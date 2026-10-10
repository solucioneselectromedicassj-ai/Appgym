'use strict';
/* Salud Activa — PWA sin dependencias. Datos solo en este dispositivo (localStorage). */
(function () {
  const KEY = 'saludActivaV1';
  const $ = (s, r = document) => r.querySelector(s);
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hoy = () => ymd(new Date());
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS_CORE = [1, 3, 5]; // lunes, miércoles y viernes
  const tsFecha = f => new Date(f + 'T12:00:00').getTime();
  const fmtFecha = f => { const [y, m, d] = f.split('-'); return `${d}/${m}/${y}`; };
  const fmtTs = t => { const d = new Date(t); return `${d.getDate()}/${d.getMonth() + 1} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  /* ---------- Contenido: ejercicios ---------- */
  const RUTINA = [
    { id: 'giros', n: 'Giros de cadera', meta: 30, tip: 'Círculos amplios pero suaves, sin forzar la zona lumbar.' },
    { id: 'brazos', n: 'Estiramiento de brazos a los costados', meta: 10, tip: 'Respirá con normalidad, sin aguantar el aire.' },
    { id: 'piernas', n: 'Flexiones de piernas', meta: 15, tip: 'Rodillas alineadas con la punta de los pies.' },
    { id: 'aperturas', n: 'Aperturas de brazos y espalda', meta: 15, tip: 'Abrí el pecho llevando los omóplatos hacia atrás, sin arquear la zona lumbar.' },
    { id: 'rodillas', n: 'Levantamiento de rodillas', meta: 20, tip: 'Torso erguido, ritmo cómodo.' },
    { id: 'agacharse', n: 'Agacharse (arriba y abajo)', meta: 10, tip: 'Doblá caderas y rodillas con la espalda recta; no dobles la cintura.' }
  ];
  const CORE = [
    { id: 'gato', n: 'Gato-camello', series: 2, reps: 8, tip: 'En cuatro apoyos, redondeá y arqueá la espalda despacio, solo hasta donde no duela.' },
    { id: 'bird', n: 'Bird-dog (brazo y pierna opuestos)', series: 2, reps: 6, lado: true, tip: 'Estirá brazo y pierna contrarios, mantené 3-5 s con la pelvis quieta.' },
    { id: 'deadbug', n: 'Dead bug', series: 2, reps: 6, lado: true, tip: 'Boca arriba, zona lumbar apoyada; bajá brazo y pierna contrarios sin despegarla.' },
    { id: 'puente', n: 'Puente de glúteos', series: 2, reps: 8, tip: 'Subí la cadera apretando glúteos; no arquees la zona lumbar al subir.' },
    { id: 'lateral', n: 'Plancha lateral (rodillas apoyadas)', series: 2, seg: 15, lado: true, tip: 'Cuerpo en línea, hombro sobre el codo. Respirá, no aguantes el aire.' },
    { id: 'plancha', n: 'Plancha corta', series: 2, seg: 15, tip: 'Podés apoyar las rodillas. Abdomen firme, sin hundir la cintura.' }
  ];

  /* ---------- Estado ---------- */
  const DEFAULTS = () => ({
    v: 2,
    settings: { pesoObj: 88, pesoTol: 1.5, metaPasos: 8000, metaAgua: 2500, vaso: 250, umbral: 1.3, pSis: 140, pDia: 90, recAgua: false, recMin: 90, notas: '', spo2Min: 92, recSpo2: false, horasSpo2: '09:00, 21:00' },
    days: {}, peso: [], presion: [], colesterol: [], spo2: [], dolor: {}
  });

  function load() {
    const d = DEFAULTS();
    try {
      const r = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (r && typeof r === 'object') {
        Object.assign(d.settings, r.settings || {});
        ['days', 'dolor'].forEach(k => { if (r[k] && typeof r[k] === 'object' && !Array.isArray(r[k])) d[k] = r[k]; });
        ['peso', 'presion', 'colesterol', 'spo2'].forEach(k => { if (Array.isArray(r[k])) d[k] = r[k]; });
      }
    } catch (e) { /* datos corruptos: se parte de cero */ }
    return d;
  }
  let S = load();
  let saveT = null;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('No se pudo guardar en este dispositivo'); } }
  function saveSoon() { clearTimeout(saveT); saveT = setTimeout(save, 1500); }

  const peek = (d = hoy()) => S.days[d] || { pasos: 0, agua: 0, rutina: {}, core: {} };
  const day = (d = hoy()) => {
    const x = S.days[d] || (S.days[d] = { pasos: 0, agua: 0, rutina: {}, core: {} });
    x.rutina = x.rutina || {}; x.core = x.core || {};
    return x;
  };

  /* ---------- Utilidades de UI ---------- */
  let toastT = null;
  function toast(msg) {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }
  const meter = (label, val, max, unit) => {
    const p = max > 0 ? Math.min(100, Math.round(val / max * 100)) : 0;
    const u = unit ? ' ' + unit : '';
    return `<div class="meter"><div class="meter-top"><span>${label}</span><b>${val}${u} / ${max}${u}</b></div><div class="bar"><i style="width:${p}%"></i></div></div>`;
  };

  function chart(series, o = {}) {
    const W = 320, H = 150, L = 38, R = 8, T = 10, B = 22;
    const vals = [], times = [];
    series.forEach(s => s.pts.forEach(q => { vals.push(q.v); times.push(q.t); }));
    if (!vals.length) return '<p class="muted">Todavía no hay datos para graficar.</p>';
    if (o.band) vals.push(o.band[0], o.band[1]);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (lo === hi) { lo -= 1; hi += 1; }
    const m = (hi - lo) * 0.12; lo -= m; hi += m;
    const t0 = Math.min(...times), t1 = Math.max(...times);
    const X = t => L + (t1 === t0 ? (W - L - R) / 2 : (t - t0) / (t1 - t0) * (W - L - R));
    const Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const dec = o.dec ?? 0;
    const fd = t => { const d = new Date(t); return `${d.getDate()}/${d.getMonth() + 1}`; };
    let g = '';
    if (o.band) g += `<rect x="${L}" y="${Y(o.band[1]).toFixed(1)}" width="${W - L - R}" height="${(Y(o.band[0]) - Y(o.band[1])).toFixed(1)}" class="band"/>`;
    g += `<line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" class="axis"/><line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" class="axis"/>`;
    g += `<text x="${L - 4}" y="${T + 6}" class="tick" text-anchor="end">${hi.toFixed(dec)}</text><text x="${L - 4}" y="${H - B}" class="tick" text-anchor="end">${lo.toFixed(dec)}</text>`;
    g += `<text x="${L}" y="${H - 6}" class="tick">${fd(t0)}</text>`;
    if (t1 !== t0) g += `<text x="${W - R}" y="${H - 6}" class="tick" text-anchor="end">${fd(t1)}</text>`;
    series.forEach((s, i) => {
      const pts = s.pts.slice().sort((a, b) => a.t - b.t);
      const path = pts.map((q, j) => `${j ? 'L' : 'M'}${X(q.t).toFixed(1)} ${Y(q.v).toFixed(1)}`).join('');
      g += `<path d="${path}" class="line s${i}"/>` + pts.map(q => `<circle cx="${X(q.t).toFixed(1)}" cy="${Y(q.v).toFixed(1)}" r="3" class="dot s${i}"/>`).join('');
    });
    const legend = series.length > 1 ? `<div class="legend">${series.map((s, i) => `<span class="lg s${i}">${esc(s.name)}</span>`).join('')}</div>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(o.label || 'Gráfico')}">${g}</svg>${legend}`;
  }

  /* ---------- Temporizador ---------- */
  let tInt = null, tEnd = 0;
  const mmss = s => `${Math.floor(s / 60)}:${pad(s % 60)}`;
  function beep() {
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      const ctx = new C(), o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.2;
      o.start(); o.stop(ctx.currentTime + 0.35);
    } catch (e) { /* sin audio */ }
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* sin vibración */ }
  }
  function tick() {
    const left = Math.max(0, Math.ceil((tEnd - Date.now()) / 1000));
    $('#timerTime').textContent = mmss(left);
    if (left <= 0) {
      clearInterval(tInt); beep(); toast('¡Tiempo!');
      setTimeout(() => { if (Date.now() >= tEnd) $('#timer').hidden = true; }, 2500);
    }
  }
  function startTimer(sec, label) {
    clearInterval(tInt); tEnd = Date.now() + sec * 1000;
    $('#timer').hidden = false; $('#timerLabel').textContent = label;
    tick(); tInt = setInterval(tick, 250);
  }
  function stopTimer() { clearInterval(tInt); tEnd = 0; $('#timer').hidden = true; }

  /* ---------- Pasos (acelerómetro, solo con la app abierta) ---------- */
  const step = { on: false, filt: 9.8, above: false, last: 0, wake: null };
  function detectStep(m, t) {
    step.filt = step.filt * 0.92 + m * 0.08;
    const d = m - step.filt, thr = S.settings.umbral;
    if (!step.above && d > thr && t - step.last > 300) { step.above = true; step.last = t; return true; }
    if (step.above && d < thr * 0.4) step.above = false;
    return false;
  }
  function onMotion(e) {
    const a = e.accelerationIncludingGravity; if (!a) return;
    const m = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
    if (detectStep(m, Date.now())) { day().pasos++; saveSoon(); updateStepsUI(); }
  }
  async function toggleMotion() {
    if (step.on) {
      window.removeEventListener('devicemotion', onMotion); step.on = false;
      try { step.wake && step.wake.release(); } catch (e) { /* nada */ } step.wake = null;
      save(); render(); return;
    }
    if (typeof window.DeviceMotionEvent === 'undefined') { toast('Este dispositivo no tiene acelerómetro accesible'); return; }
    try {
      if (typeof window.DeviceMotionEvent.requestPermission === 'function') {
        const r = await window.DeviceMotionEvent.requestPermission();
        if (r !== 'granted') { toast('Permiso de movimiento denegado'); return; }
      }
    } catch (e) { toast('No se pudo pedir el permiso de movimiento'); return; }
    window.addEventListener('devicemotion', onMotion); step.on = true;
    try { if (navigator.wakeLock) step.wake = await navigator.wakeLock.request('screen'); } catch (e) { /* opcional */ }
    render();
  }
  function updateStepsUI() {
    const el = $('#pasosNum'); if (!el) return;
    const n = peek().pasos, meta = S.settings.metaPasos;
    el.textContent = n;
    const b = $('#pasosBar'); if (b) b.style.width = Math.min(100, Math.round(n / meta * 100)) + '%';
  }

  /* ---------- Avisos de salud ---------- */
  function presionNivel(r) {
    if (r.sis >= 180 || r.dia >= 120) return 'crisis';
    if (r.sis >= S.settings.pSis || r.dia >= S.settings.pDia) return 'alta';
    return 'ok';
  }
  const spo2Nivel = r => (r.spo2 < S.settings.spo2Min ? 'baja' : 'ok');
  const spo2Msg = 'Saturación por debajo del umbral que fijaste. Repetí la medición con la mano tibia, quieta y sin esmalte. Si se repite, o tenés falta de aire, labios azulados o confusión, buscá atención médica.';
  const presionMsg = {
    crisis: 'Presión muy alta. Sentate, descansá unos minutos y volvé a medirla. Si sigue así, o tenés dolor de cabeza intenso, dolor de pecho, falta de aire o mareo, buscá atención médica de urgencia.',
    alta: 'Presión por encima del umbral que fijaste. Repetí la medición con calma y comentalo con tu médico si se repite.'
  };
  // Más reciente primero; con la misma fecha, gana el que se cargó después.
  const porFecha = list => list.map((r, i) => ({ ...r, i })).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.i - a.i);
  function pesoAviso() {
    if (!S.peso.length) return '';
    const last = porFecha(S.peso)[0];
    const diff = last.kg - S.settings.pesoObj;
    if (Math.abs(diff) <= S.settings.pesoTol) return '';
    return `<div class="card warn"><b>Peso fuera de rango</b><p>Tu último registro (${last.kg} kg) está ${Math.abs(diff).toFixed(1)} kg ${diff > 0 ? 'por encima' : 'por debajo'} de tu objetivo de ${S.settings.pesoObj} kg.</p></div>`;
  }

  /* ---------- Vistas ---------- */
  let tab = 'hoy', sub = 'presion';
  const views = { hoy: viewHoy, pasos: viewPasos, espalda: viewEspalda, salud: viewSalud, ajustes: viewAjustes };

  function rutinaItem(it) {
    const c = peek().rutina[it.id] || 0, done = c >= it.meta, dol = S.dolor[it.id];
    return `<div class="item ${done ? 'done' : ''} ${dol ? 'pain' : ''}">
      <div class="item-main"><b>${esc(it.n)}</b>${window.FIG ? window.FIG(it.id) : ''}<small>${esc(it.tip)}</small>${dol ? '<small class="warnTxt">⚠ Marcado como doloroso: salteálo o hacelo más suave, y consultalo con tu kinesiólogo.</small>' : ''}</div>
      <div class="stepper"><button data-a="r-" data-id="${it.id}" aria-label="Una menos">−</button><span>${c}/${it.meta}</span><button data-a="r+" data-id="${it.id}" aria-label="Una más">+</button></div>
      <div class="item-actions"><button class="ghost mini" data-a="rok" data-id="${it.id}">${done ? 'Deshacer' : 'Marcar hecho'}</button><button class="ghost mini" data-a="dolor" data-id="${it.id}">${dol ? 'Quitar marca' : 'Me dolió'}</button></div>
    </div>`;
  }

  function viewHoy() {
    const d = peek(), s = S.settings, now = new Date();
    const hechos = RUTINA.filter(i => (d.rutina[i.id] || 0) >= i.meta).length;
    const toca = DIAS_CORE.includes(now.getDay());
    const coreHechos = CORE.filter(i => (d.core[i.id] || 0) >= i.series).length;
    const ult = S.presion.slice().sort((a, b) => b.ts - a.ts)[0];
    let aviso = pesoAviso();
    if (ult && ymd(new Date(ult.ts)) === hoy() && presionNivel(ult) !== 'ok') {
      const n = presionNivel(ult);
      aviso += `<div class="card ${n === 'crisis' ? 'bad' : 'warn'}"><b>Presión de hoy: ${ult.sis}/${ult.dia}</b><p>${presionMsg[n]}</p></div>`;
    }
    const us = S.spo2.slice().sort((a, b) => b.ts - a.ts)[0];
    if (us && ymd(new Date(us.ts)) === hoy() && spo2Nivel(us) !== 'ok') aviso += `<div class="card warn"><b>Saturación de hoy: ${us.spo2}%</b><p>${spo2Msg}</p></div>`;
    return `<h2>${DIAS[now.getDay()]} ${now.getDate()} de ${MESES[now.getMonth()]}</h2>${aviso}
    <div class="card"><h3>Resumen del día</h3>
      ${meter('Pasos', d.pasos, s.metaPasos)}
      ${meter('Agua', d.agua, s.metaAgua, 'ml')}
      ${meter('Rutina de la mañana', hechos, RUTINA.length)}
      ${toca ? meter('Espalda y core', coreHechos, CORE.length) : '<small>Espalda y core: hoy descansás (lun, mié y vie).</small>'}
    </div>
    <div class="card"><h3>Agua</h3>
      <div class="row"><button class="ghost grow" data-a="agua-">− ${s.vaso} ml</button><button class="pri grow" data-a="agua+">+ vaso (${s.vaso} ml)</button></div>
    </div>
    <h3>Rutina de la mañana</h3>${RUTINA.map(rutinaItem).join('')}
    <p class="foot">Ayuda personal: no reemplaza las indicaciones de tu médico ni de tu kinesiólogo.</p>`;
  }

  function viewPasos() {
    const d = peek(), s = S.settings, now = new Date();
    let max = s.metaPasos, cols = '';
    const dias = [];
    for (let i = 6; i >= 0; i--) { const x = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i); dias.push({ x, n: peek(ymd(x)).pasos }); }
    dias.forEach(q => { if (q.n > max) max = q.n; });
    dias.forEach(q => { cols += `<div><i style="height:${Math.round(q.n / max * 90)}px"></i>${DIAS[q.x.getDay()].slice(0, 3)}<br>${q.n}</div>`; });
    return `<h2>Pasos</h2>
    <div class="card">
      <div class="big" id="pasosNum">${d.pasos}</div>
      <p class="muted" style="text-align:center">meta: ${s.metaPasos} pasos</p>
      <div class="bar"><i id="pasosBar" style="width:${Math.min(100, Math.round(d.pasos / s.metaPasos * 100))}%"></i></div>
      <div class="row" style="margin-top:12px"><button class="${step.on ? 'dang' : 'pri'} grow" data-a="motion">${step.on ? 'Detener conteo' : 'Contar pasos ahora'}</button></div>
      <small>${step.on ? 'Contando con el acelerómetro. Dejá la pantalla encendida y el teléfono en el bolsillo.' : 'El navegador solo cuenta mientras la app está abierta y la pantalla encendida.'}</small>
    </div>
    <div class="card"><h3>Cargar pasos a mano</h3>
      <small>Útil para copiar el total de Google Fit, Salud o tu pulsera.</small>
      <label for="pasosInput">Cantidad</label><input id="pasosInput" type="number" inputmode="numeric" min="0" max="100000" placeholder="Ej: 3500">
      <div class="row" style="margin-top:8px"><button class="ghost grow" data-a="pasos-add">Sumar</button><button class="ghost grow" data-a="pasos-set">Fijar total del día</button></div>
    </div>
    <div class="card"><h3>Últimos 7 días</h3><div class="week">${cols}</div></div>`;
  }

  function coreItem(it) {
    const c = peek().core[it.id] || 0, dol = S.dolor[it.id];
    const dosis = it.seg ? `${it.series} × ${it.seg} s${it.lado ? ' por lado' : ''}` : `${it.series} × ${it.reps}${it.lado ? ' por lado' : ''}`;
    const chips = Array.from({ length: it.series }, (_, i) => `<span class="chip ${i < c ? 'on' : ''}"></span>`).join('');
    return `<div class="item ${c >= it.series ? 'done' : ''} ${dol ? 'pain' : ''}">
      <div class="item-main"><b>${esc(it.n)}</b>${window.FIG ? window.FIG(it.id) : ''}<small>${dosis} — ${esc(it.tip)}</small>${dol ? '<small class="warnTxt">⚠ Marcado como doloroso: salteálo y consultalo con tu kinesiólogo.</small>' : ''}</div>
      <div class="chips">${chips}</div>
      <div class="item-actions">
        <button class="pri mini" data-a="serie" data-id="${it.id}">Serie hecha</button>
        <button class="ghost mini" data-a="serie-" data-id="${it.id}">−</button>
        ${it.seg ? `<button class="ghost mini" data-a="timer" data-s="${it.seg}" data-l="${esc(it.n)}">⏱ ${it.seg} s</button>` : ''}
        <button class="ghost mini" data-a="dolor" data-id="${it.id}">${dol ? 'Quitar marca' : 'Me dolió'}</button>
      </div></div>`;
  }

  function viewEspalda() {
    const toca = DIAS_CORE.includes(new Date().getDay());
    const notas = S.settings.notas.trim();
    return `<h2>Espalda y core</h2>
    <div class="card ${toca ? 'ok' : ''}"><b>${toca ? 'Hoy toca' : 'Hoy descansás'}</b><p>Módulo de 10 a 15 minutos, 3 veces por semana (lunes, miércoles y viernes). Pocas repeticiones, ritmo lento y pausas de 45 s entre series.</p></div>
    <div class="card warn"><b>Cortá el ejercicio y consultá si aparece:</b><p>dolor que baja a la pierna, hormigueo, adormecimiento o pérdida de fuerza. Que un kinesiólogo valide esta lista una vez por tu lesión de espalda.</p></div>
    ${notas ? `<div class="card"><h3>Indicaciones de mi médico</h3><p>${esc(notas).replace(/\n/g, '<br>')}</p></div>` : ''}
    ${CORE.map(coreItem).join('')}
    <div class="card"><h3>Para levantar cosas con cuidado</h3>
      <ul><li>Flexioná caderas y rodillas, con la espalda neutra.</li><li>Llevá la carga pegada al cuerpo.</li><li>No gires el tronco mientras cargás: mové los pies.</li><li>Exhalá durante el esfuerzo; no aguantes la respiración (cuidá la presión).</li><li>Si pesa mucho o es incómodo, pedí ayuda.</li></ul>
    </div>
    <p class="foot">Ayuda personal: no reemplaza las indicaciones de tu médico ni de tu kinesiólogo.</p>`;
  }

  function viewSalud() {
    const tabs = [['presion', 'Presión'], ['peso', 'Peso'], ['colesterol', 'Colesterol'], ['spo2', 'Saturación'], ['agua', 'Agua']];
    const seg = `<div class="seg">${tabs.map(([k, n]) => `<button data-a="sub" data-v="${k}" class="${sub === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    return `<h2>Salud</h2>${seg}${({ presion: subPresion, peso: subPeso, colesterol: subColesterol, spo2: subSpo2, agua: subAgua })[sub]()}`;
  }

  const delBtn = (k, i) => `<button data-a="del" data-k="${k}" data-i="${i}" aria-label="Borrar registro">🗑</button>`;

  function subPresion() {
    const rows = S.presion.map((r, i) => ({ ...r, i })).sort((a, b) => b.ts - a.ts);
    const aviso = rows[0] && presionNivel(rows[0]) !== 'ok' ? `<div class="card ${presionNivel(rows[0]) === 'crisis' ? 'bad' : 'warn'}"><b>Última medición: ${rows[0].sis}/${rows[0].dia}</b><p>${presionMsg[presionNivel(rows[0])]}</p></div>` : '';
    const pts = k => rows.slice(0, 30).map(r => ({ t: r.ts, v: r[k] }));
    return `${aviso}<div class="card"><h3>Registrar presión</h3>
      <form data-f="presion"><div class="grid3">
        <div><label for="pSis">Máxima</label><input id="pSis" name="sis" type="number" inputmode="numeric" required></div>
        <div><label for="pDia">Mínima</label><input id="pDia" name="dia" type="number" inputmode="numeric" required></div>
        <div><label for="pPul">Pulso</label><input id="pPul" name="pul" type="number" inputmode="numeric"></div>
      </div><div class="row" style="margin-top:10px"><button class="pri grow" type="submit">Guardar</button></div></form>
      <small>Umbral de aviso: ${S.settings.pSis}/${S.settings.pDia}. Pedile a tu médico cuál usar y cambialo en Ajustes.</small></div>
    <div class="card"><h3>Evolución</h3>${chart([{ name: 'Máxima', pts: pts('sis') }, { name: 'Mínima', pts: pts('dia') }], { label: 'Presión arterial' })}
      <ul class="list">${rows.slice(0, 8).map(r => `<li><span>${fmtTs(r.ts)} · <b>${r.sis}/${r.dia}</b>${r.pul ? ' · ' + r.pul + ' lpm' : ''} <span class="tag ${presionNivel(r)}">${({ ok: 'normal', alta: 'alta', crisis: 'muy alta' })[presionNivel(r)]}</span></span>${delBtn('presion', r.i)}</li>`).join('')}</ul></div>`;
  }

  function subPeso() {
    const rows = porFecha(S.peso);
    const s = S.settings;
    return `${pesoAviso()}<div class="card"><h3>Registrar peso</h3>
      <form data-f="peso"><div class="grid2">
        <div><label for="wKg">Peso (kg)</label><input id="wKg" name="kg" type="number" step="0.1" inputmode="decimal" required></div>
        <div><label for="wFecha">Fecha</label><input id="wFecha" name="fecha" type="date" value="${hoy()}" required></div>
      </div><div class="row" style="margin-top:10px"><button class="pri grow" type="submit">Guardar</button></div></form>
      <small>Objetivo: ${s.pesoObj} kg (rango ±${s.pesoTol} kg, zona sombreada).</small></div>
    <div class="card"><h3>Evolución</h3>${chart([{ name: 'Peso', pts: rows.slice(0, 30).map(r => ({ t: tsFecha(r.fecha), v: r.kg })) }], { band: [s.pesoObj - s.pesoTol, s.pesoObj + s.pesoTol], dec: 1, label: 'Peso' })}
      <ul class="list">${rows.slice(0, 8).map(r => `<li><span>${fmtFecha(r.fecha)} · <b>${r.kg} kg</b></span>${delBtn('peso', r.i)}</li>`).join('')}</ul></div>`;
  }

  function subColesterol() {
    const rows = porFecha(S.colesterol);
    const pts = k => rows.filter(r => r[k] != null).slice(0, 20).map(r => ({ t: tsFecha(r.fecha), v: r[k] }));
    const f = (id, n, l) => `<div><label for="${id}">${l}</label><input id="${id}" name="${n}" type="number" inputmode="decimal" step="any" min="0"></div>`;
    const dato = r => ['total', 'ldl', 'hdl', 'tg'].filter(k => r[k] != null).map(k => `${({ total: 'Total', ldl: 'LDL', hdl: 'HDL', tg: 'TG' })[k]} ${r[k]}`).join(' · ');
    return `<div class="card"><h3>Cargar análisis de laboratorio</h3>
      <form data-f="colesterol"><label for="cFecha">Fecha del análisis</label><input id="cFecha" name="fecha" type="date" value="${hoy()}" required>
      <div class="grid2">${f('cTot', 'total', 'Colesterol total')}${f('cLdl', 'ldl', 'LDL')}${f('cHdl', 'hdl', 'HDL')}${f('cTg', 'tg', 'Triglicéridos')}</div>
      <div class="row" style="margin-top:10px"><button class="pri grow" type="submit">Guardar</button></div></form>
      <small>Valores en mg/dl. Los valores objetivo los define tu médico.</small></div>
    <div class="card"><h3>Evolución</h3>${chart([{ name: 'Total', pts: pts('total') }, { name: 'LDL', pts: pts('ldl') }], { label: 'Colesterol' })}
      <ul class="list">${rows.slice(0, 8).map(r => `<li><span>${fmtFecha(r.fecha)} · ${dato(r)}</span>${delBtn('colesterol', r.i)}</li>`).join('')}</ul></div>`;
  }

  function subSpo2() {
    const rows = S.spo2.map((r, i) => ({ ...r, i })).sort((a, b) => b.ts - a.ts);
    const aviso = rows[0] && spo2Nivel(rows[0]) !== 'ok' ? `<div class="card warn"><b>Última medición: ${rows[0].spo2}%</b><p>${spo2Msg}</p></div>` : '';
    return `${aviso}<div class="card"><h3>Registrar saturación (saturómetro)</h3>
      <form data-f="spo2"><div class="grid2">
        <div><label for="oSat">Saturación (%)</label><input id="oSat" name="spo2" type="number" inputmode="numeric" min="50" max="100" required></div>
        <div><label for="oPul">Pulso</label><input id="oPul" name="pul" type="number" inputmode="numeric"></div>
      </div><div class="row" style="margin-top:10px"><button class="pri grow" type="submit">Guardar</button></div></form>
      <small>Medí sentado, en reposo, con la mano tibia y quieta. Umbral de aviso: ${S.settings.spo2Min}%. Pedile a tu médico cuál usar y cambialo en Ajustes.</small></div>
    <div class="card"><h3>Evolución</h3>${chart([{ name: 'Saturación', pts: rows.slice(0, 30).map(r => ({ t: r.ts, v: r.spo2 })) }], { band: [S.settings.spo2Min, 100], label: 'Saturación de oxígeno' })}
      <ul class="list">${rows.slice(0, 8).map(r => `<li><span>${fmtTs(r.ts)} · <b>${r.spo2}%</b>${r.pul ? ' · ' + r.pul + ' lpm' : ''} <span class="tag ${spo2Nivel(r)}">${spo2Nivel(r) === 'ok' ? 'normal' : 'baja'}</span></span>${delBtn('spo2', r.i)}</li>`).join('')}</ul></div>`;
  }

  function subAgua() {
    const d = peek(), s = S.settings, now = new Date();
    let max = s.metaAgua, cols = '';
    const dias = [];
    for (let i = 6; i >= 0; i--) { const x = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i); dias.push({ x, n: peek(ymd(x)).agua }); }
    dias.forEach(q => { if (q.n > max) max = q.n; });
    dias.forEach(q => { cols += `<div><i style="height:${Math.round(q.n / max * 90)}px"></i>${DIAS[q.x.getDay()].slice(0, 3)}<br>${q.n}</div>`; });
    return `<div class="card"><h3>Agua de hoy</h3>${meter('Tomado', d.agua, s.metaAgua, 'ml')}
      <div class="row" style="margin-top:10px"><button class="ghost grow" data-a="agua-">− ${s.vaso} ml</button><button class="pri grow" data-a="agua+">+ vaso</button></div>
      <small>Tomar abundante líquido a lo largo del día es la medida principal para prevenir cálculos renales. La cantidad exacta la define tu médico: ajustala en Ajustes.</small></div>
    <div class="card"><h3>Últimos 7 días (ml)</h3><div class="week">${cols}</div></div>`;
  }

  function viewAjustes() {
    const s = S.settings;
    const f = (n, l, v, extra = '') => `<div><label for="s_${n}">${l}</label><input id="s_${n}" name="${n}" type="number" inputmode="decimal" step="any" value="${v}" ${extra} required></div>`;
    return `<h2>Ajustes</h2>
    <form data-f="ajustes" class="card"><h3>Metas</h3>
      <div class="grid2">${f('pesoObj', 'Peso objetivo (kg)', s.pesoObj)}${f('pesoTol', 'Tolerancia (± kg)', s.pesoTol)}${f('metaPasos', 'Meta de pasos', s.metaPasos)}${f('metaAgua', 'Meta de agua (ml)', s.metaAgua)}${f('vaso', 'Tamaño del vaso (ml)', s.vaso)}</div>
      <label for="s_umbral">Sensibilidad del contador de pasos</label>
      <select id="s_umbral" name="umbral">${[[0.9, 'Alta (detecta pasos suaves)'], [1.3, 'Normal'], [1.8, 'Baja (evita falsos pasos)']].map(([v, n]) => `<option value="${v}" ${s.umbral === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <h3 style="margin-top:14px">Presión: umbral de aviso</h3><small>Consultá con tu médico qué valores usar.</small>
      <div class="grid2">${f('pSis', 'Máxima (sistólica)', s.pSis)}${f('pDia', 'Mínima (diastólica)', s.pDia)}</div>
      <h3 style="margin-top:14px">Recordatorio de agua</h3>
      <label style="display:flex;align-items:center;color:var(--fg)"><input type="checkbox" name="recAgua" ${s.recAgua ? 'checked' : ''}>Avisar cada cierto tiempo (solo con la app abierta)</label>
      ${f('recMin', 'Cada cuántos minutos', s.recMin, 'min="15"')}
      <h3 style="margin-top:14px">Saturación (saturómetro)</h3><small>Consultá con tu médico qué valor usar como umbral.</small>
      <div class="grid2">${f('spo2Min', 'Umbral de aviso (%)', s.spo2Min)}</div>
      <label style="display:flex;align-items:center;color:var(--fg)"><input type="checkbox" name="recSpo2" ${s.recSpo2 ? 'checked' : ''}>Recordarme medirla (solo con la app abierta)</label>
      <label for="s_horasSpo2">Horarios (HH:MM separados por coma)</label><input id="s_horasSpo2" name="horasSpo2" type="text" value="${esc(s.horasSpo2)}" placeholder="09:00, 21:00" style="min-height:44px">
      <label for="s_notas">Indicaciones de mi médico / kinesiólogo</label><textarea id="s_notas" name="notas" maxlength="1000" placeholder="Ej: evitar flexión de columna con carga; caminar 30 min diarios">${esc(s.notas)}</textarea>
      <div class="row" style="margin-top:10px"><button class="pri grow" type="submit">Guardar ajustes</button></div></form>
    <div class="card"><h3>Datos</h3>
      <p class="muted">Todo se guarda solo en este dispositivo. Hacé copias de seguridad.</p>
      <div class="row"><button class="ghost grow" data-a="informe">Informe para el médico</button><button class="ghost grow" data-a="export">Exportar copia</button></div>
      <div class="row" style="margin-top:8px"><button class="ghost grow" data-a="import">Importar copia</button><button class="dang grow" data-a="borrar">Borrar todo</button></div>
      <input id="fileIn" type="file" accept="application/json,.json" hidden>
    </div>`;
  }

  function render() {
    $('#view').innerHTML = views[tab]();
    document.querySelectorAll('#nav button').forEach(b => { if (b.dataset.t === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const n = new Date(); $('#topDate').textContent = `${n.getDate()}/${n.getMonth() + 1}`;
  }
  function go(t) { tab = t; render(); window.scrollTo(0, 0); }

  /* ---------- Acciones ---------- */
  const byId = (list, id) => list.find(x => x.id === id);
  function changed() { save(); render(); }

  function addAgua(sign) {
    const d = day(); d.agua = Math.max(0, d.agua + sign * S.settings.vaso); changed();
  }

  function exportar() {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `salud-activa-${hoy()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function importar(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const r = JSON.parse(rd.result);
        if (!r || typeof r !== 'object' || !r.days || !Array.isArray(r.peso)) throw new Error('formato');
        if (!confirm('Esto reemplaza los datos actuales. ¿Continuar?')) return;
        localStorage.setItem(KEY, JSON.stringify(r)); S = load(); setupReminders(); changed(); toast('Copia importada');
      } catch (e) { toast('El archivo no es una copia válida'); }
    };
    rd.readAsText(file);
  }

  function informe() {
    const s = S.settings, el = $('#informe');
    const pe = porFecha(S.peso).slice(0, 12);
    const pr = S.presion.slice().sort((a, b) => b.ts - a.ts).slice(0, 20);
    const co = porFecha(S.colesterol).slice(0, 8);
    const tabla = (cab, filas) => `<table><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr>${filas.map(f => `<tr>${f.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cab.length}">Sin registros</td></tr>`}</table>`;
    el.innerHTML = `<h1>Informe de salud — ${fmtFecha(hoy())}</h1>
      <p>Peso objetivo: ${s.pesoObj} kg (±${s.pesoTol}). Meta diaria: ${s.metaPasos} pasos, ${s.metaAgua} ml de agua.</p>
      ${s.notas.trim() ? `<h3>Indicaciones médicas anotadas</h3><p>${esc(s.notas).replace(/\n/g, '<br>')}</p>` : ''}
      <h3>Presión arterial</h3>${tabla(['Fecha', 'Máx/Mín', 'Pulso'], pr.map(r => [fmtTs(r.ts), `${r.sis}/${r.dia}`, r.pul || '-']))}
      <h3>Saturación de oxígeno</h3>${tabla(['Fecha', 'SpO2 %', 'Pulso'], S.spo2.slice().sort((a, b) => b.ts - a.ts).slice(0, 20).map(r => [fmtTs(r.ts), r.spo2, r.pul || '-']))}
      <h3>Peso</h3>${tabla(['Fecha', 'kg'], pe.map(r => [fmtFecha(r.fecha), r.kg]))}
      <h3>Colesterol (mg/dl)</h3>${tabla(['Fecha', 'Total', 'LDL', 'HDL', 'TG'], co.map(r => [fmtFecha(r.fecha), r.total ?? '-', r.ldl ?? '-', r.hdl ?? '-', r.tg ?? '-']))}`;
    document.body.classList.add('printing');
    window.onafterprint = () => document.body.classList.remove('printing');
    try { window.print(); } catch (e) { document.body.classList.remove('printing'); }
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a, id = b.dataset.id;
    switch (a) {
      case 'tab': go(b.dataset.t); break;
      case 'r+': { const it = byId(RUTINA, id), d = day(); d.rutina[id] = Math.min(it.meta, (d.rutina[id] || 0) + 1); changed(); break; }
      case 'r-': { const d = day(); d.rutina[id] = Math.max(0, (d.rutina[id] || 0) - 1); changed(); break; }
      case 'rok': { const it = byId(RUTINA, id), d = day(); d.rutina[id] = (d.rutina[id] || 0) >= it.meta ? 0 : it.meta; changed(); break; }
      case 'dolor': { if (S.dolor[id]) delete S.dolor[id]; else S.dolor[id] = true; changed(); break; }
      case 'serie': {
        const it = byId(CORE, id), d = day(), n = Math.min(it.series, (d.core[id] || 0) + 1);
        d.core[id] = n; changed(); if (n < it.series) startTimer(45, 'Descanso'); break;
      }
      case 'serie-': { const d = day(); d.core[id] = Math.max(0, (d.core[id] || 0) - 1); changed(); break; }
      case 'timer': startTimer(parseInt(b.dataset.s, 10) || 15, b.dataset.l || 'Temporizador'); break;
      case 'timer-stop': stopTimer(); break;
      case 'agua+': addAgua(1); break;
      case 'agua-': addAgua(-1); break;
      case 'motion': toggleMotion(); break;
      case 'pasos-add': case 'pasos-set': {
        const n = Math.round(num($('#pasosInput').value));
        if (!(n >= 0) || n > 100000) { toast('Ingresá una cantidad válida'); break; }
        const d = day(); d.pasos = a === 'pasos-add' ? d.pasos + n : n; changed(); break;
      }
      case 'sub': sub = b.dataset.v; render(); break;
      case 'del': {
        const k = b.dataset.k, i = parseInt(b.dataset.i, 10);
        if (Array.isArray(S[k]) && i >= 0 && i < S[k].length && confirm('¿Borrar este registro?')) { S[k].splice(i, 1); changed(); }
        break;
      }
      case 'export': exportar(); break;
      case 'import': $('#fileIn').click(); break;
      case 'informe': informe(); break;
      case 'borrar': if (confirm('Se borran todos tus datos de este dispositivo. ¿Seguro?')) { S = DEFAULTS(); setupReminders(); changed(); toast('Datos borrados'); } break;
    }
  });

  document.addEventListener('change', e => {
    if (e.target.id === 'fileIn' && e.target.files[0]) importar(e.target.files[0]);
  });

  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-f]'); if (!f) return;
    e.preventDefault();
    const fd = new FormData(f), kind = f.dataset.f, g = n => num(fd.get(n));
    const opt = n => { const v = fd.get(n); return v === null || String(v).trim() === '' ? null : num(v); };
    if (kind === 'presion') {
      const sis = g('sis'), dia = g('dia'), pul = opt('pul');
      if (!(sis >= 70 && sis <= 260) || !(dia >= 40 && dia <= 160) || sis <= dia) return toast('Revisá los valores de presión');
      if (pul !== null && !(pul >= 30 && pul <= 220)) return toast('Revisá el pulso');
      S.presion.push({ ts: Date.now(), sis: Math.round(sis), dia: Math.round(dia), pul: pul === null ? null : Math.round(pul) });
      changed(); toast('Presión guardada');
    } else if (kind === 'spo2') {
      const sat = g('spo2'), pul = opt('pul');
      if (!(sat >= 50 && sat <= 100)) return toast('Revisá la saturación');
      if (pul !== null && !(pul >= 30 && pul <= 220)) return toast('Revisá el pulso');
      S.spo2.push({ ts: Date.now(), spo2: Math.round(sat), pul: pul === null ? null : Math.round(pul) });
      changed(); toast('Saturación guardada');
    } else if (kind === 'peso') {
      const kg = g('kg'), fecha = String(fd.get('fecha') || '');
      if (!(kg >= 30 && kg <= 300) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return toast('Revisá el peso y la fecha');
      S.peso.push({ fecha, kg: Math.round(kg * 10) / 10 }); changed(); toast('Peso guardado');
    } else if (kind === 'colesterol') {
      const fecha = String(fd.get('fecha') || ''), r = { fecha };
      let alguno = false;
      for (const k of ['total', 'ldl', 'hdl', 'tg']) {
        const v = opt(k);
        if (v !== null) { if (!(v > 0 && v < 2000)) return toast('Revisá los valores'); r[k] = v; alguno = true; }
      }
      if (!alguno || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return toast('Cargá al menos un valor y la fecha');
      S.colesterol.push(r); changed(); toast('Análisis guardado');
    } else if (kind === 'ajustes') {
      const n = {
        pesoObj: g('pesoObj'), pesoTol: g('pesoTol'), metaPasos: g('metaPasos'), metaAgua: g('metaAgua'), vaso: g('vaso'),
        umbral: g('umbral'), pSis: g('pSis'), pDia: g('pDia'), recMin: g('recMin'), spo2Min: g('spo2Min')
      };
      if (Object.values(n).some(v => !(v > 0))) return toast('Revisá los valores: deben ser mayores que cero');
      if (n.recMin < 15) n.recMin = 15;
      if (n.spo2Min > 100) return toast('El umbral de saturación no puede pasar de 100');
      const horas = String(fd.get('horasSpo2') || '').split(',').map(h => h.trim()).filter(Boolean);
      if (horas.some(h => !/^([01]?\d|2[0-3]):[0-5]\d$/.test(h))) return toast('Horarios con formato HH:MM, ej: 09:00, 21:00');
      Object.assign(S.settings, n, { recAgua: fd.get('recAgua') === 'on', recSpo2: fd.get('recSpo2') === 'on', horasSpo2: horas.map(h => h.padStart(5, '0')).join(', '), notas: String(fd.get('notas') || '').slice(0, 1000) });
      if ((S.settings.recAgua || S.settings.recSpo2) && 'Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (er) { /* nada */ } }
      setupReminders(); changed(); toast('Ajustes guardados');
    }
  });

  /* ---------- Recordatorios (solo con la app abierta) ---------- */
  function notify(title, body) {
    toast(title);
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const o = { body, icon: 'icon-192.png', tag: title };
    const directo = () => { try { new Notification(title, o); } catch (e) { /* nada */ } };
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(r => r.showNotification(title, o)).catch(directo);
      else directo();
    } catch (e) { directo(); }
  }
  let recT = null, lastRec = Date.now(), lastSpo2 = '';
  function setupReminders() {
    clearInterval(recT); lastRec = Date.now();
    if (!S.settings.recAgua && !S.settings.recSpo2) return;
    recT = setInterval(() => {
      const n = new Date(), h = n.getHours();
      if (S.settings.recAgua && h >= 8 && h < 22 && Date.now() - lastRec >= S.settings.recMin * 60000) {
        lastRec = Date.now(); notify('💧 Hora de tomar agua', `Vaso de ${S.settings.vaso} ml`);
      }
      if (S.settings.recSpo2) {
        const k = `${hoy()} ${pad(h)}:${pad(n.getMinutes())}`;
        const horas = String(S.settings.horasSpo2 || '').split(',').map(x => x.trim().padStart(5, '0'));
        if (horas.includes(k.slice(11)) && lastSpo2 !== k) { lastSpo2 = k; notify('🫁 Hora de medir la saturación', 'Sentado, en reposo, con la mano tibia y quieta.'); }
      }
    }, 20000);
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);

  render();
  setupReminders();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });

  // Ganchos para pruebas automáticas.
  window.SA = { state: () => S, detectStep, step, presionNivel, spo2Nivel, go, render, chart };
})();
