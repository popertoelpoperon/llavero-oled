// Dibuja un cuadro de la pantalla (1024 bytes en formato gfx_buf) en un <canvas>,
// con los colores de la pantalla real: franja amarilla arriba (filas 0..15) y azul abajo.

const AMARILLO = '#ffd23f', AZUL = '#3fc3ff', FONDO = '#05070a';

export function medidas(zoom) {
  return { ancho: 128 * zoom, alto: 64 * zoom + 2 * zoom };
}

export function dibujar(canvas, gfx, zoom) {
  const { ancho, alto } = medidas(zoom);
  if (canvas.width !== ancho) canvas.width = ancho;
  if (canvas.height !== alto) canvas.height = alto;
  const g = canvas.getContext('2d');
  g.fillStyle = FONDO;
  g.fillRect(0, 0, ancho, alto);
  for (let y = 0; y < 64; y++) {
    g.fillStyle = y < 16 ? AMARILLO : AZUL;
    const oy = y * zoom + (y >= 16 ? 2 * zoom : 0);           // la franja está separada del resto
    for (let x = 0; x < 128; x++) {
      if (gfx[(y >> 3) * 128 + x] >> (y & 7) & 1) g.fillRect(x * zoom, oy, zoom, zoom);
    }
  }
}

const sinMovimiento = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// cuadros: [{gfx, ms}]. Devuelve una función para detener la animación.
// Con "reducir movimiento" activado en el sistema se muestra solo el primer cuadro.
export function animar(canvas, cuadros, zoom) {
  if (sinMovimiento()) { dibujar(canvas, cuadros[0].gfx, zoom); return () => {}; }
  let i = 0, timer = null, vivo = true;
  const paso = () => {
    if (!vivo) return;
    const { gfx, ms } = cuadros[i];
    dibujar(canvas, gfx, zoom);
    i = (i + 1) % cuadros.length;
    timer = setTimeout(paso, ms);
  };
  paso();
  return () => { vivo = false; clearTimeout(timer); };
}
