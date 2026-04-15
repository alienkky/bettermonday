/**
 * Pre-migration script — enum → String 전환을 위한 수동 DDL
 * Prisma db push 는 enum→TEXT 캐스트를 자동 처리 못 하므로 먼저 ALTER TABLE 수행
 * 멱등적(idempotent): 이미 TEXT면 아무것도 안 함
 */
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    // 1) categories.name 컬럼 타입 확인
    const rows = await prisma.$queryRawUnsafe(`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'categories' AND column_name = 'name'
    `);

    if (!rows || rows.length === 0) {
      console.log('[pre-migrate] categories.name column not found (fresh DB?) — skip');
      return;
    }

    const { data_type, udt_name } = rows[0];
    console.log(`[pre-migrate] categories.name: data_type=${data_type}, udt_name=${udt_name}`);

    if (data_type === 'USER-DEFINED') {
      // enum 타입 → text 변환
      console.log('[pre-migrate] Converting categories.name from enum → TEXT...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE categories ALTER COLUMN name TYPE TEXT USING name::TEXT
      `);
      console.log('[pre-migrate] Column type converted.');

      // 구 enum 타입 삭제 (존재 시)
      try {
        await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "CategoryName"`);
        console.log('[pre-migrate] Dropped enum type CategoryName.');
      } catch (e) {
        console.log('[pre-migrate] (enum drop skipped:', e.message + ')');
      }

      // 기존 영문 enum 키 → 한국어 표시명으로 매핑 (기존 데이터 보존)
      const ENG_TO_KO = {
        painting: '도장', film: '필름', tile: '타일', fabric: '패브릭',
        lighting: '조명', hardware: '손잡이', stone: '인조대리석',
        metalwork: '금속유리', plumbing: '설비', woodwork: '목공자재', labor: '인건비',
      };
      for (const [eng, ko] of Object.entries(ENG_TO_KO)) {
        try {
          const res = await prisma.$executeRawUnsafe(
            `UPDATE categories SET name = $1 WHERE name = $2`,
            ko, eng
          );
          if (res > 0) console.log(`[pre-migrate] Renamed ${eng} → ${ko} (${res} row)`);
        } catch (e) {
          // 이미 동일 이름이 있어 UNIQUE 충돌 등 — 무시
          console.log(`[pre-migrate] Rename skip ${eng}→${ko}: ${e.message}`);
        }
      }
    } else {
      console.log('[pre-migrate] categories.name already TEXT — skip.');
    }
  } catch (err) {
    console.error('[pre-migrate] Error:', err.message);
    // 초기 배포(테이블 없음 등)에서는 실패해도 진행
  } finally {
    await prisma.$disconnect();
  }
}

main();
