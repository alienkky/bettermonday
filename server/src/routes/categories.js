const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireMaster } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/categories — 전체 조회 (브랜드 필터 포함 아이템)
router.get('/', authenticate, async (req, res) => {
  try {
    const { brand } = req.query;
    const itemWhere = { isActive: true };
    if (brand) {
      itemWhere.OR = [{ brand }, { brand: '공통' }];
    }
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        items: {
          where: itemWhere,
          orderBy: { name: 'asc' },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const result = categories.map((c) => ({
      ...c,
      label: c.displayName || c.name,
    }));
    res.json(result);
  } catch (err) {
    console.error('[categories.list]', err);
    res.status(500).json({ error: '카테고리 조회 실패' });
  }
});

// POST /api/categories — 생성 (master only)
router.post('/', requireMaster, async (req, res) => {
  try {
    const { name, displayName, sortOrder } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: '카테고리명은 필수입니다.' });

    const trimmed = name.trim();
    const existing = await prisma.category.findUnique({ where: { name: trimmed } });
    if (existing) {
      // 비활성 상태라면 재활성화
      if (!existing.isActive) {
        const reactivated = await prisma.category.update({
          where: { id: existing.id },
          data: { isActive: true, displayName: displayName || existing.displayName },
        });
        return res.json(reactivated);
      }
      return res.status(409).json({ error: `이미 존재하는 카테고리입니다: ${trimmed}` });
    }

    const created = await prisma.category.create({
      data: {
        name: trimmed,
        displayName: displayName?.trim() || null,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      },
    });
    res.json(created);
  } catch (err) {
    console.error('[categories.create]', err);
    res.status(500).json({ error: '카테고리 생성 실패' });
  }
});

// PATCH /api/categories/:id — 수정 (master only)
router.patch('/:id', requireMaster, async (req, res) => {
  try {
    const { name, displayName, sortOrder, isActive } = req.body;
    const data = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (displayName !== undefined) data.displayName = displayName ? String(displayName).trim() : null;
    if (Number.isFinite(sortOrder)) data.sortOrder = sortOrder;
    if (typeof isActive === 'boolean') data.isActive = isActive;

    const updated = await prisma.category.update({
      where: { id: req.params.id },
      data,
    });
    res.json(updated);
  } catch (err) {
    console.error('[categories.update]', err);
    if (err.code === 'P2002') return res.status(409).json({ error: '이미 존재하는 카테고리명입니다.' });
    if (err.code === 'P2025') return res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
    res.status(500).json({ error: '카테고리 수정 실패' });
  }
});

// DELETE /api/categories/:id — 삭제 (master only, 연결된 아이템 없을 때만)
router.delete('/:id', requireMaster, async (req, res) => {
  try {
    const { force } = req.query; // ?force=true 인 경우 soft delete (비활성화)
    const cat = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { items: true } } },
    });
    if (!cat) return res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });

    // 아이템이 있으면 강제 삭제 불가 — 비활성화만 허용
    if (cat._count.items > 0) {
      if (force === 'true') {
        const updated = await prisma.category.update({
          where: { id: cat.id },
          data: { isActive: false },
        });
        return res.json({ action: 'deactivated', message: `${cat._count.items}개 아이템이 연결되어 있어 비활성화 처리했습니다.`, category: updated });
      }
      return res.status(400).json({
        error: `이 카테고리에 ${cat._count.items}개의 아이템이 연결되어 있어 삭제할 수 없습니다.`,
        itemCount: cat._count.items,
        suggestion: '비활성화를 원하시면 force=true 파라미터를 전송하세요.',
      });
    }

    await prisma.category.delete({ where: { id: cat.id } });
    res.json({ action: 'deleted', message: '카테고리 삭제 완료', id: cat.id });
  } catch (err) {
    console.error('[categories.delete]', err);
    res.status(500).json({ error: '카테고리 삭제 실패' });
  }
});

module.exports = router;
