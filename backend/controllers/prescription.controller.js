const Prescription = require('../models/Prescription.model');
const Visit = require('../models/Visit.model');
const Patient = require('../models/Patient.model');
const Token = require('../models/Token.model');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

// @route  GET /api/prescriptions
exports.getPrescriptions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, patientId, date } = req.query;
    const query = { clinicId: req.clinicId };

    if (patientId) query.patientId = patientId;
    if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const total = await Prescription.countDocuments(query);
    const prescriptions = await Prescription.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('patientId', 'name age gender phone patientId')
      .populate('doctorId', 'name specialization');

    res.json({
      success: true,
      data: prescriptions,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// @route  POST /api/prescriptions
exports.createPrescription = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      patientId, tokenId, diagnosis, symptoms, medicines,
      advices, followUpDate, generatedViaVoice, voiceTranscript,
      consultationFee, paymentStatus, paymentMode, vitalSigns, clinicalNotes,
    } = req.body;

    const patient = await Patient.findOne({ _id: patientId, clinicId: req.clinicId });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // Create prescription
    const prescription = await Prescription.create({
      clinicId: req.clinicId,
      patientId,
      doctorId: req.doctor._id,
      tokenId,
      diagnosis,
      symptoms: symptoms || [],
      medicines: medicines || [],
      advices: advices || [],
      followUpDate,
      generatedViaVoice: generatedViaVoice || false,
      voiceTranscript,
    });

    // Create visit record
    const visit = await Visit.create({
      clinicId: req.clinicId,
      patientId,
      doctorId: req.doctor._id,
      tokenId,
      prescriptionId: prescription._id,
      chiefComplaints: symptoms || [],
      diagnosis,
      vitalSigns: vitalSigns || {},
      clinicalNotes,
      consultationFee: consultationFee || 0,
      paymentStatus: paymentStatus || 'pending',
      paymentMode: paymentMode || '',
      followUpDate,
    });

    // Link visit to prescription
    prescription.visitId = visit._id;
    await prescription.save();

    // Mark token completed
    if (tokenId) {
      await Token.findByIdAndUpdate(tokenId, {
        status: 'completed',
        consultationEndedAt: new Date(),
      });
      req.app.get('io').to(`clinic-${req.clinicId}`).emit('token:completed', { tokenId });
    }

    const populated = await prescription.populate([
      { path: 'patientId', select: 'name age gender phone patientId' },
      { path: 'doctorId', select: 'name specialization' },
    ]);

    logger.info(`Prescription ${prescription.prescriptionNumber} created for patient ${patient.name}`);

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/prescriptions/:id
exports.getPrescription = async (req, res, next) => {
  try {
    const rx = await Prescription.findOne({ _id: req.params.id, clinicId: req.clinicId })
      .populate('patientId', 'name age gender phone address bloodGroup patientId allergies')
      .populate({ path: 'doctorId', select: 'name specialization registrationNumber clinicId', populate: { path: 'clinicId', model: 'Clinic' } })
      .populate('visitId', 'consultationFee paymentStatus paymentMode');

    if (!rx) return res.status(404).json({ success: false, message: 'Prescription not found' });
    res.json({ success: true, data: rx });
  } catch (err) {
    next(err);
  }
};

// @route  PUT /api/prescriptions/:id
exports.updatePrescription = async (req, res, next) => {
  try {
    const allowed = ['diagnosis', 'symptoms', 'medicines', 'advices', 'followUpDate'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const rx = await Prescription.findOneAndUpdate(
      { _id: req.params.id, clinicId: req.clinicId },
      updates,
      { new: true, runValidators: true }
    )
      .populate('patientId', 'name age gender phone address bloodGroup patientId allergies')
      .populate({ path: 'doctorId', select: 'name specialization registrationNumber clinicId', populate: { path: 'clinicId', model: 'Clinic' } })
      .populate('visitId', 'consultationFee paymentStatus paymentMode');

    if (!rx) return res.status(404).json({ success: false, message: 'Prescription not found' });
    res.json({ success: true, data: rx });
  } catch (err) {
    next(err);
  }
};

// @route  DELETE /api/prescriptions/:id
exports.deletePrescription = async (req, res, next) => {
  try {
    const rx = await Prescription.findOneAndDelete({ _id: req.params.id, clinicId: req.clinicId });
    if (!rx) return res.status(404).json({ success: false, message: 'Prescription not found' });
    res.json({ success: true, message: 'Prescription deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// @route  POST /api/prescriptions/:id/whatsapp
exports.sendWhatsApp = async (req, res, next) => {
  try {
    const rx = await Prescription.findOne({ _id: req.params.id, clinicId: req.clinicId })
      .populate('patientId', 'name phone')
      .populate('doctorId', 'name clinicId');

    if (!rx) return res.status(404).json({ success: false, message: 'Prescription not found' });

    // Build WhatsApp message text
    const meds = rx.medicines.map((m, i) =>
      `${i + 1}. ${m.name} ${m.dosage} — ${m.frequency} × ${m.duration}${m.instructions ? ` (${m.instructions})` : ''}`
    ).join('\n');

    const message =
      `🏥 *VoiceOPD Prescription*\n\n` +
      `Patient: *${rx.patientId.name}*\n` +
      `Rx No: ${rx.prescriptionNumber}\n` +
      `Date: ${new Date(rx.createdAt).toDateString()}\n` +
      `Diagnosis: ${rx.diagnosis || 'As discussed'}\n\n` +
      `*Medicines:*\n${meds}\n\n` +
      (rx.advices && rx.advices.length ? `*Advice:*\n${rx.advices.join('\n')}\n\n` : '') +
      (rx.followUpDate ? `*Follow-up:* ${new Date(rx.followUpDate).toDateString()}\n\n` : '') +
      `💊 Take medicines as prescribed. Get well soon!`;

    // Build wa.me link (works on any device, no API key needed)
    const phone = rx.patientId.phone
      ? rx.patientId.phone.replace(/\D/g, '') // strip non-digits
      : null;
    const waUrl = phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    rx.whatsappSent    = true;
    rx.whatsappSentAt  = new Date();
    await rx.save();

    res.json({ success: true, message: 'WhatsApp ready', data: { message, waUrl } });
  } catch (err) {
    next(err);
  }
};
