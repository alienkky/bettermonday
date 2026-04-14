const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

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

router.get('/', authenticate, async (req, res) => {
  try {
    const { brand } = req.query;
    const itemWhere = { isActive: true };
    if (brand) {
      itemWhere.OR = [{ brand }, { brand: '공통' }];
    }
    const categories = await prisma.category.findMany({
      include: {
        items: {
          where: itemWhere,
          orderBy: { name: 'asc' },
        },
      },
    });
    const result = categories.map((c) => ({
      ...c,
      label: CATEGORY_LABELS[c.name] || c.name,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '카테고리 조회 실패' });
  }
});

module.exports = router;
