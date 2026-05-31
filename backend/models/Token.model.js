const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
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
  tokenNumber: {
    type: Number,
    required: true,
  },
  displayNumber: { type: String }, // e.g. "A-023"
  date: {
    type: String, // YYYY-MM-DD — for daily scoping
    required: true,
    index: true,
  },
  chiefComplaint: { type: String, trim: true },
  status: {
    type: String,
    enum: ['waiting', 'in-consultation', 'completed', 'skipped', 'cancelled'],
    default: 'waiting',
    index: true,
  },
  registeredVia: {
    type: String,
    enum: ['voice', 'manual', 'walk-in'],
    default: 'manual',
  },
  voiceTranscript: { type: String },
  calledAt: { type: Date },
  consultationStartedAt: { type: Date },
  consultationEndedAt: { type: Date },
  waitTimeMinutes: { type: Number },
  consultationMinutes: { type: Number },
}, {
  timestamps: true,
});

// Unique token per clinic per day
tokenSchema.index({ clinicId: 1, date: 1, tokenNumber: 1 }, { unique: true });

// Auto-assign display number
tokenSchema.pre('save', function () {
  if (!this.displayNumber) {
    this.displayNumber = String(this.tokenNumber).padStart(3, '0');
  }
});

module.exports = mongoose.model('Token', tokenSchema);
