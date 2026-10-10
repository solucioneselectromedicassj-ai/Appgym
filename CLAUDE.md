# Salud Activa

PWA personal de salud y actividad física. Un solo usuario, uso diario desde el celular, funciona sin conexión.
Idioma de la interfaz y de los textos: español rioplatense (voseo).

## Qué hace
- **Hoy**: resumen del día (pasos, agua, rutina, espalda) y rutina matutina con contador de repeticiones.
- **Pasos**: conteo con acelerómetro (`devicemotion`) solo con la app abierta, carga manual y gráfico de 7 días.
- **Espalda**: módulo de espalda y core (lun/mié/vie) con series, temporizador de descanso y tarjetas de técnica de levantamiento.
- **Salud**: presión arterial, peso (objetivo 88 kg ± tolerancia), colesterol y agua, cada uno con gráfico SVG.
- **Ajustes**: metas, umbrales de presión, recordatorio de agua, indicaciones del médico, exportar/importar JSON e informe imprimible.

## Estructura
```
index.html      shell + navegación inferior
styles.css      tema claro/oscuro, mobile first
app.js          toda la lógica (IIFE, sin dependencias)
sw.js           service worker (cache-first, offline)
manifest.json   instalación como app
icon.svg, icon-192.png, icon-512.png
```

## Cómo correrlo
```
python3 -m http.server 8080      # o: npx serve .
```
Abrir http://localhost:8080. El service worker y `devicemotion` requieren HTTPS en el celular
(o localhost): desplegar en Vercel/Netlify/GitHub Pages para probar en el teléfono.

## Datos
Todo vive en `localStorage` bajo la clave `saludActivaV1`:
```
{ v, settings, days: { "YYYY-MM-DD": { pasos, agua, rutina:{id:reps}, core:{id:series} } },
  peso: [{fecha, kg}], presion: [{ts, sis, dia, pul}],
  colesterol: [{fecha, total?, ldl?, hdl?, tg?}], dolor: { idEjercicio: true } }
```
Si se cambia el formato, mantener `load()` tolerante y subir `v`. Si se cambian los archivos cacheados, subir `CACHE` en `sw.js`.

## Reglas de diseño (importante: la app es para alguien con hipertensión medicada, lesión lumbar por pinzamiento y antecedentes de cálculos renales)
- **No agregar** ejercicios con carga pesada, flexión de columna cargada, torsiones bruscas, saltos ni esfuerzos máximos. Todo ejercicio nuevo debe poder hacerse con espalda neutra y respirando (sin maniobra de Valsalva).
- Mantener el botón **"Me dolió"** y el aviso de cortar si hay dolor irradiado a la pierna, hormigueo o pérdida de fuerza.
- Los **umbrales médicos** (presión, peso, agua) son siempre configurables y vienen con el aviso de consultarlos con el médico. No hardcodear metas clínicas ni dar diagnósticos o dosis.
- La alerta de presión muy alta (≥180/120) debe mantenerse y remitir a atención médica.
- El agua tiene prioridad (prevención de cálculos): meta alta, recordatorio y registro simple.
- Mantener el pie de "ayuda personal, no reemplaza indicaciones médicas".

## Convenciones
- JavaScript vanilla, sin frameworks ni build. Escapar siempre texto del usuario con `esc()` antes de ir a `innerHTML`.
- Re-renderizar con `render()` tras cambiar estado; para el contador de pasos usar `updateStepsUI()` (no re-renderiza).
- Botones táctiles de al menos 44 px. Probar en 360 px de ancho.
- Editar los archivos existentes en lugar de reescribirlos.

## Límites conocidos y próximos pasos
1. **Pasos fiables todo el día**: una PWA no puede leer el podómetro del teléfono en segundo plano. Opciones: (a) Flutter con `health`/Health Connect (como Ocaland), (b) importar el total diario desde Google Fit/Health Connect. Hoy: acelerómetro con pantalla encendida + carga manual.
2. **Recordatorios**: hoy solo funcionan con la app abierta. Para push reales hace falta backend (Supabase + Web Push) o app nativa.
3. **Sincronización entre dispositivos**: opcional con Supabase (misma pila de los otros proyectos), con RLS por usuario.
4. Ideas: racha de días, registro de sueño y energía, ajuste de rutina según "Me dolió", exportar PDF, calentamiento guiado.

## Pruebas
Cuando se cambie `app.js`: abrir cada pestaña, cargar un registro de cada tipo, verificar gráficos, probar sin conexión
(DevTools → Application → Service Workers → Offline) y revisar la consola sin errores.
