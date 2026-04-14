const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/estimates — save estimate
router.post('/', authenticate, async (req, res) => {
  try {
    const { spaceId, itemsSnapshot, totalCost, contactName, contactPhone, status } = req.body;
    if (!spaceId || !itemsSnapshot || totalCost === undefined)
      return res.status(400).json({ error: '견적 정보를 모두 입력하세요.' });

    const space = await prisma.space.findFirst({
      where: { id: spaceId, customerId: req.user.id },
    });
    if (!space) return res.status(403).json({ error: 'Access denied' });

    const sysVersion = await prisma.systemVersion.findFirst({ where: { isCurrent: true } });
    const versionLabel = sysVersion?.version || '1.0.0';
    const totalCostVat = totalCost * 1.1;

    const estimate = await prisma.estimate.create({
      data: {
        spaceId,
        customerId: req.user.id,
        versionLabel,
        itemsSnapshot,
        totalCost: parseFloat(totalCost),
        totalCostVat,
        status: status || 'draft',
        contactName,
        contactPhone,
      },
    });
    res.status(201).json(estimate);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '견적 저장 실패' });
  }
});

// GET /api/estimates — customer's estimates
router.get('/', authenticate, async (req, res) => {
  try {
    const estimates = await prisma.estimate.findMany({
      where: { customerId: req.user.id },
      include: { space: { select: { name: true, areaSqm: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(estimates);
  } catch (err) {
    res.status(500).json({ error: '견적 목록 조회 실패' });
  }
});

// GET /api/estimates/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const where = { id: req.params.id };
    if (req.user.role !== 'admin') where.customerId = req.user.id;

    const estimate = await prisma.estimate.findFirst({
      where,
      include: {
        space: true,
        customer: { select: { name: true, email: true, phone: true } },
      },
    });
    if (!estimate) return res.status(404).json({ error: '견적을 찾을 수 없습니다.' });
    res.json(estimate);
  } catch (err) {
    res.status(500).json({ error: '견적 조회 실패' });
  }
});

// PATCH /api/estimates/:id/submit — customer submits for consultation
router.patch('/:id/submit', authenticate, async (req, res) => {
  try {
    const { contactName, contactPhone } = req.body;
    const estimate = await prisma.estimate.findFirst({
      where: { id: req.params.id, customerId: req.user.id },
    });
    if (!estimate) return res.status(404).json({ error: '견적을 찾을 수 없습니다.' });

    const updated = await prisma.estimate.update({
      where: { id: req.params.id },
      data: { status: 'submitted', contactName, contactPhone },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: '상담 신청 실패' });
  }
});

module.exports = router;
