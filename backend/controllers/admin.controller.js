const Clinic       = require('../models/Clinic.model');
const Doctor       = require('../models/Doctor.model');
const Patient      = require('../models/Patient.model');
const Prescription = require('../models/Prescription.model');
const Visit        = require('../models/Visit.model');
const Token        = require('../models/Token.model');
const mongoose     = require('mongoose');
const toObjId      = (id) => new mongoose.Types.ObjectId(String(id));

// @route  GET /api/admin/stats
exports.getStats = async (req, res, next) => {
  try {
    const now = new Date();
    const [
      totalClinics, activeClinics, inactiveClinics,
      trialClinics, expiredTrials,
      totalDoctors, totalPatients, totalPrescriptions,
      todayTokens,
    ] = await Promise.all([
      Clinic.countDocuments(),
      Clinic.countDocuments({ isActive: true }),
      Clinic.countDocuments({ isActive: false }),
      Clinic.countDocuments({ subscriptionPlan: 'trial', trialEndsAt: { $gte: now }, isActive: true }),
      Clinic.countDocuments({ subscriptionPlan: 'trial', trialEndsAt: { $lt: now } }),
      Doctor.countDocuments(),
      Patient.countDocuments({ isActive: true }),
      Prescription.countDocuments(),
      Token.countDocuments({ date: new Date().toISOString().slice(0, 10) }),
    ]);

    res.json({
      success: true,
      data: {
        totalClinics, activeClinics, inactiveClinics,
        trialClinics, expiredTrials,
        totalDoctors, totalPatients, totalPrescriptions, todayTokens,
      },
    });
  } catch (err) { next(err); }
};

// @route  GET /api/admin/clinics
exports.getClinics = async (req, res, next) => {
  try {
    const { search, plan, status } = req.query;
    const query = {};
    if (plan)   query.subscriptionPlan = plan;
    if (status === 'active')   query.isActive = true;
    if (status === 'inactive') query.isActive = false;

    const clinics = await Clinic.find(query)
      .populate('ownerDoctor', 'name email phone specialization lastLogin')
      .sort({ createdAt: -1 });

    // Enrich each clinic with counts
    const enriched = await Promise.all(clinics.map(async c => {
      const [patientCount, prescriptionCount, doctorCount, lastToken] = await Promise.all([
        Patient.countDocuments({ clinicId: c._id, isActive: true }),
        Prescription.countDocuments({ clinicId: c._id }),
        Doctor.countDocuments({ clinicId: c._id }),
        Token.findOne({ clinicId: c._id }).sort({ createdAt: -1 }).select('createdAt date'),
      ]);
      return { ...c.toObject(), patientCount, prescriptionCount, doctorCount, lastActivity: lastToken?.createdAt || c.createdAt };
    }));

    // Client-side search filter on enriched results
    const filtered = search
      ? enriched.filter(c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.ownerDoctor?.name?.toLowerCase().includes(search.toLowerCase()) ||
          c.ownerDoctor?.email?.toLowerCase().includes(search.toLowerCase())
        )
      : enriched;

    res.json({ success: true, data: filtered });
  } catch (err) { next(err); }
};

// @route  GET /api/admin/clinics/:id
exports.getClinicDetail = async (req, res, next) => {
  try {
    const clinic = await Clinic.findById(req.params.id)
      .populate('ownerDoctor', 'name email phone specialization registrationNumber lastLogin isActive createdAt');

    if (!clinic) return res.status(404).json({ success: false, message: 'Clinic not found' });

    const [doctors, patientCount, prescriptionCount, visitCount, recentPatients, monthlyStats] = await Promise.all([
      Doctor.find({ clinicId: req.params.id }).select('name email phone role specialization isActive lastLogin createdAt').sort({ createdAt: -1 }),
      Patient.countDocuments({ clinicId: req.params.id, isActive: true }),
      Prescription.countDocuments({ clinicId: req.params.id }),
      Visit.countDocuments({ clinicId: req.params.id }),
      Patient.find({ clinicId: req.params.id }).sort({ createdAt: -1 }).limit(5).select('name phone age gender createdAt registeredVia'),
      // Last 6 months token counts
      Token.aggregate([
        { $match: { clinicId: toObjId(clinic._id) } },
        { $group: {
          _id: { $substr: ['$date', 0, 7] }, // YYYY-MM
          count: { $sum: 1 },
        }},
        { $sort: { _id: -1 } },
        { $limit: 6 },
      ]),
    ]);

    res.json({
      success: true,
      data: { clinic, doctors, patientCount, prescriptionCount, visitCount, recentPatients, monthlyStats },
    });
  } catch (err) { next(err); }
};

// @route  PUT /api/admin/clinics/:id
exports.updateClinic = async (req, res, next) => {
  try {
    const allowed = ['isActive', 'subscriptionPlan', 'trialEndsAt', 'name', 'phone', 'consultationFee'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const clinic = await Clinic.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('ownerDoctor', 'name email phone');

    if (!clinic) return res.status(404).json({ success: false, message: 'Clinic not found' });
    res.json({ success: true, data: clinic });
  } catch (err) { next(err); }
};

// @route  PUT /api/admin/doctors/:id  (activate/deactivate a doctor)
exports.updateDoctor = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, { isActive }, { new: true }).select('-password');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    res.json({ success: true, data: doctor });
  } catch (err) { next(err); }
};
