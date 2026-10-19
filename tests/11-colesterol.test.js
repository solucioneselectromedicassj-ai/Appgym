'use strict';
const { test, assert, estado, ir, texto } = require('./lib');

const datos = (extra = {}) => ({ saludActivaV1: JSON.stringify(Object.assign({ v: 3, settings: {}, days: {}, peso: [], colesterol: [
  { fecha: '2026-06-10', total: 260, ldl: 179, hdl: 40, tg: 200 },
  { fecha: '2026-08-10', ldl: 150 },
  { fecha: '2026-10-01', total: 230, ldl: 130, hdl: 45 }] }, extra)) });
const irColesterol = async page => { await ir(page, 'salud'); await page.click('[data-a=sub][data-v=colesterol]'); };

test('colesterol: variación porcentual contra el análisis anterior de cada valor', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: datos() });
  await irColesterol(page);
  const t = await texto(page);
  // LDL 130 vs 150 = -13,3 %; HDL 45 vs 40 = +12,5 %; total 230 vs 260 = -11,5 %; TG solo tiene un valor
  assert.match(t, /LDL 130 150 ▼ 13,3 %/);
  assert.match(t, /HDL 45 40 ▲ 12,5 %/);
  assert.match(t, /Colesterol total 230 260 ▼ 11,5 %/);
  assert.match(t, /Triglicéridos 200 — —/);
  // en la lista cada análisis muestra su variación contra el anterior que tenía ese valor
  assert.match(t, /01\/10\/2026 · Total 230 \(▼ 11,5 %\) · LDL 130 \(▼ 13,3 %\) · HDL 45 \(▲ 12,5 %\)/);
  assert.match(t, /10\/08\/2026 · LDL 150 \(▼ 16,2 %\)/);
  assert.match(t, /10\/06\/2026 · Total 260 · LDL 179 · HDL 40 · TG 200/);
  assert.deepStrictEqual(errores, []);
});

test('colesterol: la meta de LDL no tiene valor por defecto y se configura en Ajustes', async ({ abrir }) => {
  const { page } = await abrir({ ls: datos() });
  assert.strictEqual((await estado(page)).settings.ldlMeta, null);
  await ir(page, 'ajustes');
  assert.strictEqual(await page.inputValue('#s_ldlMeta'), '');
  await irColesterol(page);
  assert.match(await texto(page), /Todavía no cargaste una meta de LDL/);
  assert.strictEqual(await page.locator('svg.chart .goal').count(), 0, 'sin meta no hay línea');
});

test('colesterol: con meta se dibuja la línea y se calcula cuánto falta', async ({ abrir }) => {
  const { page } = await abrir({ ls: datos({ settings: { ldlMeta: 100 } }) });
  await irColesterol(page);
  assert.strictEqual(await page.locator('svg.chart .goal').count(), 1);
  assert.match(await page.locator('svg.chart').textContent(), /Meta 100/);
  assert.match(await texto(page), /Último LDL: 130 mg\/dL · Meta de tu médico: 100 mg\/dL · te faltan 30 mg\/dL/);
  // por debajo de la meta
  const b = await abrir({ ls: datos({ settings: { ldlMeta: 140 } }) });
  await irColesterol(b.page);
  assert.match(await texto(b.page), /estás en la meta o por debajo/);
  // las otras variables no dibujan la meta de LDL
  await b.page.click('[data-a=sub-c][data-v=hdl]');
  assert.strictEqual(await b.page.locator('svg.chart .goal').count(), 0);
});

test('colesterol: la meta se valida y se puede borrar', async ({ abrir }) => {
  const { page } = await abrir({ ls: datos() });
  await ir(page, 'ajustes');
  await page.fill('#s_ldlMeta', '500'); await page.click('form[data-f=ajustes] button[type=submit]');
  assert.strictEqual((await estado(page)).settings.ldlMeta, null);
  await page.fill('#s_ldlMeta', '100'); await page.click('form[data-f=ajustes] button[type=submit]');
  assert.strictEqual((await estado(page)).settings.ldlMeta, 100);
  await ir(page, 'ajustes'); await page.fill('#s_ldlMeta', ''); await page.click('form[data-f=ajustes] button[type=submit]');
  assert.strictEqual((await estado(page)).settings.ldlMeta, null);
});

test('colesterol: carga por fecha de LDL, HDL, total y TG, con validación y mezcla por fecha', async ({ abrir }) => {
  const { page } = await abrir({});
  await irColesterol(page);
  const guardar = () => page.click('form[data-f=colesterol] button[type=submit]');
  await page.fill('#cFecha', '2026-10-10'); await page.fill('#cLdl', '179'); await page.fill('#cHdl', '42'); await page.fill('#cTot', '255'); await page.fill('#cTg', '190'); await guardar();
  let S = await estado(page);
  assert.deepStrictEqual(S.colesterol, [{ fecha: '2026-10-10', ldl: 179, hdl: 42, total: 255, tg: 190 }]);
  // la misma fecha completa el análisis en vez de duplicarlo
  await page.fill('#cFecha', '2026-10-10'); await page.fill('#cLdl', '175'); await guardar();
  S = await estado(page);
  assert.strictEqual(S.colesterol.length, 1); assert.strictEqual(S.colesterol[0].ldl, 175); assert.strictEqual(S.colesterol[0].hdl, 42);
  // validaciones
  await page.fill('#cFecha', '2026-10-11'); await page.fill('#cLdl', '5'); await guardar();
  await page.fill('#cLdl', ''); await guardar();                                   // sin valores
  await page.fill('#cFecha', '2026-12-25'); await page.fill('#cLdl', '150'); await guardar(); // fecha futura
  assert.strictEqual((await estado(page)).colesterol.length, 1, 'nada inválido se guardó');
  // solo algunos valores
  await page.fill('#cFecha', '2026-10-12'); await page.fill('#cLdl', ''); await page.fill('#cTg', '160'); await guardar();
  assert.strictEqual((await estado(page)).colesterol.length, 2);
});

test('colesterol: se puede elegir qué valor graficar', async ({ abrir }) => {
  const { page } = await abrir({ ls: datos() });
  await irColesterol(page);
  for (const [v, n] of [['ldl', 'Evolución de LDL'], ['hdl', 'Evolución de HDL'], ['total', 'Evolución de Colesterol total'], ['tg', 'Evolución de Triglicéridos']]) {
    await page.click(`[data-a=sub-c][data-v=${v}]`);
    assert.strictEqual(await page.getAttribute('svg.chart', 'aria-label'), n);
  }
});

/* ---- Aviso de nuevo análisis (punto 4) ---- */
const conAnalisis = (fecha, hoyISO) => ({ ls: { saludActivaV1: JSON.stringify({ v: 3, settings: {}, days: {}, peso: [], colesterol: [{ fecha, ldl: 160 }] }) }, fecha: hoyISO || '2026-10-19T12:00:00' });

test('aviso de análisis: aparece desde 14 días antes de los 2 meses (14 sí, 15 no)', async ({ abrir }) => {
  // 02/09 + 2 meses = 02/11 → faltan 14 días desde el 19/10
  let x = await abrir(conAnalisis('2026-09-02'));
  assert.match(await texto(x.page), /Faltan 14 días para el momento sugerido de repetir tu análisis de colesterol: entre el 02\/11\/2026 y el 02\/12\/2026/);
  // 03/09 + 2 meses = 03/11 → faltan 15 días: no avisa
  x = await abrir(conAnalisis('2026-09-03'));
  assert.doesNotMatch(await texto(x.page), /Nuevo análisis de colesterol/);
  // 20/09 → faltan 32
  x = await abrir(conAnalisis('2026-09-20'));
  assert.doesNotMatch(await texto(x.page), /Nuevo análisis de colesterol/);
});

test('aviso de análisis: dentro de la ventana, vencido y singular', async ({ abrir }) => {
  let x = await abrir(conAnalisis('2026-08-10'));   // ventana 10/10–10/11
  assert.match(await texto(x.page), /Ya es momento de repetir tu análisis de colesterol \(entre el 10\/10\/2026 y el 10\/11\/2026\)/);
  x = await abrir(conAnalisis('2026-06-01'));       // pasó el 01/09
  assert.match(await texto(x.page), /Pasó el plazo sugerido \(hasta el 01\/09\/2026\)/);
  x = await abrir(conAnalisis('2026-09-06'));       // 06/11 → faltan 18: no. 
  assert.doesNotMatch(await texto(x.page), /Nuevo análisis/);
  x = await abrir(conAnalisis('2026-09-05', '2026-11-04T12:00:00')); // 05/11 → falta 1 día
  assert.match(await texto(x.page), /Falta 1 día para el momento sugerido/);
});

test('aviso de análisis: aclara que solo aparece con la app abierta (Hoy y Colesterol)', async ({ abrir }) => {
  const { page } = await abrir(conAnalisis('2026-08-10'));
  assert.match(await texto(page), /Este aviso solo aparece cuando abrís la app\./);
  await irColesterol(page);
  assert.match(await texto(page), /Próximo análisis sugerido.*Este aviso solo aparece cuando abrís la app\./);
});

test('aviso de análisis: no desborda meses cortos y se calcula desde el último análisis', async ({ abrir }) => {
  // 31/12 + 2 meses = 28/02 (no 03/03) y + 3 = 31/03
  let x = await abrir(conAnalisis('2026-12-31', '2026-12-31T12:00:00'));
  await irColesterol(x.page);
  assert.match(await texto(x.page), /Entre el 28\/02\/2027 y el 31\/03\/2027/);
  // año bisiesto: 31/12/2027 + 2 meses = 29/02/2028
  x = await abrir(conAnalisis('2027-12-31', '2027-12-31T12:00:00'));
  await irColesterol(x.page);
  assert.match(await texto(x.page), /Entre el 29\/02\/2028/);
  // varios análisis: manda el de fecha más reciente, aunque se haya cargado antes
  const ls = { saludActivaV1: JSON.stringify({ v: 3, settings: {}, days: {}, peso: [], colesterol: [{ fecha: '2026-10-01', ldl: 140 }, { fecha: '2026-03-01', ldl: 180 }] }) };
  x = await abrir({ ls });
  assert.doesNotMatch(await texto(x.page), /Nuevo análisis de colesterol/, 'el más reciente (01/10) todavía no vence');
});

test('aviso de análisis: al cargar uno nuevo desaparece y se informa la fecha para repetirlo', async ({ abrir }) => {
  const { page } = await abrir(conAnalisis('2026-06-01'));
  assert.match(await texto(page), /Pasó el plazo/);
  await irColesterol(page);
  await page.fill('#cFecha', '2026-10-19'); await page.fill('#cLdl', '140'); await page.click('form[data-f=colesterol] button[type=submit]');
  assert.match(await page.innerText('#toast'), /Repetilo entre el 19\/12\/2026 y el 19\/01\/2027/);
  await ir(page, 'hoy');
  assert.doesNotMatch(await texto(page), /Nuevo análisis de colesterol/);
});

test('aviso de análisis: sin análisis cargados no hay aviso', async ({ abrir }) => {
  const { page } = await abrir({});
  assert.doesNotMatch(await texto(page), /Nuevo análisis de colesterol/);
  await irColesterol(page);
  assert.doesNotMatch(await texto(page), /Próximo análisis sugerido/);
});
