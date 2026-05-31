const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Patient name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
  },
  phone: {
    type: String,
    match: [/^[6-9]\d{9}$/, 'Please provide a valid Indian mobile number'],
  },
  age: {
    type: Number,
    required: [true, 'Age is required'],
    min: [0, 'Age cannot be negative'],
    max: [150, 'Age cannot exceed 150'],
  },
  gender: {
    type: String,
    required: [true, 'Gender is required'],
    enum: ['male', 'female', 'other'],
  },
  address: { type: String, trim: true },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''],
    default: '',
  },
  allergies: [{ type: String, trim: true }],
  chronicConditions: [{ type: String, trim: true }],
  registeredVia: {
    type: String,
    enum: ['voice', 'manual', 'walk-in'],
    default: 'manual',
  },
  voiceTranscript: { type: String }, // raw voice input used for registration
  patientId: { type: String, unique: true }, // human-readable ID e.g. VOP-000123
  totalVisits: { type: Number, default: 0 },
  lastVisit: { type: Date },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
});

// Compound index for fast clinic-level search
patientSchema.index({ clinicId: 1, phone: 1 }, { unique: true, sparse: true });
patientSchema.index({ clinicId: 1, name: 'text' });

// Auto-generate patientId before save
patientSchema.pre('save', async function () {
  if (!this.isNew) return;
  const count = await this.constructor.countDocuments({ clinicId: this.clinicId });
  this.patientId = `VOP-${String(count + 1).padStart(6, '0')}`;
});

module.exports = mongoose.model('Patient', patientSchema);
