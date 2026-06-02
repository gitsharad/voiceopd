const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  dosage: { type: String, default: '' }, // e.g. "500mg"
  frequency: { type: String, required: true }, // e.g. "1-0-1"
  duration: { type: String, required: true }, // e.g. "5 days"
  instructions: { type: String, trim: true }, // e.g. "After food"
  routeOfAdmin: {
    type: String,
    enum: ['oral', 'topical', 'injection', 'inhalation', 'other'],
    default: 'oral',
  },
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
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
  visitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Visit',
  },
  prescriptionNumber: { type: String, unique: true },
  diagnosis: { type: String, trim: true },
  symptoms: [{ type: String, trim: true }],
  medicines: [medicineSchema],
  advices: [{ type: String, trim: true }],
  followUpDate: { type: Date },
  generatedViaVoice: { type: Boolean, default: false },
  voiceTranscript: { type: String },
  whatsappSent: { type: Boolean, default: false },
  whatsappSentAt: { type: Date },
  printCount: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// Auto-generate prescription number (globally unique with collision retry)
prescriptionSchema.pre('save', async function () {
  if (!this.isNew || this.prescriptionNumber) return;
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  let num = await this.constructor.countDocuments() + 1;
  let candidate = `RX${yy}${mm}-${String(num).padStart(5, '0')}`;
  while (await this.constructor.exists({ prescriptionNumber: candidate })) {
    num++;
    candidate = `RX${yy}${mm}-${String(num).padStart(5, '0')}`;
  }
  this.prescriptionNumber = candidate;
});

module.exports = mongoose.model('Prescription', prescriptionSchema);
