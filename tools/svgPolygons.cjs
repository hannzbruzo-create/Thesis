// DEVELOPMENT ONLY. Minimal SVG reader shared by the campus-model tools.
// Turns every filled <path> outside a <mask> into flat polygons (800x800 units).
const fs = require('node:fs');

const CURVE_STEPS = 6;

function tokenize(d) {
  return d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
}

/** Path data -> array of closed point rings. Supports M L H V C S Q T Z (abs/rel). */
function flattenPath(d, minPoints = 3) {
  const t = tokenize(d);
  const rings = [];
  let ring = null, i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0;
  const num = () => parseFloat(t[i++]);
  const isNum = () => i < t.length && !/[a-zA-Z]/.test(t[i]);
  const push = (px, py) => { if (!ring) { ring = []; rings.push(ring); } ring.push([px, py]); };
  const cubic = (x1, y1, x2, y2, ex, ey) => {
    for (let s = 1; s <= CURVE_STEPS; s++) {
      const u = s / CURVE_STEPS, v = 1 - u;
      push(v*v*v*x + 3*v*v*u*x1 + 3*v*u*u*x2 + u*u*u*ex,
           v*v*v*y + 3*v*v*u*y1 + 3*v*u*u*y2 + u*u*u*ey);
    }
    cx = x2; cy = y2; x = ex; y = ey;
  };
  while (i < t.length) {
    if (!isNum()) cmd = t[i++];
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case 'M':
        x = ox + num(); y = oy + num(); sx = x; sy = y;
        ring = null; push(x, y);
        cmd = rel ? 'l' : 'L'; // extra pairs after M are line-tos
        break;
      case 'L': x = ox + num(); y = oy + num(); push(x, y); break;
      case 'H': x = (rel ? x : 0) + num(); push(x, y); break;
      case 'V': y = (rel ? y : 0) + num(); push(x, y); break;
      case 'C': { const a = [num(), num(), num(), num(), num(), num()];
        cubic(ox+a[0], oy+a[1], ox+a[2], oy+a[3], ox+a[4], oy+a[5]); continue; }
      case 'S': { const a = [num(), num(), num(), num()];
        cubic(2*x-cx, 2*y-cy, ox+a[0], oy+a[1], ox+a[2], oy+a[3]); continue; }
      case 'Q': { const a = [num(), num(), num(), num()];
        const qx = ox+a[0], qy = oy+a[1];
        cubic(x+2/3*(qx-x), y+2/3*(qy-y), ox+a[2]+2/3*(qx-ox-a[2]), oy+a[3]+2/3*(qy-oy-a[3]), ox+a[2], oy+a[3]);
        continue; }
      case 'Z': x = sx; y = sy; ring = null; break;
      default: throw new Error(`Unsupported path command ${cmd}`);
    }
    cx = x; cy = y;
  }
  return rings.filter(r => r.length >= minPoints);
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : null;
}

function signedArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0]*ring[i][1] - ring[i][0]*ring[j][1];
  return a / 2;
}

/** Douglas-Peucker on a closed ring. */
function simplify(ring, tolerance) {
  if (ring.length < 4) return ring;
  const dp = (pts) => {
    let max = 0, index = 0;
    const [a, b] = [pts[0], pts[pts.length - 1]];
    for (let k = 1; k < pts.length - 1; k++) {
      const p = pts[k], dx = b[0]-a[0], dy = b[1]-a[1], len = Math.hypot(dx, dy) || 1e-9;
      const dist = Math.abs(dy*p[0] - dx*p[1] + b[0]*a[1] - b[1]*a[0]) / len;
      if (dist > max) { max = dist; index = k; }
    }
    if (max <= tolerance) return [a, b];
    return [...dp(pts.slice(0, index + 1)).slice(0, -1), ...dp(pts.slice(index))];
  };
  // Split at the vertex farthest from the first one so the closed ring keeps its shape.
  let far = 0, best = 0;
  ring.forEach((p, k) => { const d = Math.hypot(p[0]-ring[0][0], p[1]-ring[0][1]); if (d > best) { best = d; far = k; } });
  const first = dp(ring.slice(0, far + 1));
  const second = dp([...ring.slice(far), ring[0]]);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

/** Every filled path not inside a <mask>, in document order. */
function readFilledPaths(svgFile) {
  const text = fs.readFileSync(svgFile, 'utf8');
  const out = [];
  let maskDepth = 0, groupOpacity = [];
  for (const m of text.matchAll(/<(\/?)(mask|g|path)\b([^>]*?)(\/?)>/g)) {
    const [, closing, name, body, selfClosing] = m;
    if (name === 'mask') { maskDepth += closing ? -1 : 1; continue; }
    if (name === 'g') {
      if (closing) groupOpacity.pop();
      else if (!selfClosing) groupOpacity.push(parseFloat(attr(' ' + body, 'opacity') ?? '1'));
      continue;
    }
    if (maskDepth > 0) continue;
    const tag = ' ' + body;
    const fill = attr(tag, 'fill');
    const d = attr(tag, 'd');
    if (!d || !fill || fill === 'none') continue;
    const opacity = parseFloat(attr(tag, 'opacity') ?? '1') * groupOpacity.reduce((a, b) => a * b, 1);
    out.push({ index: out.length, fill: fill.toUpperCase(), opacity, rings: flattenPath(d) });
  }
  return out;
}

/** Open polylines drawn with a stroke of the given colour, e.g. road centerlines. */
function readStrokedPaths(svgFile, strokeColor) {
  const text = fs.readFileSync(svgFile, 'utf8');
  const out = [];
  for (const m of text.matchAll(/<path\b([^>]*?)\/?>/g)) {
    const tag = ' ' + m[1];
    if ((attr(tag, 'stroke') || '').toUpperCase() !== strokeColor.toUpperCase()) continue;
    const d = attr(tag, 'd');
    if (!d) continue;
    const width = parseFloat(attr(tag, 'stroke-width') ?? '1');
    for (const line of flattenPath(d, 2)) out.push({ width, points: line });
  }
  return out;
}

module.exports = { flattenPath, readFilledPaths, readStrokedPaths, signedArea, simplify };
