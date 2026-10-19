# Salud Activa

PWA personal de salud y actividad física. Un solo usuario, uso diario desde el celular, funciona sin conexión.
Idioma de la interfaz y de los textos: español rioplatense (voseo).

## Qué hace
- **Hoy**: resumen del día (pasos, agua, rutina, espalda) y rutina matutina con contador de repeticiones.
- **Pasos**: conteo con acelerómetro (`devicemotion`) solo con la app abierta, carga manual y gráfico de 7 días.
- **Espalda**: módulo de espalda y core (lun/mié/vie) con series, temporizador de descanso y tarjetas de técnica de levantamiento.
- **Hábitos**: *Actividad* (minutos de actividad aeróbica por fecha y tipo, meta semanal 150 min configurable, barra de la semana lunes–domingo y gráfico de 8 semanas; los pasos no la reemplazan) y *Alimentación* (checklist diario editable en Ajustes + contador semanal de pescado azul, meta 2, y % de cumplimiento de la semana).
- **Salud**: presión arterial, saturación de oxígeno (saturómetro, con umbral y recordatorio configurables), peso (objetivo 88 kg ± tolerancia), colesterol (LDL, HDL, total y TG por fecha; variación % contra el análisis anterior; gráfico por valor con línea de la meta de LDL) y agua, cada uno con gráfico SVG.
- **Ajustes**: metas (incluida la **meta de LDL, sin valor por defecto: la fija el médico**), umbrales de presión, agenda, recordatorios, editor del checklist, indicaciones del médico, respaldo JSON e informe para el médico (LDL/HDL/total/TG con variación, promedio semanal de actividad, cumplimiento del checklist, presión, peso).

## Estructura
```
index.html      shell + navegación inferior
styles.css      tema claro/oscuro, mobile first
app.js          toda la lógica (IIFE, sin dependencias)
figuras.js      ilustraciones SVG de los ejercicios (window.FIG(id)); un ejercicio nuevo necesita su pose aquí
sw.js           service worker (cache-first, offline)
manifest.json   instalación como app
icon.svg, icon-192.png, icon-512.png
tests/          suite de pruebas (Playwright + Chromium): `npm test`
capacitor.config.json, package.json, scripts/build-web.js   empaquetado Android (Capacitor)
android/        proyecto Android generado por Capacitor (manifest con Health Connect y notificaciones)
.github/workflows/android.yml   compila el APK en GitHub Actions
```

## App Android (Capacitor)
La misma PWA se empaqueta como APK. `app.js` detecta `window.Capacitor` (`NATIVE`):
- **Pasos**: lee los pasos del día/semana de Health Connect (`capacitor-health`, solo permiso `READ_STEPS`) al abrir, al volver a la app y cada 5 min. Los pasos los registra Google Fit / Salud de Samsung / etc.; la app no mide por sí misma.
- **Pasos del sensor** (`StepCounterPlugin`, `StepWorker`): `TYPE_STEP_COUNTER` del teléfono + WorkManager cada ~15 min guarda lecturas en SharedPreferences; la app las recoge al abrirse (`drain`) y reparte la diferencia por día (`acreditar`). Se puede detener/reanudar desde Pasos (`settings.segundoPlano`). Health Connect queda como importación manual opcional.
- **Plugins nativos en JS**: se acceden con `Capacitor.Plugins.<Nombre>` (`plug()`), no hay bundler.
- **Recordatorios**: notificaciones locales programadas (`@capacitor/local-notifications`), funcionan con la app cerrada. Se reprograman en `setupReminders()` cada vez que se guardan los ajustes.
- En la app nativa no se registra el service worker (los archivos van dentro del APK).
- Compilar: GitHub → Actions → "APK Android" → artefacto `salud-activa-apk` (APK debug). Localmente: `npm ci && npm run sync` y abrir `android/` en Android Studio.
- Si se agregan archivos web, sumarlos a `scripts/build-web.js` y a `sw.js`.

## Agenda y metas de ejercicios
- `settings.agRut*` (rutina matutina, por defecto todos los días 08:00) y `settings.agCore*` (espalda, por defecto lun/mié/vie 18:00) + `seguirOn/seguirHora` (pregunta nocturna y recordatorio al otro día). En Android se programan como notificaciones semanales (`scheduleNative`, ids 3000-3500).
- Las repeticiones y series **no tienen tope**: se puede superar la meta; se escribe el número exacto tocando el contador; `S.plan[id]` guarda metas propias por ejercicio.
- Espalda: "Lo hice todo" / "No pude hoy" (`day.omitido`, aviso único para mañana). `pendientes()` detecta sesiones incompletas de los últimos 7 días; "Repartir" las pasa a `S.recup` (máx. 3 por ejercicio, **como máximo 1 serie extra opcional por sesión**, por la lesión lumbar); "Dejarlo así" las cierra en `S.cerrados`.

## Respaldo y migración de datos (importante: el usuario carga datos reales)
- **Nunca** se pierden datos al actualizar: `load()` solo agrega campos nuevos, conserva claves desconocidas y, si el formato guardado es más viejo que `VERSION` (hoy 3), deja una copia intacta en `saludActivaV1_antes_v3`. Si el JSON está corrupto se conserva en `saludActivaV1_corrupto` en vez de pisarlo. Al importar un respaldo se guarda lo anterior en `saludActivaV1_antes_importar`.
- Si se cambia el formato: subir `VERSION`, mantener la migración aditiva y agregar una prueba con datos del formato anterior (`tests/10-respaldo-migracion.test.js`).
- Respaldo: *Exportar respaldo* (en el APK guarda en caché y abre el menú de compartir con `@capacitor/filesystem` + `@capacitor/share`; en la web descarga el archivo), *Copiar respaldo*, recordatorio en Hoy si pasaron 7 días (`settings.ultimoRespaldo`). *Borrar todo* ofrece exportar y pide doble confirmación.
- El informe en el APK se comparte como `.html` autónomo (no hay `window.print()`).

## Cómo correrlo
```
python3 -m http.server 8080      # o: npx serve .
```
Abrir http://localhost:8080. El service worker y `devicemotion` requieren HTTPS en el celular
(o localhost): desplegar en Vercel/Netlify/GitHub Pages para probar en el teléfono.

## Datos
Todo vive en `localStorage` bajo la clave `saludActivaV1`:
```
{ v(3), settings, days: { "YYYY-MM-DD": { pasos, agua, rutina:{id:reps}, core:{id:series}, comida?:{idItem:true}, pescado?:n, omitido?:true } },
  peso: [{fecha, kg}], presion: [{ts, sis, dia, pul}],
  colesterol: [{fecha, total?, ldl?, hdl?, tg?}],          // un registro por fecha (cargar la misma fecha lo completa)
  spo2: [{ts, spo2, pul}], aero: [{fecha, min, tipo}],      // actividad aeróbica
  comida: { items: [{id, n}] },                             // checklist diario editable
  dolor: { idEjercicio: true }, plan, cerrados, recup, sensor }
settings nuevos: ldlMeta (null = sin meta), aeroMeta (150), pescadoMeta (2), ultimoRespaldo, respaldoPospuesto
```
Si se cambia el formato, mantener `load()` tolerante y subir `v`. Si se cambian los archivos cacheados, subir `CACHE` en `sw.js`.

## Reglas de diseño (importante: la app es para alguien con hipertensión medicada, lesión lumbar por pinzamiento y antecedentes de cálculos renales)
- **No agregar** ejercicios con carga pesada, flexión de columna cargada, torsiones bruscas, saltos ni esfuerzos máximos. Todo ejercicio nuevo debe poder hacerse con espalda neutra y respirando (sin maniobra de Valsalva).
- Mantener el botón **"Me dolió"** y el aviso de cortar si hay dolor irradiado a la pierna, hormigueo o pérdida de fuerza.
- Los **umbrales médicos** (presión, peso, agua) son siempre configurables y vienen con el aviso de consultarlos con el médico. No hardcodear metas clínicas ni dar diagnósticos o dosis.
- La alerta de presión muy alta (≥180/120) debe mantenerse y remitir a atención médica.
- El agua tiene prioridad (prevención de cálculos): meta alta, recordatorio y registro simple.
- Mantener el pie de "ayuda personal, no reemplaza indicaciones médicas".
- **Oxalato / cálculos renales**: el checklist de alimentación NO incluye frutos secos, chía ni semillas por defecto; solo se agregan si el usuario lo decide con su médico. La meta de LDL no tiene valor por defecto. El aviso de repetir el análisis (2–3 meses, desde 14 días antes) aparece solo con la app abierta y así se aclara en pantalla.

## Convenciones
- JavaScript vanilla, sin frameworks ni build. Escapar siempre texto del usuario con `esc()` antes de ir a `innerHTML`.
- Re-renderizar con `render()` tras cambiar estado; para el contador de pasos usar `updateStepsUI()` (no re-renderiza).
- Botones táctiles de al menos 44 px (incluidos `.mini`, casillas y la lista de borrar; hay una prueba que lo verifica). Probar en 360 px de ancho.
- Cada vez que cambian los archivos cacheados, subir `CACHE` en `sw.js` (hoy `salud-activa-v3`) y mantener `scripts/build-web.js` y `ASSETS` alineados (lo verifica una prueba).
- Editar los archivos existentes en lugar de reescribirlos.

## Límites conocidos y próximos pasos
1. **Pasos**: en la web, acelerómetro con la pantalla encendida + carga manual. En Android, Health Connect (depende de que otra app registre los pasos). En Android hay lectura en segundo plano cada ~15 min (puede frenarla el ahorro de batería del fabricante).
2. **Recordatorios en la web**: solo con la app abierta. En la app Android ya son nativos.
3. **Sincronización entre dispositivos**: opcional con Supabase (misma pila de los otros proyectos), con RLS por usuario.
4. Ideas: racha de días, registro de sueño y energía, ajuste de rutina según "Me dolió", exportar PDF, calentamiento guiado.

## Pruebas
`npm test` (hace `node --check` de app.js, sw.js y figuras.js y corre `tests/run.js`; filtro opcional: `node tests/run.js "texto"`). Usa Playwright + Chromium (`CHROMIUM_PATH` si no está en `/opt/pw-browsers/chromium`), con fecha simulada (lunes 19/10/2026) y simulación de los plugins nativos de Capacitor.
Cubre: migración de datos viejos, respaldo/importación/borrado, colesterol y meta de LDL, aviso de nuevo análisis, actividad semanal, checklist, informe, agenda, pasos (sensor y Health Connect), sin conexión, 44 px, sin desbordes en 360 px y XSS. Toda novedad debe traer su prueba.
Antes de dar algo por terminado, además, abrir cada pestaña a mano en un teléfono (el APK no se prueba en CI).
