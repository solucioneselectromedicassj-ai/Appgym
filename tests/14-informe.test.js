'use strict';
const { test, assert, ir } = require('./lib');

const datos = () => ({ saludActivaV1: JSON.stringify({
  v: 3, settings: { ldlMeta: 100, notas: 'Control en diciembre <b>x</b>' },
  days: { '2026-10-19': { pasos: 0, agua: 0, rutina: {}, core: {}, comida: { avena: true, frituras: true }, pescado: 1 },
    '2026-10-12': { pasos: 0, agua: 0, rutina: {}, core: {}, comida: { avena: true, frituras: true, fiambres: true, oliva: true }, pescado: 2 } },
  peso: [{ fecha: '2026-10-15', kg: 89.2 }], presion: [{ ts: Date.parse('2026-10-18T09:00:00'), sis: 128, dia: 82, pul: 70 }],
  colesterol: [{ fecha: '2026-06-10', total: 260, ldl: 179, hdl: 40, tg: 200 }, { fecha: '2026-10-01', total: 230, ldl: 130, hdl: 45, tg: 150 }],
  aero: [{ fecha: '2026-10-12', min: 150, tipo: 'Caminata rápida' }, { fecha: '2026-10-19', min: 50, tipo: 'Bicicleta' }] }) });

test('informe: incluye evolución de colesterol, actividad, checklist, presión y peso', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: datos() });
  const html = await page.evaluate(() => window.SA.informeCuerpo());
  const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(t, /Meta de LDL fijada por el médico: 100 mg\/dL/);
  assert.match(t, /Repetir el análisis entre el 01\/12\/2026 y el 01\/01\/2027/);
  assert.match(t, /01\/10\/2026 130 \(▼ 27,4 %\) 45 \(▲ 12,5 %\) 230 \(▼ 11,5 %\) 150 \(▼ 25,0 %\)/);
  assert.match(t, /10\/06\/2026 179 40 260 200/);
  assert.match(html, /<svg[^>]*aria-label="Evolución del LDL"/);
  assert.match(html, /class="goal"/);
  assert.match(t, /Promedio semanal: 100 min \(2 semanas con registros, incluida la actual\) · meta 150 min/);
  assert.match(t, /Semana del 12\/10 14 % 2 de 2/, '4 casilleros de 28 (los días sin marcar cuentan como no cumplidos)');
  assert.match(t, /Semana del 19\/10 50 % 1 de 2/);
  assert.match(t, /128\/82/); assert.match(t, /89.2/);
  assert.ok(html.includes('Control en diciembre &lt;b&gt;x&lt;/b&gt;'), 'las indicaciones del médico están escapadas');
  assert.deepStrictEqual(errores, []);
});

test('informe: sin datos no falla y avisa que no hay registros', async ({ abrir }) => {
  const { page, errores } = await abrir({});
  const t = (await page.evaluate(() => window.SA.informeCuerpo())).replace(/<[^>]+>/g, ' ');
  assert.match(t, /Meta de LDL: sin fijar/); assert.match(t, /Sin registros de actividad/); assert.match(t, /Sin registros/);
  assert.deepStrictEqual(errores, []);
});

test('informe (web): se arma en #informe y se imprime', async ({ abrir }) => {
  const { page } = await abrir({ ls: datos() });
  await page.evaluate(() => { window.print = () => { window.__impreso = document.querySelector('#informe').innerText; }; });
  await ir(page, 'ajustes'); await page.click('[data-a=informe]');
  const t = await page.evaluate(() => window.__impreso);
  assert.match(t, /Informe de salud — 19\/10\/2026/); assert.match(t, /Actividad aeróbica/); assert.match(t, /Alimentación \(checklist\)/);
});

test('informe (Android): se comparte como archivo HTML autónomo', async ({ abrir }) => {
  const { page } = await abrir({ native: true, ls: datos() });
  await ir(page, 'ajustes'); await page.click('[data-a=informe]'); await page.waitForTimeout(200);
  const ll = await page.evaluate(() => window.__llamadas.filter(x => x[0] === 'Filesystem' || x[0] === 'Share'));
  const w = JSON.parse(ll.find(x => x[1] === 'writeFile')[2])[0];
  assert.strictEqual(w.path, 'informe-salud-2026-10-19.html');
  assert.match(w.data, /^<!doctype html>/); assert.match(w.data, /<style>/); assert.match(w.data, /Evolución del LDL/);
  assert.ok(ll.find(x => x[1] === 'share'));
});
