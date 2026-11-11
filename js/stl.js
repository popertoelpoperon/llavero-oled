// Leer y escribir STL binario.

// Devuelve vértices unidos (los STL repiten cada vértice en cada triángulo)
export function leerSTL(buf) {
  const vista = new DataView(buf);
  const n = vista.getUint32(80, true);
  const indices = new Map();
  const pos = [];
  const tri = new Uint32Array(n * 3);
  for (let t = 0; t < n; t++) {
    for (let v = 0; v < 3; v++) {
      const o = 84 + t * 50 + 12 + v * 12;
      const p = [0, 1, 2].map((k) => vista.getFloat32(o + 4 * k, true));
      const clave = p.map((c) => Math.round(c * 1e4)).join(',');
      let i = indices.get(clave);
      if (i === undefined) {
        i = pos.length / 3;
        indices.set(clave, i);
        pos.push(...p);
      }
      tri[t * 3 + v] = i;
    }
  }
  return { pos: new Float32Array(pos), tri };
}

// mesh = {vertProperties, triVerts, numProp} (como lo da manifold-3d)
export function escribirSTL({ vertProperties, triVerts, numProp = 3 }) {
  const n = triVerts.length / 3;
  const buf = new Uint8Array(84 + n * 50);
  const vista = new DataView(buf.buffer);
  buf.set(new TextEncoder().encode('llavero-oled'));
  vista.setUint32(80, n, true);
  const p = (i) => [0, 1, 2].map((k) => vertProperties[i * numProp + k]);
  for (let t = 0; t < n; t++) {
    const [a, b, c] = [0, 1, 2].map((v) => p(triVerts[t * 3 + v]));
    const u = a.map((x, k) => b[k] - x), w = a.map((x, k) => c[k] - x);
    const nor = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const largo = Math.hypot(...nor) || 1;
    const o = 84 + t * 50;
    [...nor.map((x) => x / largo), ...a, ...b, ...c].forEach((x, k) => vista.setFloat32(o + 4 * k, x, true));
  }
  return buf;
}
