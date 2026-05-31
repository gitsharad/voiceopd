const Clinic = require('../models/Clinic.model');

exports.getClinic = async (req, res, next) => {
  try {
    const clinic = await Clinic.findById(req.clinicId).populate('ownerDoctor', 'name email phone');
    if (!clinic) return res.status(404).json({ success: false, message: 'Clinic not found' });
    res.json({ success: true, data: clinic });
  } catch (err) { next(err); }
};

exports.updateClinic = async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'address', 'opdTiming', 'supportedLanguages',
                     'whatsappEnabled', 'whatsappNumber', 'consultationFee', 'tokenResetTime'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const clinic = await Clinic.findByIdAndUpdate(req.clinicId, updates, { new: true, runValidators: true });
    res.json({ success: true, data: clinic });
  } catch (err) { next(err); }
};
