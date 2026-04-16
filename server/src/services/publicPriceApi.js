/**
 * 공공데이터포털(data.go.kr) + 조달청 나라장터 OpenAPI 연동 서비스 (POC)
 * ───────────────────────────────────────────────────────────────
 * 목적
 *   - 시세(MarketPrice) 레코드를 외부 공공 API에서 합법/무료로 가져와
 *     프랜차이즈 인테리어 자재 단가를 자동 업데이트하기 위한 POC.
 *
 * 사용하는 외부 API
 *   1) 조달청 나라장터 종합쇼핑몰 상품정보 (ShoppingMallPrdctInfoService)
 *      - 공급가격(= 단가)과 계약기간, 규격, 업체 정보를 반환
 *      - data.go.kr 에서 "조달청 종합쇼핑몰" 검색 후 활용신청 필요
 *      - 호출 URL 예시:
 *          http://apis.data.go.kr/1230000/ShoppingMallPrdctInfoService/getMASCntrctPrdctInfoList
 *          ?serviceKey=<KEY>&pageNo=1&numOfRows=10&type=json&prdctIdntNo=...
 *
 *   2) 공공데이터포털 건설자재/물가 관련 Dataset (키워드 검색용)
 *      - 데이터셋에 따라 엔드포인트가 다르므로 env 로 엔드포인트 지정
 *
 * 환경변수
 *   - G2B_API_KEY                : 조달청 OpenAPI 일반/암호화 서비스키 (디코딩된 값)
 *   - G2B_SHOPPING_ENDPOINT      : 종합쇼핑몰 상품정보 엔드포인트 (기본값 제공)
 *   - PUBLIC_DATA_API_KEY        : data.go.kr 일반 서비스키 (보조)
 *
 * 설계 규칙
 *   - API 키가 없거나 호출이 실패하면 DEMO 데이터를 반환하여 POC 가 동작하도록 함
 *   - 호출 결과는 우리 스키마(MarketPrice) 에 맞는 공통 형태로 normalize
 *   - 모든 레코드에 sourceUrl 을 남겨서 출처를 확인 가능
 */

'use strict';

const G2B_BASE = 'http://apis.data.go.kr/1230000';
const G2B_SHOPPING_ENDPOINT =
  process.env.G2B_SHOPPING_ENDPOINT ||
  `${G2B_BASE}/ShoppingMallPrdctInfoService/getMASCntrctPrdctInfoList`;

// 우리 MarketPrice 스키마의 카테고리(한국어) ↔ 검색 키워드 매핑
// 조달청은 카테고리(물품분류번호)가 있지만 POC 에서는 name 키워드 매칭을 사용
const CATEGORY_KEYWORDS = {
  도장: ['도장', '페인트', '분체도장'],
  필름: ['인테리어필름', '데코시트', '시트지'],
  타일: ['타일', '포세린타일', '자기질타일'],
  패브릭: ['인조가죽', '시트'],
  조명: ['LED', '조명기구', '다운라이트'],
  손잡이: ['도어손잡이', '핸들'],
  인조대리석: ['인조대리석', '엔지니어드스톤'],
  금속유리: ['강화유리', '유리문'],
  설비: ['PVC배관', '배관', '밸브'],
  목공자재: ['합판', 'MDF', '석고보드', '각재'],
  인건비: [], // 인건비는 조달청에서 가져올 수 없음
};

// ─────────────────────────────────────────────
// DEMO 데이터 — API 키 없이 동작 확인용
// ─────────────────────────────────────────────
const DEMO_RECORDS = [
  {
    name: '[DEMO] 포세린 타일 600x600 챠콜',
    spec: '600×600×10mm, 1급품, KS L 1001',
    category: '타일',
    unit: '㎡',
    minPrice: 32000,
    maxPrice: 49000,
    brand: '공통',
    sourceUrl: 'https://shopping.g2b.go.kr',
    vendor: '(주)예시세라믹',
    contractDate: '2024-09-01',
  },
  {
    name: '[DEMO] LED 다운라이트 COB 8W 3인치',
    spec: '전구색 3000K, KS C IEC 62612',
    category: '조명',
    unit: 'EA',
    minPrice: 4200,
    maxPrice: 9800,
    brand: '공통',
    sourceUrl: 'https://shopping.g2b.go.kr',
    vendor: '(주)예시조명',
    contractDate: '2024-10-12',
  },
  {
    name: '[DEMO] 석고보드 12.5T',
    spec: '900×1800×12.5mm, 준불연',
    category: '목공자재',
    unit: '매',
    minPrice: 4600,
    maxPrice: 7100,
    brand: '공통',
    sourceUrl: 'https://www.data.go.kr',
    vendor: '(주)예시건재',
    contractDate: '2024-08-30',
  },
  {
    name: '[DEMO] PVC 배관 75mm',
    spec: 'KS M 3402, 급배수',
    category: '설비',
    unit: 'm',
    minPrice: 5200,
    maxPrice: 8400,
    brand: '공통',
    sourceUrl: 'https://shopping.g2b.go.kr',
    vendor: '(주)예시설비',
    contractDate: '2024-11-02',
  },
  {
    name: '[DEMO] 합판 18T 내수',
    spec: '1220×2440×18mm, KS F 3101',
    category: '목공자재',
    unit: '매',
    minPrice: 33500,
    maxPrice: 44000,
    brand: '공통',
    sourceUrl: 'https://www.data.go.kr',
    vendor: '(주)예시목재',
    contractDate: '2024-07-21',
  },
];

function filterDemoByKeyword(keyword) {
  if (!keyword) return DEMO_RECORDS;
  const k = keyword.toLowerCase();
  return DEMO_RECORDS.filter(
    (r) =>
      r.name.toLowerCase().includes(k) ||
      r.category.toLowerCase().includes(k) ||
      (r.spec || '').toLowerCase().includes(k),
  );
}

// ─────────────────────────────────────────────
// 조달청 종합쇼핑몰 상품정보 호출
// ─────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {string} [opts.keyword]    - 상품명 키워드 (prdctClsfcNoNm)
 * @param {number} [opts.numOfRows]  - 페이지당 건수 (기본 20, 최대 100)
 * @param {number} [opts.pageNo]     - 페이지 번호 (기본 1)
 * @returns {Promise<{items: object[], source: 'g2b'|'demo', raw?: any}>}
 */
async function fetchG2BShoppingMall({ keyword, numOfRows = 20, pageNo = 1 } = {}) {
  const key = process.env.G2B_API_KEY;
  if (!key) {
    return { items: filterDemoByKeyword(keyword).map(toNormalized), source: 'demo' };
  }

  const params = new URLSearchParams({
    serviceKey: key,
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
    type: 'json',
  });
  if (keyword) params.set('prdctClsfcNoNm', keyword);

  const url = `${G2B_SHOPPING_ENDPOINT}?${params.toString()}`;

  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      console.warn('[publicPriceApi] G2B HTTP error', res.status);
      return { items: filterDemoByKeyword(keyword).map(toNormalized), source: 'demo', error: `HTTP ${res.status}` };
    }
    const json = await res.json().catch(() => null);
    if (!json) {
      return { items: filterDemoByKeyword(keyword).map(toNormalized), source: 'demo', error: 'non-json response' };
    }
    // 응답 스키마: response.body.items.item (배열 또는 단일)
    const body = json?.response?.body;
    const raw = body?.items?.item;
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const items = arr.map(mapG2BRecord).filter(Boolean);
    return { items, source: 'g2b', totalCount: body?.totalCount, raw: undefined };
  } catch (err) {
    console.error('[publicPriceApi] G2B fetch failed:', err.message);
    return { items: filterDemoByKeyword(keyword).map(toNormalized), source: 'demo', error: err.message };
  }
}

// 조달청 필드명을 우리 스키마 형태로 매핑
function mapG2BRecord(r) {
  if (!r) return null;
  const name = r.prdctIdntNoNm || r.prdctClsfcNoNm || r.prdctNm || null;
  if (!name) return null;
  // 조달청 가격 필드는 스키마 변동이 잦아 여러 후보 중 존재하는 값 사용
  const priceCandidates = [r.sbmsnOpeningAmt, r.mnfctPrdctUprc, r.prdctPrce, r.unitPrc, r.spplyPrce];
  const priceVal = priceCandidates.find((v) => v != null && !Number.isNaN(Number(v)));
  const price = priceVal != null ? Number(priceVal) : null;
  if (!price) return null;

  return {
    name: String(name).slice(0, 120),
    spec: r.dtilPrdctClsfcNoNm || r.detailPrdctClsfcNoNm || r.prdctIdntNoInfo || '',
    category: guessCategoryFromName(name),
    unit: normalizeUnit(r.prdctUntNm || r.prdctUntPrvnrNm || r.unit || 'EA'),
    minPrice: Math.round(price * 0.95),
    maxPrice: Math.round(price * 1.05),
    brand: '공통',
    sourceUrl:
      r.lnkdUrl || r.prdctIdntNoUrl || 'https://shopping.g2b.go.kr',
    vendor: r.corpNm || r.cntrctCorpNm || '',
    contractDate: r.cntrctBgnDt || r.cntrctEndDt || '',
  };
}

function guessCategoryFromName(name) {
  const n = (name || '').toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => n.includes(k.toLowerCase()))) return cat;
  }
  return '공통';
}

function normalizeUnit(u) {
  if (!u) return 'EA';
  const s = String(u).trim();
  if (s.includes('㎡') || s.toUpperCase() === 'M2') return '㎡';
  if (s.toUpperCase() === 'M' || s === '미터') return 'm';
  if (s.includes('매')) return '매';
  if (s.includes('박스') || s.toUpperCase() === 'BOX') return '박스';
  if (s.includes('식')) return '식';
  if (s.includes('인/일')) return '인/일';
  return 'EA';
}

function toNormalized(demo) {
  return {
    name: demo.name,
    spec: demo.spec,
    category: demo.category,
    unit: demo.unit,
    minPrice: demo.minPrice,
    maxPrice: demo.maxPrice,
    brand: demo.brand,
    sourceUrl: demo.sourceUrl,
    vendor: demo.vendor,
    contractDate: demo.contractDate,
  };
}

// ─────────────────────────────────────────────
// Public entry points
// ─────────────────────────────────────────────

/**
 * 키워드/카테고리 기반으로 공공 API 에서 시세 후보를 가져옴.
 * 여러 개의 키워드를 순차 호출해 결과를 합친다.
 *
 * @param {object} opts
 * @param {string} [opts.keyword]  - 자유 키워드 (빈 값이면 category 기반)
 * @param {string} [opts.category] - 카테고리(한국어) — CATEGORY_KEYWORDS 키와 매핑
 * @param {number} [opts.numOfRows]
 */
async function searchPublicPrices({ keyword, category, numOfRows = 20 } = {}) {
  const keywords = [];
  if (keyword) keywords.push(keyword);
  if (!keyword && category && CATEGORY_KEYWORDS[category]) {
    keywords.push(...CATEGORY_KEYWORDS[category]);
  }
  if (keywords.length === 0) keywords.push(''); // 전체

  const out = [];
  let source = 'demo';
  let errors = [];
  for (const k of keywords) {
    const r = await fetchG2BShoppingMall({ keyword: k, numOfRows });
    if (r.source === 'g2b') source = 'g2b';
    if (r.error) errors.push(`${k}: ${r.error}`);
    out.push(...r.items);
  }

  // 중복 제거 (name + unit + minPrice 기준)
  const seen = new Set();
  const deduped = [];
  for (const it of out) {
    const sig = `${it.name}|${it.unit}|${it.minPrice}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    deduped.push(it);
  }

  return { items: deduped, source, errors };
}

module.exports = {
  searchPublicPrices,
  // exported for test
  _internal: { mapG2BRecord, guessCategoryFromName, normalizeUnit, DEMO_RECORDS },
};
