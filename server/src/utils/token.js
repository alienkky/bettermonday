const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const CUSTOMER_SECRET = process.env.JWT_SECRET;
const ADMIN_SECRET = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET;
const MASTER_SECRET = process.env.JWT_MASTER_SECRET || process.env.JWT_SECRET;

function signCustomerToken(userId, rememberMe = false) {
  return jwt.sign(
    { userId, role: 'customer' },
    CUSTOMER_SECRET,
    { expiresIn: rememberMe ? '30d' : '1d' }
  );
}

function signAdminToken(userId) {
  return jwt.sign(
    { userId, role: 'admin' },
    ADMIN_SECRET,
    { expiresIn: '8h' }
  );
}

function signMasterToken(userId) {
  return jwt.sign(
    { userId, role: 'master' },
    MASTER_SECRET,
    { expiresIn: '12h' }
  );
}

function verifyCustomerToken(token) {
  return jwt.verify(token, CUSTOMER_SECRET);
}

function verifyAdminToken(token) {
  return jwt.verify(token, ADMIN_SECRET);
}

function verifyMasterToken(token) {
  return jwt.verify(token, MASTER_SECRET);
}

function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  signCustomerToken,
  signAdminToken,
  signMasterToken,
  verifyCustomerToken,
  verifyAdminToken,
  verifyMasterToken,
  generateSecureToken,
};
