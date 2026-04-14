const DxfParser = require('dxf-parser');

/* ── polygon area (shoelace) ───────────────────────── */
function polygonArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a / 2);
}

/* ── unit detection for DXF ────────────────────────── */
function dxfUnitScale(dxf, vertices) {
  const insunits = dxf.header?.['$INSUNITS'];
  if (insunits !== undefined) {
    const map = { 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1 };
    if (map[insunits]) return map[insunits];
  }
  // heuristic: typical room in mm → coords > 1000
  const maxDim = Math.max(
    ...vertices.map(p => Math.abs(p.x)),
    ...vertices.map(p => Math.abs(p.y)),
  );
  if (maxDim > 1000) return 0.001;   // mm
  if (maxDim > 100)  return 0.01;    // cm
  return 1;                           // m
}

/* ── chain individual LINEs into a closed polygon ──── */
function chainLines(lines) {
  if (lines.length < 3) return null;
  const segs = lines.map(l => ({
    a: { x: l.vertices[0].x, y: l.vertices[0].y },
    b: { x: l.vertices[1].x, y: l.vertices[1].y },
  }));

  const EPS = 0.1;
  const pts = [segs[0].a];
  let cur = segs[0].b;
  const used = new Set([0]);

  for (let iter = 0; iter < segs.length; iter++) {
    let found = false;
    for (let i = 0; i < segs.length; i++) {
      if (used.has(i)) continue;
      const s = segs[i];
      if (Math.hypot(cur.x - s.a.x, cur.y - s.a.y) < EPS) {
        pts.push(cur); cur = s.b; used.add(i); found = true; break;
      }
      if (Math.hypot(cur.x - s.b.x, cur.y - s.b.y) < EPS) {
        pts.push(cur); cur = s.a; used.add(i); found = true; break;
      }
    }
    if (!found) break;
  }
  // closed?
  if (Math.hypot(cur.x - pts[0].x, cur.y - pts[0].y) < EPS && pts.length >= 3) {
    return pts;
  }
  return null;
}

/* ── normalise polygon → origin 0,0, in metres ─────── */
function normalise(raw, scale) {
  const scaled = raw.map(p => ({ x: p.x * scale, y: p.y * scale }));
  const minX = Math.min(...scaled.map(p => p.x));
  const minY = Math.min(...scaled.map(p => p.y));
  const poly = scaled.map(p => ({
    x: parseFloat((p.x - minX).toFixed(3)),
    y: parseFloat((p.y - minY).toFixed(3)),
  }));
  const w = Math.max(...poly.map(p => p.x));
  const h = Math.max(...poly.map(p => p.y));
  return {
    polygon: poly,
    widthM:  parseFloat(w.toFixed(2)),
    depthM:  parseFloat(h.toFixed(2)),
    areaSqm: parseFloat(polygonArea(poly).toFixed(2)),
  };
}

/* ═══════════════════════════════════════════════════════
   DXF  →  { polygon, widthM, depthM, areaSqm }
   ═══════════════════════════════════════════════════════ */
function parseDXF(content) {
  const parser = new DxfParser();
  const dxf = parser.parseSync(content);
  if (!dxf?.entities) throw new Error('DXF 파일을 파싱할 수 없습니다.');

  // Collect closed polylines
  const candidates = [];
  for (const e of dxf.entities) {
    if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.vertices?.length >= 3) {
      candidates.push(e.vertices.map(v => ({ x: v.x, y: v.y })));
    }
  }

  // Fall back: chain LINE entities
  if (candidates.length === 0) {
    const lines = dxf.entities.filter(e => e.type === 'LINE' && e.vertices?.length === 2);
    const chained = chainLines(lines);
    if (chained) candidates.push(chained);
  }

  if (candidates.length === 0) {
    throw new Error('도면에서 폐합 다각형(방 경계)을 찾을 수 없습니다.');
  }

  // Pick the largest by area
  let best = candidates[0];
  let bestArea = polygonArea(best);
  for (const c of candidates) {
    const a = polygonArea(c);
    if (a > bestArea) { best = c; bestArea = a; }
  }

  const scale = dxfUnitScale(dxf, best);
  return normalise(best, scale);
}

/* ═══════════════════════════════════════════════════════
   SVG  →  { polygon, widthM, depthM, areaSqm }
   ═══════════════════════════════════════════════════════ */
function parseSVG(content) {
  // Try <polygon> or <polyline> first
  let pts = extractSvgPolygon(content) || extractSvgPath(content);
  if (!pts || pts.length < 3) {
    throw new Error('SVG에서 도면 형태를 추출할 수 없습니다. polygon 또는 path 요소가 필요합니다.');
  }

  // guess scale
  const maxDim = Math.max(...pts.map(p => Math.abs(p.x)), ...pts.map(p => Math.abs(p.y)));
  let scale = 1;
  if (maxDim > 1000) scale = 0.001;       // mm
  else if (maxDim > 100) scale = 0.01;    // cm

  return normalise(pts, scale);
}

function extractSvgPolygon(svg) {
  const m = svg.match(/<(?:polygon|polyline)[^>]+points="([^"]+)"/);
  if (!m) return null;
  const nums = m[1].trim().split(/[\s,]+/).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    if (!isNaN(nums[i]) && !isNaN(nums[i + 1])) pts.push({ x: nums[i], y: nums[i + 1] });
  }
  return pts.length >= 3 ? pts : null;
}

function extractSvgPath(svg) {
  const paths = [...svg.matchAll(/<path[^>]+d="([^"]+)"/g)];
  let best = null, bestArea = 0;
  for (const [, d] of paths) {
    const pts = pathToPoints(d);
    if (pts && pts.length >= 3) {
      const a = polygonArea(pts);
      if (a > bestArea) { best = pts; bestArea = a; }
    }
  }
  return best;
}

function pathToPoints(d) {
  const cmds = d.match(/[MLHVZmlhvz][^MLHVZmlhvz]*/g);
  if (!cmds) return null;
  const pts = [];
  let cx = 0, cy = 0;
  for (const c of cmds) {
    const t = c[0];
    const n = c.slice(1).trim().split(/[\s,]+/).map(Number);
    switch (t) {
      case 'M': cx = n[0]; cy = n[1]; pts.push({ x: cx, y: cy });
        for (let i = 2; i + 1 < n.length; i += 2) { cx = n[i]; cy = n[i + 1]; pts.push({ x: cx, y: cy }); }
        break;
      case 'L': for (let i = 0; i + 1 < n.length; i += 2) { cx = n[i]; cy = n[i + 1]; pts.push({ x: cx, y: cy }); } break;
      case 'H': cx = n[0]; pts.push({ x: cx, y: cy }); break;
      case 'V': cy = n[0]; pts.push({ x: cx, y: cy }); break;
      case 'm': cx += n[0]; cy += n[1]; pts.push({ x: cx, y: cy });
        for (let i = 2; i + 1 < n.length; i += 2) { cx += n[i]; cy += n[i + 1]; pts.push({ x: cx, y: cy }); }
        break;
      case 'l': for (let i = 0; i + 1 < n.length; i += 2) { cx += n[i]; cy += n[i + 1]; pts.push({ x: cx, y: cy }); } break;
      case 'h': cx += n[0]; pts.push({ x: cx, y: cy }); break;
      case 'v': cy += n[0]; pts.push({ x: cx, y: cy }); break;
      default: break; // Z, curves — ignore
    }
  }
  return pts.length >= 3 ? pts : null;
}

module.exports = { parseDXF, parseSVG };
