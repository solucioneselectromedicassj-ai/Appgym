'use strict';
const { test, assert, estado, ir, texto, lsGet } = require('./lib');

// Datos como los guardaba la versión original (v1): sin spo2, plan, agenda, etc.
const V1 = {
  v: 1,
  settings: { pesoObj: 88, pesoTol: 1.5, metaPasos: 8000, metaAgua: 2500, vaso: 250, umbral: 1.3, pSis: 140, pDia: 90, recAgua: true, recMin: 90, notas: 'Evitar cargas' },
  days: { '2026-10-15': { pasos: 5000, agua: 1500, rutina: { giros: 30 }, core: { gato: 2 } }, '2026-10-16': { pasos: 7100, agua: 2500, rutina: {}, core: {} } },
  peso: [{ fecha: '2026-10-01', kg: 90.5 }, { fecha: '2026-10-15', kg: 89.2 }],
  presion: [{ ts: 1790000000000, sis: 128, dia: 82, pul: 70 }],
  colesterol: [{ fecha: '2026-08-10', total: 260, ldl: 179, hdl: 45, tg: 180 }, { fecha: '2026-09-20', ldl: 160 }],
  dolor: { gato: true }
};
const V2 = Object.assign({}, V1, { v: 2, spo2: [{ ts: 1790000100000, spo2: 96, pul: 72 }], plan: { giros: { meta: 20 } }, cerrados: { '2026-10-12': true }, recup: { gato: 2 }, sensor: { last: 1234, t: 1790000200000 } });

test('migración: datos v1 se conservan íntegros y se deja copia previa', async ({ abrir }) => {
  const raw = JSON.stringify(V1);
  const { page, errores } = await abrir({ ls: { saludActivaV1: raw } });
  const S = await estado(page);
  assert.deepStrictEqual(S.peso, V1.peso);
  assert.deepStrictEqual(S.presion, V1.presion);
  assert.deepStrictEqual(S.colesterol, V1.colesterol);
  assert.deepStrictEqual(S.days, V1.days);
  assert.deepStrictEqual(S.dolor, V1.dolor);
  assert.strictEqual(S.settings.notas, 'Evitar cargas');
  assert.strictEqual(S.settings.recAgua, true);
  assert.strictEqual(S.v, 3);
  // campos nuevos con sus valores iniciales
  assert.deepStrictEqual(S.aero, []);
  assert.strictEqual(S.settings.aeroMeta, 150);
  assert.strictEqual(S.settings.ldlMeta, null);
  assert.strictEqual(S.comida.items.length, 4);
  // copia previa idéntica al original
  assert.strictEqual(await lsGet(page, 'saludActivaV1_antes_v3'), raw);
  assert.deepStrictEqual(errores, []);
});

test('migración: la copia previa no se pisa al guardar ni al recargar', async ({ abrir }) => {
  const raw = JSON.stringify(V1);
  const { page } = await abrir({ ls: { saludActivaV1: raw } });
  await ir(page, 'ajustes'); await page.click('form[data-f=ajustes] button[type=submit]');
  await page.reload(); await page.waitForFunction(() => window.SA);
  assert.strictEqual(await lsGet(page, 'saludActivaV1_antes_v3'), raw);
  const S = await estado(page);
  assert.strictEqual(S.peso.length, 2);
});

test('migración: datos v2 (spo2, plan, recup, sensor) siguen intactos', async ({ abrir }) => {
  const { page } = await abrir({ ls: { saludActivaV1: JSON.stringify(V2) } });
  const S = await estado(page);
  assert.deepStrictEqual(S.spo2, V2.spo2); assert.deepStrictEqual(S.plan, V2.plan);
  assert.deepStrictEqual(S.recup, V2.recup); assert.deepStrictEqual(S.cerrados, V2.cerrados);
  assert.deepStrictEqual(S.sensor, V2.sensor);
});

test('migración: claves desconocidas (de una versión más nueva) no se pierden al guardar', async ({ abrir }) => {
  const futuro = Object.assign({}, V2, { v: 9, cosaNueva: { x: [1, 2, 3] } });
  const { page } = await abrir({ ls: { saludActivaV1: JSON.stringify(futuro) } });
  await ir(page, 'ajustes'); await page.click('form[data-f=ajustes] button[type=submit]');
  const guardado = JSON.parse(await lsGet(page, 'saludActivaV1'));
  assert.deepStrictEqual(guardado.cosaNueva, { x: [1, 2, 3] });
  assert.strictEqual(guardado.v, 9, 'no se baja la versión');
});

test('migración: datos corruptos no se pisan, se conserva el texto original', async ({ abrir }) => {
  const roto = '{"v":2,"peso":[{"fecha":"2026-10-01","kg":90}';
  const { page, errores } = await abrir({ ls: { saludActivaV1: roto } });
  assert.strictEqual(await lsGet(page, 'saludActivaV1_corrupto'), roto);
  await ir(page, 'ajustes'); await page.click('form[data-f=ajustes] button[type=submit]');
  assert.strictEqual(await lsGet(page, 'saludActivaV1_corrupto'), roto, 'la copia sigue ahí tras guardar');
  assert.deepStrictEqual(errores, []);
});

test('respaldo: exportar descarga un JSON válido con todos los datos y marca la fecha', async ({ abrir }) => {
  const { page } = await abrir({ ls: { saludActivaV1: JSON.stringify(V2) } });
  await ir(page, 'ajustes');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-a=export]')]);
  assert.match(dl.suggestedFilename(), /^salud-activa-respaldo-2026-10-19\.json$/);
  const txt = require('fs').readFileSync(await dl.path(), 'utf8');
  const j = JSON.parse(txt);
  assert.deepStrictEqual(j.colesterol, V2.colesterol); assert.deepStrictEqual(j.peso, V2.peso);
  const S = await estado(page);
  assert.ok(S.settings.ultimoRespaldo > 0);
  assert.match(await texto(page), /Último respaldo: 19\/10\/2026/);
});

test('respaldo: recordatorio en Hoy si pasaron 7 días o nunca hubo, y "Más tarde" lo oculta por hoy', async ({ abrir }) => {
  const { page } = await abrir({ ls: { saludActivaV1: JSON.stringify(V2) } });
  assert.match(await texto(page), /Hacé un respaldo de tus datos/);
  await page.click('[data-a=resp-luego]');
  assert.doesNotMatch(await texto(page), /Hacé un respaldo de tus datos/);
  // con un respaldo reciente no aparece
  const reciente = Object.assign({}, V2, { settings: Object.assign({}, V2.settings, { ultimoRespaldo: Date.parse('2026-10-17T12:00:00') }) });
  const b = await abrir({ ls: { saludActivaV1: JSON.stringify(reciente) } });
  assert.doesNotMatch(await texto(b.page), /Hacé un respaldo de tus datos/);
  // sin datos no molesta
  const c = await abrir({});
  assert.doesNotMatch(await texto(c.page), /Hacé un respaldo de tus datos/);
});

test('respaldo: en la app Android se guarda en caché y se abre el menú de compartir', async ({ abrir }) => {
  const { page } = await abrir({ native: true, ls: { saludActivaV1: JSON.stringify(V2) } });
  await ir(page, 'ajustes'); await page.click('[data-a=export]'); await page.waitForTimeout(200);
  const ll = await page.evaluate(() => window.__llamadas.filter(x => x[0] === 'Filesystem' || x[0] === 'Share'));
  const fs = ll.find(x => x[1] === 'writeFile'), sh = ll.find(x => x[1] === 'share');
  assert.ok(fs && sh, 'llama a writeFile y share');
  const a = JSON.parse(fs[2])[0];
  assert.strictEqual(a.directory, 'CACHE'); assert.strictEqual(a.encoding, 'utf8');
  assert.strictEqual(JSON.parse(a.data).peso.length, 2);
  assert.deepStrictEqual(JSON.parse(sh[2])[0].files, ['file:///cache/' + a.path]);
  assert.ok((await estado(page)).settings.ultimoRespaldo > 0);
});

test('respaldo: copiar al portapapeles', async ({ abrir }) => {
  const { page } = await abrir({ ls: { saludActivaV1: JSON.stringify(V2) } });
  await ir(page, 'ajustes'); await page.click('[data-a=copiar]'); await page.waitForTimeout(150);
  const t = await page.evaluate(() => navigator.clipboard.readText());
  assert.strictEqual(JSON.parse(t).peso.length, 2);
});

test('importar: reemplaza los datos y deja copia de lo anterior; un archivo inválido no cambia nada', async ({ abrir }) => {
  const actual = JSON.stringify(V1);
  const { page } = await abrir({ ls: { saludActivaV1: actual } });
  await ir(page, 'ajustes');
  const nuevo = Object.assign({}, V2, { peso: [{ fecha: '2026-10-18', kg: 87.1 }] });
  await page.setInputFiles('#fileIn', { name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(nuevo)) });
  await page.waitForTimeout(250);
  assert.deepStrictEqual((await estado(page)).peso, [{ fecha: '2026-10-18', kg: 87.1 }]);
  assert.strictEqual(await lsGet(page, 'saludActivaV1_antes_importar'), actual);
  await page.setInputFiles('#fileIn', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('no es json') });
  await page.waitForTimeout(200);
  assert.deepStrictEqual((await estado(page)).peso, [{ fecha: '2026-10-18', kg: 87.1 }]);
});

test('borrar todo: ofrece exportar primero y pide doble confirmación', async ({ abrir }) => {
  // 1) acepta exportar → no se borra
  let x = await abrir({ ls: { saludActivaV1: JSON.stringify(V1) }, dialogos: [true] });
  await ir(x.page, 'ajustes');
  await Promise.all([x.page.waitForEvent('download'), x.page.click('[data-a=borrar]')]);
  assert.strictEqual((await estado(x.page)).peso.length, 2);
  // 2) rechaza exportar y cancela en la 2ª confirmación → no se borra
  x = await abrir({ ls: { saludActivaV1: JSON.stringify(V1) }, dialogos: [false, false] });
  await ir(x.page, 'ajustes'); await x.page.click('[data-a=borrar]'); await x.page.waitForTimeout(150);
  assert.strictEqual((await estado(x.page)).peso.length, 2);
  // 3) rechaza exportar, confirma dos veces → se borra
  x = await abrir({ ls: { saludActivaV1: JSON.stringify(V1) }, dialogos: [false, true, true] });
  await ir(x.page, 'ajustes'); await x.page.click('[data-a=borrar]'); await x.page.waitForTimeout(150);
  assert.strictEqual((await estado(x.page)).peso.length, 0);
});
