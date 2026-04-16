import { useEffect, useRef, useState, useCallback } from 'react';
import usePlannerStore from '../store/plannerStore';
import { Box, RotateCw, RotateCcw } from 'lucide-react';

/* ── isometric math ────────────────────────────────── */
const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;

function toIso(x, y, z) {
  return { sx: (x - y) * COS30, sy: (x + y) * SIN30 - z };
}

/* ── rotate a point around a center ────────────────── */
function rotatePoint(x, y, cx, cy, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx, dy = y - cy;
  return { x: dx * cos - dy * sin + cx, y: dx * sin + dy * cos + cy };
}

/* ── colors ────────────────────────────────────────── */
const WALL_BASE   = [225, 218, 205];
const FLOOR_COLOR = '#ede8df';
const FLOOR_LINE  = '#d6cfc4';
const CEIL_STROKE = '#9a8b7c';

const ITEM_COLORS = {
  painting: '#f5e6a3', film: '#a3c4f5', tile: '#a8d5a2', fabric: '#f5b3d5',
  lighting: '#f5d5a3', hardware: '#b8b3f5', stone: '#d5b3f5', metalwork: '#f5c8a3',
  plumbing: '#b8b3f5', woodwork: '#f5d5a3', labor: '#d5dbe5',
};

const MIN_W = 180, MIN_H = 140, MAX_W = 600, MAX_H = 500;

const ANGLE_LABELS = { 0: 'SW', 90: 'SE', 180: 'NE', 270: 'NW' };

/* ── outward normal via centroid ───────────────────── */
function outwardNormal(polygon, i) {
  const a = polygon[i], b = polygon[(i + 1) % polygon.length];
  const cx = polygon.reduce((s, p) => s + p.x, 0) / polygon.length;
  const cy = polygon.reduce((s, p) => s + p.y, 0) / polygon.length;
  const dx = b.x - a.x, dy = b.y - a.y;
  const mx = (a.x + b.x) / 2 - cx, my = (a.y + b.y) / 2 - cy;
  if (dy * mx + (-dx) * my > 0) return { x: dy, y: -dx };
  return { x: -dy, y: dx };
}

/* ═══════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════ */
export default function IsometricPreview() {
  const canvasRef  = useRef(null);
  const dragRef    = useRef(null);
  const tileCache  = useRef({}); // url → Image
  const [visible, setVisible] = useState(true);
  const [size, setSize] = useState({ w: 280, h: 220 });
  const [angle, setAngle] = useState(0); // 0, 90, 180, 270
  const space      = usePlannerStore((s) => s.space);
  const placements = usePlannerStore((s) => s.placements);
  const zones      = usePlannerStore((s) => s.zones);

  const rotateLeft  = useCallback(() => setAngle(a => (a - 90 + 360) % 360), []);
  const rotateRight = useCallback(() => setAngle(a => (a + 90) % 360), []);

  /* ── draw on change ──────────────────────────────── */
  useEffect(() => {
    if (!visible || !space || !canvasRef.current) return;

    // Preload tile images (prefer isoImageUrl for 3D, fallback to imageUrl)
    const floorTiles = placements.filter(p => p.item?.tileSize && (p.item?.isoImageUrl || p.item?.imageUrl));
    const urls = [...new Set(floorTiles.map(ft => ft.item.isoImageUrl || ft.item.imageUrl))];
    const toLoad = urls.filter(u => !tileCache.current[u]);

    if (toLoad.length > 0) {
      let loaded = 0;
      toLoad.forEach(url => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          tileCache.current[url] = img;
          loaded++;
          if (loaded === toLoad.length) {
            draw(canvasRef.current, space, placements, zones, tileCache.current, size.w, size.h, angle);
          }
        };
        img.onerror = () => {
          loaded++;
          if (loaded === toLoad.length) {
            draw(canvasRef.current, space, placements, zones, tileCache.current, size.w, size.h, angle);
          }
        };
        img.src = url.startsWith('http') ? url : `${window.location.origin}${url}`;
      });
    } else {
      draw(canvasRef.current, space, placements, zones, tileCache.current, size.w, size.h, angle);
    }
  }, [visible, space, placements, zones, size, angle]);

  /* ── resize drag ─────────────────────────────────── */
  const onGripDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h };

    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const nw = Math.min(MAX_W, Math.max(MIN_W, d.startW - (ev.clientX - d.startX)));
      const nh = Math.min(MAX_H, Math.max(MIN_H, d.startH + (ev.clientY - d.startY)));
      setSize({ w: nw, h: nh });
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [size]);

  if (!space) return null;

  return (
    <div className="absolute top-2 right-2 z-10 flex items-start gap-1.5">
      {/* Toggle */}
      <button
        onClick={() => setVisible((v) => !v)}
        className={`w-7 h-7 rounded-lg border shadow-sm flex items-center justify-center transition-colors ${
          visible
            ? 'bg-[#0073ea] border-[#0073ea] text-white'
            : 'bg-white/90 backdrop-blur-sm border-gray-200 text-gray-500 hover:text-[#0073ea]'
        }`}
        title={visible ? '3D 뷰 숨기기' : '3D 뷰 보기'}
      >
        <Box size={14} />
      </button>

      {/* Preview panel */}
      {visible && (
        <div className="relative" style={{ width: size.w, height: size.h }}>
          <canvas
            ref={canvasRef}
            style={{ width: size.w, height: size.h }}
            className="rounded-xl border border-gray-200 bg-white shadow-lg"
          />

          {/* Rotation controls — top-left inside preview */}
          <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5">
            <button
              onClick={rotateLeft}
              className="w-6 h-6 rounded-md bg-white/80 backdrop-blur-sm border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[#0073ea] hover:border-[#0073ea]/40 transition-colors shadow-sm"
              title="왼쪽으로 회전"
            >
              <RotateCcw size={11} />
            </button>
            <span className="text-[9px] font-mono text-gray-400 bg-white/70 px-1 py-0.5 rounded border border-gray-100 min-w-[28px] text-center select-none">
              {ANGLE_LABELS[angle]}
            </span>
            <button
              onClick={rotateRight}
              className="w-6 h-6 rounded-md bg-white/80 backdrop-blur-sm border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[#0073ea] hover:border-[#0073ea]/40 transition-colors shadow-sm"
              title="오른쪽으로 회전"
            >
              <RotateCw size={11} />
            </button>
          </div>

          {/* Resize grip — bottom-left corner */}
          <div
            onMouseDown={onGripDown}
            className="absolute bottom-0 left-0 w-5 h-5 cursor-nesw-resize group"
            title="드래그로 크기 조절"
          >
            <svg viewBox="0 0 20 20" className="w-full h-full text-gray-300 group-hover:text-[#0073ea] transition-colors">
              <line x1="4" y1="16" x2="16" y2="4" stroke="currentColor" strokeWidth="1.5" />
              <line x1="4" y1="11" x2="11" y2="4" stroke="currentColor" strokeWidth="1.5" />
              <line x1="4" y1="6"  x2="6"  y2="4" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Render function  (W, H are CSS pixel dimensions)
   ═══════════════════════════════════════════════════════ */
function draw(cvs, space, placements, zones, tileCache, W, H, angle) {
  const dpr = window.devicePixelRatio || 1;
  cvs.width = W * dpr;
  cvs.height = H * dpr;
  const ctx = cvs.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  // layoutJson may be in legacy single-polygon shape (`polygon: [...]`) or the
  // current multi-polygon shape (`polygons: [{id, name, vertices}, ...]`).
  // Collect ALL polygons (additional spaces / L-shapes) so they're all rendered
  // rather than only the first one.
  const layout = space.layoutJson || {};
  console.debug('[ISO] draw() — layoutJson:', JSON.stringify(layout).slice(0, 300),
    'widthM:', space.widthM, 'depthM:', space.depthM, 'shape:', space.shape);
  let origPolygons = [];
  if (Array.isArray(layout.polygons) && layout.polygons.length > 0) {
    origPolygons = layout.polygons
      .map(p => Array.isArray(p?.vertices) ? p.vertices : null)
      .filter(v => v && v.length >= 3);
  }
  if (origPolygons.length === 0 && Array.isArray(layout.polygon) && layout.polygon.length >= 3) {
    origPolygons = [layout.polygon];
  }
  if (origPolygons.length === 0) {
    console.debug('[ISO] ⚠️ No valid polygon found — falling back to widthM × depthM rect');
    origPolygons = [[
      { x: 0, y: 0 },
      { x: space.widthM, y: 0 },
      { x: space.widthM, y: space.depthM },
      { x: 0, y: space.depthM },
    ]];
  } else {
    console.debug('[ISO] ✓ Using', origPolygons.length, 'polygon(s),',
      'verts:', origPolygons.map(p => p.length).join('+'));
  }
  const hM = space.heightM || 2.8;

  // Compute rotation center from union of all polygons
  const allOrigPts = origPolygons.flat();
  const origMaxX = Math.max(...allOrigPts.map(p => p.x));
  const origMaxY = Math.max(...allOrigPts.map(p => p.y));
  const rcx = origMaxX / 2, rcy = origMaxY / 2;

  // Rotate all polygons
  const rotatedPolygons = origPolygons.map(poly =>
    poly.map(p => rotatePoint(p.x, p.y, rcx, rcy, angle))
  );

  // Recalculate bounds after rotation (across all polygons)
  const allRotPts = rotatedPolygons.flat();
  const minPX = Math.min(...allRotPts.map(p => p.x));
  const minPY = Math.min(...allRotPts.map(p => p.y));
  const maxPX = Math.max(...allRotPts.map(p => p.x));
  const maxPY = Math.max(...allRotPts.map(p => p.y));

  // Shift polygons so min is at 0
  const shiftX = -minPX, shiftY = -minPY;
  const shiftedPolygons = rotatedPolygons.map(poly =>
    poly.map(p => ({ x: p.x + shiftX, y: p.y + shiftY }))
  );
  // First polygon stays as "main" for legacy tile/grid logic
  const shifted = shiftedPolygons[0];

  const maxX = maxPX - minPX;
  const maxY = maxPY - minPY;

  // Compute iso-projected bounding box of all polygon vertices (floor + ceiling)
  // so that scale and center can be chosen to fit & center the drawn shape
  // (including wall height) in the canvas.
  const allShiftedPts = shiftedPolygons.flat();
  const isoPts = [];
  allShiftedPts.forEach(p => {
    isoPts.push(toIso(p.x, p.y, 0));        // floor
    isoPts.push(toIso(p.x, p.y, hM));       // ceiling
  });
  const isoMinX = Math.min(...isoPts.map(p => p.sx));
  const isoMaxX = Math.max(...isoPts.map(p => p.sx));
  const isoMinY = Math.min(...isoPts.map(p => p.sy));
  const isoMaxY = Math.max(...isoPts.map(p => p.sy));
  const isoW = isoMaxX - isoMinX || 1;
  const isoH = isoMaxY - isoMinY || 1;

  const PAD = 16;
  const scale = Math.min((W - PAD * 2) / isoW, (H - PAD * 2) / isoH);
  // Center the iso bbox of the drawn shape in the canvas
  const cx = W / 2 - ((isoMinX + isoMaxX) / 2) * scale;
  const cy = H / 2 - ((isoMinY + isoMaxY) / 2) * scale;

  // Project function using shifted (rotated) coordinates
  const proj = (x, y, z = 0) => {
    const iso = toIso(x * scale, y * scale, z * scale);
    return { x: iso.sx + cx, y: iso.sy + cy };
  };

  // Helper: rotate a world point and shift to local coords
  const toLocal = (wx, wy) => {
    const r = rotatePoint(wx, wy, rcx, rcy, angle);
    return { x: r.x + shiftX, y: r.y + shiftY };
  };

  // Helper: build a path that covers all polygons' floors (union via non-zero fill)
  const tracePolyFloor = (poly, dz = 0, dx = 0, dy = 0) => {
    poly.forEach((p, i) => {
      const pt = proj(p.x + dx, p.y + dy, dz);
      i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
  };
  const traceAllFloors = (dz = 0, dx = 0, dy = 0) => {
    ctx.beginPath();
    shiftedPolygons.forEach(poly => tracePolyFloor(poly, dz, dx, dy));
  };

  /* ── shadow ──────────────────────────────────────── */
  ctx.save();
  traceAllFloors(-0.15, 0.3, 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fill();
  ctx.restore();

  /* ── floor ───────────────────────────────────────── */
  traceAllFloors(0);
  ctx.fillStyle = FLOOR_COLOR;
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.2;
  shiftedPolygons.forEach(poly => {
    ctx.beginPath();
    poly.forEach((p, i) => {
      const pt = proj(p.x, p.y, 0);
      i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.stroke();
  });

  /* ── per-zone floor tile textures ───────────────── */
  if (zones && tileCache) {
    const floorTiles = placements.filter(p => p.item?.tileSize && (p.item?.isoImageUrl || p.item?.imageUrl) && p.zoneId);
    const zoneMap = {};
    floorTiles.forEach(ft => { zoneMap[ft.zoneId] = ft; });

    const zonelessTile = placements.find(p => p.item?.tileSize && (p.item?.isoImageUrl || p.item?.imageUrl) && !p.zoneId);

    const drawTilesClipped = (clipZone, ft) => {
      const imgUrl = ft.item.isoImageUrl || ft.item.imageUrl;
      const img = tileCache[imgUrl];
      if (!img) return;
      const tileSizeM = ft.item.tileSize / 1000;
      if (tileSizeM <= 0) return;

      ctx.save();

      // Clip to union of all floor polygons
      traceAllFloors(0);
      ctx.clip();

      // If zone-specific, clip to rotated zone quad
      if (clipZone) {
        const zc = [
          toLocal(clipZone.x, clipZone.y),
          toLocal(clipZone.x + clipZone.w, clipZone.y),
          toLocal(clipZone.x + clipZone.w, clipZone.y + clipZone.h),
          toLocal(clipZone.x, clipZone.y + clipZone.h),
        ];
        ctx.beginPath();
        zc.forEach((c, i) => {
          const pt = proj(c.x, c.y, 0);
          i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();
        ctx.clip();
      }

      // Isometric affine transform
      ctx.transform(
        COS30 * scale, SIN30 * scale,
        -COS30 * scale, SIN30 * scale,
        cx, cy
      );

      const startX = clipZone ? Math.min(...[clipZone.x, clipZone.x + clipZone.w].map(v => rotatePoint(v, clipZone.y, rcx, rcy, angle).x + shiftX)) : 0;
      const startY = clipZone ? Math.min(...[clipZone.y, clipZone.y + clipZone.h].map(v => rotatePoint(clipZone.x, v, rcx, rcy, angle).y + shiftY)) : 0;

      for (let tx = Math.floor(startX < 0 ? 0 : startX); tx < maxX; tx += tileSizeM) {
        for (let ty = Math.floor(startY < 0 ? 0 : startY); ty < maxY; ty += tileSizeM) {
          ctx.drawImage(img, tx, ty, tileSizeM, tileSizeM);
        }
      }

      ctx.restore();
    };

    if (zonelessTile) drawTilesClipped(null, zonelessTile);
    zones.forEach(z => {
      const ft = zoneMap[z.id];
      if (ft) drawTilesClipped(z, ft);
    });
  }

  // Floor grid
  ctx.save();
  traceAllFloors(0);
  ctx.clip();

  const hasTiles = placements.some(p => p.item?.tileSize && p.item?.imageUrl);
  ctx.strokeStyle = hasTiles ? 'rgba(0,0,0,0.08)' : FLOOR_LINE;
  ctx.lineWidth = 0.4;
  for (let gx = 0; gx <= maxX; gx += 1) {
    const a = proj(gx, 0, 0), b = proj(gx, maxY, 0);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (let gy = 0; gy <= maxY; gy += 1) {
    const a = proj(0, gy, 0), b = proj(maxX, gy, 0);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.restore();

  /* ── zone overlays on floor ─────────────────────── */
  if (zones && zones.length > 0) {
    const ZONE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    zones.forEach((z, idx) => {
      const color = ZONE_COLORS[idx % ZONE_COLORS.length];
      const corners = [
        toLocal(z.x, z.y),
        toLocal(z.x + z.w, z.y),
        toLocal(z.x + z.w, z.y + z.h),
        toLocal(z.x, z.y + z.h),
      ];

      ctx.save();
      // Clip to union of all floors
      traceAllFloors(0);
      ctx.clip();

      // Draw zone fill
      ctx.beginPath();
      corners.forEach((c, i) => {
        const pt = proj(c.x, c.y, 0);
        i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      ctx.fillStyle = color + '18';
      ctx.fill();
      ctx.strokeStyle = color + '55';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Zone label
      const lp = proj(corners[0].x + 0.15, corners[0].y + 0.15, 0);
      ctx.font = `bold ${Math.max(7, Math.round(W / 40))}px system-ui, sans-serif`;
      ctx.fillStyle = color + 'aa';
      ctx.fillText(z.name, lp.x, lp.y);

      ctx.restore();
    });
  }

  /* ── walls ───────────────────────────────────────── */
  const walls = [];
  shiftedPolygons.forEach((poly) => {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const n = outwardNormal(poly, i);
      const facing = n.x + n.y;
      // Depth sorting: walls further from viewer drawn first
      const depth = (a.x + b.x + a.y + b.y) / 2;
      walls.push({ a, b, facing, depth });
    }
  });

  walls.sort((a, b) => a.depth - b.depth);

  walls.forEach(({ a, b, facing }) => {
    const bl = proj(a.x, a.y, 0);
    const br = proj(b.x, b.y, 0);
    const tr = proj(b.x, b.y, hM);
    const tl = proj(a.x, a.y, hM);

    ctx.beginPath();
    ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y);
    ctx.lineTo(tr.x, tr.y); ctx.lineTo(tl.x, tl.y);
    ctx.closePath();

    if (facing > 0) {
      ctx.fillStyle = 'rgba(210,200,185,0.18)';
      ctx.fill();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(17,17,17,0.45)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const bright = facing < -0.5 ? 0.82 : 0.92;
      const r = Math.round(WALL_BASE[0] * bright);
      const g = Math.round(WALL_BASE[1] * bright);
      const bv = Math.round(WALL_BASE[2] * bright);

      const grad = ctx.createLinearGradient(bl.x, bl.y, tl.x, tl.y);
      grad.addColorStop(0, `rgb(${Math.round(r * 0.92)},${Math.round(g * 0.92)},${Math.round(bv * 0.92)})`);
      grad.addColorStop(1, `rgb(${r},${g},${bv})`);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y);
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  });

  /* ── ceiling outline ─────────────────────────────── */
  shiftedPolygons.forEach(poly => {
    ctx.beginPath();
    poly.forEach((p, i) => {
      const pt = proj(p.x, p.y, hM);
      i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  });

  /* ── placements ──────────────────────────────────── */
  // Rotate & sort placements by depth (back to front)
  const sortedPlacements = [...placements].map(p => {
    const item = p.item;
    if (!item) return null;
    if (item.tileSize && (item.isoImageUrl || item.imageUrl)) return null;
    const w = item.width || 0.5, h = item.height || 0.5;
    // Rotate all 4 corners and use bounding box
    const corners = [
      toLocal(p.x, p.y),
      toLocal(p.x + w, p.y),
      toLocal(p.x + w, p.y + h),
      toLocal(p.x, p.y + h),
    ];
    const lx = Math.min(...corners.map(c => c.x));
    const ly = Math.min(...corners.map(c => c.y));
    const lw = Math.max(...corners.map(c => c.x)) - lx;
    const lh = Math.max(...corners.map(c => c.y)) - ly;
    return { ...p, lx, ly, lw, lh, depth: lx + ly };
  }).filter(Boolean).sort((a, b) => a.depth - b.depth);

  sortedPlacements.forEach((p) => {
    const item = p.item;
    const catName = item.category?.name || 'tile';
    const color = ITEM_COLORS[catName] || '#ddd';
    const bh = Math.min(p.lw, p.lh, 0.4);
    const x0 = p.lx, y0 = p.ly;
    const w = p.lw, h = p.lh;

    // Right face
    const rb1 = proj(x0 + w, y0, 0), rb2 = proj(x0 + w, y0 + h, 0);
    const rt2 = proj(x0 + w, y0 + h, bh), rt1 = proj(x0 + w, y0, bh);
    ctx.beginPath();
    ctx.moveTo(rb1.x, rb1.y); ctx.lineTo(rb2.x, rb2.y);
    ctx.lineTo(rt2.x, rt2.y); ctx.lineTo(rt1.x, rt1.y);
    ctx.closePath();
    ctx.fillStyle = darken(color, 0.85);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.5; ctx.stroke();

    // Front face
    const fb1 = proj(x0, y0 + h, 0), fb2 = proj(x0 + w, y0 + h, 0);
    const ft2 = proj(x0 + w, y0 + h, bh), ft1 = proj(x0, y0 + h, bh);
    ctx.beginPath();
    ctx.moveTo(fb1.x, fb1.y); ctx.lineTo(fb2.x, fb2.y);
    ctx.lineTo(ft2.x, ft2.y); ctx.lineTo(ft1.x, ft1.y);
    ctx.closePath();
    ctx.fillStyle = darken(color, 0.75);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.5; ctx.stroke();

    // Top face
    const t1 = proj(x0, y0, bh), t2 = proj(x0 + w, y0, bh);
    const t3 = proj(x0 + w, y0 + h, bh), t4 = proj(x0, y0 + h, bh);
    ctx.beginPath();
    ctx.moveTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y);
    ctx.lineTo(t3.x, t3.y); ctx.lineTo(t4.x, t4.y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.5; ctx.stroke();
  });

  /* ── label ───────────────────────────────────────── */
  ctx.fillStyle = '#9ca3af';
  ctx.font = `${Math.max(9, Math.round(W / 30))}px system-ui, sans-serif`;
  ctx.fillText(`${space.widthM}m × ${space.depthM}m × ${hM}m`, 8, H - 6);

  // Direction indicator
  const dir = ANGLE_LABELS[angle] || '';
  ctx.fillStyle = '#c0c4cc';
  ctx.font = `bold ${Math.max(8, Math.round(W / 35))}px system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText(dir, W - 8, H - 6);
  ctx.textAlign = 'left';
}

/* ── color util ────────────────────────────────────── */
function darken(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}
