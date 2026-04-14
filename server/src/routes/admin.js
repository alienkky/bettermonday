const express = require('express');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAdmin, requireMaster, optionalAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Multer for brand logo/favicon uploads
const brandUploadDir = path.join(__dirname, '..', '..', 'uploads', 'brand');
if (!fs.existsSync(brandUploadDir)) fs.mkdirSync(brandUploadDir, { recursive: true });
const brandStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, brandUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const prefix = file.fieldname === 'logo' ? 'logo' : 'favicon';
    cb(null, `${prefix}-${Date.now()}${ext}`);
  },
});
const brandUpload = multer({
  storage: brandStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// GET /api/admin/dashboard
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const isMaster = req.user.role === 'master';

    // Admin sees only own estimates; master sees all
    const estimateFilter = isMaster ? {} : { customerId: req.user.id };
    const monthEstimateFilter = isMaster
      ? { createdAt: { gte: startOfMonth } }
      : { customerId: req.user.id, createdAt: { gte: startOfMonth } };

    const [totalEstimates, monthEstimates, consultations, recentEstimates] = await Promise.all([
      prisma.estimate.count({ where: estimateFilter }),
      prisma.estimate.count({ where: monthEstimateFilter }),
      prisma.estimate.count({ where: { ...estimateFilter, status: 'submitted' } }),
      prisma.estimate.findMany({
        where: estimateFilter,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true, email: true } },
          space: { select: { name: true, areaSqm: true } },
        },
      }),
    ]);

    res.json({ totalEstimates, monthEstimates, consultations, recentEstimates });
  } catch (err) {
    res.status(500).json({ error: '대시보드 조회 실패' });
  }
});

// GET /api/admin/estimates — admin sees own estimates only; master sees all
router.get('/estimates', requireAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const isMaster = req.user.role === 'master';
    const where = {};
    if (status) where.status = status;
    if (!isMaster) where.customerId = req.user.id;

    const [estimates, total] = await Promise.all([
      prisma.estimate.findMany({
        where,
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true, email: true, phone: true } },
          space: { select: { name: true, areaSqm: true, widthM: true, depthM: true } },
        },
      }),
      prisma.estimate.count({ where }),
    ]);
    res.json({ estimates, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: '견적 목록 조회 실패' });
  }
});

// PATCH /api/admin/estimates/:id — update status / note (admin: own only)
router.patch('/estimates/:id', requireAdmin, async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const isMaster = req.user.role === 'master';
    const estimate = await prisma.estimate.findUnique({ where: { id: req.params.id } });
    if (!estimate) return res.status(404).json({ error: '견적을 찾을 수 없습니다.' });
    if (!isMaster && estimate.customerId !== req.user.id) {
      return res.status(403).json({ error: '해당 견적에 대한 권한이 없습니다.' });
    }
    // 승인완료는 마스터만 가능
    if (status === 'approved' && !isMaster) {
      return res.status(403).json({ error: '승인은 본사(마스터)만 가능합니다.' });
    }

    const updated = await prisma.estimate.update({
      where: { id: req.params.id },
      data: {
        status: status || estimate.status,
        adminNote: adminNote !== undefined ? adminNote : estimate.adminNote,
      },
      include: {
        customer: { select: { name: true, email: true } },
        space: { select: { name: true } },
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: '견적 업데이트 실패' });
  }
});

// GET /api/admin/customers (master only)
router.get('/customers', requireMaster, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'customer' },
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { estimates: true, spaces: true } },
        },
      }),
      prisma.user.count({ where: { role: 'customer' } }),
    ]);
    res.json({ customers, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: '고객 목록 조회 실패' });
  }
});

// PATCH /api/admin/customers/:id — update note (master only)
router.patch('/customers/:id', requireMaster, async (req, res) => {
  try {
    const { note } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { note },
      select: { id: true, name: true, email: true, note: true },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: '고객 업데이트 실패' });
  }
});

// GET /api/admin/customers/:id/estimates (master only)
router.get('/customers/:id/estimates', requireMaster, async (req, res) => {
  try {
    const estimates = await prisma.estimate.findMany({
      where: { customerId: req.params.id },
      orderBy: { createdAt: 'desc' },
      include: { space: { select: { name: true, areaSqm: true } } },
    });
    res.json(estimates);
  } catch (err) {
    res.status(500).json({ error: '고객 견적 조회 실패' });
  }
});

// GET /api/admin/customers/:id/consent-logs (master only)
router.get('/customers/:id/consent-logs', requireMaster, async (req, res) => {
  try {
    const logs = await prisma.consentLog.findMany({
      where: { userId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: '동의 이력 조회 실패' });
  }
});

// POST /api/admin/customers/:id/anonymize — GDPR (master only)
router.post('/customers/:id/anonymize', requireMaster, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.role !== 'customer') return res.status(404).json({ error: '고객을 찾을 수 없습니다.' });

    const ts = Date.now();
    await prisma.user.update({
      where: { id: req.params.id },
      data: {
        name: `탈퇴회원_${ts}`,
        email: `deleted_${ts}@anonymized.local`,
        phone: null,
        region: null,
        isActive: false,
        consentTerms: false,
        consentPrivacy: false,
        consentMarketing: false,
      },
    });

    res.json({ message: '개인정보가 익명화되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '익명화 처리 실패' });
  }
});

// GET /api/admin/customers/marketing — consent filter (master only)
router.get('/customers/marketing', requireMaster, async (req, res) => {
  try {
    const customers = await prisma.user.findMany({
      where: { role: 'customer', consentMarketing: true, isActive: true },
      select: { id: true, name: true, email: true, phone: true, consentAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: '마케팅 동의 고객 조회 실패' });
  }
});

// ─────────────────────────────────────────────
// BRAND SETTINGS
// ─────────────────────────────────────────────

// ── Helper: extract brand form data ──
function extractBrandData(req) {
  const data = {};
  const fields = [
    'brandName', 'primaryColor', 'secondaryColor', 'accentColor',
    'dangerColor', 'headerBg', 'headerTextColor', 'bodyBg',
    'fontFamily', 'borderRadius',
  ];
  for (const f of fields) {
    if (req.body[f] !== undefined && req.body[f] !== '') data[f] = req.body[f];
  }
  if (req.files?.logo?.[0]) data.logoUrl = `/uploads/brand/${req.files.logo[0].filename}`;
  if (req.files?.favicon?.[0]) data.faviconUrl = `/uploads/brand/${req.files.favicon[0].filename}`;
  if (req.body.removeLogo === 'true') data.logoUrl = null;
  if (req.body.removeFavicon === 'true') data.faviconUrl = null;
  return data;
}

// GET /api/admin/brand — returns company-specific brand for admin, default for others
router.get('/brand', optionalAuth, async (req, res) => {
  try {
    let settings = null;

    // If admin user, try company-specific brand first
    if (req.user?.role === 'admin') {
      settings = await prisma.brandSettings.findUnique({ where: { userId: req.user.id } });
    }

    // Fallback to system default
    if (!settings) {
      settings = await prisma.brandSettings.findUnique({ where: { id: 'default' } });
    }
    if (!settings) {
      settings = await prisma.brandSettings.create({ data: { id: 'default' } });
    }

    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '브랜드 설정 조회 실패' });
  }
});

// PATCH /api/admin/brand — admin edits own company brand, master edits system default
router.patch('/brand', requireAdmin, brandUpload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'favicon', maxCount: 1 },
]), async (req, res) => {
  try {
    const data = extractBrandData(req);

    let settings;
    if (req.user.role === 'admin') {
      // Sync brand name → company name
      if (data.brandName) {
        await prisma.user.update({ where: { id: req.user.id }, data: { name: data.brandName } });
      }
      // Upsert company-specific brand
      const existing = await prisma.brandSettings.findUnique({ where: { userId: req.user.id } });
      if (existing) {
        settings = await prisma.brandSettings.update({ where: { id: existing.id }, data });
      } else {
        settings = await prisma.brandSettings.create({ data: { userId: req.user.id, ...data } });
      }
    } else {
      // Master: upsert system default
      settings = await prisma.brandSettings.upsert({
        where: { id: 'default' },
        create: { id: 'default', ...data },
        update: data,
      });
    }

    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '브랜드 설정 업데이트 실패' });
  }
});

module.exports = router;
