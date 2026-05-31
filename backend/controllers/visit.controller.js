const Visit = require('../models/Visit.model');

exports.getVisits = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, patientId, from, to } = req.query;
    const query = { clinicId: req.clinicId };
    if (patientId) query.patientId = patientId;
    if (from || to) {
      query.visitDate = {};
      if (from) query.visitDate.$gte = new Date(from);
      if (to) { const t = new Date(to); t.setHours(23,59,59,999); query.visitDate.$lte = t; }
    }
    const total = await Visit.countDocuments(query);
    const visits = await Visit.find(query)
      .sort({ visitDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('patientId', 'name age gender phone patientId')
      .populate('doctorId', 'name specialization')
      .populate('prescriptionId', 'prescriptionNumber medicines');

    res.json({ success: true, data: visits, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

exports.getVisit = async (req, res, next) => {
  try {
    const visit = await Visit.findOne({ _id: req.params.id, clinicId: req.clinicId })
      .populate('patientId').populate('doctorId').populate('prescriptionId');
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
    res.json({ success: true, data: visit });
  } catch (err) { next(err); }
};

exports.updateVisit = async (req, res, next) => {
  try {
    const allowed = ['paymentStatus', 'paymentMode', 'clinicalNotes', 'followUpDate', 'vitalSigns'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const visit = await Visit.findOneAndUpdate({ _id: req.params.id, clinicId: req.clinicId }, updates, { new: true });
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
    res.json({ success: true, data: visit });
  } catch (err) { next(err); }
};
