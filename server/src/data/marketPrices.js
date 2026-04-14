// ─────────────────────────────────────────────
// 시세 데이터 (Market Price Seed Data)
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

module.exports = { MC_DATA, LM_DATA, WOOD_DATA, LABOR_DATA, fmtDate };
