'use strict';
const fs = require('fs');
const path = require('path');
const { test, assert, estado, ir, texto } = require('./lib');

const RAIZ = path.join(__dirname, '..');
const completo = () => ({ saludActivaV1: JSON.stringify({
  v: 3, settings: { ldlMeta: 100, aeroMeta: 150 }, days: { '2026-10-19': { pasos: 100, agua: 0, rutina: {}, core: {}, comida: { avena: true }, pescado: 1 } },
  peso: [{ fecha: '2026-10-15', kg: 89 }], colesterol: [{ fecha: '2026-06-10', total: 260, ldl: 179, hdl: 40, tg: 200 }, { fecha: '2026-10-01', ldl: 130 }],
  aero: [{ fecha: '2026-10-19', min: 40, tipo: 'Bicicleta' }], comida: { items: [{ id: 'avena', n: 'Avena o legumbres' }, { id: 'x1', n: 'Verduras' }] } }) });

test('respaldo: ida y vuelta con los datos nuevos (colesterol, actividad, checklist) sin pérdidas', async ({ abrir }) => {
  const a = await abrir({ ls: completo() });
  await ir(a.page, 'ajustes');
  const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('[data-a=export]')]);
  const archivo = fs.readFileSync(await dl.path());
  const original = await estado(a.page);
  const b = await abrir({});
  await ir(b.page, 'ajustes');
  await b.page.setInputFiles('#fileIn', { name: 'r.json', mimeType: 'application/json', buffer: archivo });
  await b.page.waitForTimeout(300);
  const copia = await estado(b.page);
  for (const k of ['colesterol', 'aero', 'comida', 'peso', 'days']) assert.deepStrictEqual(copia[k], original[k], k);
  assert.strictEqual(copia.settings.ldlMeta, 100);
  await ir(b.page, 'habitos');
  assert.match(await texto(b.page), /Actividad aeróbica 40 min/);
});

test('datos de una versión vieja + uso de las novedades: todo lo anterior sigue ahí', async ({ abrir }) => {
  const viejo = { v: 1, settings: { pesoObj: 88 }, days: { '2026-10-15': { pasos: 5000, agua: 1500, rutina: {}, core: {} } }, peso: [{ fecha: '2026-10-01', kg: 90.5 }], presion: [], colesterol: [{ fecha: '2026-08-10', total: 260, ldl: 179, hdl: 45, tg: 180 }], dolor: {} };
  const { page } = await abrir({ ls: { saludActivaV1: JSON.stringify(viejo) } });
  await ir(page, 'habitos'); await page.fill('#aMin', '30'); await page.click('form[data-f=aero] button[type=submit]');
  await page.click('[data-a=sub-h][data-v=comida]'); await page.click('[data-a=com-t][data-id=avena]');
  await ir(page, 'salud'); await page.click('[data-a=sub][data-v=colesterol]');
  await page.fill('#cFecha', '2026-10-10'); await page.fill('#cLdl', '150'); await page.click('form[data-f=colesterol] button[type=submit]');
  await page.reload(); await page.waitForFunction(() => window.SA);
  const S = await estado(page);
  assert.deepStrictEqual(S.colesterol[0], viejo.colesterol[0]);
  assert.strictEqual(S.colesterol.length, 2);
  assert.deepStrictEqual(S.days['2026-10-15'], viejo.days['2026-10-15']);
  assert.deepStrictEqual(S.peso, viejo.peso);
  assert.strictEqual(S.aero.length, 1); assert.deepStrictEqual(S.days['2026-10-19'].comida, { avena: true });
  assert.strictEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('saludActivaV1_antes_v3'))).colesterol.length, 1, 'la copia previa sigue con el formato viejo');
});

test('service worker: caché v3, todos los archivos existen y la app funciona sin conexión', async ({ abrir }) => {
  const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
  assert.match(sw, /const CACHE = 'salud-activa-v3'/);
  const assets = eval(sw.match(/const ASSETS = (\[.*?\]);/)[1]).filter(a => a !== './');
  assets.forEach(a => assert.ok(fs.existsSync(path.join(RAIZ, a)), 'falta ' + a));
  const build = fs.readFileSync(path.join(RAIZ, 'scripts/build-web.js'), 'utf8');
  assets.forEach(a => assert.ok(build.includes(`'${a}'`), 'build-web no copia ' + a));
  const { page, ctx, errores } = await abrir({ ls: completo() });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller || true);
  await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller);
  await ctx.setOffline(true);
  await page.reload(); await page.waitForFunction(() => window.SA);
  await ir(page, 'habitos');
  assert.match(await texto(page), /Actividad aeróbica 40 min/);
  assert.deepStrictEqual(errores.filter(e => !/Failed to load resource|net::ERR/.test(e)), []);
});

test('navegación: seis pestañas, con Hábitos, todas visibles en 360 px', async ({ abrir }) => {
  const { page } = await abrir({});
  const bs = await page.locator('#nav button').evaluateAll(els => els.map(e => ({ t: e.innerText.trim(), x: e.getBoundingClientRect().right, w: e.getBoundingClientRect().width })));
  assert.deepStrictEqual(bs.map(b => b.t.replace(/^\S+\s*/, '')), ['Hoy', 'Pasos', 'Espalda', 'Hábitos', 'Salud', 'Ajustes']);
  assert.ok(bs.every(b => b.x <= 360.5 && b.w >= 44));
});

test('44 px en Hábitos (actividad y alimentación), Ajustes con checklist y Colesterol con datos', async ({ abrir }) => {
  const { page } = await abrir({ ls: completo() });
  const chicos = () => page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, select, textarea, input:not([type=hidden]):not([type=checkbox]), label:has(input[type=checkbox])').forEach(el => {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
      if (r.height < 43.5 || r.width < 43.5) out.push((el.dataset.a || el.name || el.id || el.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    });
    return out.join(' | ');
  });
  await ir(page, 'habitos'); assert.strictEqual(await chicos(), '', 'actividad');
  await page.click('[data-a=sub-h][data-v=comida]'); assert.strictEqual(await chicos(), '', 'comida');
  await ir(page, 'ajustes'); assert.strictEqual(await chicos(), '', 'ajustes');
  await ir(page, 'salud'); await page.click('[data-a=sub][data-v=colesterol]'); assert.strictEqual(await chicos(), '', 'colesterol');
  for (const v of ['hdl', 'total', 'tg']) { await page.click(`[data-a=sub-c][data-v=${v}]`); assert.strictEqual(await chicos(), '', v); }
});

test('sin desbordes horizontales en 360 px', async ({ abrir }) => {
  const { page } = await abrir({ ls: completo() });
  const ancho = () => page.evaluate(() => document.documentElement.scrollWidth);
  for (const t of ['hoy', 'pasos', 'espalda', 'habitos', 'salud', 'ajustes']) { await ir(page, t); assert.ok(await ancho() <= 361, t + ' ' + await ancho()); }
  await ir(page, 'habitos'); await page.click('[data-a=sub-h][data-v=comida]'); assert.ok(await ancho() <= 361, 'comida');
});
