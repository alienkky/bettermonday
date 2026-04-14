const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');

const router = express.Router();
const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `item-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'isoImage', maxCount: 1 },
]);

// GET /api/items — all active items (public for logged-in customers)
router.get('/', authenticate, async (req, res) => {
  try {
    const { categoryId, isActive, brand } = req.query;
    const where = {};
    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    else where.isActive = true;
    if (brand) where.OR = [{ brand }, { brand: '공통' }];

    const items = await prisma.item.findMany({
      where,
      include: { category: true },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: '아이템 목록 조회 실패' });
  }
});

// GET /api/items/all — admin: all items including inactive
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const items = await prisma.item.findMany({
      include: { category: true },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: '아이템 목록 조회 실패' });
  }
});

// POST /api/items — admin: create item
router.post('/', requireAdmin, uploadFields, async (req, res) => {
  try {
    const { categoryId, name, unit, unitPrice, description, isRequired, width, height, tileSize, areaBasis, brand } = req.body;
    if (!categoryId || !name || !unit || !unitPrice)
      return res.status(400).json({ error: '필수 항목을 입력하세요.' });

    // Get current system version
    const sysVersion = await prisma.systemVersion.findFirst({ where: { isCurrent: true } });
    const version = sysVersion?.version || '1.0.0';

    const imageUrl = req.files?.image?.[0] ? `/uploads/${req.files.image[0].filename}` : null;
    const isoImageUrl = req.files?.isoImage?.[0] ? `/uploads/${req.files.isoImage[0].filename}` : null;
    const item = await prisma.item.create({
      data: {
        categoryId,
        name,
        brand: brand || '공통',
        unit,
        unitPrice: parseFloat(unitPrice),
        description,
        imageUrl,
        isoImageUrl,
        isRequired: isRequired === 'true' || isRequired === true,
        width: width ? parseFloat(width) : null,
        height: height ? parseFloat(height) : null,
        tileSize: tileSize ? parseInt(tileSize) : null,
        areaBasis: areaBasis || null,
        version,
      },
      include: { category: true },
    });
    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '아이템 생성 실패' });
  }
});

// PUT /api/items/:id — admin: update item (bumps patch version)
router.put('/:id', requireAdmin, uploadFields, async (req, res) => {
  try {
    const item = await prisma.item.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });

    const { name, unit, unitPrice, description, isRequired, isActive, width, height, tileSize, areaBasis } = req.body;

    // Auto-bump patch version if price changed
    let newVersion = item.version;
    if (unitPrice && parseFloat(unitPrice) !== item.unitPrice) {
      const parts = item.version.split('.').map(Number);
      parts[2] += 1;
      newVersion = parts.join('.');
    }

    const imageUrl = req.files?.image?.[0] ? `/uploads/${req.files.image[0].filename}` : item.imageUrl;
    const isoImageUrl = req.files?.isoImage?.[0] ? `/uploads/${req.files.isoImage[0].filename}` : item.isoImageUrl;
    const updated = await prisma.item.update({
      where: { id: req.params.id },
      data: {
        name: name || item.name,
        unit: unit || item.unit,
        unitPrice: unitPrice ? parseFloat(unitPrice) : item.unitPrice,
        description: description !== undefined ? description : item.description,
        imageUrl,
        isoImageUrl,
        isRequired: isRequired !== undefined ? (isRequired === 'true' || isRequired === true) : item.isRequired,
        isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : item.isActive,
        width: width !== undefined ? (width ? parseFloat(width) : null) : item.width,
        height: height !== undefined ? (height ? parseFloat(height) : null) : item.height,
        tileSize: tileSize !== undefined ? (tileSize ? parseInt(tileSize) : null) : item.tileSize,
        areaBasis: areaBasis !== undefined ? (areaBasis || null) : item.areaBasis,
        version: newVersion,
      },
      include: { category: true },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '아이템 업데이트 실패' });
  }
});

// PATCH /api/items/:id/toggle — admin: toggle active
router.patch('/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const item = await prisma.item.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    const updated = await prisma.item.update({
      where: { id: req.params.id },
      data: { isActive: !item.isActive },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: '상태 변경 실패' });
  }
});

// POST /api/items/bulk — admin: bulk actions (activate, deactivate, delete, price change)
router.post('/bulk', requireAdmin, async (req, res) => {
  try {
    const { ids, action, unitPrice } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ error: '아이템을 선택하세요.' });

    let result;
    switch (action) {
      case 'activate':
        result = await prisma.item.updateMany({ where: { id: { in: ids } }, data: { isActive: true } });
        res.json({ message: `${result.count}개 아이템 활성화`, count: result.count });
        break;
      case 'deactivate':
        result = await prisma.item.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
        res.json({ message: `${result.count}개 아이템 비활성화`, count: result.count });
        break;
      case 'delete':
        result = await prisma.item.deleteMany({ where: { id: { in: ids } } });
        res.json({ message: `${result.count}개 아이템 삭제`, count: result.count });
        break;
      case 'price':
        if (!unitPrice || isNaN(parseFloat(unitPrice)))
          return res.status(400).json({ error: '변경할 단가를 입력하세요.' });
        result = await prisma.item.updateMany({
          where: { id: { in: ids } },
          data: { unitPrice: parseFloat(unitPrice) },
        });
        res.json({ message: `${result.count}개 아이템 단가 변경`, count: result.count });
        break;
      default:
        return res.status(400).json({ error: '올바른 액션을 선택하세요.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '일괄 처리 실패' });
  }
});

// ─────────────────────────────────────────────
// SEED FROM MARKET PRICES
// ─────────────────────────────────────────────

const MP_CAT_MAP = {
  '도장': 'painting', '필름': 'film', '타일': 'tile', '패브릭': 'fabric',
  '조명': 'lighting', '손잡이': 'hardware', '인조대리석': 'stone', '금속유리': 'metalwork',
  '설비': 'plumbing', '설비/배관': 'plumbing', '목공자재': 'woodwork', '인건비': 'labor',
};
const MP_UNIT_MAP = {
  '㎡': 'm2', 'm': 'm', 'EA': 'ea', '식': 'set', '인/일': 'day', '박스': 'box', '통': 'unit', '매': 'unit',
};

router.post('/seed-from-market', requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.item.count();
    if (existing > 0 && !req.body.force)
      return res.status(400).json({ error: `이미 ${existing}건의 아이템이 있습니다. force: true를 전송하면 초기화 후 시딩합니다.` });

    if (req.body.force) {
      await prisma.placement.deleteMany();
      await prisma.item.deleteMany();
      await prisma.category.deleteMany();
    }

    // 1. Create all categories
    const categoryNames = ['painting', 'film', 'tile', 'fabric', 'lighting', 'hardware', 'stone', 'metalwork', 'plumbing', 'woodwork', 'labor'];
    const catMap = {};
    for (const name of categoryNames) {
      const cat = await prisma.category.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      catMap[name] = cat.id;
    }

    // 2. Load market prices
    const marketPrices = await prisma.marketPrice.findMany({ where: { isActive: true } });
    if (marketPrices.length === 0) {
      return res.status(400).json({ error: '시세 데이터가 없습니다. 먼저 시세 데이터를 시딩하세요.' });
    }

    // 3. Create items from market prices
    let created = 0;
    for (const mp of marketPrices) {
      const catEnum = MP_CAT_MAP[mp.category];
      if (!catEnum || !catMap[catEnum]) continue;

      const unitEnum = MP_UNIT_MAP[mp.unit] || 'm2';
      const item = await prisma.item.create({
        data: {
          categoryId: catMap[catEnum],
          name: mp.name,
          brand: mp.brand,
          unit: unitEnum,
          unitPrice: mp.avgPrice,
          description: mp.spec || null,
          isRequired: false,
          version: '1.0.0',
        },
      });

      // Link market price to this item
      await prisma.marketPrice.update({
        where: { id: mp.id },
        data: { linkedItemId: item.id },
      });
      created++;
    }

    res.json({ message: `${created}개 아이템이 시세 데이터에서 생성되었습니다.`, created, categories: categoryNames.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '시딩 실패: ' + err.message });
  }
});

// ─────────────────────────────────────────────
// EXCEL EXPORT / IMPORT
// ─────────────────────────────────────────────

const CAT_KO = {
  painting: '도장', film: '필름', tile: '타일', fabric: '패브릭',
  lighting: '조명', hardware: '손잡이', stone: '인조대리석', metalwork: '금속유리',
  plumbing: '설비/배관', woodwork: '목공자재', labor: '인건비',
};
const CAT_EN = Object.fromEntries(Object.entries(CAT_KO).map(([k, v]) => [v, k]));
const UNIT_KO = { m2: 'm²', m: 'm', ea: '개', set: '세트', day: '인/일', box: '박스', unit: '매' };
const UNIT_EN = Object.fromEntries(Object.entries(UNIT_KO).map(([k, v]) => [v, k]));

// GET /api/items/export — download items as Excel
router.get('/export', requireAdmin, async (req, res) => {
  try {
    const items = await prisma.item.findMany({
      include: { category: true },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });

    const rows = items.map(item => ({
      'ID': item.id,
      '브랜드': item.brand || '공통',
      '카테고리': CAT_KO[item.category?.name] || item.category?.name || '',
      '아이템명': item.name,
      '단가(원)': item.unitPrice,
      '단위': UNIT_KO[item.unit] || item.unit,
      '설명': item.description || '',
      '필수여부': item.isRequired ? 'Y' : 'N',
      '활성여부': item.isActive ? 'Y' : 'N',
      '가로(m)': item.width || '',
      '세로(m)': item.height || '',
      '타일크기(mm)': item.tileSize || '',
      '면적기준': item.areaBasis === 'floor' ? '바닥' : item.areaBasis === 'wall' ? '벽' : '',
      '버전': item.version,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    ws['!cols'] = [
      { wch: 38 }, // ID
      { wch: 14 }, // 브랜드
      { wch: 10 }, // 카테고리
      { wch: 22 }, // 아이템명
      { wch: 12 }, // 단가
      { wch: 6 },  // 단위
      { wch: 30 }, // 설명
      { wch: 8 },  // 필수여부
      { wch: 8 },  // 활성여부
      { wch: 8 },  // 가로
      { wch: 8 },  // 세로
      { wch: 12 }, // 타일크기
      { wch: 8 },  // 면적기준
      { wch: 8 },  // 버전
    ];

    // Auto-filter on header row
    ws['!autofilter'] = { ref: `A1:N${rows.length + 1}` };

    XLSX.utils.book_append_sheet(wb, ws, '아이템 단가');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `items_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '엑셀 내보내기 실패' });
  }
});

// POST /api/items/import — upload Excel to bulk update/create items
const excelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/import', requireAdmin, excelUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);

    if (!rows.length) return res.status(400).json({ error: '엑셀에 데이터가 없습니다.' });

    // Load categories for mapping
    const categories = await prisma.category.findMany();
    const catMap = {};
    categories.forEach(c => {
      catMap[c.name] = c.id;
      catMap[CAT_KO[c.name]] = c.id;
    });

    let updated = 0, created = 0, skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row number (header is row 1)

      try {
        const name = (row['아이템명'] || '').toString().trim();
        const priceRaw = row['단가(원)'];
        const catLabel = (row['카테고리'] || '').toString().trim();

        if (!name) { skipped++; continue; }
        if (priceRaw === undefined || priceRaw === '') { errors.push(`${rowNum}행: 단가 누락 (${name})`); skipped++; continue; }

        const unitPrice = parseFloat(priceRaw);
        if (isNaN(unitPrice)) { errors.push(`${rowNum}행: 단가 숫자 오류 (${name})`); skipped++; continue; }

        const categoryId = catMap[catLabel];
        if (!categoryId) { errors.push(`${rowNum}행: 카테고리 오류 "${catLabel}" (${name})`); skipped++; continue; }

        const unitLabel = (row['단위'] || 'm²').toString().trim();
        const unit = UNIT_EN[unitLabel] || 'm2';
        const description = row['설명'] ? row['설명'].toString() : null;
        const isRequired = (row['필수여부'] || '').toString().toUpperCase() === 'Y';
        const isActive = (row['활성여부'] || 'Y').toString().toUpperCase() !== 'N';
        const width = row['가로(m)'] ? parseFloat(row['가로(m)']) : null;
        const height = row['세로(m)'] ? parseFloat(row['세로(m)']) : null;
        const tileSize = row['타일크기(mm)'] ? parseInt(row['타일크기(mm)']) : null;
        const areaBasisLabel = (row['면적기준'] || '').toString().trim();
        const areaBasis = areaBasisLabel === '바닥' ? 'floor' : areaBasisLabel === '벽' ? 'wall' : null;

        const brand = (row['브랜드'] || '공통').toString().trim();

        const data = {
          categoryId, name, brand, unit, unitPrice, description,
          isRequired, isActive, width, height, tileSize, areaBasis,
        };

        const id = row['ID'] ? row['ID'].toString().trim() : null;

        if (id) {
          // Try to update existing item
          const existing = await prisma.item.findUnique({ where: { id } });
          if (existing) {
            // Auto-bump version if price changed
            let version = existing.version;
            if (unitPrice !== existing.unitPrice) {
              const parts = version.split('.').map(Number);
              parts[2] += 1;
              version = parts.join('.');
            }
            await prisma.item.update({ where: { id }, data: { ...data, version } });
            updated++;
          } else {
            // ID provided but not found — create new with auto ID
            await prisma.item.create({ data });
            created++;
          }
        } else {
          // No ID — create new
          await prisma.item.create({ data });
          created++;
        }
      } catch (rowErr) {
        errors.push(`${rowNum}행: ${rowErr.message}`);
        skipped++;
      }
    }

    const msg = `처리 완료: ${updated}개 수정, ${created}개 신규, ${skipped}개 건너뜀`;
    res.json({ message: msg, updated, created, skipped, errors: errors.slice(0, 20) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '엑셀 가져오기 실패: ' + err.message });
  }
});

module.exports = router;
