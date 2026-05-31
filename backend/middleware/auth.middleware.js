const jwt = require('jsonwebtoken');
const Doctor = require('../models/Doctor.model');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const doctor = await Doctor.findById(decoded.id).select('-password');
    if (!doctor) {
      return res.status(401).json({ success: false, message: 'Doctor not found' });
    }
    if (!doctor.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated' });
    }

    req.doctor = doctor;
    req.clinicId = doctor.clinicId;
    next();
  } catch (err) {
    next(err);
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.doctor.role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.doctor.role}' is not authorized to access this route`,
    });
  }
  next();
};

module.exports = { protect, authorize };
