const Token = require('../models/Token.model');
const Patient = require('../models/Patient.model');

const TODAY = () => new Date().toISOString().slice(0, 10);

// @route  POST /api/tokens
// Add existing patient to today's OPD queue
exports.createToken = async (req, res, next) => {
  try {
    const { patientId, chiefComplaint } = req.body;
    if (!patientId) return res.status(400).json({ success: false, message: 'patientId is required' });

    const patient = await Patient.findOne({ _id: patientId, clinicId: req.clinicId });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const today = TODAY();

    // Prevent duplicate token for same patient on same day
    const duplicate = await Token.findOne({
      clinicId: req.clinicId, patientId, date: today,
      status: { $in: ['waiting', 'in-consultation'] },
    });
    if (duplicate) {
      return res.status(409).json({ success: false, message: `Already in queue as token #${duplicate.displayNumber}` });
    }

    const lastToken = await Token.findOne({ clinicId: req.clinicId, date: today }).sort({ tokenNumber: -1 });
    const nextTokenNumber = lastToken ? lastToken.tokenNumber + 1 : 1;

    const token = await Token.create({
      clinicId: req.clinicId,
      patientId: patient._id,
      doctorId: req.doctor._id,
      tokenNumber: nextTokenNumber,
      date: today,
      chiefComplaint: chiefComplaint || '',
      registeredVia: 'manual',
    });

    const io = req.app.get('io');
    io.to(`clinic-${req.clinicId}`).emit('token:new', {
      token: await token.populate('patientId', 'name age gender phone'),
    });

    res.status(201).json({ success: true, data: token });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/tokens/today
exports.getTodayTokens = async (req, res, next) => {
  try {
    const tokens = await Token.find({
      clinicId: req.clinicId,
      date: TODAY(),
    })
      .sort({ tokenNumber: 1 })
      .populate('patientId', 'name age gender phone patientId registeredVia');

    const stats = {
      total: tokens.length,
      waiting: tokens.filter(t => t.status === 'waiting').length,
      inConsultation: tokens.filter(t => t.status === 'in-consultation').length,
      completed: tokens.filter(t => t.status === 'completed').length,
      skipped: tokens.filter(t => t.status === 'skipped').length,
    };

    const current = tokens.find(t => t.status === 'in-consultation');
    const next = tokens.filter(t => t.status === 'waiting').shift();

    res.json({ success: true, data: { tokens, stats, current, next } });
  } catch (err) {
    next(err);
  }
};

// @route  POST /api/tokens/:id/call
// Call a specific token (move to in-consultation)
exports.callToken = async (req, res, next) => {
  try {
    const io = req.app.get('io');

    // Complete the currently active token if exists
    await Token.updateMany(
      { clinicId: req.clinicId, date: TODAY(), status: 'in-consultation' },
      { status: 'completed', consultationEndedAt: new Date() }
    );

    const token = await Token.findOneAndUpdate(
      { _id: req.params.id, clinicId: req.clinicId, status: 'waiting' },
      {
        status: 'in-consultation',
        calledAt: new Date(),
        consultationStartedAt: new Date(),
      },
      { new: true }
    ).populate('patientId', 'name age gender phone patientId');

    if (!token) {
      return res.status(404).json({ success: false, message: 'Token not found or not in waiting state' });
    }

    io.to(`clinic-${req.clinicId}`).emit('token:called', { token });

    // Update patient total visits when called
    await Patient.findByIdAndUpdate(token.patientId._id, {
      $inc: { totalVisits: 1 },
      lastVisit: new Date(),
    });

    res.json({ success: true, data: token });
  } catch (err) {
    next(err);
  }
};

// @route  POST /api/tokens/next
// Call next token in queue
exports.callNext = async (req, res, next) => {
  try {
    const io = req.app.get('io');

    // Complete current
    await Token.updateMany(
      { clinicId: req.clinicId, date: TODAY(), status: 'in-consultation' },
      { status: 'completed', consultationEndedAt: new Date() }
    );

    // Get next waiting
    const nextToken = await Token.findOneAndUpdate(
      { clinicId: req.clinicId, date: TODAY(), status: 'waiting' },
      { status: 'in-consultation', calledAt: new Date(), consultationStartedAt: new Date() },
      { new: true, sort: { tokenNumber: 1 } }
    ).populate('patientId', 'name age gender phone patientId');

    if (!nextToken) {
      return res.status(404).json({ success: false, message: 'No more patients in queue' });
    }

    await Patient.findByIdAndUpdate(nextToken.patientId._id, {
      $inc: { totalVisits: 1 },
      lastVisit: new Date(),
    });

    io.to(`clinic-${req.clinicId}`).emit('token:next', { token: nextToken });

    res.json({ success: true, data: nextToken });
  } catch (err) {
    next(err);
  }
};

// @route  POST /api/tokens/:id/skip
exports.skipToken = async (req, res, next) => {
  try {
    const token = await Token.findOneAndUpdate(
      { _id: req.params.id, clinicId: req.clinicId, status: { $in: ['waiting', 'in-consultation'] } },
      { status: 'skipped' },
      { new: true }
    );
    if (!token) return res.status(404).json({ success: false, message: 'Token not found' });

    req.app.get('io').to(`clinic-${req.clinicId}`).emit('token:skipped', { token });
    res.json({ success: true, data: token });
  } catch (err) {
    next(err);
  }
};

// @route  POST /api/tokens/:id/complete
exports.completeToken = async (req, res, next) => {
  try {
    const token = await Token.findOneAndUpdate(
      { _id: req.params.id, clinicId: req.clinicId },
      { status: 'completed', consultationEndedAt: new Date() },
      { new: true }
    );
    if (!token) return res.status(404).json({ success: false, message: 'Token not found' });

    req.app.get('io').to(`clinic-${req.clinicId}`).emit('token:completed', { token });
    res.json({ success: true, data: token });
  } catch (err) {
    next(err);
  }
};
