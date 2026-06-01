const Visit = require('../models/Visit.model');
const Patient = require('../models/Patient.model');
const Token = require('../models/Token.model');
const Prescription = require('../models/Prescription.model');
const mongoose = require('mongoose');
const toObjId = (id) => new mongoose.Types.ObjectId(String(id));

// @route  GET /api/reports/dashboard
exports.getDashboardStats = async (req, res, next) => {
  try {
    const clinicId    = req.clinicId;
    const clinicObjId = toObjId(clinicId);
    const today = new Date().toISOString().slice(0, 10);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const [
      totalPatients,
      todayTokens,
      pendingTokens,
      todayPrescriptions,
      todayRevenue,
    ] = await Promise.all([
      Patient.countDocuments({ clinicId, isActive: true }),
      Token.countDocuments({ clinicId, date: today }),
      Token.countDocuments({ clinicId, date: today, status: 'waiting' }),
      Prescription.countDocuments({ clinicId, createdAt: { $gte: todayStart, $lte: todayEnd } }),
      Visit.aggregate([
        { $match: { clinicId: clinicObjId, visitDate: { $gte: todayStart, $lte: todayEnd }, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$consultationFee' } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalPatients,
        todayOPD: todayTokens,
        pendingTokens,
        todayPrescriptions,
        todayRevenue: todayRevenue[0]?.total || 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/reports/weekly
exports.getWeeklyReport = async (req, res, next) => {
  try {
    const clinicId    = req.clinicId;
    const clinicObjId = toObjId(clinicId);
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    const [tokensByDay, revenueByDay] = await Promise.all([
      Token.aggregate([
        { $match: { clinicId: clinicObjId, date: { $in: days } } },
        { $group: { _id: '$date', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Visit.aggregate([
        {
          $match: {
            clinicId: clinicObjId,
            visitDate: {
              $gte: new Date(days[0]),
              $lte: new Date(days[6] + 'T23:59:59'),
            },
            paymentStatus: 'paid',
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$visitDate' } },
            revenue: { $sum: '$consultationFee' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const result = days.map(day => {
      const t = tokensByDay.find(x => x._id === day);
      const r = revenueByDay.find(x => x._id === day);
      return { date: day, patients: t?.count || 0, revenue: r?.revenue || 0 };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/reports/monthly
exports.getMonthlyReport = async (req, res, next) => {
  try {
    const clinicId    = req.clinicId;
    const clinicObjId = toObjId(clinicId);
    const { year = new Date().getFullYear(), month } = req.query;

    const matchStage = month
      ? {
          $match: {
            clinicId: clinicObjId,
            visitDate: {
              $gte: new Date(`${year}-${String(month).padStart(2, '0')}-01`),
              $lt: new Date(`${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01`),
            },
          },
        }
      : {
          $match: {
            clinicId: clinicObjId,
            visitDate: {
              $gte: new Date(`${year}-01-01`),
              $lt: new Date(`${parseInt(year) + 1}-01-01`),
            },
          },
        };

    const report = await Visit.aggregate([
      matchStage,
      {
        $group: {
          _id: { $dateToString: { format: month ? '%Y-%m-%d' : '%Y-%m', date: '$visitDate' } },
          patients: { $sum: 1 },
          revenue: { $sum: '$consultationFee' },
          paidRevenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$consultationFee', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/reports/top-medicines
exports.getTopMedicines = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const result = await Prescription.aggregate([
      { $match: { clinicId: toObjId(req.clinicId) } },
      { $unwind: '$medicines' },
      { $group: { _id: '$medicines.name', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) },
    ]);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/reports/top-diagnoses
exports.getTopDiagnoses = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const result = await Prescription.aggregate([
      { $match: { clinicId: toObjId(req.clinicId), diagnosis: { $exists: true, $ne: '' } } },
      { $group: { _id: '$diagnosis', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) },
    ]);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
