const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireMaster } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const VALID_CATEGORY = new Set(['improvement', 'bug', 'question', 'other']);
const VALID_STATUS = new Set(['open', 'in_progress', 'resolved']);

// ───────────────────────────────────────────────
// POST /api/inquiries — create (customer or admin)
// ───────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'master') {
      return res.status(403).json({ error: '마스터 계정은 문의를 생성할 수 없습니다.' });
    }
    const { title, content, category } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: '제목을 입력하세요.' });
    if (!content?.trim()) return res.status(400).json({ error: '내용을 입력하세요.' });
    const cat = VALID_CATEGORY.has(category) ? category : 'improvement';

    const inquiry = await prisma.inquiry.create({
      data: {
        userId: req.user.id,
        role: req.user.role,
        category: cat,
        title: title.trim(),
        content: content.trim(),
        status: 'open',
      },
    });
    res.status(201).json(inquiry);
  } catch (err) {
    console.error('Inquiry create error:', err);
    res.status(500).json({ error: '문의 등록 실패' });
  }
});

// ───────────────────────────────────────────────
// GET /api/inquiries/mine — list own (customer/admin)
// ───────────────────────────────────────────────
router.get('/mine', authenticate, async (req, res) => {
  try {
    const inquiries = await prisma.inquiry.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(inquiries);
  } catch (err) {
    console.error('Inquiry list(mine) error:', err);
    res.status(500).json({ error: '문의 목록 조회 실패' });
  }
});

// ───────────────────────────────────────────────
// DELETE /api/inquiries/:id — delete own inquiry (only if open)
// ───────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const inquiry = await prisma.inquiry.findUnique({ where: { id: req.params.id } });
    if (!inquiry) return res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    if (inquiry.userId !== req.user.id && req.user.role !== 'master') {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    if (inquiry.status !== 'open' && req.user.role !== 'master') {
      return res.status(400).json({ error: '이미 처리 중인 문의는 삭제할 수 없습니다.' });
    }
    await prisma.inquiry.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('Inquiry delete error:', err);
    res.status(500).json({ error: '문의 삭제 실패' });
  }
});

// ───────────────────────────────────────────────
// GET /api/inquiries — list all (master only)
// ───────────────────────────────────────────────
router.get('/', requireMaster, async (req, res) => {
  try {
    const { status, category } = req.query;
    const where = {};
    if (status && VALID_STATUS.has(status)) where.status = status;
    if (category && VALID_CATEGORY.has(category)) where.category = category;

    const inquiries = await prisma.inquiry.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    res.json(inquiries);
  } catch (err) {
    console.error('Inquiry list error:', err);
    res.status(500).json({ error: '문의 목록 조회 실패' });
  }
});

// ───────────────────────────────────────────────
// PATCH /api/inquiries/:id — respond / update status (master only)
// ───────────────────────────────────────────────
router.patch('/:id', requireMaster, async (req, res) => {
  try {
    const { status, response } = req.body;
    const data = {};
    if (status && VALID_STATUS.has(status)) data.status = status;
    if (response !== undefined) {
      data.response = response;
      data.respondedAt = response ? new Date() : null;
    }
    const updated = await prisma.inquiry.update({
      where: { id: req.params.id },
      data,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    res.json(updated);
  } catch (err) {
    console.error('Inquiry update error:', err);
    res.status(500).json({ error: '문의 업데이트 실패' });
  }
});

// ───────────────────────────────────────────────
// GET /api/inquiries/stats — master-only summary
// ───────────────────────────────────────────────
router.get('/stats/summary', requireMaster, async (req, res) => {
  try {
    const [open, inProgress, resolved, total] = await Promise.all([
      prisma.inquiry.count({ where: { status: 'open' } }),
      prisma.inquiry.count({ where: { status: 'in_progress' } }),
      prisma.inquiry.count({ where: { status: 'resolved' } }),
      prisma.inquiry.count(),
    ]);
    res.json({ open, inProgress, resolved, total });
  } catch (err) {
    res.status(500).json({ error: '통계 조회 실패' });
  }
});

module.exports = router;
