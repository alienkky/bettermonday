const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { validate } = require('../middleware/validate');
const { loginLimiter, registerLimiter, resetLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');
const {
  signCustomerToken,
  signAdminToken,
  signMasterToken,
  verifyCustomerToken,
  generateSecureToken,
} = require('../utils/token');
const { sendPasswordReset, sendEmailVerification } = require('../utils/email');

const router = express.Router();
const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;
const LOCK_THRESHOLD = 5;
const LOCK_MINUTES = 30;

// ════════════════════════════════════════════
// CUSTOMER AUTH
// ════════════════════════════════════════════

// POST /api/auth/customer/register
router.post(
  '/customer/register',
  registerLimiter,
  validate([
    body('name').trim().notEmpty().withMessage('이름을 입력하세요.').isLength({ max: 50 }),
    body('email').isEmail().withMessage('올바른 이메일 형식이 아닙니다.').normalizeEmail(),
    body('password')
      .isLength({ min: 8 }).withMessage('비밀번호는 8자 이상이어야 합니다.')
      .matches(/[a-zA-Z]/).withMessage('비밀번호에 영문자가 포함되어야 합니다.')
      .matches(/[0-9]/).withMessage('비밀번호에 숫자가 포함되어야 합니다.')
      .matches(/[^a-zA-Z0-9]/).withMessage('비밀번호에 특수문자가 포함되어야 합니다.'),
    body('phone').optional().matches(/^010-\d{4}-\d{4}$/).withMessage('연락처 형식이 올바르지 않습니다. (010-XXXX-XXXX)'),
    body('consentTerms').equals('true').withMessage('서비스 이용약관에 동의해야 합니다.'),
    body('consentPrivacy').equals('true').withMessage('개인정보 수집에 동의해야 합니다.'),
  ]),
  async (req, res) => {
    try {
      const { name, email, password, phone, region, consentTerms, consentPrivacy, consentMarketing } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const verifyToken = generateSecureToken();
      const now = new Date();

      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          phone,
          region,
          role: 'customer',
          consentTerms: consentTerms === 'true' || consentTerms === true,
          consentPrivacy: consentPrivacy === 'true' || consentPrivacy === true,
          consentMarketing: consentMarketing === 'true' || consentMarketing === true,
          consentAt: now,
          consentIp: req.ip,
          emailVerifyToken: verifyToken,
          emailVerifyExpires: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        },
        select: { id: true, name: true, email: true, role: true },
      });

      // Log consents
      const consentTypes = [
        { type: 'terms', agreed: consentTerms },
        { type: 'privacy', agreed: consentPrivacy },
        { type: 'marketing', agreed: consentMarketing },
      ].filter((c) => c.agreed === 'true' || c.agreed === true);

      if (consentTypes.length > 0) {
        await prisma.consentLog.createMany({
          data: consentTypes.map((c) => ({
            userId: user.id,
            action: 'agree',
            consentType: c.type,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          })),
        });
      }

      // Send verification email (non-blocking)
      const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${verifyToken}`;
      sendEmailVerification(email, name, verifyUrl).catch((e) => console.error('Email error:', e));

      const token = signCustomerToken(user.id);
      res.status(201).json({ token, user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.' });
    }
  }
);

// POST /api/auth/customer/login
router.post(
  '/customer/login',
  loginLimiter,
  validate([
    body('email').isEmail().withMessage('올바른 이메일 형식이 아닙니다.').normalizeEmail(),
    body('password').notEmpty().withMessage('비밀번호를 입력하세요.'),
  ]),
  async (req, res) => {
    try {
      const { email, password, rememberMe } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.role !== 'customer') {
        return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      }

      if (!user.isActive) return res.status(403).json({ error: '비활성화된 계정입니다.' });

      // Account lock check
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const mins = Math.ceil((user.lockedUntil - new Date()) / 60000);
        return res.status(429).json({ error: `계정이 잠겼습니다. ${mins}분 후 다시 시도하세요.` });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        const attempts = user.loginAttempts + 1;
        const update = { loginAttempts: attempts };
        if (attempts >= LOCK_THRESHOLD) {
          update.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
          update.loginAttempts = 0;
        }
        await prisma.user.update({ where: { id: user.id }, data: update });
        return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      }

      // Reset lock, update login info
      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), loginCount: { increment: 1 } },
      });

      const token = signCustomerToken(user.id, rememberMe === true || rememberMe === 'true');
      res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
    }
  }
);

// POST /api/auth/customer/logout
router.post('/customer/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: '로그아웃되었습니다.' });
});

// POST /api/auth/customer/forgot-password
router.post(
  '/customer/forgot-password',
  resetLimiter,
  validate([body('email').isEmail().withMessage('올바른 이메일을 입력하세요.').normalizeEmail()]),
  async (req, res) => {
    try {
      const { email } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });

      // Always return success (prevent email enumeration)
      if (!user || user.role !== 'customer') {
        return res.json({ message: '이메일이 등록되어 있으면 재설정 링크를 발송합니다.' });
      }

      const token = generateSecureToken();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: token,
          passwordResetExpires: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
      await sendPasswordReset(email, user.name, resetUrl).catch((e) => console.error('Email error:', e));

      res.json({ message: '이메일이 등록되어 있으면 재설정 링크를 발송합니다.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '처리 중 오류가 발생했습니다.' });
    }
  }
);

// POST /api/auth/customer/reset-password
router.post(
  '/customer/reset-password',
  validate([
    body('token').notEmpty().withMessage('토큰이 필요합니다.'),
    body('password')
      .isLength({ min: 8 }).withMessage('비밀번호는 8자 이상이어야 합니다.')
      .matches(/[a-zA-Z]/).withMessage('영문자를 포함해야 합니다.')
      .matches(/[0-9]/).withMessage('숫자를 포함해야 합니다.')
      .matches(/[^a-zA-Z0-9]/).withMessage('특수문자를 포함해야 합니다.'),
  ]),
  async (req, res) => {
    try {
      const { token, password } = req.body;

      const user = await prisma.user.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetExpires: { gt: new Date() },
        },
      });
      if (!user) return res.status(400).json({ error: '유효하지 않거나 만료된 토큰입니다.' });

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordResetToken: null, passwordResetExpires: null, loginAttempts: 0, lockedUntil: null },
      });

      res.json({ message: '비밀번호가 재설정되었습니다.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '처리 중 오류가 발생했습니다.' });
    }
  }
);

// GET /api/auth/verify-email?token=xxx
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    const user = await prisma.user.findFirst({
      where: { emailVerifyToken: token, emailVerifyExpires: { gt: new Date() } },
    });
    if (!user) return res.status(400).json({ error: '유효하지 않거나 만료된 인증 링크입니다.' });

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyToken: null, emailVerifyExpires: null },
    });
    res.json({ message: '이메일이 인증되었습니다.' });
  } catch {
    res.status(500).json({ error: '처리 중 오류가 발생했습니다.' });
  }
});

// ════════════════════════════════════════════
// ADMIN AUTH
// ════════════════════════════════════════════

// POST /api/auth/admin/register — company self-registration (pending approval)
router.post(
  '/admin/register',
  registerLimiter,
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
      const { name, email, password, phone, region } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          phone,
          region,
          role: 'admin',
          isActive: false, // 승인 대기 상태
          consentTerms: true,
          consentPrivacy: true,
        },
        select: { id: true, name: true, email: true },
      });

      res.status(201).json({ message: '가입 신청이 완료되었습니다. 시스템 관리자의 승인 후 이용 가능합니다.', user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '가입 중 오류가 발생했습니다.' });
    }
  }
);

const ADMIN_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 8 * 60 * 60 * 1000, // 8h
  domain: process.env.COOKIE_DOMAIN || undefined,
};

// POST /api/auth/admin/login
router.post(
  '/admin/login',
  loginLimiter,
  validate([
    body('email').isEmail().withMessage('올바른 이메일을 입력하세요.').normalizeEmail(),
    body('password').notEmpty().withMessage('비밀번호를 입력하세요.'),
  ]),
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.role !== 'admin') {
        return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      }
      if (!user.isActive) {
        return res.status(403).json({ error: '승인 대기 중인 계정입니다. 시스템 관리자에게 문의하세요.' });
      }

      // Lock check
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const mins = Math.ceil((user.lockedUntil - new Date()) / 60000);
        return res.status(429).json({ error: `계정이 잠겼습니다. ${mins}분 후 다시 시도하세요.` });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        const attempts = user.loginAttempts + 1;
        const update = { loginAttempts: attempts };
        if (attempts >= LOCK_THRESHOLD) {
          update.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
          update.loginAttempts = 0;
        }
        await prisma.user.update({ where: { id: user.id }, data: update });
        return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), loginCount: { increment: 1 } },
      });

      const token = signAdminToken(user.id);

      // Set httpOnly cookie + also return in body for SPA usage
      res.cookie('admin_token', token, ADMIN_COOKIE_OPTS);
      res.json({
        token,
        user: {
          id: user.id, name: user.name, email: user.email, role: user.role,
          forcePasswordChange: user.forcePasswordChange,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
    }
  }
);

// POST /api/auth/admin/logout
router.post('/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ message: '로그아웃되었습니다.' });
});

// ════════════════════════════════════════════
// MASTER AUTH
// ════════════════════════════════════════════

const MASTER_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 12 * 60 * 60 * 1000, // 12h
  domain: process.env.COOKIE_DOMAIN || undefined,
};

// POST /api/auth/master/login
router.post(
  '/master/login',
  loginLimiter,
  validate([
    body('email').isEmail().withMessage('올바른 이메일을 입력하세요.').normalizeEmail(),
    body('password').notEmpty().withMessage('비밀번호를 입력하세요.'),
  ]),
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.role !== 'master' || !user.isActive) {
        return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      }

      // Lock check
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const mins = Math.ceil((user.lockedUntil - new Date()) / 60000);
        return res.status(429).json({ error: `계정이 잠겼습니다. ${mins}분 후 다시 시도하세요.` });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        const attempts = user.loginAttempts + 1;
        const update = { loginAttempts: attempts };
        if (attempts >= LOCK_THRESHOLD) {
          update.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
          update.loginAttempts = 0;
        }
        await prisma.user.update({ where: { id: user.id }, data: update });
        return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), loginCount: { increment: 1 } },
      });

      const token = signMasterToken(user.id);

      res.cookie('master_token', token, MASTER_COOKIE_OPTS);
      res.json({
        token,
        user: {
          id: user.id, name: user.name, email: user.email, role: user.role,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
    }
  }
);

// POST /api/auth/master/logout
router.post('/master/logout', (req, res) => {
  res.clearCookie('master_token');
  res.json({ message: '로그아웃되었습니다.' });
});

// ════════════════════════════════════════════
// SHARED
// ════════════════════════════════════════════

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const u = req.user;
  res.json({
    id: u.id, name: u.name, email: u.email, role: u.role,
    phone: u.phone, region: u.region,
    emailVerified: u.emailVerified,
    consentMarketing: u.consentMarketing,
    forcePasswordChange: u.forcePasswordChange,
  });
});

module.exports = router;
