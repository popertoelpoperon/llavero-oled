// Piezas del llavero en STL de un solo color: cada pieza por separado o todas en una cama.
// Las partes de color que van incrustadas (nombre, logo y textos de los costados)
// no se incluyen: sus huecos quedan vacíos y se ven como grabado.
import { leerSTL, escribirSTL } from './stl.js';
import { aManifold } from './tapa.js';

// Cada pieza: [archivo dentro de piezas/, corrimiento en x]. Ya vienen ubicadas en una misma cama.
export const PIEZAS = [
  { archivo: 'carcasa', nombre: 'Carcasa', partes: [['1_carcasa/carcasa.stl', 0]] },
  { archivo: 'chasis', nombre: 'Chasis', partes: [['2_chasis/chasis.stl', 0]] },
  { archivo: 'tapa', nombre: 'Tapa', partes: [] },                     // la tapa con el nombre se genera aparte
  { archivo: 'botones', nombre: 'Botones', partes: [['7_botones/botones.stl', 0], ['7_botones/cara_azul.stl', 0]] },
  { archivo: 'medallon', nombre: 'Medallón', partes: [['4_medallon_logo/disco_blanco.stl', 0]] },
  { archivo: 'costados', nombre: 'Costados', partes: [['5_costado_derecho/placa.stl', 0], ['6_costado_izquierdo/placa.stl', 1]] },  // 1 mm para que no se toquen
];

const aBuffer = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);

async function piezasManifold(wasm, leer, tapa) {
  const cargar = async (ruta, dx) => {
    const m = aManifold(wasm, leerSTL(aBuffer(await leer(ruta))));
    return dx ? m.translate([dx, 0, 0]) : m;
  };
  const resultado = [];
  for (const p of PIEZAS) {
    const partes = p.archivo === 'tapa'
      ? [aManifold(wasm, leerSTL(aBuffer(tapa)))]
      : await Promise.all(p.partes.map(([ruta, dx]) => cargar(ruta, dx)));
    resultado.push({ ...p, manifold: wasm.Manifold.union(partes) });
  }
  return resultado;
}

// leer: async (ruta dentro de piezas/) => Uint8Array · tapa: STL de la tapa con el nombre
export async function armarPiezas(wasm, leer, tapa) {
  return (await piezasManifold(wasm, leer, tapa))
    .map(({ archivo, nombre, manifold }) => ({ archivo, nombre, stl: escribirSTL(manifold.getMesh()) }));
}

export async function armarCama(wasm, leer, tapa) {
  const piezas = await piezasManifold(wasm, leer, tapa);
  return escribirSTL(wasm.Manifold.union(piezas.map((p) => p.manifold)).getMesh());
}
