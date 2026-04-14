import { useState } from 'react';
import { Lock, Unlock, ChevronDown, ChevronRight } from 'lucide-react';
import usePlannerStore from '../store/plannerStore';

const CATEGORY_LABELS = {
  painting: '도장', film: '필름', tile: '타일', fabric: '패브릭',
  lighting: '조명', hardware: '손잡이', stone: '인조대리석', metalwork: '금속유리',
  plumbing: '설비/배관', woodwork: '목공자재', labor: '인건비',
};

const CAT_ICONS = {
  painting: '🎨', film: '📋', tile: '🪨', fabric: '🧵',
  lighting: '💡', hardware: '🔩', stone: '🏛️', metalwork: '⚙️',
  plumbing: '🔧', woodwork: '🪵', labor: '👷',
};

export default function ItemPanel({ categories }) {
  const [expanded, setExpanded] = useState({});
  const { placements } = usePlannerStore();

  const toggle = (name) => setExpanded((e) => ({ ...e, [name]: !e[name] }));

  // Group items by category
  const grouped = {};
  categories?.forEach((cat) => {
    if (cat.items?.length > 0) grouped[cat.name] = cat;
  });

  return (
    <div className="w-64 bg-white border-r border-gray-100 flex flex-col h-full">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-[#1a1a1a] text-sm">인테리어 아이템</h3>
        <p className="text-xs text-gray-400 mt-0.5">항목을 캔버스로 드래그하세요</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {Object.values(grouped).map((cat) => {
          const isOpen = expanded[cat.name] !== false; // default open
          return (
            <div key={cat.id}>
              <button
                onClick={() => toggle(cat.name)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 transition-colors"
              >
                <span>{CAT_ICONS[cat.name]}</span>
                <span className="flex-1 text-left">{CATEGORY_LABELS[cat.name]}</span>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {isOpen && (
                <div className="pb-1">
                  {cat.items.map((item) => (
                    <ItemCard key={item.id} item={item} categoryName={cat.name} categoryId={cat.id} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ItemCard({ item, categoryName, categoryId }) {
  const { addPlacement, toggleLock, unlockedIds, zones, placements } = usePlannerStore();
  const locked = item.isRequired && !unlockedIds.includes(item.id);

  // Attach category info so getEstimate can auto-calc area
  const itemWithCategory = { ...item, category: { id: categoryId, name: categoryName } };

  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/json', JSON.stringify(itemWithCategory));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleClick = () => {
    if (locked) return;
    // For floor tiles with zones: assign to first uncovered zone
    if (item.tileSize && (item.imageUrl || item.isoImageUrl) && zones.length > 0) {
      const coveredZoneIds = new Set(
        placements.filter(p => p.item?.tileSize && (p.item?.imageUrl || p.item?.isoImageUrl) && p.zoneId).map(p => p.zoneId)
      );
      const targetZone = zones.find(z => !coveredZoneIds.has(z.id)) || zones[0];
      addPlacement(itemWithCategory, 1, 1, targetZone.id);
      return;
    }
    addPlacement(itemWithCategory, 1, 1);
  };

  const handleLockClick = (e) => {
    e.stopPropagation();
    toggleLock(item.id);
  };

  return (
    <div
      draggable={!locked}
      onDragStart={handleDragStart}
      onClick={handleClick}
      className={`mx-2 mb-1 px-3 py-2 rounded-lg border transition-all ${
        locked
          ? 'border-orange-200 bg-orange-50 cursor-default'
          : 'border-gray-100 hover:border-[#0073ea]/30 hover:bg-blue-50 cursor-grab active:cursor-grabbing'
      }`}
    >
      <div className="flex items-start gap-2">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="w-8 h-8 object-cover rounded" />
        ) : (
          <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-base">
            {locked ? '🔒' : '📦'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-[#1a1a1a] truncate">{item.name}</span>
            {item.isRequired && (
              <button
                onClick={handleLockClick}
                className={`shrink-0 p-0.5 rounded transition-colors ${
                  locked
                    ? 'text-orange-500 hover:text-orange-700 hover:bg-orange-100'
                    : 'text-green-500 hover:text-green-700 hover:bg-green-100'
                }`}
                title={locked ? '잠금 해제' : '잠금'}
              >
                {locked ? <Lock size={10} /> : <Unlock size={10} />}
              </button>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {item.unitPrice.toLocaleString()}원/{item.unit}
          </div>
        </div>
      </div>
    </div>
  );
}
