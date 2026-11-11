// Tapa del gafete con el nombre en relieve hundido (va en blanco, impreso aparte).
// Igual que herramientas/decoracion.py + carcasa_fusion.py del proyecto, sin Fusion:
//   - nombre con la letra pixel 5x7, píxeles de 1,2 mm, 0,6 mm de profundidad
//   - un rombo de 1,2 mm une los píxeles que solo se tocan por la esquina
//   - tapa = tapa base (sin nombre) − nombre
import { leerSTL, escribirSTL } from './stl.js';

const PIXEL = 1.2;
const PROFUNDIDAD = 0.6;
const PUENTE = 1.2;
const CENTRO = [121, 7.8];   // dónde queda el centro del nombre en los STL de la tapa

export function aManifold({ Manifold, Mesh }, { pos, tri }) {
  const mesh = new Mesh({ numProp: 3, vertProperties: pos, triVerts: tri });
  mesh.merge();
  return new Manifold(mesh);
}

// Celdas del nombre como celdas_linea de decoracion.py: cada letra ocupa sus columnas usadas
function celdas(fuente, texto) {
  const set = new Set();
  let x = 0;
  for (const ch of texto) {
    const cols = fuente.get(ch);
    if (cols) cols.forEach((c, i) => { for (let f = 0; f < 7; f++) if (c >> f & 1) set.add(`${x + i},${f}`); });
    x += (cols ? cols.length : 3) + 1;
  }
  return { set, ancho: x - 1 };
}

function poligonosNombre(fuente, texto) {
  const { set, ancho } = celdas(fuente, texto);
  const hay = (c, f) => set.has(`${c},${f}`);
  const u0 = (ancho * PIXEL) / 2, v0 = (7 * PIXEL) / 2;   // centrado en (0, 0), v hacia abajo
  const P = (x, y) => [x - u0, y - v0];
  const polis = [];
  for (const clave of set) {
    const [c, f] = clave.split(',').map(Number);
    const x = c * PIXEL, y = f * PIXEL;
    polis.push([P(x, y), P(x + PIXEL, y), P(x + PIXEL, y + PIXEL), P(x, y + PIXEL)]);
    for (const dc of [-1, 1]) {
      if (hay(c + dc, f + 1) && !hay(c + dc, f) && !hay(c, f + 1)) {
        const ex = (c + (dc > 0 ? 1 : 0)) * PIXEL, ey = (f + 1) * PIXEL, r = PUENTE / 2;
        polis.push([P(ex - r, ey), P(ex, ey - r), P(ex + r, ey), P(ex, ey + r)]);
      }
    }
  }
  // Todos con la misma orientación para que la regla 'Positive' los una
  return polis.map((p) => (area(p) < 0 ? p.reverse() : p));
}

const area = (p) => p.reduce((a, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return a + x * y2 - x2 * y; }, 0) / 2;

export async function generarTapa(wasm, fuente, nombre, tapaBaseBuf) {
  const { CrossSection } = wasm;
  const plano = new CrossSection(poligonosNombre(fuente, nombre), 'Positive');
  const letras = plano.extrude(PROFUNDIDAD).translate([CENTRO[0], CENTRO[1], 0]);
  const datos = tapaBaseBuf.buffer ? tapaBaseBuf.buffer.slice(tapaBaseBuf.byteOffset, tapaBaseBuf.byteOffset + tapaBaseBuf.byteLength) : tapaBaseBuf;
  const base = aManifold(wasm, leerSTL(datos));
  const tapa = base.subtract(letras);
  return { tapa: escribirSTL(tapa.getMesh()), nombre: escribirSTL(letras.getMesh()) };
}
