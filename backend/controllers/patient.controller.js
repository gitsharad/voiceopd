const Patient = require('../models/Patient.model');
const Token = require('../models/Token.model');
const { validationResult } = require('express-validator');

// @route  GET /api/patients
exports.getPatients = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = req.query;

    const query = { clinicId: req.clinicId, isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { patientId: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Patient.countDocuments(query);
    const patients = await Patient.find(query)
      .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: patients,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

// @route  POST /api/patients
exports.createPatient = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, phone, age, gender, address, bloodGroup, allergies,
            chronicConditions, registeredVia, voiceTranscript, chiefComplaint } = req.body;

    // Check if patient already exists in this clinic (including soft-deleted)
    const existing = await Patient.findOne({ clinicId: req.clinicId, phone });

    let patient;
    if (existing) {
      // Reactivate if previously deleted
      if (!existing.isActive) {
        existing.isActive = true;
        await existing.save({ validateBeforeSave: false });
      }
      patient = existing;
    } else {
      patient = await Patient.create({
        clinicId: req.clinicId,
        name, phone, age, gender, address, bloodGroup,
        allergies: allergies || [],
        chronicConditions: chronicConditions || [],
        registeredVia: registeredVia || 'manual',
        voiceTranscript,
      });
    }

    // Auto-create token for today
    const today = new Date().toISOString().slice(0, 10);
    const lastToken = await Token.findOne({ clinicId: req.clinicId, date: today })
      .sort({ tokenNumber: -1 });
    const nextTokenNumber = lastToken ? lastToken.tokenNumber + 1 : 1;

    const token = await Token.create({
      clinicId: req.clinicId,
      patientId: patient._id,
      doctorId: req.doctor._id,
      tokenNumber: nextTokenNumber,
      date: today,
      chiefComplaint: chiefComplaint || '',
      registeredVia: registeredVia || 'manual',
      voiceTranscript,
    });

    // Emit real-time event for live token board
    const io = req.app.get('io');
    io.to(`clinic-${req.clinicId}`).emit('token:new', {
      token: await token.populate('patientId', 'name age gender phone'),
    });

    res.status(201).json({
      success: true,
      message: existing ? 'Existing patient found, new token issued' : 'Patient registered successfully',
      data: { patient, token },
    });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/patients/:id
exports.getPatient = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ _id: req.params.id, clinicId: req.clinicId });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
    res.json({ success: true, data: patient });
  } catch (err) {
    next(err);
  }
};

// @route  PUT /api/patients/:id
exports.updatePatient = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'age', 'gender', 'address', 'bloodGroup', 'allergies', 'chronicConditions'];
    const updates = {};
    allowedFields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const patient = await Patient.findOneAndUpdate(
      { _id: req.params.id, clinicId: req.clinicId },
      updates,
      { new: true, runValidators: true }
    );
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
    res.json({ success: true, data: patient });
  } catch (err) {
    next(err);
  }
};

// @route  DELETE /api/patients/:id
exports.deletePatient = async (req, res, next) => {
  try {
    const patient = await Patient.findOneAndUpdate(
      { _id: req.params.id, clinicId: req.clinicId },
      { isActive: false },
      { new: true }
    );
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
    res.json({ success: true, message: 'Patient deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/patients/:id/history
exports.getPatientHistory = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ _id: req.params.id, clinicId: req.clinicId });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const Visit = require('../models/Visit.model');
    const Prescription = require('../models/Prescription.model');

    const [visits, prescriptions] = await Promise.all([
      Visit.find({ patientId: req.params.id, clinicId: req.clinicId })
        .sort({ visitDate: -1 }).limit(20)
        .populate('doctorId', 'name specialization'),
      Prescription.find({ patientId: req.params.id, clinicId: req.clinicId })
        .sort({ createdAt: -1 }).limit(20),
    ]);

    res.json({ success: true, data: { patient, visits, prescriptions } });
  } catch (err) {
    next(err);
  }
};
