'use strict';
const { test, assert, estado, ir, texto } = require('./lib');

const irComida = async page => { await ir(page, 'habitos'); await page.click('[data-a=sub-h][data-v=comida]'); };
const MIERCOLES = '2026-10-21T12:00:00';

test('comida: ítems iniciales y sin frutos secos ni chía por defecto', async ({ abrir }) => {
  const { page, errores } = await abrir({});
  const items = (await estado(page)).comida.items.map(i => i.n);
  assert.deepStrictEqual(items, ['Avena o legumbres', 'Sin frituras', 'Sin fiambres ni embutidos', 'Aceite de oliva en lugar de grasas animales']);
  const t = await texto(page) + await (async () => { await irComida(page); return texto(page); })();
  assert.doesNotMatch(items.join(' '), /fruto|chía|chia|semilla|nuez|almendra/i);
  assert.match(t, /no vienen incluidos por su contenido de oxalato/);
  assert.deepStrictEqual(errores, []);
});

test('comida: marcar y desmarcar, y el porcentaje de la semana (lunes a hoy)', async ({ abrir }) => {
  // miércoles: lunes 4/4, martes 0/4, miércoles 2/4 → 6 de 12 = 50 %
  const ls = { saludActivaV1: JSON.stringify({ v: 3, settings: {}, peso: [], days: {
    '2026-10-19': { pasos: 0, agua: 0, rutina: {}, core: {}, comida: { avena: true, frituras: true, fiambres: true, oliva: true } },
    '2026-10-20': { pasos: 0, agua: 0, rutina: {}, core: {} } } }) };
  const { page } = await abrir({ ls, fecha: MIERCOLES });
  await irComida(page);
  assert.match(await texto(page), /0 de 4/);
  await page.click('[data-a=com-t][data-id=avena]'); await page.click('[data-a=com-t][data-id=oliva]');
  assert.match(await texto(page), /50 %/);
  assert.match(await texto(page), /6 de 12 casilleros marcados en 3 días/);
  await page.click('[data-a=com-t][data-id=oliva]');
  assert.match(await texto(page), /42 %/, '5 de 12');
  assert.strictEqual(await page.getAttribute('[data-a=com-t][data-id=avena]', 'aria-pressed'), 'true');
});

test('comida: pescado azul con contador semanal y meta de 2', async ({ abrir }) => {
  const ls = { saludActivaV1: JSON.stringify({ v: 3, settings: {}, peso: [], days: { '2026-10-19': { pasos: 0, agua: 0, rutina: {}, core: {}, pescado: 1 }, '2026-10-12': { pasos: 0, agua: 0, rutina: {}, core: {}, pescado: 3 } } }) };
  const { page } = await abrir({ ls, fecha: MIERCOLES });
  await irComida(page);
  assert.match(await texto(page), /Esta semana \(veces\) 1 \/ 2/, 'la semana pasada no cuenta');
  await page.click('[data-a=pez\\+]');
  assert.match(await texto(page), /Esta semana \(veces\) 2 \/ 2/);
  await page.click('[data-a=pez\\+]'); await page.click('[data-a=pez-]'); await page.click('[data-a=pez-]'); await page.click('[data-a=pez-]'); await page.click('[data-a=pez-]');
  assert.strictEqual((await estado(page)).days['2026-10-21'].pescado, undefined, 'no baja de cero');
  await ir(page, 'ajustes'); await page.fill('#s_pescadoMeta', '3'); await page.click('form[data-f=ajustes] button[type=submit]');
  await irComida(page); assert.match(await texto(page), /Esta semana \(veces\) 1 \/ 3/);
});

test('comida: el checklist se edita en Ajustes (agregar, renombrar, quitar, restaurar)', async ({ abrir }) => {
  const { page } = await abrir({ dialogos: ['Frutos secos (autorizado por mi médico)', 'Verduras en el almuerzo', true, true] });
  await ir(page, 'ajustes');
  await page.click('[data-a=ci-add]');
  let S = await estado(page);
  assert.strictEqual(S.comida.items.length, 5); assert.strictEqual(S.comida.items[4].n, 'Frutos secos (autorizado por mi médico)');
  await page.click('[data-a=ci-ren][data-id=frituras]');
  assert.strictEqual((await estado(page)).comida.items[1].n, 'Verduras en el almuerzo');
  await page.click('[data-a=ci-del][data-id=avena]');
  S = await estado(page); assert.strictEqual(S.comida.items.length, 4); assert.ok(!S.comida.items.some(i => i.id === 'avena'));
  await page.click('[data-a=ci-reset]');
  assert.strictEqual((await estado(page)).comida.items.length, 4);
  assert.strictEqual((await estado(page)).comida.items[0].id, 'avena');
  await irComida(page);
  assert.match(await texto(page), /Avena o legumbres/);
});

test('comida: nombre vacío o cancelar no agrega nada; quitar un ítem no borra las marcas de los días', async ({ abrir }) => {
  const ls = { saludActivaV1: JSON.stringify({ v: 3, settings: {}, peso: [], days: { '2026-10-19': { pasos: 0, agua: 0, rutina: {}, core: {}, comida: { avena: true } } } }) };
  const { page } = await abrir({ ls, dialogos: ['   ', null, true] });
  await ir(page, 'ajustes');
  await page.click('[data-a=ci-add]'); await page.click('[data-a=ci-add]');
  assert.strictEqual((await estado(page)).comida.items.length, 4);
  await page.click('[data-a=ci-del][data-id=avena]');
  const S = await estado(page);
  assert.strictEqual(S.comida.items.length, 3);
  assert.deepStrictEqual(S.days['2026-10-19'].comida, { avena: true });
  await irComida(page);
  assert.match(await texto(page), /0 de 3/, 'los ítems quitados ya no cuentan');
});

test('comida: texto del usuario escapado (XSS) y largo máximo', async ({ abrir }) => {
  const malo = '<img src=x onerror="window.__xss=1"> ' + 'x'.repeat(200);
  const { page } = await abrir({ dialogos: [malo] });
  await ir(page, 'ajustes'); await page.click('[data-a=ci-add]');
  await irComida(page);
  assert.strictEqual(await page.evaluate(() => window.__xss), undefined);
  assert.strictEqual(await page.locator('#view img').count(), 0);
  const n = (await estado(page)).comida.items[4].n;
  assert.ok(n.length <= 80); assert.ok(n.startsWith('<img'));
  const inf = await page.evaluate(() => window.SA.informeCuerpo());
  assert.ok(!inf.includes('<img src=x'), 'escapado también en el informe');
});

test('comida: aparece en Hoy', async ({ abrir }) => {
  const { page } = await abrir({});
  assert.match(await texto(page), /Alimentación de hoy 0 \/ 4/);
  await irComida(page); await page.click('[data-a=com-t][data-id=avena]');
  await ir(page, 'hoy');
  assert.match(await texto(page), /Alimentación de hoy 1 \/ 4/);
});
