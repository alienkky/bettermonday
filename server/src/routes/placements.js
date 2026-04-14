const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/placements?spaceId=xxx
router.get('/', authenticate, async (req, res) => {
  try {
    const { spaceId } = req.query;
    if (!spaceId) return res.status(400).json({ error: 'spaceId required' });

    const space = await prisma.space.findFirst({
      where: { id: spaceId, customerId: req.user.id },
    });
    if (!space) return res.status(403).json({ error: 'Access denied' });

    const placements = await prisma.placement.findMany({
      where: { spaceId },
      include: { item: { include: { category: true } } },
    });
    res.json(placements);
  } catch (err) {
    res.status(500).json({ error: '배치 목록 조회 실패' });
  }
});

// POST /api/placements — add or update placements (bulk sync)
router.post('/sync', authenticate, async (req, res) => {
  try {
    const { spaceId, placements } = req.body;
    if (!spaceId) return res.status(400).json({ error: 'spaceId required' });

    const space = await prisma.space.findFirst({
      where: { id: spaceId, customerId: req.user.id },
    });
    if (!space) return res.status(403).json({ error: 'Access denied' });

    // Delete existing, re-create (simple sync strategy)
    await prisma.placement.deleteMany({ where: { spaceId } });

    if (placements && placements.length > 0) {
      await prisma.placement.createMany({
        data: placements.map((p) => ({
          spaceId,
          itemId: p.itemId,
          quantity: p.quantity || 1,
          x: p.x || 0,
          y: p.y || 0,
          rotation: p.rotation || 0,
          zoneId: p.zoneId ?? null,
        })),
      });
    }

    const result = await prisma.placement.findMany({
      where: { spaceId },
      include: { item: { include: { category: true } } },
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '배치 동기화 실패' });
  }
});

module.exports = router;
