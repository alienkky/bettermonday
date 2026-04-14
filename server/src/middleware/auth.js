const { PrismaClient } = require('@prisma/client');
const { verifyCustomerToken, verifyAdminToken, verifyMasterToken } = require('../utils/token');

const prisma = new PrismaClient();

// ── Customer auth (Bearer token or cookie) ──────────────────────────
const requireCustomer = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

  try {
    const decoded = verifyCustomerToken(token);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) return res.status(401).json({ error: '유효하지 않은 계정입니다.' });
    if (user.role !== 'customer') return res.status(403).json({ error: '고객 계정으로 접근하세요.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: '토큰이 만료되었거나 유효하지 않습니다.' });
  }
};

// ── Admin auth (httpOnly cookie preferred, Bearer fallback) ─────────
// Also allows master role (master can do everything admin can)
const requireAdmin = async (req, res, next) => {
  const token = req.cookies?.admin_token || req.cookies?.master_token || extractToken(req);
  if (!token) return res.status(401).json({ error: '관리자 로그인이 필요합니다.' });

  try {
    let decoded;
    try { decoded = verifyMasterToken(token); }
    catch {
      try { decoded = verifyAdminToken(token); }
      catch { throw new Error('invalid'); }
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) return res.status(401).json({ error: '유효하지 않은 계정입니다.' });
    if (user.role !== 'admin' && user.role !== 'master') return res.status(403).json({ error: '관리자 권한이 없습니다.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: '관리자 토큰이 만료되었거나 유효하지 않습니다.' });
  }
};

// ── Master auth (only master role) ──────────────────────────────────
const requireMaster = async (req, res, next) => {
  const token = req.cookies?.master_token || extractToken(req);
  if (!token) return res.status(401).json({ error: '마스터 로그인이 필요합니다.' });

  try {
    const decoded = verifyMasterToken(token);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) return res.status(401).json({ error: '유효하지 않은 계정입니다.' });
    if (user.role !== 'master') return res.status(403).json({ error: '마스터 권한이 없습니다.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: '마스터 토큰이 만료되었거나 유효하지 않습니다.' });
  }
};

// ── Generic auth (any role) ──────────────────────────────────────────
const authenticate = async (req, res, next) => {
  const token = req.cookies?.master_token || req.cookies?.admin_token || extractToken(req);
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

  try {
    let decoded;
    try { decoded = verifyMasterToken(token); }
    catch {
      try { decoded = verifyAdminToken(token); }
      catch { decoded = verifyCustomerToken(token); }
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) return res.status(401).json({ error: '유효하지 않은 계정입니다.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: '토큰이 만료되었거나 유효하지 않습니다.' });
  }
};

// ── Consent guard ────────────────────────────────────────────────────
const requireConsent = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  if (req.user.role === 'admin' || req.user.role === 'master') return next();
  if (!req.user.consentTerms || !req.user.consentPrivacy) {
    return res.status(403).json({ error: '필수 약관에 동의해야 합니다.' });
  }
  next();
};

// ── Optional auth ────────────────────────────────────────────────────
const optionalAuth = async (req, res, next) => {
  const token = req.cookies?.master_token || req.cookies?.admin_token || extractToken(req);
  if (!token) { req.user = null; return next(); }
  try {
    let decoded;
    try { decoded = verifyMasterToken(token); }
    catch {
      try { decoded = verifyAdminToken(token); }
      catch { decoded = verifyCustomerToken(token); }
    }
    req.user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  } catch {
    req.user = null;
  }
  next();
};

function extractToken(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.split(' ')[1];
  return null;
}

module.exports = { requireCustomer, requireAdmin, requireMaster, authenticate, requireConsent, optionalAuth };
