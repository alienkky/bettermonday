const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin, requireMaster } = require('../middleware/auth');
const XLSX = require('xlsx');
const multer = require('multer');

const router = express.Router();
const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// SEED DATA (from 실시간 자재 단가 트래킹 웹)
// ─────────────────────────────────────────────

const MC_DATA = [
  { name: '제비스코 GR 0827', spec: 'Ecru, 내부 벽면·천장·프레임', category: '도장', unit: '㎡', minPrice: 6500, maxPrice: 9500, changePct: 2.1, source: '구글검색(제비스코)' },
  { name: '테라코 그래뉼 TK-506', spec: '무명색 25kg, 외부 갈바 위 마감', category: '도장', unit: '㎡', minPrice: 11000, maxPrice: 16000, changePct: 3.2, source: '구글검색(다나와)' },
  { name: '레드 분체도장', spec: '디자인보드·D/P장 선반', category: '도장', unit: '㎡', minPrice: 15000, maxPrice: 25000, changePct: 1.8, source: '구글검색(powderkorea)' },
  { name: '영림 PW845', spec: '우드, 주방벽면·가구마감·붙박이소파', category: '필름', unit: 'm', minPrice: 8500, maxPrice: 13000, changePct: 1.5, source: '한국물가정보' },
  { name: '영림 132', spec: '우드, 홀 지정 공간(스케치업 반영)', category: '필름', unit: 'm', minPrice: 8500, maxPrice: 13000, changePct: 1.5, source: '한국물가정보' },
  { name: 'LX지인 RS132', spec: '베이지, 홀 지정 공간·창고 내외부', category: '필름', unit: 'm', minPrice: 9000, maxPrice: 14000, changePct: 1.2, source: '한국물가정보' },
  { name: '까사세라믹 66PDN27', spec: '챠콜 600×600, 전체바닥', category: '타일', unit: '㎡', minPrice: 35000, maxPrice: 52000, changePct: 1.8, source: '한국물가정보' },
  { name: '테라코타 점토타일', spec: 'SW색상 240×60×12T, 테이크아웃·주방 하부', category: '타일', unit: '㎡', minPrice: 50000, maxPrice: 75000, changePct: 2.4, source: '구글검색(폴브릭스)' },
  { name: '대군통상 JEAN시리즈 2532', spec: '챠콜 인조가죽, 붙박이소파·등받이', category: '패브릭', unit: 'm', minPrice: 6300, maxPrice: 12800, changePct: 0.8, source: '구글검색(천나라)' },
  { name: '더쎈 COB 8W (3인치)', spec: '화이트바디 전구색, 전체 조명', category: '조명', unit: 'EA', minPrice: 4000, maxPrice: 11000, changePct: 1.3, source: '구글검색(11번가)' },
  { name: '강화도어 손잡이 원홀 150mm', spec: '레드, 주 출입구', category: '손잡이', unit: 'EA', minPrice: 39000, maxPrice: 48500, changePct: 0.5, source: '구글검색(철물스토어)' },
  { name: '도무스 905SS', spec: '실버, 내부 도어', category: '손잡이', unit: 'EA', minPrice: 23660, maxPrice: 25500, changePct: 0.3, source: '구글검색(다나와)' },
];

const LM_DATA = [
  { name: '제비스코 GR 0841', spec: 'RGB(229,226,210), 천장·내부 지정 벽면 마감', category: '도장', unit: '㎡', minPrice: 6500, maxPrice: 9500, changePct: 2.0, source: '구글검색(제비스코)' },
  { name: '제비스코 흑색 (유성)', spec: '검정색 무광, 외부 마감', category: '도장', unit: '㎡', minPrice: 8000, maxPrice: 13000, changePct: 1.8, source: '구글검색(제비스코)' },
  { name: '영림 PW927-1 / 영림104', spec: '우드, 베이커리DP하부장·가구마감·카운터하부장·홀 전체 벽체', category: '필름', unit: 'm', minPrice: 8500, maxPrice: 13000, changePct: 1.5, source: '한국물가정보' },
  { name: '영림 PW836-1', spec: '블랙, 베이커리DP장 상판·창고 내외부·샷시 프레임', category: '필름', unit: 'm', minPrice: 8500, maxPrice: 13000, changePct: 1.4, source: '한국물가정보' },
  { name: 'LX지인 RS131', spec: '화이트, 홀 전체 벽체 (매지 시공 필수)', category: '필름', unit: 'm', minPrice: 9000, maxPrice: 14500, changePct: 1.2, source: '한국물가정보' },
  { name: '까사세라믹 YY 오키드L', spec: '베이지 600×600 포세린무광, 전체바닥 (택1)', category: '타일', unit: '㎡', minPrice: 35000, maxPrice: 52000, changePct: 1.6, source: '한국물가정보' },
  { name: 'NT66007-2', spec: '크림 600×600 포세린무광, 전체바닥 (택1)', category: '타일', unit: '㎡', minPrice: 33000, maxPrice: 50000, changePct: 1.5, source: '한국물가정보' },
  { name: '현대L&C ST-102', spec: '마렐리뇨, 주방 상판·빵 매대', category: '인조대리석', unit: 'm', minPrice: 120000, maxPrice: 180000, changePct: 2.8, source: '한국물가정보' },
  { name: '대군통상 JEAN시리즈 2532', spec: '챠콜, 붙박이소파·등받이', category: '패브릭', unit: 'm', minPrice: 15000, maxPrice: 25000, changePct: 0.8, source: '구글검색(매직펑션)' },
  { name: '비츠조명 루바 1등', spec: '블랙 전구색, 고정테이블 벽등', category: '조명', unit: 'EA', minPrice: 29000, maxPrice: 45000, changePct: 1.3, source: '구글검색(비츠조명)' },
  { name: '더쎈 COB 8W (3인치)', spec: '화이트바디 전구색, 전체 조명', category: '조명', unit: 'EA', minPrice: 4000, maxPrice: 11000, changePct: 1.1, source: '구글검색(11번가)' },
  { name: '나눔조명 호박U자가지 벽등 20호', spec: '블랙, 외부 벽등 (H:2100), 전구 12W 별도', category: '조명', unit: 'EA', minPrice: 33000, maxPrice: 55000, changePct: 0.9, source: '구글검색(조명쇼핑몰)' },
  { name: '강화도어 340 원형손잡이', spec: '650mm 블랙, 주 출입구 강화도어', category: '손잡이', unit: 'EA', minPrice: 35000, maxPrice: 55000, changePct: 0.6, source: '구글검색(철물스토어)' },
  { name: '도무스 950BK', spec: '블랙, 내부 도어', category: '손잡이', unit: 'EA', minPrice: 25000, maxPrice: 33000, changePct: 0.4, source: '구글검색(메탈팜)' },
  { name: '강화유리 출입문', spec: '도어 높이/폭 현장별 상이, 손잡이 별도', category: '금속유리', unit: '㎡', minPrice: 95000, maxPrice: 140000, changePct: 2.5, source: '구글검색(한국물가정보)' },
  { name: '각관 하지 + 라운드 테이블', spec: 'R값 600 밴딩, 바닥에서 700 설치', category: '금속유리', unit: '식', minPrice: 380000, maxPrice: 550000, changePct: 1.8, source: '구글검색(제작업체)' },
  { name: 'R파티션 제작', spec: 'R600, W현장별×H600, 피스 시공 날개 30mm', category: '금속유리', unit: 'EA', minPrice: 180000, maxPrice: 300000, changePct: 1.5, source: '구글검색(인테리어업체)' },
  { name: '빵DP장 선반 (원형파이프 32Ø)', spec: 'D350, H350(2단)/400(1단), LED바 홈작업 포함', category: '금속유리', unit: '식', minPrice: 250000, maxPrice: 420000, changePct: 1.6, source: '구글검색(제작업체)' },
  { name: 'PVC배관 75Ø', spec: '급배수·오배수, 레듀샤(50×75) 포함', category: '설비', unit: 'm', minPrice: 5000, maxPrice: 8500, changePct: 1.0, source: '조달청' },
  { name: '황동 볼밸브 노브', spec: '급수 밸브, 관붙이 앵글밸브(국산)', category: '설비', unit: 'EA', minPrice: 5500, maxPrice: 16000, changePct: 0.7, source: '구글검색(배관몰)' },
  { name: 'PVC 마감캡 (배관마감)', spec: '기기장비 설치 후 타공 설치, 실리콘 마감 불가', category: '설비', unit: 'EA', minPrice: 500, maxPrice: 3000, changePct: 0.3, source: '구글검색(쇼핑하우)' },
];

const WOOD_DATA = [
  { name: '합판 12T', spec: '1220×2440, 내수합판', category: '목공자재', unit: '매', minPrice: 24000, maxPrice: 32000, changePct: -0.8, source: '한국물가정보' },
  { name: '합판 18T', spec: '1220×2440, 내수합판', category: '목공자재', unit: '매', minPrice: 33000, maxPrice: 44000, changePct: -1.2, source: '한국물가정보' },
  { name: 'MDF 9T', spec: '1220×2440', category: '목공자재', unit: '매', minPrice: 9900, maxPrice: 15000, changePct: 1.5, source: '구글검색(싹다/우드앤홈)' },
  { name: 'MDF 15T', spec: '1220×2440', category: '목공자재', unit: '매', minPrice: 16800, maxPrice: 22000, changePct: 1.8, source: '구글검색(싹다/우드앤홈)' },
  { name: '각재 (30×30)', spec: '소나무, 3.6m', category: '목공자재', unit: 'EA', minPrice: 2500, maxPrice: 4200, changePct: 0.9, source: '한국물가정보' },
  { name: '각재 (40×40)', spec: '소나무, 3.6m', category: '목공자재', unit: 'EA', minPrice: 3500, maxPrice: 5500, changePct: 1.0, source: '한국물가정보' },
  { name: '석고보드 9.5T', spec: '900×1800', category: '목공자재', unit: '매', minPrice: 3800, maxPrice: 5800, changePct: 5.2, source: '한국물가정보' },
  { name: '석고보드 12.5T', spec: '900×1800', category: '목공자재', unit: '매', minPrice: 4800, maxPrice: 7200, changePct: 4.8, source: '한국물가정보' },
  { name: '경량철물 스터드 (65×45)', spec: '0.5t, 3m', category: '목공자재', unit: 'EA', minPrice: 2800, maxPrice: 4200, changePct: 1.0, source: '조달청' },
  { name: '경량철물 런너 (65×30)', spec: '0.5t, 3m', category: '목공자재', unit: 'EA', minPrice: 2500, maxPrice: 3800, changePct: 0.8, source: '조달청' },
  { name: '타카핀 (F30)', spec: '1박스 5,000본', category: '목공자재', unit: '박스', minPrice: 3300, maxPrice: 6500, changePct: 0.3, source: '구글검색(다나와)' },
  { name: '본드 (목공용)', spec: '4kg 1통', category: '목공자재', unit: '통', minPrice: 12000, maxPrice: 18000, changePct: 0.5, source: '구글검색(다우몰)' },
  { name: '피스 (드라이월)', spec: '1박스 1,000본', category: '목공자재', unit: '박스', minPrice: 7000, maxPrice: 11000, changePct: 0.2, source: '구글검색(꾸밈닷컴)' },
];

const LABOR_DATA = [
  { name: '목수 (일반)', spec: '1일 8시간 기준, 목공사 전반', category: '인건비', unit: '인/일', minPrice: 280000, maxPrice: 380000, changePct: 3.5, source: '대한건설협회' },
  { name: '목수 (숙련공)', spec: '1일 8시간 기준, 가구·정밀작업', category: '인건비', unit: '인/일', minPrice: 350000, maxPrice: 450000, changePct: 4.2, source: '대한건설협회' },
  { name: '배관공 (일반)', spec: '1일 8시간 기준, 급배수·오배수', category: '인건비', unit: '인/일', minPrice: 300000, maxPrice: 400000, changePct: 3.8, source: '대한건설협회' },
  { name: '배관공 (숙련공)', spec: '1일 8시간 기준, 특수배관', category: '인건비', unit: '인/일', minPrice: 380000, maxPrice: 480000, changePct: 4.5, source: '대한건설협회' },
  { name: '전기공 (일반)', spec: '1일 8시간 기준, 배선·콘센트·스위치', category: '인건비', unit: '인/일', minPrice: 280000, maxPrice: 370000, changePct: 3.2, source: '대한건설협회' },
  { name: '전기공 (숙련공)', spec: '1일 8시간 기준, 분전반·조명설계', category: '인건비', unit: '인/일', minPrice: 350000, maxPrice: 450000, changePct: 4.0, source: '대한건설협회' },
  { name: '도장공', spec: '1일 8시간 기준, 벽면·천장 도장', category: '인건비', unit: '인/일', minPrice: 250000, maxPrice: 350000, changePct: 2.8, source: '대한건설협회' },
  { name: '타일공', spec: '1일 8시간 기준, 바닥·벽면 타일시공', category: '인건비', unit: '인/일', minPrice: 300000, maxPrice: 420000, changePct: 3.5, source: '대한건설협회' },
  { name: '보통인부', spec: '1일 8시간 기준, 잡역·자재운반', category: '인건비', unit: '인/일', minPrice: 180000, maxPrice: 250000, changePct: 2.5, source: '대한건설협회' },
];

function fmtDate() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// MAPPERS — 시세(Market Price) Korean strings → Prisma enums
// ─────────────────────────────────────────────
const CATEGORY_MAP = {
  '도장': 'painting',
  '필름': 'film',
  '타일': 'tile',
  '패브릭': 'fabric',
  '조명': 'lighting',
  '손잡이': 'hardware',
  '인조대리석': 'stone',
  '금속유리': 'metalwork',
  '설비': 'plumbing',
  '설비/배관': 'plumbing',
  '목공자재': 'woodwork',
  '인건비': 'labor',
};

const UNIT_MAP = {
  '㎡': 'm2',
  'm2': 'm2',
  'm': 'm',
  'EA': 'ea',
  'ea': 'ea',
  '식': 'set',
  'set': 'set',
  '인/일': 'day',
  'day': 'day',
  '박스': 'box',
  'box': 'box',
  '통': 'unit',
  '매': 'unit',
};

async function ensureCategoryId(koreanCategory) {
  const enumName = CATEGORY_MAP[koreanCategory];
  if (!enumName) return null;
  const cat = await prisma.category.upsert({
    where: { name: enumName },
    update: {},
    create: { name: enumName },
  });
  return cat.id;
}

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────

// GET /api/market-prices — list with filters
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { brand, category, search } = req.query;
    const where = { isActive: true };
    if (brand && brand !== '전체') where.brand = brand;
    if (category && category !== '전체') where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { spec: { contains: search, mode: 'insensitive' } },
      ];
    }
    const items = await prisma.marketPrice.findMany({
      where,
      include: { linkedItem: { include: { category: true } } },
      orderBy: [{ brand: 'asc' }, { category: 'asc' }, { name: 'asc' }],
    });

    // Summary stats
    const totalCount = items.length;
    const avgChange = items.length ? +(items.reduce((s, i) => s + i.changePct, 0) / items.length).toFixed(1) : 0;
    const upCount = items.filter(i => i.changePct > 0).length;
    const latestDate = items.length ? items.reduce((d, i) => (i.priceDate > d ? i.priceDate : d), '0') : '-';

    res.json({ items, summary: { totalCount, avgChange, upCount, latestDate } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '시세 목록 조회 실패' });
  }
});

// POST /api/market-prices — create single (master only)
router.post('/', requireMaster, async (req, res) => {
  try {
    const { brand, name, spec, category, unit, minPrice, maxPrice, changePct, source } = req.body;
    if (!brand || !name || !category || !unit || minPrice == null || maxPrice == null)
      return res.status(400).json({ error: '필수 항목을 입력하세요.' });
    const avgPrice = Math.round((parseFloat(minPrice) + parseFloat(maxPrice)) / 2);
    const item = await prisma.marketPrice.create({
      data: { brand, name, spec, category, unit, minPrice: parseFloat(minPrice), maxPrice: parseFloat(maxPrice), avgPrice, changePct: parseFloat(changePct || 0), source, priceDate: fmtDate() },
    });
    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '시세 항목 생성 실패' });
  }
});

// PUT /api/market-prices/:id — update (master only) + auto-sync to linked item
router.put('/:id', requireMaster, async (req, res) => {
  try {
    const existing = await prisma.marketPrice.findUnique({ where: { id: req.params.id }, include: { linkedItem: true } });
    if (!existing) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    const { brand, name, spec, category, unit, minPrice, maxPrice, changePct, source } = req.body;
    const min = minPrice != null ? parseFloat(minPrice) : existing.minPrice;
    const max = maxPrice != null ? parseFloat(maxPrice) : existing.maxPrice;
    const newAvg = Math.round((min + max) / 2);
    const updated = await prisma.marketPrice.update({
      where: { id: req.params.id },
      data: { brand: brand || existing.brand, name: name || existing.name, spec: spec !== undefined ? spec : existing.spec, category: category || existing.category, unit: unit || existing.unit, minPrice: min, maxPrice: max, avgPrice: newAvg, changePct: changePct != null ? parseFloat(changePct) : existing.changePct, source: source !== undefined ? source : existing.source, priceDate: fmtDate() },
    });

    // 강압적 반영: auto-sync to linked item
    let syncResult = null;
    if (existing.linkedItem && newAvg !== existing.linkedItem.unitPrice) {
      const parts = existing.linkedItem.version.split('.').map(Number);
      parts[2] += 1;
      const newVersion = parts.join('.');
      await prisma.item.update({
        where: { id: existing.linkedItem.id },
        data: { unitPrice: newAvg, version: newVersion },
      });
      syncResult = {
        itemName: existing.linkedItem.name,
        oldPrice: existing.linkedItem.unitPrice,
        newPrice: newAvg,
        diff: +(((newAvg - existing.linkedItem.unitPrice) / existing.linkedItem.unitPrice) * 100).toFixed(1),
      };
    }

    res.json({ ...updated, syncResult });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '시세 항목 수정 실패' });
  }
});

// DELETE /api/market-prices/:id (master only)
router.delete('/:id', requireMaster, async (req, res) => {
  try {
    await prisma.marketPrice.delete({ where: { id: req.params.id } });
    res.json({ message: '삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: '삭제 실패' });
  }
});

// POST /api/market-prices/seed — seed initial data (master only)
router.post('/seed', requireMaster, async (req, res) => {
  try {
    const existing = await prisma.marketPrice.count();
    if (existing > 0 && !req.body.force)
      return res.status(400).json({ error: `이미 ${existing}건의 시세 데이터가 있습니다. 강제 초기화하려면 force: true를 전송하세요.` });

    if (req.body.force) await prisma.marketPrice.deleteMany();

    const date = fmtDate();
    const rows = [];
    MC_DATA.forEach(d => rows.push({ ...d, brand: '먼데이커피', avgPrice: Math.round((d.minPrice + d.maxPrice) / 2), priceDate: date }));
    LM_DATA.forEach(d => rows.push({ ...d, brand: '스토리오브라망', avgPrice: Math.round((d.minPrice + d.maxPrice) / 2), priceDate: date }));
    WOOD_DATA.forEach(d => rows.push({ ...d, brand: '공통', avgPrice: Math.round((d.minPrice + d.maxPrice) / 2), priceDate: date }));
    LABOR_DATA.forEach(d => rows.push({ ...d, brand: '공통', avgPrice: Math.round((d.minPrice + d.maxPrice) / 2), priceDate: date }));

    await prisma.marketPrice.createMany({ data: rows });
    res.json({ message: `${rows.length}건의 시세 데이터가 등록되었습니다.`, count: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '시세 데이터 초기화 실패' });
  }
});

// POST /api/market-prices/refresh — simulate price update (master only) + auto-sync items
router.post('/refresh', requireMaster, async (req, res) => {
  try {
    const items = await prisma.marketPrice.findMany({
      where: { isActive: true },
      include: { linkedItem: true },
    });
    const date = fmtDate();
    let updated = 0;
    let itemsSynced = 0;
    for (const item of items) {
      const noise = 1 + (Math.random() - 0.5) * 0.014; // ±0.7%
      const newMin = Math.round(item.minPrice * noise);
      const newMax = Math.round(item.maxPrice * noise);
      const newAvg = Math.round((newMin + newMax) / 2);
      const oldAvg = item.avgPrice;
      const pct = oldAvg ? +((newAvg - oldAvg) / oldAvg * 100).toFixed(1) : 0;
      await prisma.marketPrice.update({
        where: { id: item.id },
        data: { minPrice: newMin, maxPrice: newMax, avgPrice: newAvg, changePct: pct, priceDate: date },
      });
      updated++;

      // 강압적 반영: auto-sync linked item
      if (item.linkedItem && newAvg !== item.linkedItem.unitPrice) {
        const parts = item.linkedItem.version.split('.').map(Number);
        parts[2] += 1;
        await prisma.item.update({
          where: { id: item.linkedItem.id },
          data: { unitPrice: newAvg, version: parts.join('.') },
        });
        itemsSynced++;
      }
    }
    res.json({ message: `${updated}개 품목 시세 갱신 완료${itemsSynced > 0 ? `, ${itemsSynced}개 아이템 단가 자동 반영` : ''}`, count: updated, itemsSynced });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '시세 갱신 실패' });
  }
});

// PATCH /api/market-prices/:id/link — link market price to item (master only)
router.patch('/:id/link', requireMaster, async (req, res) => {
  try {
    const { itemId } = req.body;
    const mp = await prisma.marketPrice.findUnique({ where: { id: req.params.id } });
    if (!mp) return res.status(404).json({ error: '시세 항목을 찾을 수 없습니다.' });
    if (itemId) {
      const item = await prisma.item.findUnique({ where: { id: itemId } });
      if (!item) return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }
    const updated = await prisma.marketPrice.update({
      where: { id: req.params.id },
      data: { linkedItemId: itemId || null },
      include: { linkedItem: { include: { category: true } } },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '연결 실패' });
  }
});

// GET /api/market-prices/compare — compare linked market prices with item catalog
router.get('/compare', requireAdmin, async (req, res) => {
  try {
    const marketPrices = await prisma.marketPrice.findMany({
      where: { isActive: true },
      include: { linkedItem: { include: { category: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    const allItems = await prisma.item.findMany({ where: { isActive: true }, include: { category: true } });

    const comparisons = marketPrices.map(mp => {
      const linked = mp.linkedItem;
      // Suggest items by name similarity for unlinked
      let suggestions = [];
      if (!linked) {
        suggestions = allItems.filter(item => {
          return item.name.includes(mp.name) || mp.name.includes(item.name) ||
            item.name.split(' ').some(w => w.length > 1 && mp.name.includes(w));
        }).slice(0, 3).map(item => ({
          id: item.id, name: item.name, unitPrice: item.unitPrice, unit: item.unit, category: item.category?.name,
        }));
      }
      const itemPrice = linked?.unitPrice || null;
      const diff = (linked && mp.avgPrice) ? +(((itemPrice - mp.avgPrice) / mp.avgPrice) * 100).toFixed(1) : null;

      return {
        marketPrice: { id: mp.id, brand: mp.brand, name: mp.name, spec: mp.spec, category: mp.category, unit: mp.unit, avgPrice: mp.avgPrice, minPrice: mp.minPrice, maxPrice: mp.maxPrice, changePct: mp.changePct },
        linked: linked ? { id: linked.id, name: linked.name, unitPrice: linked.unitPrice, unit: linked.unit, category: linked.category?.name, version: linked.version } : null,
        suggestions,
        diff,
      };
    });

    res.json({ comparisons, totalLinked: comparisons.filter(c => c.linked).length, totalUnlinked: comparisons.filter(c => !c.linked).length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '단가 비교 실패' });
  }
});

// POST /api/market-prices/sync-to-items — auto-update linked item prices (master only)
router.post('/sync-to-items', requireMaster, async (req, res) => {
  try {
    const { marketPriceIds, priceType = 'avg' } = req.body;
    // If marketPriceIds provided, sync only those; otherwise sync all linked
    const where = { isActive: true, linkedItemId: { not: null } };
    if (marketPriceIds?.length) where.id = { in: marketPriceIds };

    const marketPrices = await prisma.marketPrice.findMany({
      where,
      include: { linkedItem: true },
    });

    let updated = 0;
    const results = [];
    for (const mp of marketPrices) {
      if (!mp.linkedItem) continue;
      const newPrice = priceType === 'min' ? mp.minPrice : priceType === 'max' ? mp.maxPrice : mp.avgPrice;
      const oldPrice = mp.linkedItem.unitPrice;
      if (newPrice === oldPrice) continue;

      const parts = mp.linkedItem.version.split('.').map(Number);
      parts[2] += 1;
      const newVersion = parts.join('.');

      await prisma.item.update({
        where: { id: mp.linkedItem.id },
        data: { unitPrice: newPrice, version: newVersion },
      });
      results.push({ marketPriceName: mp.name, itemName: mp.linkedItem.name, oldPrice, newPrice, diff: +(((newPrice - oldPrice) / oldPrice) * 100).toFixed(1) });
      updated++;
    }

    res.json({ message: `${updated}개 아이템 단가 반영 완료`, updated, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '단가 반영 실패' });
  }
});

// POST /api/market-prices/force-sync-all — 강제 일괄 반영 (master only)
// - 연결된 시세 → 기존 아이템 단가 업데이트
// - 미연결 시세 → 아이템 자동 등록 + 연결
router.post('/force-sync-all', requireMaster, async (req, res) => {
  try {
    const { priceType = 'avg' } = req.body;
    const marketPrices = await prisma.marketPrice.findMany({
      where: { isActive: true },
      include: { linkedItem: true },
    });

    let updated = 0;
    let created = 0;
    let skipped = 0;
    const results = [];
    const skippedDetails = [];

    for (const mp of marketPrices) {
      const newPrice = priceType === 'min' ? mp.minPrice : priceType === 'max' ? mp.maxPrice : mp.avgPrice;

      // (1) 이미 연결된 아이템이 있으면 → 단가 업데이트
      if (mp.linkedItem) {
        const oldPrice = mp.linkedItem.unitPrice;
        if (newPrice === oldPrice) continue;
        const parts = mp.linkedItem.version.split('.').map(Number);
        parts[2] += 1;
        await prisma.item.update({
          where: { id: mp.linkedItem.id },
          data: { unitPrice: newPrice, version: parts.join('.') },
        });
        results.push({
          action: 'updated',
          marketPriceName: mp.name,
          itemName: mp.linkedItem.name,
          oldPrice,
          newPrice,
          diff: oldPrice ? +(((newPrice - oldPrice) / oldPrice) * 100).toFixed(1) : 0,
        });
        updated++;
        continue;
      }

      // (2) 미연결 → 같은 brand+name 아이템을 찾거나 신규 등록
      const categoryId = await ensureCategoryId(mp.category);
      const unit = UNIT_MAP[mp.unit];
      if (!categoryId || !unit) {
        skipped++;
        skippedDetails.push({ name: mp.name, reason: !categoryId ? `카테고리 매핑 없음(${mp.category})` : `단위 매핑 없음(${mp.unit})` });
        continue;
      }

      // 동일 brand+name 기존 아이템 검색 (있으면 연결만)
      let item = await prisma.item.findFirst({
        where: { brand: mp.brand, name: mp.name, isActive: true },
      });

      if (item) {
        // 기존 아이템과 연결 + 단가 반영
        if (item.unitPrice !== newPrice) {
          const parts = item.version.split('.').map(Number);
          parts[2] += 1;
          item = await prisma.item.update({
            where: { id: item.id },
            data: { unitPrice: newPrice, version: parts.join('.') },
          });
        }
        await prisma.marketPrice.update({ where: { id: mp.id }, data: { linkedItemId: item.id } });
        results.push({ action: 'linked', marketPriceName: mp.name, itemName: item.name, oldPrice: item.unitPrice, newPrice });
        updated++;
      } else {
        // 신규 등록
        const newItem = await prisma.item.create({
          data: {
            categoryId,
            name: mp.name,
            brand: mp.brand,
            unit,
            unitPrice: newPrice,
            description: mp.spec || null,
            isRequired: false,
            version: '1.0.0',
          },
        });
        await prisma.marketPrice.update({ where: { id: mp.id }, data: { linkedItemId: newItem.id } });
        results.push({ action: 'created', marketPriceName: mp.name, itemName: newItem.name, newPrice });
        created++;
      }
    }

    res.json({
      message: `강제 반영 완료 — 신규 ${created}개 등록, ${updated}개 업데이트${skipped > 0 ? `, ${skipped}개 건너뜀` : ''} (총 ${marketPrices.length}개 시세)`,
      created,
      updated,
      skipped,
      total: marketPrices.length,
      results,
      skippedDetails,
    });
  } catch (err) {
    console.error('[force-sync-all] error:', err);
    res.status(500).json({ error: '강제 반영 실패: ' + (err.message || 'unknown') });
  }
});

// GET /api/market-prices/export — Excel export
router.get('/export', requireAdmin, async (req, res) => {
  try {
    const { brand, category } = req.query;
    const where = { isActive: true };
    if (brand && brand !== '전체') where.brand = brand;
    if (category && category !== '전체') where.category = category;

    const items = await prisma.marketPrice.findMany({ where, orderBy: [{ brand: 'asc' }, { category: 'asc' }, { name: 'asc' }] });
    const rows = items.map(i => ({
      '브랜드': i.brand,
      '자재명': i.name,
      '규격': i.spec || '',
      '카테고리': i.category,
      '최저가': i.minPrice,
      '평균가': i.avgPrice,
      '최대가': i.maxPrice,
      '단위': i.unit,
      '전월比(%)': i.changePct,
      '출처': i.source || '',
      '기준일': i.priceDate,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 14 }, { wch: 30 }, { wch: 40 }, { wch: 10 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 },
      { wch: 10 }, { wch: 25 }, { wch: 12 },
    ];
    ws['!autofilter'] = { ref: `A1:K${rows.length + 1}` };
    XLSX.utils.book_append_sheet(wb, ws, '자재 시세');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `market_prices_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '엑셀 내보내기 실패' });
  }
});

module.exports = router;
