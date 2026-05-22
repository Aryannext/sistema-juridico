const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const signToken = (payload, expiresIn = process.env.JWT_EXPIRES_IN || '8h') => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = {
  signToken,
  verifyToken,
  generateOTP,
  generateVerificationToken,
};
