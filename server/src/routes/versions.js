const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin, requireMaster } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/versions/current — public
router.get('/current', async (req, res) => {
  try {
    const version = await prisma.systemVersion.findFirst({ where: { isCurrent: true } });
    res.json(version);
  } catch (err) {
    res.status(500).json({ error: '버전 조회 실패' });
  }
});

// GET /api/versions/public — public list of recent versions (for landing page)
router.get('/public', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const versions = await prisma.systemVersion.findMany({
      orderBy: { releasedAt: 'desc' },
      take: limit,
      select: {
        version: true,
        changelog: true,
        releasedAt: true,
        isCurrent: true,
      },
    });
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: '버전 조회 실패' });
  }
});

// GET /api/versions — all versions (admin)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const versions = await prisma.systemVersion.findMany({
      orderBy: { releasedAt: 'desc' },
    });
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: '버전 목록 조회 실패' });
  }
});

// POST /api/versions/release — master only: release new version
router.post('/release', requireMaster, async (req, res) => {
  try {
    const { type, changelog } = req.body; // type: 'minor' | 'major'
    const current = await prisma.systemVersion.findFirst({ where: { isCurrent: true } });
    if (!current) return res.status(500).json({ error: '현재 버전을 찾을 수 없습니다.' });

    const parts = current.version.split('.').map(Number);
    if (type === 'major') {
      parts[0] += 1; parts[1] = 0; parts[2] = 0;
    } else {
      parts[1] += 1; parts[2] = 0;
    }
    const newVersionStr = parts.join('.');

    await prisma.$transaction([
      prisma.systemVersion.updateMany({ data: { isCurrent: false } }),
      prisma.systemVersion.create({
        data: { version: newVersionStr, changelog, isCurrent: true },
      }),
    ]);

    const newVersion = await prisma.systemVersion.findFirst({ where: { version: newVersionStr } });
    res.status(201).json(newVersion);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '버전 릴리즈 실패' });
  }
});

module.exports = router;
