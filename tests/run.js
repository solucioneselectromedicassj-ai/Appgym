'use strict';
// Suite de pruebas de Salud Activa. Uso: node tests/run.js [filtro]   (CHROMIUM_PATH opcional)
const fs = require('fs');
const path = require('path');
const { correr } = require('./lib');
fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort().forEach(f => { console.log(f); require(path.join(__dirname, f)); });
correr(process.argv[2]);
