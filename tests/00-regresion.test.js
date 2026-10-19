'use strict';
// Comportamiento que ya existía antes de las novedades de colesterol, actividad y alimentación.
const { test, assert, estado, ir, texto } = require('./lib');

const TABS = ['hoy', 'pasos', 'espalda', 'salud', 'ajustes'];

test('todas las pestañas y subpestañas de Salud se muestran sin errores', async ({ abrir }) => {
  const { page, errores } = await abrir({});
  for (const t of TABS) { await ir(page, t); assert.ok((await texto(page)).length > 50, t); }
  await ir(page, 'salud');
  for (const v of ['presion', 'peso', 'colesterol', 'spo2', 'agua']) { await page.click(`[data-a=sub][data-v=${v}]`); assert.ok((await texto(page)).length > 50, v); }
  assert.deepStrictEqual(errores, []);
});

test('presión: guarda, avisa por encima del umbral y en crisis (≥180/120)', async ({ abrir }) => {
  const { page } = await abrir({});
  await ir(page, 'salud');
  await page.fill('#pSis', '128'); await page.fill('#pDia', '82'); await page.click('form[data-f=presion] button[type=submit]');
  assert.doesNotMatch(await texto(page), /por encima del umbral/);
  await page.fill('#pSis', '150'); await page.fill('#pDia', '95'); await page.click('form[data-f=presion] button[type=submit]');
  assert.match(await texto(page), /por encima del umbral/);
  await page.fill('#pSis', '185'); await page.fill('#pDia', '110'); await page.click('form[data-f=presion] button[type=submit]');
  assert.match(await texto(page), /atención médica de urgencia/);
  assert.strictEqual((await estado(page)).presion.length, 3);
  await page.fill('#pSis', '80'); await page.fill('#pDia', '90'); await page.click('form[data-f=presion] button[type=submit]');
  assert.strictEqual((await estado(page)).presion.length, 3, 'valores inválidos no se guardan');
});

test('peso, saturación y colesterol: se guardan y se borran', async ({ abrir }) => {
  const { page } = await abrir({ dialogos: [true, true, true] });
  await ir(page, 'salud');
  await page.click('[data-a=sub][data-v=peso]'); await page.fill('#wKg', '89.4'); await page.click('form[data-f=peso] button[type=submit]');
  await page.click('[data-a=sub][data-v=spo2]'); await page.fill('#oSat', '97'); await page.click('form[data-f=spo2] button[type=submit]');
  await page.click('[data-a=sub][data-v=colesterol]'); await page.fill('#cLdl', '150'); await page.click('form[data-f=colesterol] button[type=submit]');
  let S = await estado(page);
  assert.strictEqual(S.peso.length, 1); assert.strictEqual(S.spo2.length, 1); assert.strictEqual(S.colesterol.length, 1);
  await page.click('[data-a=del][data-k=colesterol]'); await page.click('[data-a=sub][data-v=spo2]'); await page.click('[data-a=del][data-k=spo2]');
  await page.click('[data-a=sub][data-v=peso]'); await page.click('[data-a=del][data-k=peso]');
  S = await estado(page);
  assert.strictEqual(S.peso.length + S.spo2.length + S.colesterol.length, 0);
});

test('saturación bajo el umbral avisa; el umbral es configurable', async ({ abrir }) => {
  const { page } = await abrir({});
  await ir(page, 'salud'); await page.click('[data-a=sub][data-v=spo2]');
  await page.fill('#oSat', '90'); await page.click('form[data-f=spo2] button[type=submit]');
  assert.match(await texto(page), /por debajo del umbral/);
  await ir(page, 'ajustes'); await page.fill('#s_spo2Min', '88'); await page.click('form[data-f=ajustes] button[type=submit]');
  await ir(page, 'hoy'); assert.doesNotMatch(await texto(page), /por debajo del umbral/);
});

test('pasos manuales: sumar y fijar', async ({ abrir }) => {
  const { page } = await abrir({});
  await ir(page, 'pasos');
  await page.fill('#pasosInput', '3500'); await page.click('[data-a=pasos-add]');
  await page.fill('#pasosInput', '1000'); await page.click('[data-a=pasos-add]');
  assert.strictEqual(await page.innerText('#pasosNum'), '4500');
  await page.fill('#pasosInput', '2000'); await page.click('[data-a=pasos-set]');
  assert.strictEqual(await page.innerText('#pasosNum'), '2000');
});

test('rutina: sin tope, escribir el número exacto, +5 y cambiar la meta', async ({ abrir }) => {
  const { page } = await abrir({ dialogos: ['30', '12'] });
  await ir(page, 'hoy');
  await page.click('[data-a=r-set][data-id=brazos]');
  let S = await estado(page); assert.strictEqual(S.days['2026-10-19'].rutina.brazos, 30, 'se pasa de la meta de 10');
  await page.click('[data-a="r+5"][data-id=brazos]');
  S = await estado(page); assert.strictEqual(S.days['2026-10-19'].rutina.brazos, 35);
  await page.click('[data-a=meta-r][data-id=brazos]');
  S = await estado(page); assert.strictEqual(S.plan.brazos.meta, 12);
  assert.match(await texto(page), /35\/12/);
});

test('espalda: agenda, "lo hice todo", "no pude hoy", pendientes y reparto (máx. 1 extra por sesión)', async ({ abrir }) => {
  const ayer = '2026-10-18'; // domingo; agenda de prueba: todos los días
  const ls = { saludActivaV1: JSON.stringify({ v: 3, settings: { agCoreDias: [0, 1, 2, 3, 4, 5, 6], agDesde: '2026-10-18' }, days: { [ayer]: { pasos: 0, agua: 0, rutina: {}, core: { gato: 2, bird: 1 } } }, peso: [] }) };
  const { page } = await abrir({ ls });
  await ir(page, 'espalda');
  assert.match(await texto(page), /Pendientes de días anteriores/);
  await page.click('[data-a=pend-repartir]');
  let S = await estado(page);
  assert.strictEqual(S.recup.bird, 1); assert.strictEqual(S.recup.puente, 2); assert.ok(S.cerrados[ayer]);
  assert.match(await texto(page), /1 serie extra de recuperación/);
  await page.click('[data-a=core-todo]');
  S = await estado(page);
  assert.strictEqual(S.days['2026-10-19'].core.puente, 3, 'meta 2 + 1 extra');
  assert.strictEqual(S.recup.puente, 1, 'se descuenta la extra hecha');
  await page.click('[data-a=core-no]'); S = await estado(page);
  assert.ok(S.days['2026-10-19'].omitido);
});

test('agenda: se programan notificaciones semanales y se conserva el aviso de mañana (3500)', async ({ abrir }) => {
  const { page } = await abrir({ native: { LocalNotifications: { getPending: '() => ({notifications:[{id:3500},{id:1000}]})' } } });
  await page.waitForTimeout(300);
  const ll = await page.evaluate(() => window.__llamadas);
  const cancel = ll.find(x => x[1] === 'cancel'), sch = ll.find(x => x[1] === 'schedule');
  assert.deepStrictEqual(JSON.parse(cancel[2])[0].notifications.map(n => n.id), [1000]);
  const ids = JSON.parse(sch[2])[0].notifications.map(n => n.id);
  assert.ok(ids.includes(3000) && ids.includes(3101) && ids.includes(3201) && ids.includes(3301));
  const lun = JSON.parse(sch[2])[0].notifications.find(n => n.id === 3101);
  assert.deepStrictEqual(lun.schedule.on, { weekday: 2, hour: 18, minute: 0 });
});

test('sensor de pasos (Android): reparte por día, detecta reinicio y respeta el botón de segundo plano', async ({ abrir }) => {
  const ahora = Date.parse('2026-10-19T12:00:00'), ayer = ahora - 26 * 3600e3;
  const ls = { saludActivaV1: JSON.stringify({ v: 3, settings: {}, days: {}, peso: [], sensor: { last: 1000, t: ayer - 1000 } }) };
  let ctr = 1560;
  const { page } = await abrir({
    ls, native: {
      StepCounter: {
        isAvailable: '() => ({available:true})', hasPermission: '() => ({granted:true})',
        drain: `() => ({readings:[{t:${ayer},c:1100,b:0},{t:${ayer + 900e3},c:1300,b:0},{t:${ahora - 900e3},c:1500,b:0}]})`,
        read: `() => ({counter:${ctr},bootTime:0})`, startBackground: '() => ({})', stopBackground: '() => ({})'
      }
    }
  });
  await page.waitForTimeout(300);
  let S = await estado(page);
  assert.strictEqual(S.days['2026-10-18'].pasos, 300); assert.strictEqual(S.days['2026-10-19'].pasos, 260);
  await ir(page, 'pasos');
  await page.click('[data-a=bg-toggle]');
  const ll = await page.evaluate(() => window.__llamadas.map(x => x[1]));
  assert.ok(ll.includes('stopBackground'));
  assert.strictEqual((await estado(page)).settings.segundoPlano, false);
});

test('Health Connect (Android): los permisos llegan como objeto y los pasos se importan', async ({ abrir }) => {
  const { page } = await abrir({
    native: {
      HealthPlugin: {
        isHealthAvailable: '() => ({available:true})', checkHealthPermissions: '() => ({permissions:{READ_STEPS:false}})',
        requestHealthPermissions: '() => ({permissions:{READ_STEPS:true}})',
        queryAggregated: `() => ({aggregatedData:[{startDate:new Date(2026,9,19).toISOString(),endDate:new Date().toISOString(),value:4321.4}]})`
      }
    }
  });
  await ir(page, 'pasos'); await page.click('[data-a=health-sync]'); await page.waitForTimeout(300);
  assert.strictEqual((await estado(page)).days['2026-10-19'].pasos, 4321);
});

test('seguridad: el texto del usuario se escapa (sin XSS)', async ({ abrir }) => {
  const { page } = await abrir({});
  await ir(page, 'ajustes');
  await page.fill('#s_notas', '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>');
  await page.click('form[data-f=ajustes] button[type=submit]');
  await ir(page, 'espalda'); await page.waitForTimeout(150);
  assert.strictEqual(await page.evaluate(() => window.__xss), undefined);
  assert.strictEqual(await page.locator('#view img[src="x"]').count(), 0);
  assert.match(await texto(page), /<img src=x/);
});

test('botones táctiles de al menos 44 px en todas las pantallas', async ({ abrir }) => {
  const { page } = await abrir({ ls: { saludActivaV1: JSON.stringify({ v: 3, settings: {}, days: {}, peso: [{ fecha: '2026-10-01', kg: 90 }], colesterol: [{ fecha: '2026-09-01', ldl: 150 }] }) } });
  const chicos = () => page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, select, textarea, input:not([type=hidden]):not([type=checkbox]), label:has(input[type=checkbox]), #nav button').forEach(el => {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
      if (r.height < 43.5 || r.width < 43.5) out.push((el.dataset.a || el.name || el.id || el.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    });
    return out;
  });
  for (const t of ['hoy', 'pasos', 'espalda', 'salud', 'ajustes']) { await ir(page, t); { const c = await chicos(); assert.strictEqual(c.join(' | '), '', 'pantalla ' + t); }; }
  await ir(page, 'salud');
  for (const v of ['presion', 'peso', 'colesterol', 'spo2', 'agua']) { await page.click(`[data-a=sub][data-v=${v}]`); { const c = await chicos(); assert.strictEqual(c.join(' | '), '', 'salud/' + v); }; }
});
