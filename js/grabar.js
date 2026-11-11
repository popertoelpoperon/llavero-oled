// Graba el llavero desde el navegador (Web Serial) con esptool-js, la herramienta oficial
// de Espressif: firmware (bootloader, particiones y app) + los datos de la persona.
import { DIRECCIONES } from './datos.js';

const ESPRESSIF = 0x303A;   // fabricante USB del ESP32-C3

export function armarArchivos({ bootloader, particiones, app }, datos) {
  return [
    { data: bootloader, address: DIRECCIONES.bootloader },
    { data: particiones, address: DIRECCIONES.particiones },
    { data: app, address: DIRECCIONES.app },
    { data: datos, address: DIRECCIONES.datos },
  ];
}

export function progresoTotal(archivos, indice, escrito, total) {
  const tam = archivos.map((a) => a.data.length);
  const todo = tam.reduce((a, b) => a + b, 0);
  const antes = tam.slice(0, indice).reduce((a, b) => a + b, 0);
  return ((antes + (escrito / total) * tam[indice]) / todo) * 100;
}

const MODO_DESCARGA = 'mantené apretado BOOT, apretá y soltá RST, soltá BOOT y volvé a intentar.';

// fase: 'conectando' (antes de empezar a escribir) o 'grabando' (a mitad de la grabación)
export function mensajeError(e, fase = 'conectando') {
  if (fase === 'grabando') {
    return 'La grabación no terminó (¿se movió el cable?). El llavero puede quedar apagado hasta grabarlo de nuevo: '
      + MODO_DESCARGA;
  }
  if (e?.name === 'NotFoundError') {
    return 'No elegiste ningún dispositivo. Si el llavero no aparecía en la lista: enchufalo con un cable USB de datos '
      + `y apretá RST. Si sigue sin aparecer, ${MODO_DESCARGA}`;
  }
  const m = String(e?.message ?? e);
  if (/open|busy|ocupado/i.test(m)) return 'El puerto está ocupado: cerrá otro programa que lo esté usando (Arduino, monitor serie, otra pestaña) y probá de nuevo.';
  return `No se pudo conectar con el llavero. Enchufalo con un cable USB de datos y apretá RST. Si sigue sin aparecer, ${MODO_DESCARGA}`;
}

// Reinicio con el watchdog del chip (como esptool --after watchdog_reset). En el ESP32-C3
// el reinicio por las líneas del USB a veces lo deja en modo descarga y hay que apretar RST;
// el watchdog lo reinicia desde adentro y arranca el programa recién grabado.
const RTC_CNTL = 0x60008000;
export async function reiniciarConWatchdog(cargador, espera = 500) {
  await cargador.writeReg(RTC_CNTL + 0xA8, 0x50D83AA1);                          // desbloquear
  await cargador.writeReg(RTC_CNTL + 0x94, 2000);                                // tiempo
  await cargador.writeReg(RTC_CNTL + 0x90, ((1 << 31) | (5 << 28) | (1 << 8) | 2) >>> 0);   // activar
  await cargador.writeReg(RTC_CNTL + 0xA8, 0);                                   // bloquear
  await new Promise((r) => setTimeout(r, espera));
}

async function leerBin(nombre) {
  const r = await fetch(new URL(`../firmware/${nombre}`, import.meta.url));
  if (!r.ok) throw new Error(`Falta el firmware (${nombre}).`);
  return new Uint8Array(await r.arrayBuffer());
}

export async function grabar(datosGafete, alProgreso = () => {}) {
  let puerto;
  try {
    puerto = await navigator.serial.requestPort({ filters: [{ usbVendorId: ESPRESSIF }] });
  } catch (e) {
    throw new Error(mensajeError(e));
  }
  const { ESPLoader, Transport } = await import('../vendor/esptool-js/bundle.js');
  const [bootloader, particiones, app] = await Promise.all(['bootloader.bin', 'partition-table.bin', 'pantallaexpo.bin'].map(leerBin));
  const archivos = armarArchivos({ bootloader, particiones, app }, datosGafete);
  const transporte = new Transport(puerto, false);
  try {
    alProgreso(0, 'Conectando con el llavero…');
    const cargador = new ESPLoader({ transport: transporte, baudrate: 460800, terminal: { clean() {}, writeLine() {}, write() {} } });
    let chip;
    try {
      chip = await cargador.main();
    } catch (e) {
      throw new Error(mensajeError(e));
    }
    if (!/ESP32-C3/i.test(chip)) throw new Error(`Esto no parece el llavero (es un ${chip}, se esperaba un ESP32-C3).`);
    alProgreso(0, 'Grabando…');
    try {
      await cargador.writeFlash({
        fileArray: archivos, flashMode: 'keep', flashFreq: 'keep', flashSize: 'keep', eraseAll: false, compress: true,
        reportProgress: (i, escrito, total) => alProgreso(progresoTotal(archivos, i, escrito, total), 'Grabando…'),
      });
    } catch (e) {
      throw new Error(mensajeError(e, 'grabando'));
    }
    alProgreso(100, 'Reiniciando el llavero…');
    try {
      await reiniciarConWatchdog(cargador);
    } catch {
      await cargador.after('hard_reset').catch(() => {});   // ya está grabado: si no reinicia solo, alcanza con apretar RST
    }
  } finally {
    await transporte.disconnect().catch(() => {});
  }
}
