// Textos del gafete: normalizar, validar y dibujar con la misma letra que el firmware
// (pixel 5x7 agrandada; ver main/gfx.c, nombre.c y titulo.c del firmware).

export const ROLES = ['EXPOSITOR', 'EXPOSITORA', 'PROFESOR', 'PROFESORA', 'JURADO', 'VISITANTE'];
export const MAX_NOMBRE = 5;

const ANCHO = 128;
const ESCALAS_NOMBRE = [4, 3, 2];

// Cada letra: columnas usadas (recortadas como hace generar_fuentes.py), bit 0 = fila de arriba.
export function cargarFuente({ caracteres, columnas }) {
  const letras = new Map();
  caracteres.forEach((ch, i) => {
    const cols = columnas[i];
    const usadas = cols.map((c, j) => (c ? j : -1)).filter((j) => j >= 0);
    letras.set(ch, usadas.length ? cols.slice(usadas[0], usadas[usadas.length - 1] + 1) : null);
  });
  return letras;
}

const anchoLetra = (cols, escala) => (cols ? cols.length : 3) * escala;

export function anchoTexto(fuente, texto, escala) {
  const letras = [...texto];
  if (!letras.length) return 0;
  return letras.reduce((a, ch) => a + anchoLetra(fuente.get(ch), escala) + escala, 0) - escala;
}

// Saca tildes y diéresis pero conserva la Ñ
function sinTildes(s) {
  return s.replace(/ñ/g, '\u0001').replace(/Ñ/g, '\u0002')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'ñ').replace(/\u0002/g, 'Ñ');
}

export function normalizarNombre(s) {
  return sinTildes(s.trim()).toUpperCase();
}

export function validarNombre(fuente, s) {
  const valor = normalizarNombre(s);
  if (!valor) return { ok: false, valor, error: 'Escribí tu nombre.' };
  if (!/^[A-ZÑ0-9]+$/u.test(valor)) return { ok: false, valor, error: 'Solo letras (A–Z, Ñ) y números, sin espacios.' };
  if ([...valor].length > MAX_NOMBRE) return { ok: false, valor, error: `Hasta ${MAX_NOMBRE} letras (tiene ${[...valor].length}).` };
  const escala = ESCALAS_NOMBRE.find((k) => anchoTexto(fuente, valor, k) <= ANCHO - 4) ?? 2;
  return { ok: true, valor, escala };
}

function normalizarLinea(s) {
  return sinTildes(s.replace(/º/g, '°')).replace(/\s+/g, ' ').trim();
}

export function validarLinea(fuente, s, { escala = 2, max = ANCHO, permitirVacio = false } = {}) {
  const valor = normalizarLinea(s);
  if (!valor) return permitirVacio ? { ok: true, valor } : { ok: false, valor, error: 'No puede quedar vacío.' };
  const raras = [...new Set([...valor].filter((ch) => !fuente.has(ch)))];
  if (raras.length) return { ok: false, valor, error: `No se puede dibujar: ${raras.join(' ')}` };
  const ancho = anchoTexto(fuente, valor, escala);
  if (ancho > max) return { ok: false, valor, error: `No entra en la pantalla: sobran ${ancho - max} px. Probá con algo más corto.` };
  return { ok: true, valor };
}

// Curso y año, siempre en mayúsculas ("7°c" -> "7°C")
export function lineaDeAbajo(curso, anio) {
  return [curso, anio].map((t) => normalizarLinea(t).toUpperCase()).filter(Boolean).join(' ');
}

// ---------- dibujo (formato gfx_buf: pixel (x, y) = bit y&7 del byte (y>>3)*128 + x) ----------

function pixel(buf, x, y) {
  if (x < 0 || x >= ANCHO || y < 0 || y >= 64) return;
  buf[(y >> 3) * ANCHO + x] |= 1 << (y & 7);
}

function dibujarLinea(buf, fuente, texto, escala, y) {
  let x = Math.floor((ANCHO - anchoTexto(fuente, texto, escala)) / 2);
  for (const ch of texto) {
    const cols = fuente.get(ch);
    if (cols) {
      cols.forEach((c, i) => {
        for (let f = 0; f < 7; f++) {
          if (!(c >> f & 1)) continue;
          for (let a = 0; a < escala; a++) for (let b = 0; b < escala; b++) pixel(buf, x + i * escala + b, y + f * escala + a);
        }
      });
    }
    x += anchoLetra(cols, escala) + escala;
  }
}

// La pantalla final (rol en la franja, nombre y línea de abajo), ubicada como en el firmware
export function pantallaTexto(fuente, { rol, nombre, subtexto }) {
  const buf = new Uint8Array(1024);
  dibujarLinea(buf, fuente, rol, 2, Math.trunc((16 - 14) / 2));
  const ySub = 63 - 14;
  if (subtexto) dibujarLinea(buf, fuente, subtexto, 2, ySub);
  const escala = ESCALAS_NOMBRE.find((k) => anchoTexto(fuente, nombre, k) <= ANCHO - 4) ?? 2;
  const abajo = subtexto ? ySub - 3 : 63;
  const zonaAzul = 17;
  dibujarLinea(buf, fuente, nombre, escala, zonaAzul + Math.trunc((abajo - zonaAzul + 1 - 7 * escala) / 2));
  return buf;
}
