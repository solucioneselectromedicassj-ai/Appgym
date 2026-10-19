'use strict';
// Utilidades de la suite de pruebas: servidor estático, navegador (Chromium de Playwright) y ayudas.
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright-core');

const RAIZ = path.join(__dirname, '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const FECHA_BASE = '2026-10-19T12:00:00'; // lunes

let server, browser, base;
const pruebas = [];
const test = (nombre, fn) => pruebas.push({ nombre, fn });

async function iniciar() {
  server = http.createServer((req, res) => {
    const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+$/, '/index.html'));
    if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/index.html`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
}
async function cerrar() { if (browser) await browser.close(); if (server) server.close(); }

/* Abre la app en una página nueva.
   opts.fecha   fecha/hora fija (por defecto lunes 19/10/2026 12:00)
   opts.ls      { clave: texto } de localStorage antes de cargar la app (solo la primera vez)
   opts.native  true | { Plugin: {metodo: fn} }  simula la app Android (Capacitor)
   opts.dialogos  lista de respuestas para confirm/prompt/alert (en orden); true/false para confirm, texto para prompt */
async function abrir(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errores.push('console: ' + m.text()); });
  const cola = (opts.dialogos || []).slice();
  page.on('dialog', d => {
    const r = cola.length ? cola.shift() : (d.type() === 'prompt' ? null : true);
    if (d.type() === 'prompt') return r === null ? d.dismiss() : d.accept(String(r));
    return r === false ? d.dismiss() : d.accept();
  });
  await page.addInitScript(([fecha, ls]) => {
    const R = Date, base = R.parse(fecha), t0 = R.now();
    class D extends R {
      constructor(...a) { if (a.length) super(...a); else super(base + (R.now() - t0)); }
      static now() { return base + (R.now() - t0); }
    }
    window.Date = D;
    if (!localStorage.getItem('__sembrado')) {
      localStorage.setItem('__sembrado', '1');
      Object.entries(ls || {}).forEach(([k, v]) => localStorage.setItem(k, v));
    }
  }, [opts.fecha || FECHA_BASE, opts.ls || {}]);
  if (opts.native) {
    await page.addInitScript(mocks => {
      window.__llamadas = [];
      const reg = (nom, fns) => Object.fromEntries(Object.entries(fns).map(([m, f]) => [m, async (...a) => { window.__llamadas.push([nom, m, JSON.stringify(a)]); return f(...a); }]));
      const def = {
        StepCounter: { isAvailable: () => ({ available: false }), hasPermission: () => ({ granted: false }) },
        HealthPlugin: {},
        LocalNotifications: { getPending: () => ({ notifications: [] }), cancel: () => {}, checkPermissions: () => ({ display: 'granted' }), requestPermissions: () => ({ display: 'granted' }), createChannel: () => {}, schedule: () => {} },
        Filesystem: { writeFile: a => ({ uri: 'file:///cache/' + a.path }) },
        Share: { share: () => ({}) }
      };
      const plugins = {};
      Object.keys(def).forEach(n => { plugins[n] = reg(n, Object.assign({}, def[n], (mocks && mocks[n]) || {})); });
      // permite funciones personalizadas serializadas como texto
      if (mocks) Object.entries(mocks).forEach(([n, fns]) => Object.entries(fns).forEach(([m, f]) => { if (typeof f === 'string') plugins[n][m] = async (...a) => { window.__llamadas.push([n, m, JSON.stringify(a)]); return (0, eval)('(' + f + ')')(...a); }; }));
      window.Capacitor = { isNativePlatform: () => true, Plugins: plugins };
    }, opts.native === true ? null : opts.native);
  }
  await page.goto(base);
  await page.waitForFunction(() => window.SA);
  return { page, errores, ctx };
}

const estado = page => page.evaluate(() => JSON.parse(JSON.stringify(window.SA.state())));
const ir = async (page, tab) => { await page.click(`#nav [data-t=${tab}]`); };
const texto = async (page, sel = '#view') => (await page.innerText(sel)).replace(/\s+/g, ' ').trim();
const lsGet = (page, k) => page.evaluate(k => localStorage.getItem(k), k);

async function correr(filtro) {
  await iniciar();
  let ok = 0, fallo = 0;
  for (const t of pruebas) {
    if (filtro && !t.nombre.toLowerCase().includes(filtro.toLowerCase())) continue;
    const abiertas = [];
    const ctx = { abrir: async o => { const x = await abrir(o); abiertas.push(x.ctx); return x; } };
    try { await t.fn(ctx); ok++; console.log('  ✔', t.nombre); }
    catch (e) { fallo++; console.log('  ✘', t.nombre, '\n     ', String(e.stack || e).split('\n').slice(0, 4).join('\n      ')); }
    for (const c of abiertas) await c.close().catch(() => { });
  }
  await cerrar();
  console.log(`\n${ok} pasaron, ${fallo} fallaron`);
  process.exit(fallo ? 1 : 0);
}

module.exports = { test, correr, assert, estado, ir, texto, lsGet, FECHA_BASE };
