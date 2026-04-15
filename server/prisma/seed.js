const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { MC_DATA, LM_DATA, WOOD_DATA, LABOR_DATA, fmtDate } = require('../src/data/marketPrices');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // System version
  await prisma.systemVersion.upsert({
    where: { version: '1.0.0' },
    update: {},
    create: {
      version: '1.0.0',
      changelog: 'Initial release with base pricing',
      isCurrent: true,
    },
  });

  // Master user (최고 관리자) — always ensure correct password and active state
  const masterHash = await bcrypt.hash('master1234!', 12);
  await prisma.user.upsert({
    where: { email: 'master@bettermonday.kr' },
    update: {
      passwordHash: masterHash,
      role: 'master',
      isActive: true,
      loginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      role: 'master',
      name: '마스터',
      email: 'master@bettermonday.kr',
      passwordHash: masterHash,
      isActive: true,
    },
  });
  console.log('   Master account password ensured');

  // Admin user (인테리어 업체)
  const adminHash = await bcrypt.hash('admin1234', 10);
  await prisma.user.upsert({
    where: { email: 'admin@franchisesim.com' },
    update: {},
    create: {
      role: 'admin',
      name: '관리자',
      email: 'admin@franchisesim.com',
      passwordHash: adminHash,
    },
  });

  // Demo customer
  const customerHash = await bcrypt.hash('customer1234', 10);
  await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      role: 'customer',
      name: '홍길동',
      email: 'demo@example.com',
      passwordHash: customerHash,
      phone: '010-1234-5678',
    },
  });

  // Categories — must match CategoryName enum in schema.prisma
  const categoryNames = [
    'painting', 'film', 'tile', 'fabric', 'lighting',
    'hardware', 'stone', 'metalwork', 'plumbing', 'woodwork', 'labor',
  ];

  const categories = {};
  for (const name of categoryNames) {
    try {
      const cat = await prisma.category.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      categories[name] = cat.id;
    } catch (e) {
      console.warn(`   Skip category ${name}: ${e.message}`);
    }
  }

  // Items seed data
  const items = [
    // Flooring
    { categoryId: categories.flooring, name: '타일 (600×600)', unit: 'm2', unitPrice: 35000, description: '포세린 타일 시공 (자재+시공 포함)', isRequired: true, width: null, height: null },
    { categoryId: categories.flooring, name: '원목 마루', unit: 'm2', unitPrice: 65000, description: '원목 강마루 시공', isRequired: false, width: null, height: null },
    { categoryId: categories.flooring, name: 'LVT 바닥재', unit: 'm2', unitPrice: 28000, description: 'LVT 시트 바닥재', isRequired: false, width: null, height: null },
    { categoryId: categories.flooring, name: '에폭시 코팅', unit: 'm2', unitPrice: 22000, description: '에폭시 바닥 코팅', isRequired: false, width: null, height: null },

    // Ceiling
    { categoryId: categories.ceiling, name: '텍스 천장 (T-bar)', unit: 'm2', unitPrice: 28000, description: 'T-bar 텍스 천장 마감', isRequired: true, width: null, height: null },
    { categoryId: categories.ceiling, name: '석고보드 천장', unit: 'm2', unitPrice: 35000, description: '석고보드 + 페인트', isRequired: false, width: null, height: null },
    { categoryId: categories.ceiling, name: '노출 천장 도장', unit: 'm2', unitPrice: 18000, description: '천장 노출 + 흑색 도장', isRequired: false, width: null, height: null },

    // Wall
    { categoryId: categories.wall, name: '인테리어 필름 (단색)', unit: 'm2', unitPrice: 15000, description: '단색 인테리어 필름 시공', isRequired: false, width: null, height: null },
    { categoryId: categories.wall, name: '실크 페인트', unit: 'm2', unitPrice: 8000, description: '실크 도장 2회', isRequired: true, width: null, height: null },
    { categoryId: categories.wall, name: '타일 벽 마감', unit: 'm2', unitPrice: 45000, description: '벽타일 (주방/화장실)', isRequired: false, width: null, height: null },
    { categoryId: categories.wall, name: '목재 패널 벽', unit: 'm2', unitPrice: 55000, description: '루버/목재 패널 포인트 벽', isRequired: false, width: null, height: null },

    // Electrical
    { categoryId: categories.electrical, name: '기본 전기 공사', unit: 'set', unitPrice: 800000, description: '분전반 + 콘센트 + 스위치 기본 공사', isRequired: true, width: null, height: null },
    { categoryId: categories.electrical, name: 'LED 매입등', unit: 'ea', unitPrice: 25000, description: 'LED 다운라이트 (6W)', isRequired: false, width: null, height: null },
    { categoryId: categories.electrical, name: '레일 조명', unit: 'ea', unitPrice: 45000, description: '레일 조명 세트 (1m)', isRequired: false, width: null, height: null },
    { categoryId: categories.electrical, name: '간접 조명', unit: 'm', unitPrice: 35000, description: 'LED 간접 조명 (선)', isRequired: false, width: null, height: null },

    // Plumbing
    { categoryId: categories.plumbing, name: '기본 배관 공사', unit: 'set', unitPrice: 600000, description: '급배수 기본 배관 공사', isRequired: false, width: null, height: null },
    { categoryId: categories.plumbing, name: '싱크대 배관', unit: 'ea', unitPrice: 150000, description: '싱크대 급배수 배관', isRequired: false, width: null, height: null },

    // Signage
    { categoryId: categories.signage, name: '외부 채널사인', unit: 'set', unitPrice: 1200000, description: '외부 채널 간판 제작+시공', isRequired: true, width: null, height: null },
    { categoryId: categories.signage, name: '실내 로고 사인', unit: 'ea', unitPrice: 350000, description: '실내 아크릴 로고 사인', isRequired: false, width: null, height: null },
    { categoryId: categories.signage, name: '메뉴보드 (디지털)', unit: 'ea', unitPrice: 850000, description: 'TV 메뉴보드 55인치', isRequired: false, width: null, height: null },

    // Equipment
    { categoryId: categories.equipment, name: '에스프레소 머신', unit: 'ea', unitPrice: 3500000, description: '2그룹 에스프레소 머신', isRequired: false, width: 0.6, height: 0.5 },
    { categoryId: categories.equipment, name: '냉장 쇼케이스', unit: 'ea', unitPrice: 1800000, description: '냉장 디스플레이 쇼케이스 (1.2m)', isRequired: false, width: 1.2, height: 0.6 },
    { categoryId: categories.equipment, name: '제빙기', unit: 'ea', unitPrice: 950000, description: '업소용 제빙기 (50kg)', isRequired: false, width: 0.5, height: 0.5 },
    { categoryId: categories.equipment, name: '냉장고 (업소용)', unit: 'ea', unitPrice: 1200000, description: '2도어 업소용 냉장고', isRequired: false, width: 1.4, height: 0.7 },
    { categoryId: categories.equipment, name: 'POS 시스템', unit: 'set', unitPrice: 750000, description: 'POS + 프린터 + 카드단말기', isRequired: false, width: 0.4, height: 0.4 },
    { categoryId: categories.equipment, name: '블렌더', unit: 'ea', unitPrice: 280000, description: '업소용 블렌더', isRequired: false, width: 0.2, height: 0.2 },

    // Furniture
    { categoryId: categories.furniture, name: '2인 테이블 세트', unit: 'ea', unitPrice: 180000, description: '2인용 테이블 + 의자 2개', isRequired: false, width: 0.7, height: 0.7 },
    { categoryId: categories.furniture, name: '4인 테이블 세트', unit: 'ea', unitPrice: 320000, description: '4인용 테이블 + 의자 4개', isRequired: false, width: 1.0, height: 0.8 },
    { categoryId: categories.furniture, name: '바 테이블 세트', unit: 'ea', unitPrice: 95000, description: '바 스툴 의자', isRequired: false, width: 0.4, height: 0.4 },
    { categoryId: categories.furniture, name: '카운터 (주문대)', unit: 'ea', unitPrice: 2200000, description: '주문 카운터 (제작) 1.8m', isRequired: false, width: 1.8, height: 0.8 },
    { categoryId: categories.furniture, name: '소파 (2인)', unit: 'ea', unitPrice: 450000, description: '패브릭 2인 소파', isRequired: false, width: 1.5, height: 0.8 },
    { categoryId: categories.furniture, name: '선반/디스플레이', unit: 'ea', unitPrice: 120000, description: '벽걸이 선반 세트', isRequired: false, width: 0.8, height: 0.3 },

    // Labor
    { categoryId: categories.labor, name: '기본 인건비 (면적)', unit: 'm2', unitPrice: 50000, description: '인테리어 기본 인건비 (면적 기준)', isRequired: true, width: null, height: null },
    { categoryId: categories.labor, name: '설치 관리비', unit: 'set', unitPrice: 500000, description: '현장 감리 및 관리비', isRequired: true, width: null, height: null },
  ];

  // NOTE: 기본 아이템 시드는 비활성화됨 — 현재 스키마(CategoryName enum)와 호환되지 않음.
  // 대신 마스터가 '자재 시세 관리 → 강제 일괄반영' 버튼으로 시세 데이터에서 아이템을 자동 등록합니다.
  const existingItemCount = await prisma.item.count();
  console.log(`   Items seed skipped (${existingItemCount} existing items). Use 시세→강제 일괄반영 to populate from market prices.`);

  // Market prices (시세 데이터)
  const existingMarketCount = await prisma.marketPrice.count();
  if (existingMarketCount === 0) {
    const priceDate = fmtDate();
    const marketRows = [];
    MC_DATA.forEach(d => marketRows.push({ ...d, brand: '먼데이커피', avgPrice: Math.round((d.minPrice + d.maxPrice) / 2), priceDate }));
    LM_DATA.forEach(d => marketRows.push({ ...d, brand: '스토리오브라망', avgPrice: Math.round((d.minPrice + d.maxPrice) / 2), priceDate }));
    WOOD_DATA.forEach(d => marketRows.push({ ...d, brand: '공통', avgPrice: Math.round((d.minPrice + d.maxPrice) / 2), priceDate }));
    LABOR_DATA.forEach(d => marketRows.push({ ...d, brand: '공통', avgPrice: Math.round((d.minPrice + d.maxPrice) / 2), priceDate }));
    await prisma.marketPrice.createMany({ data: marketRows });
    console.log(`   Created ${marketRows.length} market prices`);
  } else {
    console.log(`   Skipped market prices (${existingMarketCount} already exist)`);
  }

  console.log('✅ Seed completed!');
  console.log('   Master: master@bettermonday.kr / master1234!');
  console.log('   Admin:  admin@franchisesim.com / admin1234');
  console.log('   Customer: demo@example.com / customer1234');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
