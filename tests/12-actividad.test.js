'use strict';
const { test, assert, estado, ir, texto } = require('./lib');

const irActividad = async page => { await ir(page, 'habitos'); await page.click('[data-a=sub-h][data-v=actividad]'); };
const registrar = async (page, fecha, min, tipo) => {
  await page.fill('#aFecha', fecha); await page.fill('#aMin', String(min)); if (tipo) await page.selectOption('#aTipo', tipo);
  await page.click('form[data-f=aero] button[type=submit]');
};
const conAero = lista => ({ saludActivaV1: JSON.stringify({ v: 3, settings: {}, days: {}, peso: [], aero: lista }) });

test('actividad: meta de 150 min por defecto, barra de progreso y registro', async ({ abrir }) => {
  const { page, errores } = await abrir({});
  assert.strictEqual((await estado(page)).settings.aeroMeta, 150);
  await irActividad(page);
  assert.match(await texto(page), /Actividad aeróbica 0 min \/ 150 min/);
  await registrar(page, '2026-10-19', 30, 'Bicicleta');
  assert.match(await texto(page), /Actividad aeróbica 30 min \/ 150 min/);
  assert.match(await texto(page), /Te faltan 120 min para la meta/);
  assert.strictEqual(await page.locator('.meter .bar i').first().evaluate(e => e.style.width), '20%');
  assert.deepStrictEqual((await estado(page)).aero, [{ fecha: '2026-10-19', min: 30, tipo: 'Bicicleta' }]);
  await registrar(page, '2026-10-19', 120, 'Caminata rápida');
  assert.match(await texto(page), /¡Meta de la semana cumplida!/);
  assert.deepStrictEqual(errores, []);
});

test('actividad: la semana va de lunes a domingo (el domingo anterior no cuenta)', async ({ abrir }) => {
  // hoy es lunes 19/10: el domingo 18/10 pertenece a la semana anterior
  const { page } = await abrir({ ls: conAero([{ fecha: '2026-10-18', min: 60, tipo: 'Otra' }, { fecha: '2026-10-12', min: 45, tipo: 'Otra' }, { fecha: '2026-10-19', min: 20, tipo: 'Otra' }]) });
  await irActividad(page);
  assert.match(await texto(page), /Actividad aeróbica 20 min \/ 150 min/);
  const barras = await page.locator('svg.chart text.tick').allTextContents();
  assert.ok(barras.includes('105'), 'semana del 12/10 = 45 + 60'); assert.ok(barras.includes('20'));
});

test('actividad: gráfico de las últimas 8 semanas con la meta', async ({ abrir }) => {
  const { page } = await abrir({ ls: conAero([{ fecha: '2026-10-01', min: 200, tipo: 'Otra' }]) });
  await irActividad(page);
  assert.strictEqual(await page.locator('svg.chart rect.barra').count(), 8);
  assert.strictEqual(await page.locator('svg.chart rect.barra.cumple').count(), 1, 'la semana de 200 min cumple la meta');
  assert.match(await page.locator('svg.chart').textContent(), /Meta 150/);
});

test('actividad: los pasos no reemplazan los minutos', async ({ abrir }) => {
  const { page } = await abrir({ ls: { saludActivaV1: JSON.stringify({ v: 3, settings: {}, days: { '2026-10-19': { pasos: 20000, agua: 0, rutina: {}, core: {} } }, peso: [] }) } });
  await irActividad(page);
  assert.match(await texto(page), /Actividad aeróbica 0 min \/ 150 min/);
  assert.match(await texto(page), /Los pasos del día no reemplazan estos minutos/);
});

test('actividad: validaciones (minutos, fecha futura) y tipo desconocido pasa a "Otra"', async ({ abrir }) => {
  const { page } = await abrir({});
  await irActividad(page);
  await registrar(page, '2026-10-19', 0); await registrar(page, '2026-10-19', 601); await registrar(page, '2026-10-25', 30);
  assert.strictEqual((await estado(page)).aero.length, 0);
  await page.evaluate(() => { document.querySelector('#aTipo').add(new Option('<img src=x onerror=window.__xss=1>', '<img src=x onerror=window.__xss=1>')); });
  await registrar(page, '2026-10-19', 30, '<img src=x onerror=window.__xss=1>');
  const S = await estado(page);
  assert.strictEqual(S.aero[0].tipo, 'Otra');
  assert.strictEqual(await page.evaluate(() => window.__xss), undefined);
});

test('actividad: la meta semanal es configurable y se puede borrar un registro', async ({ abrir }) => {
  const { page } = await abrir({ ls: conAero([{ fecha: '2026-10-19', min: 90, tipo: 'Otra' }]), dialogos: [true] });
  await ir(page, 'ajustes'); await page.fill('#s_aeroMeta', '200'); await page.click('form[data-f=ajustes] button[type=submit]');
  await irActividad(page);
  assert.match(await texto(page), /Actividad aeróbica 90 min \/ 200 min/);
  await page.click('[data-a=del][data-k=aero]');
  assert.strictEqual((await estado(page)).aero.length, 0);
});

test('actividad: aparece en Hoy y el promedio semanal arranca en la primera semana con datos', async ({ abrir }) => {
  const lista = [{ fecha: '2026-09-29', min: 100 }, { fecha: '2026-10-06', min: 200 }, { fecha: '2026-10-13', min: 150 }, { fecha: '2026-10-19', min: 50 }].map(r => Object.assign({ tipo: 'Otra' }, r));
  const { page } = await abrir({ ls: conAero(lista) });
  assert.match(await texto(page), /Actividad de la semana 50 min \/ 150 min/);
  const inf = await page.evaluate(() => window.SA.informeCuerpo());
  assert.match(inf, /Promedio semanal: <b>125 min<\/b> \(4 semanas con registros/);
});

test('actividad: datos viejos mal formados no rompen la pantalla', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: conAero([null, { fecha: 5, min: 'x' }, { fecha: '2026-10-19', min: 30 }]) });
  await irActividad(page);
  assert.match(await texto(page), /Actividad aeróbica 30 min/);
  assert.deepStrictEqual(errores, []);
});
