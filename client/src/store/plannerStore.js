import { create } from 'zustand';

const CATEGORY_LABELS = {
  painting: '도장',
  film: '필름',
  tile: '타일',
  fabric: '패브릭',
  lighting: '조명',
  hardware: '손잡이',
  stone: '인조대리석',
  metalwork: '금속유리',
  plumbing: '설비/배관',
  woodwork: '목공자재',
  labor: '인건비',
};

const usePlannerStore = create((set, get) => ({
  space: null,
  items: [],          // all available items
  placements: [],     // { id, itemId, item, quantity, x, y, rotation, zoneId? }
  zones: [],          // { id, name, x, y, w, h } — floor zones in meters
  selectedId: null,
  showVat: true,
  isDirty: false,
  unlockedIds: [],   // required items manually unlocked by user

  setSpace: (space) => set({ space }),
  setItems: (items) => set({ items }),

  // Zone management
  setZones: (zones) => set({ zones }),
  addZone: (zone) => set((s) => ({ zones: [...s.zones, zone], isDirty: true })),
  removeZone: (id) => set((s) => ({
    zones: s.zones.filter(z => z.id !== id),
    placements: s.placements.map(p => p.zoneId === id ? { ...p, zoneId: undefined } : p),
    isDirty: true,
  })),
  updateZone: (id, updates) => set((s) => ({
    zones: s.zones.map(z => z.id === id ? { ...z, ...updates } : z),
    isDirty: true,
  })),

  setPlacements: (placements) => set({ placements, isDirty: false }),

  addPlacement: (item, x = 100, y = 100, zoneId) => {
    const isFloorTile = item.tileSize && (item.imageUrl || item.isoImageUrl);
    const placement = {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      itemId: item.id,
      item,
      quantity: 1,
      x,
      y,
      rotation: 0,
      ...(zoneId !== undefined && { zoneId }),
    };
    set((s) => {
      let newPlacements = s.placements;
      if (isFloorTile && zoneId !== undefined) {
        // Replace previous tile on same zone
        newPlacements = newPlacements.filter((p) =>
          !(p.item?.tileSize && (p.item?.imageUrl || p.item?.isoImageUrl) && p.zoneId === zoneId)
        );
      } else if (isFloorTile) {
        // No zone — replace all zone-less floor tiles
        newPlacements = newPlacements.filter((p) =>
          !(p.item?.tileSize && (p.item?.imageUrl || p.item?.isoImageUrl) && !p.zoneId)
        );
      }
      return { placements: [...newPlacements, placement], isDirty: true };
    });
    return placement;
  },

  updatePlacement: (id, updates) => {
    set((s) => ({
      placements: s.placements.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      isDirty: true,
    }));
  },

  removePlacement: (id) => {
    set((s) => ({
      placements: s.placements.filter((p) => p.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      isDirty: true,
    }));
  },

  setSelectedId: (id) => set({ selectedId: id }),

  toggleLock: (itemId) =>
    set((s) => ({
      unlockedIds: s.unlockedIds.includes(itemId)
        ? s.unlockedIds.filter((id) => id !== itemId)
        : [...s.unlockedIds, itemId],
    })),

  isLocked: (itemId) => {
    const { unlockedIds } = get();
    return !unlockedIds.includes(itemId);
  },

  toggleVat: () => set((s) => ({ showVat: !s.showVat })),

  // Calculate costs
  getEstimate: () => {
    const { space, placements, showVat } = get();
    if (!space) return { categories: [], subtotal: 0, vat: 0, total: 0 };

    const byCategory = {};

    placements.forEach((p) => {
      const item = p.item;
      const catName = item.category?.name || 'other';
      const catLabel = CATEGORY_LABELS[catName] || catName;

      let qty = p.quantity;
      let autoQty = null; // store the auto-calc value for reference
      // Area-based items auto-calculate from space
      const basis = item.areaBasis;
      if (item.unit === 'm2' && (basis === 'floor' || (!basis && ['tile', 'painting'].includes(catName)))) {
        autoQty = space.areaSqm;
        qty = p.qtyOverride != null ? p.qtyOverride : autoQty;
      } else if (item.unit === 'm2' && (basis === 'wall' || (!basis && catName === 'film'))) {
        // perimeter × height
        const perim = 2 * (space.widthM + space.depthM);
        autoQty = perim * space.heightM;
        qty = p.qtyOverride != null ? p.qtyOverride : autoQty;
      } else {
        qty = p.qtyOverride != null ? p.qtyOverride : p.quantity;
      }

      const lineTotal = qty * item.unitPrice;

      if (!byCategory[catName]) {
        byCategory[catName] = { name: catName, label: catLabel, items: [], subtotal: 0 };
      }
      byCategory[catName].items.push({ ...p, computedQty: qty, autoQty, lineTotal });
      byCategory[catName].subtotal += lineTotal;
    });

    const subtotal = Object.values(byCategory).reduce((s, c) => s + c.subtotal, 0);
    const vat = subtotal * 0.1;
    const total = showVat ? subtotal + vat : subtotal;

    return { categories: Object.values(byCategory), subtotal, vat, total, showVat };
  },

  markClean: () => set({ isDirty: false }),
}));

export default usePlannerStore;
