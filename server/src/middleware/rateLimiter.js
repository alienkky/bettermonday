const rateLimit = require('express-rate-limit');

// Login: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '너무 많은 로그인 시도입니다. 15분 후 다시 시도하세요.' },
  skipSuccessfulRequests: true,
});

// Register: 5 attempts per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '회원가입 요청이 너무 많습니다. 1시간 후 다시 시도하세요.' },
});

// Password reset: 3 per hour
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '비밀번호 재설정 요청이 너무 많습니다. 1시간 후 다시 시도하세요.' },
});

module.exports = { loginLimiter, registerLimiter, resetLimiter };
