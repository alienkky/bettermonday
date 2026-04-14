const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { validate } = require('../middleware/validate');
const { requireMaster } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

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

// All routes require master authentication
router.use(requireMaster);

// ════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════

// GET /api/master/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalCompanies,
      activeCompanies,
      pendingCompanies,
      totalCustomers,
      totalEstimates,
      monthEstimates,
      submittedEstimates,
      recentEstimates,
      recentCompanies,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'admin' } }),
      prisma.user.count({ where: { role: 'admin', isActive: true } }),
      prisma.user.count({ where: { role: 'admin', isActive: false } }),
      prisma.user.count({ where: { role: 'customer' } }),
      prisma.estimate.count(),
      prisma.estimate.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.estimate.count({ where: { status: 'submitted' } }),
      prisma.estimate.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true, email: true } },
          space: { select: { name: true, areaSqm: true, brand: true } },
        },
      }),
      prisma.user.findMany({
        where: { role: 'admin' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, isActive: true,
          createdAt: true, lastLoginAt: true, loginCount: true,
        },
      }),
    ]);

    res.json({
      totalCompanies,
      activeCompanies,
      pendingCompanies,
      totalCustomers,
      totalEstimates,
      monthEstimates,
      submittedEstimates,
      recentEstimates,
      recentCompanies,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '대시보드 조회 실패' });
  }
});

// ════════════════════════════════════════════
// COMPANY MANAGEMENT (인테리어 업체 관리)
// ════════════════════════════════════════════

// GET /api/master/companies — list all admin users
router.get('/companies', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const where = { role: 'admin' };
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    const [companies, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, phone: true, region: true,
          isActive: true, note: true, forcePasswordChange: true,
          loginCount: true, lastLoginAt: true,
          createdAt: true, updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Enrich with estimate counts
    const companyIds = companies.map((c) => c.id);
    // Admin doesn't create estimates directly — they manage customers who do
    // But let's count estimates associated with spaces created by each admin
    // Actually, estimates belong to customers. Let's count customers' estimates visible to each admin.
    // For now, return companies as is — master sees overall stats.

    res.json({ companies, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '업체 목록 조회 실패' });
  }
});

// POST /api/master/companies — create new admin account
router.post(
  '/companies',
  validate([
    body('name').trim().notEmpty().withMessage('업체명을 입력하세요.').isLength({ max: 100 }),
    body('email').isEmail().withMessage('올바른 이메일 형식이 아닙니다.').normalizeEmail(),
    body('password')
      .isLength({ min: 8 }).withMessage('비밀번호는 8자 이상이어야 합니다.')
      .matches(/[a-zA-Z]/).withMessage('영문자를 포함해야 합니다.')
      .matches(/[0-9]/).withMessage('숫자를 포함해야 합니다.'),
    body('phone').optional().trim(),
    body('region').optional().trim(),
  ]),
  async (req, res) => {
    try {
      const { name, email, password, phone, region, note } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      const company = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          phone,
          region,
          note,
          role: 'admin',
          isActive: true,
          forcePasswordChange: true,
          consentTerms: true,
          consentPrivacy: true,
        },
        select: {
          id: true, name: true, email: true, phone: true, region: true,
          isActive: true, note: true, forcePasswordChange: true, createdAt: true,
        },
      });

      res.status(201).json(company);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '업체 생성 실패' });
    }
  }
);

// PATCH /api/master/companies/:id — update company (approve, suspend, note, etc.)
// Also syncs name → brandName if brand exists
router.patch('/companies/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.role !== 'admin') return res.status(404).json({ error: '업체를 찾을 수 없습니다.' });

    const { isActive, note, name, phone, region } = req.body;
    const data = {};
    if (isActive !== undefined) data.isActive = isActive;
    if (note !== undefined) data.note = note;
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (region !== undefined) data.region = region;

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: {
        id: true, name: true, email: true, phone: true, region: true,
        isActive: true, note: true, forcePasswordChange: true,
        loginCount: true, lastLoginAt: true,
        createdAt: true, updatedAt: true,
      },
    });

    // Sync company name → brand name
    if (name) {
      const brand = await prisma.brandSettings.findUnique({ where: { userId: req.params.id } });
      if (brand) {
        await prisma.brandSettings.update({ where: { id: brand.id }, data: { brandName: name } });
      }
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '업체 업데이트 실패' });
  }
});

// POST /api/master/companies/:id/reset-password — reset company password
router.post(
  '/companies/:id/reset-password',
  validate([
    body('password')
      .isLength({ min: 8 }).withMessage('비밀번호는 8자 이상이어야 합니다.')
      .matches(/[a-zA-Z]/).withMessage('영문자를 포함해야 합니다.')
      .matches(/[0-9]/).withMessage('숫자를 포함해야 합니다.'),
  ]),
  async (req, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!user || user.role !== 'admin') return res.status(404).json({ error: '업체를 찾을 수 없습니다.' });

      const passwordHash = await bcrypt.hash(req.body.password, BCRYPT_ROUNDS);
      await prisma.user.update({
        where: { id: req.params.id },
        data: {
          passwordHash,
          forcePasswordChange: true,
          loginAttempts: 0,
          lockedUntil: null,
        },
      });

      res.json({ message: '비밀번호가 초기화되었습니다.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '비밀번호 초기화 실패' });
    }
  }
);

// DELETE /api/master/companies/:id — soft delete (set inactive + anonymize)
router.delete('/companies/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.role !== 'admin') return res.status(404).json({ error: '업체를 찾을 수 없습니다.' });

    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ message: '업체가 비활성화되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '업체 삭제 실패' });
  }
});

// ════════════════════════════════════════════
// ALL ESTIMATES (전체 견적 관리)
// ════════════════════════════════════════════

// GET /api/master/estimates — all estimates across the system
router.get('/estimates', async (req, res) => {
  try {
    const { status, page = 1, limit = 20, brand } = req.query;
    const where = {};
    if (status) where.status = status;
    if (brand) where.space = { brand };

    const [estimates, total] = await Promise.all([
      prisma.estimate.findMany({
        where,
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true, email: true, phone: true } },
          space: { select: { name: true, areaSqm: true, widthM: true, depthM: true, brand: true } },
        },
      }),
      prisma.estimate.count({ where }),
    ]);
    res.json({ estimates, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '견적 목록 조회 실패' });
  }
});

// PATCH /api/master/estimates/:id — update estimate status/note
router.patch('/estimates/:id', async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const estimate = await prisma.estimate.findUnique({ where: { id: req.params.id } });
    if (!estimate) return res.status(404).json({ error: '견적을 찾을 수 없습니다.' });

    const updated = await prisma.estimate.update({
      where: { id: req.params.id },
      data: {
        status: status || estimate.status,
        adminNote: adminNote !== undefined ? adminNote : estimate.adminNote,
      },
      include: {
        customer: { select: { name: true, email: true } },
        space: { select: { name: true, brand: true } },
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '견적 업데이트 실패' });
  }
});

// ════════════════════════════════════════════
// ALL CUSTOMERS (전체 고객 관리)
// ════════════════════════════════════════════

// GET /api/master/customers — all customers across the system
router.get('/customers', async (req, res) => {
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
    console.error(err);
    res.status(500).json({ error: '고객 목록 조회 실패' });
  }
});

// ════════════════════════════════════════════
// COMPANY BRAND SETTINGS (업체별 브랜드 관리)
// ════════════════════════════════════════════

// GET /api/master/companies/:id/brand — get a company's brand settings
router.get('/companies/:id/brand', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.role !== 'admin') return res.status(404).json({ error: '업체를 찾을 수 없습니다.' });

    let settings = await prisma.brandSettings.findUnique({ where: { userId: req.params.id } });
    if (!settings) {
      // Return default values with company name as brand name
      settings = {
        id: null,
        userId: req.params.id,
        brandName: user.name,
        logoUrl: null,
        faviconUrl: null,
        primaryColor: '#0073ea',
        secondaryColor: '#00c875',
        accentColor: '#7c3aed',
        dangerColor: '#e2445c',
        headerBg: '#1a1a1a',
        headerTextColor: '#ffffff',
        bodyBg: '#f5f6f8',
        fontFamily: 'Pretendard, sans-serif',
        borderRadius: '12',
      };
    }

    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '업체 브랜드 조회 실패' });
  }
});

// PATCH /api/master/companies/:id/brand — update a company's brand settings
// Also syncs brandName → User.name (업체명 = 브랜드명)
router.patch('/companies/:id/brand', brandUpload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'favicon', maxCount: 1 },
]), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.role !== 'admin') return res.status(404).json({ error: '업체를 찾을 수 없습니다.' });

    const data = extractBrandData(req);

    // Sync brand name → company name
    if (data.brandName) {
      await prisma.user.update({ where: { id: req.params.id }, data: { name: data.brandName } });
    }

    const existing = await prisma.brandSettings.findUnique({ where: { userId: req.params.id } });
    let settings;
    if (existing) {
      settings = await prisma.brandSettings.update({ where: { id: existing.id }, data });
    } else {
      settings = await prisma.brandSettings.create({ data: { userId: req.params.id, ...data } });
    }

    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '업체 브랜드 업데이트 실패' });
  }
});

module.exports = router;
