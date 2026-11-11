// Bloque de datos que se graba en la partición "gafete" del firmware.
// Tiene que coincidir byte a byte con main/datos.c del firmware:
//   0  "GAF1" · 4 versión=1 (u16) · 6 n cuadros (u16)
//   8  nombre[16] · 24 rol[24] · 48 subtexto[32]   (UTF-8 terminado en 0)
//   80 n × (ms u16 + 1024 bytes de pantalla) · al final CRC-32 (u32) de todo lo anterior

export const DIRECCIONES = { bootloader: 0x0, particiones: 0x8000, app: 0x10000, datos: 0x110000 };

const MAX_CUADROS = 60;
const CAMPOS = [['nombre', 8, 16], ['rol', 24, 24], ['subtexto', 48, 32]];

export function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (const b of bytes) {
    crc ^= b;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return (~crc) >>> 0;
}

export function armarDatos({ nombre, rol, subtexto, cuadros }) {
  const n = cuadros.length;
  if (n < 1 || n > MAX_CUADROS) throw new Error(`La cara tiene que tener entre 1 y ${MAX_CUADROS} cuadros (tiene ${n}).`);
  const total = 80 + n * 1026;
  const buf = new Uint8Array(total + 4);
  const vista = new DataView(buf.buffer);
  buf.set([0x47, 0x41, 0x46, 0x31]);   // "GAF1"
  vista.setUint16(4, 1, true);
  vista.setUint16(6, n, true);

  const textos = { nombre, rol, subtexto };
  for (const [campo, desde, tam] of CAMPOS) {
    const bytes = new TextEncoder().encode(textos[campo]);
    if (bytes.length >= tam) throw new Error(`El ${campo} es demasiado largo para guardarlo.`);
    buf.set(bytes, desde);
  }

  cuadros.forEach(({ gfx, ms }, i) => {
    if (!(ms >= 50 && ms <= 5000)) throw new Error(`Cada cuadro tiene que durar entre 50 y 5000 ms (uno dura ${ms} ms).`);
    const desde = 80 + i * 1026;
    vista.setUint16(desde, ms, true);
    buf.set(gfx, desde + 2);
  });
  vista.setUint32(total, crc32(buf.subarray(0, total)), true);
  return buf;
}
