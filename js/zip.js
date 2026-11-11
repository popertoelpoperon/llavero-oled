// Escritor de .zip mínimo: sin compresión ("store"), nombres en UTF-8.
import { crc32 } from './datos.js';

export function armarZip(archivos) {
  const enc = new TextEncoder();
  const locales = [], centrales = [];
  let desplazamiento = 0;
  for (const { nombre, datos } of archivos) {
    const n = enc.encode(nombre);
    const crc = crc32(datos);
    const cabecera = (firma, tam) => {
      const b = new Uint8Array(tam + n.length);
      const v = new DataView(b.buffer);
      v.setUint32(0, firma, true);
      return [b, v];
    };
    const [local, vl] = cabecera(0x04034b50, 30);
    vl.setUint16(4, 20, true);            // versión necesaria
    vl.setUint16(6, 0x0800, true);        // bit 11: nombre en UTF-8
    vl.setUint32(14, crc, true);
    vl.setUint32(18, datos.length, true);
    vl.setUint32(22, datos.length, true);
    vl.setUint16(26, n.length, true);
    local.set(n, 30);

    const [central, vc] = cabecera(0x02014b50, 46);
    vc.setUint16(4, 20, true);
    vc.setUint16(6, 20, true);
    vc.setUint16(8, 0x0800, true);
    vc.setUint32(16, crc, true);
    vc.setUint32(20, datos.length, true);
    vc.setUint32(24, datos.length, true);
    vc.setUint16(28, n.length, true);
    vc.setUint32(42, desplazamiento, true);
    central.set(n, 46);

    locales.push(local, datos);
    centrales.push(central);
    desplazamiento += local.length + datos.length;
  }
  const tamCentral = centrales.reduce((a, b) => a + b.length, 0);
  const fin = new Uint8Array(22);
  const vf = new DataView(fin.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(8, archivos.length, true);
  vf.setUint16(10, archivos.length, true);
  vf.setUint32(12, tamCentral, true);
  vf.setUint32(16, desplazamiento, true);

  const partes = [...locales, ...centrales, fin];
  const zip = new Uint8Array(partes.reduce((a, b) => a + b.length, 0));
  let o = 0;
  for (const p of partes) { zip.set(p, o); o += p.length; }
  return zip;
}
