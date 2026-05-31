const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const nodemailer = require('nodemailer');
const Doctor   = require('../models/Doctor.model');
const Clinic   = require('../models/Clinic.model');
const { validationResult } = require('express-validator');
const logger   = require('../utils/logger');

// ── Mailer helper ─────────────────────────────────────────────────────────────
const createTransporter = () => nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const generateTokens = (id) => {
  const accessToken = jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
  const refreshToken = jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
  });
  return { accessToken, refreshToken };
};

// @route  POST /api/auth/register
// @desc   Register doctor + create clinic
// @access Public
exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password, phone, clinicName, specialization } = req.body;

    const existingDoctor = await Doctor.findOne({ email });
    if (existingDoctor) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Create doctor first (no clinicId yet)
    const doctor = await Doctor.create({
      name,
      email,
      password,
      phone,
      specialization: specialization || 'General Physician',
      role: 'admin',
    });

    // Now create clinic with the real doctor ID
    const clinic = await Clinic.create({
      name: clinicName || `${name}'s Clinic`,
      ownerDoctor: doctor._id,
      phone,
    });

    // Link clinic back to doctor
    doctor.clinicId = clinic._id;
    await doctor.save({ validateBeforeSave: false });

    const { accessToken, refreshToken } = generateTokens(doctor._id);
    doctor.refreshToken = refreshToken;
    doctor.lastLogin = new Date();
    await doctor.save({ validateBeforeSave: false });

    logger.info(`New doctor registered: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        doctor,
        clinic,
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @route  POST /api/auth/login
// @access Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const doctor = await Doctor.findOne({ email }).select('+password +refreshToken');
    if (!doctor || !(await doctor.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!doctor.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    const clinic = await Clinic.findById(doctor.clinicId);
    const { accessToken, refreshToken } = generateTokens(doctor._id);

    doctor.refreshToken = refreshToken;
    doctor.lastLogin = new Date();
    await doctor.save({ validateBeforeSave: false });

    logger.info(`Doctor logged in: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: { doctor, clinic, accessToken, refreshToken },
    });
  } catch (err) {
    next(err);
  }
};

// @route  POST /api/auth/refresh
// @access Public (with refresh token)
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const doctor = await Doctor.findById(decoded.id).select('+refreshToken');

    if (!doctor || doctor.refreshToken !== refreshToken) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const tokens = generateTokens(doctor._id);
    doctor.refreshToken = tokens.refreshToken;
    await doctor.save({ validateBeforeSave: false });

    res.json({ success: true, data: tokens });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }
    next(err);
  }
};

// @route  POST /api/auth/logout
// @access Private
exports.logout = async (req, res, next) => {
  try {
    await Doctor.findByIdAndUpdate(req.doctor._id, { refreshToken: null });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/auth/me
// @access Private
exports.getMe = async (req, res) => {
  const clinic = await Clinic.findById(req.doctor.clinicId);
  res.json({ success: true, data: { doctor: req.doctor, clinic } });
};

// @route  POST /api/auth/forgot-password
// @access Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const doctor = await Doctor.findOne({ email: email.toLowerCase().trim() });
    // Always return success to avoid email enumeration
    if (!doctor) {
      return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    }

    // Generate token
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    doctor.resetPasswordToken  = hashedToken;
    doctor.resetPasswordExpire = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    await doctor.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

    try {
      const transporter = createTransporter();
      await transporter.sendMail({
        from: `"VoiceOPD" <${process.env.SMTP_USER}>`,
        to:   doctor.email,
        subject: 'VoiceOPD – Password Reset Request',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
            <h2 style="color:#0B1437;margin-bottom:8px">Reset Your Password</h2>
            <p style="color:#64748b;font-size:14px">Hi ${doctor.name},</p>
            <p style="color:#64748b;font-size:14px">Click the button below to reset your VoiceOPD password. This link expires in <strong>30 minutes</strong>.</p>
            <a href="${resetUrl}"
               style="display:inline-block;margin:20px 0;padding:13px 28px;background:#0B1437;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
              Reset Password
            </a>
            <p style="color:#94a3b8;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
            <p style="color:#94a3b8;font-size:12px">Or copy this link:<br><a href="${resetUrl}" style="color:#00A67D">${resetUrl}</a></p>
          </div>`,
      });
      logger.info(`Password reset email sent to: ${doctor.email}`);
    } catch (mailErr) {
      // Roll back token if email fails
      doctor.resetPasswordToken  = undefined;
      doctor.resetPasswordExpire = undefined;
      await doctor.save({ validateBeforeSave: false });
      logger.error('Mail send failed:', mailErr.message);
      return res.status(500).json({ success: false, message: 'Failed to send reset email. Check SMTP settings.' });
    }

    res.json({ success: true, message: 'Password reset link sent to your email.' });
  } catch (err) {
    next(err);
  }
};

// @route  POST /api/auth/reset-password/:token
// @access Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const doctor = await Doctor.findOne({
      resetPasswordToken:  hashedToken,
      resetPasswordExpire: { $gt: new Date() },
    }).select('+resetPasswordToken +resetPasswordExpire');

    if (!doctor) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired.' });
    }

    doctor.password             = password;
    doctor.resetPasswordToken   = undefined;
    doctor.resetPasswordExpire  = undefined;
    doctor.refreshToken         = undefined;
    await doctor.save();

    logger.info(`Password reset successful for: ${doctor.email}`);
    res.json({ success: true, message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    next(err);
  }
};
