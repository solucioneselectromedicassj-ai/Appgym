'use strict';
/* Ilustraciones de ejercicios: figuras de palitos en SVG, sin imágenes externas (funcionan sin conexión).
   Cada ejercicio tiene 1 o 2 poses (inicio → final). Las partes que se mueven van en color de acento. */
(function () {
  const L = (pts, cls) => `<polyline points="${pts.map(p => p.join(',')).join(' ')}" class="${cls || 'bd'}"/>`;
  const H = (x, y, cls) => `<circle cx="${x}" cy="${y}" r="7" class="${cls || 'bd'} hd"/>`;
  const FLOOR = (w, y = 96) => `<line x1="2" y1="${y}" x2="${w - 2}" y2="${y}" class="fl"/>`;

  // Pose de pie de frente. o = {head, sh, hip, la, ra, ll, rl} (cada extremidad es una lista de puntos).
  function pie(o, mv) {
    const m = k => (mv || []).includes(k) ? 'mv' : 'bd';
    const sh = o.sh || [50, 28], hip = o.hip || [50, 58];
    return FLOOR(100) + H(...(o.head || [50, 16]), m('head')) + L([(o.head ? [o.head[0], o.head[1] + 7] : [50, 23]), sh, hip], m('torso')) +
      L([sh, ...(o.la || [[38, 44], [36, 60]])], m('la')) + L([sh, ...(o.ra || [[62, 44], [64, 60]])], m('ra')) +
      L([hip, ...(o.ll || [[44, 78], [44, 96]])], m('ll')) + L([hip, ...(o.rl || [[56, 78], [56, 96]])], m('rl'));
  }
  // Pose de pie de perfil (mira hacia la derecha).
  function perfil(o, mv) {
    const m = k => (mv || []).includes(k) ? 'mv' : 'bd';
    const head = o.head || [50, 16], sh = o.sh || [50, 28], hip = o.hip || [48, 58];
    return FLOOR(100) + H(...head, m('head')) + L([[head[0], head[1] + 7], sh, hip], m('torso')) +
      L([sh, ...(o.arm || [[52, 44], [50, 58]])], m('arm')) +
      L([hip, ...(o.leg || [[50, 78], [50, 96], [58, 96]])], m('leg')) +
      L([hip, ...(o.leg2 || [[50, 78], [50, 96], [58, 96]])], m('leg2'));
  }
  // Pose en el piso (ancho 120). Se pasan los trazos ya armados.
  const piso = (...parts) => FLOOR(120, 94) + parts.join('');

  const POSES = {
    giros: {
      w: 100, cap: ['Cadera a la izquierda', 'Cadera a la derecha'],
      p: [
        pie({ hip: [44, 58], sh: [50, 28], la: [[38, 40], [43, 58]], ra: [[62, 40], [53, 58]], ll: [[42, 78], [44, 96]], rl: [[50, 78], [56, 96]] }, ['torso', 'll', 'rl']),
        pie({ hip: [56, 58], sh: [50, 28], la: [[38, 40], [47, 58]], ra: [[62, 40], [57, 58]], ll: [[50, 78], [44, 96]], rl: [[58, 78], [56, 96]] }, ['torso', 'll', 'rl'])
      ]
    },
    brazos: {
      w: 100, cap: ['Brazos abajo', 'Brazos abiertos'],
      p: [
        pie({}, []),
        pie({ la: [[32, 28], [14, 28]], ra: [[68, 28], [86, 28]] }, ['la', 'ra'])
      ]
    },
    piernas: {
      w: 100, cap: ['De pie', 'Flexioná rodillas'],
      p: [
        pie({ la: [[38, 40], [44, 58]], ra: [[62, 40], [56, 58]] }, []),
        pie({ head: [50, 26], sh: [50, 38], hip: [50, 68], la: [[38, 50], [44, 68]], ra: [[62, 50], [56, 68]], ll: [[39, 82], [42, 96]], rl: [[61, 82], [58, 96]] }, ['ll', 'rl'])
      ]
    },
    aperturas: {
      w: 100, cap: ['Codos al frente', 'Abrí el pecho'],
      p: [
        pie({ la: [[36, 38], [48, 42]], ra: [[64, 38], [52, 42]] }, []),
        pie({ la: [[34, 34], [22, 24]], ra: [[66, 34], [78, 24]] }, ['la', 'ra'])
      ]
    },
    rodillas: {
      w: 100, cap: ['De pie', 'Subí la rodilla'],
      p: [
        perfil({}, []),
        perfil({ leg: [[68, 60], [66, 80]], arm: [[40, 42], [50, 50]] }, ['leg', 'arm'])
      ]
    },
    agacharse: {
      w: 100, cap: ['De pie', 'Bajá con la espalda recta'],
      p: [
        perfil({}, []),
        perfil({ head: [56, 34], sh: [50, 44], hip: [32, 72], arm: [[64, 54], [72, 62]], leg: [[56, 76], [48, 96], [56, 96]], leg2: [[56, 76], [48, 96], [56, 96]] }, ['head', 'torso', 'leg', 'arm'])
      ]
    },
    gato: {
      w: 120, cap: ['Espalda redondeada', 'Espalda arqueada hacia abajo'],
      p: [
        piso(H(88, 66, 'mv'), `<path d="M36 60 Q58 40 80 58" class="mv"/>`, L([[80, 58], [80, 92]]), L([[36, 60], [36, 92], [18, 92]])),
        piso(H(92, 50, 'mv'), `<path d="M36 60 Q58 74 80 58" class="mv"/>`, L([[80, 58], [80, 92]]), L([[36, 60], [36, 92], [18, 92]]))
      ]
    },
    bird: {
      w: 120, cap: ['En cuatro apoyos', 'Brazo y pierna contrarios'],
      p: [
        piso(H(92, 52), L([[36, 58], [80, 58]]), L([[80, 58], [80, 92]]), L([[36, 58], [36, 92], [18, 92]])),
        piso(H(92, 52), L([[36, 58], [80, 58]]), L([[80, 58], [80, 92]]), L([[36, 58], [36, 92], [18, 92]], 'bd ds'),
          L([[80, 58], [112, 54]], 'mv'), L([[36, 58], [6, 62]], 'mv'))
      ]
    },
    deadbug: {
      w: 120, cap: ['Rodillas y brazos arriba', 'Estirá brazo y pierna contrarios'],
      p: [
        piso(H(12, 84), L([[20, 86], [70, 86]]), L([[26, 86], [26, 52]]), L([[70, 86], [70, 52], [92, 52]])),
        piso(H(12, 84), L([[20, 86], [70, 86]]), L([[26, 86], [26, 52]], 'bd ds'), L([[26, 86], [4, 86]], 'mv'),
          L([[70, 86], [70, 52], [92, 52]], 'bd ds'), L([[70, 86], [112, 84]], 'mv'))
      ]
    },
    puente: {
      w: 120, cap: ['Boca arriba, rodillas flexionadas', 'Subí la cadera'],
      p: [
        piso(H(12, 84), L([[20, 86], [56, 86]]), L([[56, 86], [78, 60], [84, 88]]), L([[24, 88], [50, 90]])),
        piso(H(12, 84), L([[20, 86], [56, 70]], 'mv'), L([[56, 70], [80, 54], [84, 88]]), L([[24, 88], [50, 90]]))
      ]
    },
    lateral: {
      w: 120, cap: ['Mantené el cuerpo en línea'],
      p: [
        piso(H(18, 52), L([[24, 66], [60, 76], [92, 88]], 'mv'), L([[24, 66], [24, 90], [38, 90]]), L([[92, 88], [112, 90]]), L([[24, 66], [38, 52]], 'bd ds'))
      ]
    },
    plancha: {
      w: 120, cap: ['Cuerpo en línea, abdomen firme'],
      p: [
        piso(H(18, 60), L([[34, 70], [68, 76], [92, 88]], 'mv'), L([[34, 70], [34, 90], [16, 90]]), L([[92, 88], [112, 90]]))
      ]
    }
  };

  window.FIG = function (id) {
    const f = POSES[id]; if (!f) return '';
    const n = f.p.length, w = f.w, gap = 24, W = n * w + (n - 1) * gap;
    let g = '';
    f.p.forEach((p, i) => {
      g += `<g transform="translate(${i * (w + gap)} 0)">${p}</g>`;
      if (i < n - 1) g += `<path d="M${i * (w + gap) + w + 4} 50 l16 0 m-6 -6 l6 6 l-6 6" class="ar"/>`;
    });
    const caps = f.cap.map(c => `<span>${c}</span>`).join('');
    return `<div class="fig"><svg viewBox="0 0 ${W} 100" role="img" aria-label="${f.cap.join(' → ')}">${g}</svg><div class="figcap">${caps}</div></div>`;
  };
})();
