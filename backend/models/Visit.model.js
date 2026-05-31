const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true,
    index: true,
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
  },
  tokenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Token',
  },
  prescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
  },
  visitDate: { type: Date, default: Date.now, index: true },
  chiefComplaints: [{ type: String, trim: true }],
  diagnosis: { type: String, trim: true },
  vitalSigns: {
    bloodPressure: { systolic: Number, diastolic: Number },
    pulse: Number,
    temperature: Number,
    weight: Number,
    height: Number,
    spo2: Number,
  },
  clinicalNotes: { type: String, trim: true },
  consultationFee: { type: Number, default: 0 },
  paymentStatus: {
    type: String,
    enum: ['paid', 'pending', 'waived'],
    default: 'pending',
  },
  paymentMode: {
    type: String,
    enum: ['cash', 'upi', 'card', 'online', ''],
    default: '',
  },
  followUpDate: { type: Date },
  followUpNotes: { type: String, trim: true },
}, {
  timestamps: true,
});

visitSchema.index({ clinicId: 1, visitDate: -1 });

module.exports = mongoose.model('Visit', visitSchema);
