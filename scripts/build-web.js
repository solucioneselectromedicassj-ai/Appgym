// Copia los archivos de la PWA a www/ (carpeta que Capacitor empaqueta en la app Android).
const fs = require('fs');
const FILES = ['index.html', 'styles.css', 'app.js', 'figuras.js', 'sw.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png'];
fs.rmSync('www', { recursive: true, force: true });
fs.mkdirSync('www');
for (const f of FILES) fs.copyFileSync(f, `www/${f}`);
console.log(`www/ listo (${FILES.length} archivos)`);
