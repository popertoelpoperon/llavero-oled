// Configurador del llavero OLED: pasos, estado (guardado en el navegador), llavero en vivo y acciones finales.
import { cargarFuente, validarNombre, validarLinea, lineaDeAbajo, pantallaTexto, ROLES, MAX_NOMBRE } from './textos.js';
import { dibujar, animar } from './pantalla.js';
import { armarDatos } from './datos.js';
import { armarZip } from './zip.js';

const PASOS = ['Nombre', 'Rol', 'Curso', 'Cara', 'Resumen', 'Listo'];
const TEXTO_MS = 3000;   // cuánto se ve la pantalla de texto en el loop del gafete

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, ...hijos) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...hijos);
  return e;
};

const inicial = { paso: 0, nombre: '', rol: 'EXPOSITOR', rolOtro: '', curso: '', anio: String(new Date().getFullYear()), cara: 'clasica' };

// Lo guardado puede estar roto o ser de otra versión: solo se toman los valores con el tipo esperado
function cargarGuardado() {
  let guardado = {};
  try { guardado = JSON.parse(localStorage.getItem('gafete')) ?? {}; } catch { /* roto o bloqueado: se empieza de cero */ }
  const e = { ...inicial };
  for (const k of Object.keys(inicial)) if (typeof guardado?.[k] === typeof inicial[k]) e[k] = guardado[k];
  if (!Number.isInteger(e.paso) || e.paso < 0) e.paso = 0;
  return e;
}
const estado = cargarGuardado();
const guardar = () => { try { localStorage.setItem('gafete', JSON.stringify(estado)); } catch { /* sin almacenamiento: no se recuerda */ } };

let fuente, caras;
let detener = [];   // animaciones del paso actual

const decodificar = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const cara = (id) => caras.find((c) => c.id === id) ?? caras[0];

// ---------- valores ya validados ----------
const nombre = () => validarNombre(fuente, estado.nombre);
const rol = () => validarLinea(fuente, estado.rol === 'OTRO' ? estado.rolOtro.toUpperCase() : estado.rol);
const subtexto = () => validarLinea(fuente, lineaDeAbajo(estado.curso, estado.anio), { permitirVacio: true });
const todoOk = () => ({ ok: nombre().ok && rol().ok && subtexto().ok });
const VALIDAR = [nombre, rol, subtexto, () => ({ ok: true }), todoOk, todoOk];

function textoActual() {
  return { rol: rol().valor || ' ', nombre: nombre().valor || '', subtexto: subtexto().ok ? subtexto().valor : '' };
}

// ---------- el gafete de la izquierda ----------
// En los pasos de texto muestra la pantalla de texto (se actualiza al escribir);
// desde la cara en adelante repite el loop real: cara animada y después el texto.
let detenerGafete = () => {};
function actualizarGafete() {
  detenerGafete();
  const lienzo = $('#pantalla');
  const texto = () => ({ gfx: pantallaTexto(fuente, textoActual()), ms: TEXTO_MS });
  if (estado.paso < 3) {
    dibujar(lienzo, texto().gfx, 2);
    $('#leyenda').textContent = 'Así se va a ver tu llavero. Se actualiza mientras escribís.';
    detenerGafete = () => {};
    return;
  }
  const c = cara(estado.cara);
  $('#leyenda').textContent = `${c.nombre}: ${c.desc.charAt(0).toLowerCase()}${c.desc.slice(1)} Después aparece tu nombre, y vuelve a empezar.`;
  detenerGafete = animar(lienzo, [...cara(estado.cara).cuadros, texto()], 2);
}

// ---------- piezas de los pasos ----------
function mensaje(r, escrito) {
  // Si está bien no se dice nada; solo se avisa si hay un error o si se graba distinto a lo escrito
  let texto = r.ok ? '' : r.error;
  if (r.ok && escrito !== undefined && r.valor !== escrito.trim()) texto = `Se graba como ${r.valor}: la pantalla no tiene tildes.`;
  return el('p', { id: 'mensaje', className: `mensaje ${r.ok ? 'aviso' : 'error'}`, textContent: texto });
}

// Campo de texto que muestra en mayúsculas lo mismo que se graba
function campo(props, alCambiar) {
  const input = el('input', { autocomplete: 'off', spellcheck: false, ...props });
  input.addEventListener('input', () => {
    const pos = input.selectionStart;
    input.value = input.value.toUpperCase();
    input.setSelectionRange(pos, pos);
    alCambiar(input.value);
    guardar();
    refrescar();
  });
  return input;
}

// Solo actualiza el mensaje, el botón y el gafete (sin perder el foco del campo)
function refrescar() {
  const r = VALIDAR[estado.paso]();
  $('#mensaje')?.replaceWith(mensaje(r, estado.paso === 0 ? estado.nombre : undefined));
  $('#siguiente').disabled = !r.ok;
  actualizarGafete();
}

const titulo = (texto, ayuda) => [el('h2', { textContent: texto }), el('p', { className: 'ayuda', textContent: ayuda })];

const pasos = [
  () => [
    ...titulo('¿Cómo te llamás?', `Hasta ${MAX_NOMBRE} letras. Va en grande en la pantalla y hundido en la tapa.`),
    campo({ value: estado.nombre, maxLength: 12, placeholder: 'FACU', className: 'grande', autofocus: true, ariaLabel: 'Nombre' }, (v) => { estado.nombre = v; }),
    mensaje(nombre(), estado.nombre),
  ],
  () => {
    const opciones = [...ROLES, 'OTRO'].map((r) => {
      const b = el('button', { type: 'button', className: 'opcion', textContent: r === 'OTRO' ? 'Otro…' : r });
      b.setAttribute('aria-pressed', String(estado.rol === r));
      b.addEventListener('click', () => { estado.rol = r; guardar(); mostrar(); });
      return b;
    });
    return [
      ...titulo('¿Qué rol tenés?', 'Va en la franja amarilla de arriba de la pantalla.'),
      el('div', { className: 'opciones' }, ...opciones),
      ...(estado.rol === 'OTRO' ? [campo({ value: estado.rolOtro, maxLength: 20, placeholder: 'COORDINADOR', autofocus: true, ariaLabel: 'Otro rol' }, (v) => { estado.rolOtro = v; })] : []),
      mensaje(rol()),
    ];
  },
  () => {
    const curso = campo({ value: estado.curso, maxLength: 12, placeholder: '6°C', autofocus: true, ariaLabel: 'Curso' }, (v) => { estado.curso = v; });
    const grado = el('button', { type: 'button', className: 'secundario', textContent: '°', title: 'Agregar el símbolo de grado' });
    grado.addEventListener('click', () => { curso.value += '°'; curso.dispatchEvent(new Event('input')); curso.focus(); });
    return [
      ...titulo('Curso y año', 'Van en la línea chica de abajo. Si no querés ponerlos, dejalos vacíos.'),
      el('div', { className: 'fila' }, curso, grado),
      campo({ value: estado.anio, maxLength: 8, placeholder: 'Año', ariaLabel: 'Año' }, (v) => { estado.anio = v; }),
      mensaje(subtexto()),
    ];
  },
  () => {
    const grupo = (estilo, nombreGrupo) => el('div', { className: 'grupo-caras' },
      el('h3', { textContent: nombreGrupo }),
      el('div', { className: 'caras' }, ...caras.filter((c) => c.estilo === estilo).map((c) => {
        const lienzo = el('canvas');
        detener.push(animar(lienzo, c.cuadros, 1));
        const b = el('button', { type: 'button', className: 'cara', title: c.desc }, lienzo, el('strong', { textContent: c.nombre }));
        b.setAttribute('aria-pressed', String(c.id === estado.cara));
        b.addEventListener('click', () => {
          estado.cara = c.id;
          guardar();
          document.querySelectorAll('.cara').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          actualizarGafete();
        });
        return b;
      })));
    return [
      ...titulo('Elegí tu cara', 'La que elijas aparece en el llavero, con su animación completa.'),
      grupo('clasica', 'Estilo clásico'),
      grupo('robot', 'Estilo robot'),
    ];
  },
  () => {
    const fila = (etiqueta, valor, paso) => {
      const b = el('button', { type: 'button', className: 'secundario', textContent: 'Cambiar' });
      b.addEventListener('click', () => irA(paso));
      return [el('dt', { textContent: etiqueta }), el('dd', { textContent: valor || 'Sin completar' }), el('div', {}, b)];
    };
    return [
      ...titulo('Revisá cómo quedó', 'Esto es lo que se va a grabar en el llavero y lo que va en la tapa.'),
      el('dl', { className: 'datos' },
        ...fila('Nombre', nombre().valor, 0), ...fila('Rol', rol().valor, 1),
        ...fila('Curso y año', subtexto().valor, 2), ...fila('Cara', cara(estado.cara).nombre, 3)),
    ];
  },
  () => {
    const puedeGrabar = 'serial' in navigator;
    const btnGrabar = el('button', { type: 'button', className: 'principal', textContent: 'Grabar en el llavero', disabled: !puedeGrabar });
    const barra = el('progress', { max: 100, value: 0, hidden: true });
    const estadoGrabar = el('p', { className: 'mensaje', textContent: puedeGrabar ? '' : 'Este navegador no puede grabar por USB. Abrí la página en Chrome o Edge.' });
    btnGrabar.addEventListener('click', () => grabarGafete(btnGrabar, barra, estadoGrabar));

    const estadoStl = el('p', { className: 'mensaje' });
    const descarga = (texto, clase, archivo) => {
      const b = el('button', { type: 'button', className: clase, textContent: texto });
      b.addEventListener('click', () => descargarSTL(b, estadoStl, archivo));
      return b;
    };
    const btnCama = descarga('Descargar STL', 'principal', 'cama');
    const btnPartes = descarga('Descargar partes separadas', 'secundario', 'partes');

    return [
      ...titulo('¡Listo!', 'Te queda grabar el llavero, imprimir la carcasa y armarlo.'),
      el('div', { className: 'acciones' },
        el('div', { className: 'accion' },
          el('h3', { textContent: 'Grabar el llavero' }),
          el('p', { className: 'ayuda', textContent: 'Enchufalo a la compu con un cable USB de datos y apretá RST. Después tocá el botón y elegí el dispositivo de la lista.' }),
          btnGrabar, barra, estadoGrabar),
        el('div', { className: 'accion' },
          el('h3', { textContent: 'Imprimir la carcasa' }),
          el('p', { className: 'ayuda', textContent: 'Todas las piezas juntas en un solo archivo, o cada una en su archivo. Tu nombre va grabado en la tapa.' }),
          el('div', { className: 'botones' }, btnCama, btnPartes),
          estadoStl),
        el('div', { className: 'accion' },
          el('h3', { textContent: 'Armarlo' }),
          el('p', { className: 'ayuda', textContent: 'Cómo se conecta cada componente y cómo va cada pieza, paso a paso con imágenes.' }),
          el('a', { className: 'guia', href: 'https://github.com/popertoelpoperon/llavero-oled#armado', target: '_blank', rel: 'noopener', textContent: 'Ver la guía de armado' }))),
    ];
  },
];

// ---------- acciones finales ----------
function datosGafete() {
  return armarDatos({ ...textoActual(), cuadros: cara(estado.cara).cuadros });
}

async function grabarGafete(boton, barra, salida) {
  boton.disabled = true;
  barra.hidden = false;
  barra.value = 0;
  salida.className = 'mensaje';
  try {
    const { grabar } = await import('./grabar.js');
    await grabar(datosGafete(), (pct, texto) => { barra.value = pct; salida.textContent = texto; });
    salida.className = 'mensaje ok';
    salida.textContent = 'Grabado. El llavero se reinicia solo y arranca con tu cara y tu nombre.';
  } catch (e) {
    salida.className = 'mensaje error';
    salida.textContent = e.message;
    barra.hidden = true;
  } finally {
    boton.disabled = false;
  }
}

let manifold, piezasDe = { nombre: null, piezas: null, cama: null };
async function armarSTL(n) {
  if (!manifold) {
    const { default: Module } = await import('../vendor/manifold/manifold.js');
    manifold = await Module({ locateFile: (f) => new URL(`../vendor/manifold/${f}`, import.meta.url).href });
    manifold.setup();
  }
  if (piezasDe.nombre !== n) {
    const { generarTapa } = await import('./tapa.js');
    const { armarPiezas, armarCama } = await import('./cama.js');
    const leer = async (ruta) => {
      const r = await fetch(`piezas/${ruta}`);
      if (!r.ok) throw new Error(`falta la pieza ${ruta}`);
      return new Uint8Array(await r.arrayBuffer());
    };
    const tapa = await generarTapa(manifold, fuente, n, await leer('3_tapa/tapa_base.stl'));
    piezasDe = { nombre: n, piezas: await armarPiezas(manifold, leer, tapa.tapa), cama: await armarCama(manifold, leer, tapa.tapa) };
  }
  return piezasDe;
}

// que: 'cama' = un solo STL con todas las piezas; 'partes' = zip con un STL por pieza
async function descargarSTL(boton, salida, que) {
  boton.disabled = true;
  salida.className = 'mensaje';
  salida.textContent = 'Armando las piezas con tu nombre…';
  try {
    const n = nombre().valor;
    const { piezas, cama } = await armarSTL(n);
    const datos = que === 'partes'
      ? armarZip(piezas.map((p) => ({ nombre: `Llavero-${n}/${p.archivo}.stl`, datos: p.stl })))
      : cama;
    const nombreArchivo = que === 'partes' ? `Llavero-${n}-partes.zip` : `Llavero-${n}.stl`;
    const url = URL.createObjectURL(new Blob([datos], { type: que === 'partes' ? 'application/zip' : 'model/stl' }));
    el('a', { href: url, download: nombreArchivo }).click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    salida.className = 'mensaje ok';
    salida.textContent = `Descargado: ${nombreArchivo}`;
  } catch (e) {
    salida.className = 'mensaje error';
    salida.textContent = `No se pudo armar el STL: ${e.message}`;
  } finally {
    boton.disabled = false;
  }
}

// ---------- navegación ----------
function irA(paso) {
  estado.paso = paso;
  guardar();
  mostrar();
  // Si el comienzo del paso quedó fuera de la vista (pasa al tocar Siguiente abajo de todo), subir hasta él
  const titulo = $('#paso h2');
  if (titulo.getBoundingClientRect().top < 0 || titulo.getBoundingClientRect().top > innerHeight * 0.6) {
    const suave = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    titulo.scrollIntoView({ block: 'start', behavior: suave ? 'smooth' : 'auto' });
  }
}

function mostrar() {
  detener.forEach((f) => f());
  detener = [];
  // Progreso: "Paso N de 6" y una barra por paso; los pasos ya hechos se pueden tocar para volver
  const segmentos = PASOS.map((p, i) => {
    const clase = `segmento ${i < estado.paso ? 'hecho' : i === estado.paso ? 'actual' : ''}`;
    if (i >= estado.paso) return el('span', { className: clase, title: p });
    const b = el('button', { type: 'button', className: clase, title: `Volver a ${p}`, ariaLabel: `Volver al paso ${i + 1}: ${p}` });
    b.dataset.paso = String(i);
    b.addEventListener('click', () => irA(i));
    return b;
  });
  $('#progreso').replaceChildren(
    el('p', { className: 'paso-n', textContent: `Paso ${estado.paso + 1} de ${PASOS.length}` }),
    el('div', { className: 'segmentos' }, ...segmentos));
  $('#paso').replaceChildren(...pasos[estado.paso]());
  $('#paso [autofocus]')?.focus();
  $('#atras').hidden = estado.paso === 0;
  $('#siguiente').hidden = estado.paso === PASOS.length - 1;
  $('#siguiente').textContent = estado.paso === PASOS.length - 2 ? 'Está todo bien' : 'Siguiente';
  $('#siguiente').disabled = !VALIDAR[estado.paso]().ok;
  actualizarGafete();
}

$('#atras').addEventListener('click', () => irA(estado.paso - 1));
$('#siguiente').addEventListener('click', () => { if (VALIDAR[estado.paso]().ok) irA(estado.paso + 1); });
// Enter = Siguiente, salvo sobre un botón (ahí Enter ya aprieta ese botón)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement) && !$('#siguiente').disabled && !$('#siguiente').hidden) $('#siguiente').click();
});

async function iniciar() {
  const [f, c] = await Promise.all(['datos/fuente.json', 'datos/caras.json'].map((u) => fetch(u).then((r) => r.json())));
  fuente = cargarFuente(f);
  caras = c.map((x) => ({ ...x, cuadros: x.cuadros.map(([b64, ms]) => ({ gfx: decodificar(b64), ms })) }));
  if (!caras.some((x) => x.id === estado.cara)) estado.cara = 'clasica';
  estado.paso = Math.min(estado.paso, PASOS.length - 1);
  // No arrancar en un paso al que no se puede llegar con lo cargado
  const primeroMal = VALIDAR.findIndex((v) => !v().ok);
  if (primeroMal >= 0 && primeroMal < estado.paso) estado.paso = primeroMal;
  mostrar();
}

iniciar();
