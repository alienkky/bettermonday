const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/spaces — create space
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, address, widthM, depthM, heightM, shape, layoutJson, areaSqm: clientArea, brand } = req.body;
    if (!name || !widthM || !depthM || !heightM)
      return res.status(400).json({ error: '공간 정보를 모두 입력하세요.' });

    const areaSqm = clientArea || parseFloat(widthM) * parseFloat(depthM);
    const space = await prisma.space.create({
      data: {
        customerId: req.user.id,
        name,
        address,
        widthM: parseFloat(widthM),
        depthM: parseFloat(depthM),
        heightM: parseFloat(heightM),
        areaSqm,
        brand: brand || '먼데이커피',
        shape: shape || 'rectangle',
        layoutJson: layoutJson || null,
      },
    });
    res.status(201).json(space);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '공간 생성 중 오류가 발생했습니다.' });
  }
});

// GET /api/spaces — list customer's spaces
router.get('/', authenticate, async (req, res) => {
  try {
    const spaces = await prisma.space.findMany({
      where: { customerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { estimates: { select: { id: true, status: true, totalCost: true, createdAt: true } } },
    });
    res.json(spaces);
  } catch (err) {
    res.status(500).json({ error: '공간 목록 조회 실패' });
  }
});

// GET /api/spaces/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const space = await prisma.space.findFirst({
      where: { id: req.params.id, customerId: req.user.id },
      include: {
        placements: { include: { item: { include: { category: true } } } },
        estimates: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!space) return res.status(404).json({ error: '공간을 찾을 수 없습니다.' });
    res.json(space);
  } catch (err) {
    res.status(500).json({ error: '공간 조회 실패' });
  }
});

// PUT /api/spaces/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, address, widthM, depthM, heightM, shape, layoutJson, areaSqm: clientArea } = req.body;
    const space = await prisma.space.findFirst({
      where: { id: req.params.id, customerId: req.user.id },
    });
    if (!space) return res.status(404).json({ error: '공간을 찾을 수 없습니다.' });

    const areaSqm = clientArea || (widthM && depthM ? parseFloat(widthM) * parseFloat(depthM) : space.areaSqm);
    const updated = await prisma.space.update({
      where: { id: req.params.id },
      data: {
        name: name || space.name,
        address: address !== undefined ? address : space.address,
        widthM: widthM ? parseFloat(widthM) : space.widthM,
        depthM: depthM ? parseFloat(depthM) : space.depthM,
        heightM: heightM ? parseFloat(heightM) : space.heightM,
        areaSqm,
        shape: shape || space.shape,
        layoutJson: layoutJson !== undefined ? layoutJson : space.layoutJson,
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: '공간 업데이트 실패' });
  }
});

// DELETE /api/spaces/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const space = await prisma.space.findFirst({
      where: { id: req.params.id, customerId: req.user.id },
    });
    if (!space) return res.status(404).json({ error: '공간을 찾을 수 없습니다.' });
    await prisma.space.delete({ where: { id: req.params.id } });
    res.json({ message: '삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: '공간 삭제 실패' });
  }
});

module.exports = router;
