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

/* ── tolerance-based line chaining ─────────────────── */
function chainLinesWithEps(lines, EPS) {
  if (lines.length < 3) return null;
  const segs = lines.map(l => ({
    a: { x: l.vertices[0].x, y: l.vertices[0].y },
    b: { x: l.vertices[1].x, y: l.vertices[1].y },
  }));

  // Try chaining starting from each segment (take longest closed result)
  let bestChain = null;
  let bestArea = 0;

  for (let start = 0; start < Math.min(segs.length, 50); start++) {
    const pts = [segs[start].a];
    let cur = segs[start].b;
    const used = new Set([start]);

    for (let iter = 0; iter < segs.length; iter++) {
      let found = false;
      let bestIdx = -1;
      let bestDist = EPS;
      let flip = false;
      for (let i = 0; i < segs.length; i++) {
        if (used.has(i)) continue;
        const s = segs[i];
        const dA = Math.hypot(cur.x - s.a.x, cur.y - s.a.y);
        const dB = Math.hypot(cur.x - s.b.x, cur.y - s.b.y);
        if (dA < bestDist) { bestDist = dA; bestIdx = i; flip = false; }
        if (dB < bestDist) { bestDist = dB; bestIdx = i; flip = true; }
      }
      if (bestIdx >= 0) {
        pts.push(cur);
        cur = flip ? segs[bestIdx].a : segs[bestIdx].b;
        used.add(bestIdx);
        found = true;
      }
      if (!found) break;
      // Closed?
      if (pts.length >= 3 && Math.hypot(cur.x - pts[0].x, cur.y - pts[0].y) < EPS) {
        const area = polygonArea(pts);
        if (area > bestArea) {
          bestArea = area;
          bestChain = pts.slice();
        }
        break;
      }
    }
  }
  return bestChain;
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

/* ── entity filter: skip non-wall entities ─────────── */
const SKIP_ENTITY_TYPES = new Set([
  'DIMENSION', 'MTEXT', 'TEXT', 'HATCH', 'LEADER', 'MLEADER',
  'ATTDEF', 'ATTRIB', 'TOLERANCE', 'WIPEOUT', 'IMAGE',
]);

/* ── layer name priorities (Korean + English CAD) ──── */
const WALL_LAYER_PATTERNS = [
  /^(A-)?WALL?(S)?$/i,    // WALL, WAL, A-WALL, A-WAL
  /^벽$/,
  /^외벽$/,
  /^내벽$/,
  /^벽체$/,
  /WALL?/i,               // anything containing WAL / WALL
  /벽/,
];

function layerScore(layerName) {
  if (!layerName) return 0;
  for (let i = 0; i < WALL_LAYER_PATTERNS.length; i++) {
    if (WALL_LAYER_PATTERNS[i].test(layerName)) {
      return WALL_LAYER_PATTERNS.length - i;  // higher = better
    }
  }
  return 0;
}

/* ── 2D transform helpers (for INSERT block expansion) ─ */
function applyTransform(pt, t) {
  const cos = Math.cos(t.rotation || 0);
  const sin = Math.sin(t.rotation || 0);
  const sx = t.scaleX ?? 1;
  const sy = t.scaleY ?? 1;
  const x = pt.x * sx;
  const y = pt.y * sy;
  return {
    x: (x * cos - y * sin) + (t.tx || 0),
    y: (x * sin + y * cos) + (t.ty || 0),
  };
}

function composeTransform(outer, inner) {
  // outer ∘ inner : first inner, then outer
  const rot = (outer.rotation || 0) + (inner.rotation || 0);
  const sx = (outer.scaleX ?? 1) * (inner.scaleX ?? 1);
  const sy = (outer.scaleY ?? 1) * (inner.scaleY ?? 1);
  const p = applyTransform({ x: inner.tx || 0, y: inner.ty || 0 }, outer);
  return { rotation: rot, scaleX: sx, scaleY: sy, tx: p.x, ty: p.y };
}

function insertToTransform(ins) {
  const deg = ins.rotation || 0;
  return {
    rotation: (deg * Math.PI) / 180,
    scaleX: ins.xScale ?? 1,
    scaleY: ins.yScale ?? 1,
    tx: ins.position?.x ?? 0,
    ty: ins.position?.y ?? 0,
  };
}

/* ── expand INSERT blocks → flat list of primitive entities ─ */
function expandEntities(entities, blocks, transform, depth = 0, out = []) {
  if (depth > 8) return out;  // safety: avoid infinite recursion
  const t = transform || { rotation: 0, scaleX: 1, scaleY: 1, tx: 0, ty: 0 };

  for (const e of entities) {
    if (!e || SKIP_ENTITY_TYPES.has(e.type)) continue;

    if (e.type === 'INSERT') {
      const blockName = e.name || e.blockName;
      const block = blocks?.[blockName];
      if (block?.entities?.length) {
        const inner = insertToTransform(e);
        const combined = composeTransform(t, inner);
        expandEntities(block.entities, blocks, combined, depth + 1, out);
      }
      continue;
    }

    if (e.type === 'LINE' && e.vertices?.length === 2) {
      out.push({
        type: 'LINE',
        layer: e.layer,
        vertices: [
          applyTransform(e.vertices[0], t),
          applyTransform(e.vertices[1], t),
        ],
      });
      continue;
    }

    if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.vertices?.length >= 3) {
      out.push({
        type: e.type,
        layer: e.layer,
        shape: e.shape,
        vertices: e.vertices.map(v => applyTransform(v, t)),
      });
      continue;
    }

    // ignore other types (ARC, CIRCLE, SPLINE, ELLIPSE) — cannot easily form polygons
  }
  return out;
}

/* ── estimate per-unit min line length threshold ────── */
function shortLineThreshold(scale) {
  // 100mm in native DXF coordinates
  // if scale is 0.001 (mm→m), native 100mm => 100 native units
  // if scale is 0.01 (cm→m),  native 100mm => 10  native units
  // if scale is 1    (m→m),   native 100mm => 0.1 native units
  return 0.1 / scale;
}

function lineLength(l) {
  const a = l.vertices[0], b = l.vertices[1];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/* ── convex hull (Andrew's monotone chain) ─────────── */
function convexHull(pts) {
  if (pts.length < 3) return null;
  const sorted = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (O, A, B) => (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

/* ── simplify near-colinear polygon vertices ────────── */
function simplifyPolygon(pts, tolerance) {
  if (pts.length <= 4) return pts;
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const prev = out[out.length - 1] || pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    // distance from cur to line prev→next
    const dx = next.x - prev.x, dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const d = Math.abs(dy * cur.x - dx * cur.y + next.x * prev.y - next.y * prev.x) / len;
    if (d > tolerance) out.push(cur);
  }
  return out.length >= 3 ? out : pts;
}

/* ═══════════════════════════════════════════════════════
   DXF  →  { polygon, widthM, depthM, areaSqm }
   ═══════════════════════════════════════════════════════ */
function parseDXF(content) {
  const parser = new DxfParser();
  const dxf = parser.parseSync(content);
  if (!dxf?.entities) throw new Error('DXF 파일을 파싱할 수 없습니다.');

  // 1) Expand INSERT blocks + filter non-wall entity types
  const flat = expandEntities(dxf.entities, dxf.blocks || {});

  // 2) Collect closed polylines (strong candidates — usually drawn as room outlines)
  const polyCandidates = [];
  for (const e of flat) {
    if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.vertices?.length >= 3) {
      polyCandidates.push({
        layer: e.layer,
        pts: e.vertices.map(v => ({ x: v.x, y: v.y })),
      });
    }
  }

  // 3) Collect LINEs (for chaining fallback)
  const allLines = flat.filter(e => e.type === 'LINE');

  // 4) Determine unit scale from whatever vertices we have
  const sampleVerts = [
    ...polyCandidates.flatMap(c => c.pts),
    ...allLines.flatMap(l => l.vertices),
  ];
  if (sampleVerts.length === 0) {
    throw new Error('도면에 사용 가능한 선/폴리라인이 없습니다.');
  }
  const scale = dxfUnitScale(dxf, sampleVerts);

  // 5) Filter short lines (< 100mm in real-world)
  const minLen = shortLineThreshold(scale);
  const lines = allLines.filter(l => lineLength(l) >= minLen);

  // 6) Compute EPS (tolerance for endpoint match) — ~10mm in real-world
  const EPS = Math.max(0.01 / scale, 1e-6);  // ≈10mm in native coords

  // 7) Build candidate list
  //    Strategy: try wall-named layers first, then all lines
  const candidates = [];

  // 7a) Closed polylines on wall-layers get highest score
  for (const c of polyCandidates) {
    const score = layerScore(c.layer);
    candidates.push({ pts: c.pts, score: score + 10, source: `POLY/${c.layer || '?'}` });
  }

  // 7b) Chained lines on wall-layers
  const linesByLayer = new Map();
  for (const l of lines) {
    const key = l.layer || '_';
    if (!linesByLayer.has(key)) linesByLayer.set(key, []);
    linesByLayer.get(key).push(l);
  }
  const wallLayers = [...linesByLayer.keys()]
    .map(k => ({ k, score: layerScore(k) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const { k, score } of wallLayers) {
    const layerLines = linesByLayer.get(k);
    const chain = chainLinesWithEps(layerLines, EPS);
    if (chain) {
      candidates.push({ pts: chain, score: score + 5, source: `CHAIN/${k}` });
    } else if (layerLines.length >= 4) {
      // Walls are often drawn as parallel pairs and never close →
      // fall back to convex hull of endpoints (gives correct bounding outline)
      const pts = [];
      for (const l of layerLines) pts.push(l.vertices[0], l.vertices[1]);
      const hull = convexHull(pts);
      if (hull && hull.length >= 3) {
        // simplify jitter (CAD corners are slightly offset between wall faces)
        const simplified = simplifyPolygon(hull, EPS * 5);
        candidates.push({ pts: simplified, score: score + 3, source: `HULL/${k}` });
      }
    }
  }

  // 7c) Fallback — chain ALL lines together
  if (candidates.length === 0 || !candidates.some(c => c.score >= 5)) {
    const chain = chainLinesWithEps(lines, EPS);
    if (chain) candidates.push({ pts: chain, score: 1, source: 'CHAIN/ALL' });
  }

  if (candidates.length === 0) {
    throw new Error('도면에서 폐합 다각형(방 경계)을 찾을 수 없습니다.');
  }

  // 8) Pick best: prefer high layer score, then large area
  candidates.forEach(c => { c.area = polygonArea(c.pts); });
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.area - a.area;
  });

  // Reject tiny candidates (likely title block / detail dots)
  const MIN_AREA = Math.pow(1 / scale, 2) * 0.5;  // 0.5 m² in native coords
  let best = candidates.find(c => c.area >= MIN_AREA) || candidates[0];

  return normalise(best.pts, scale);
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
