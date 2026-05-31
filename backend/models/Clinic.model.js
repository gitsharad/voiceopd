const mongoose = require('mongoose');

const clinicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Clinic name is required'],
    trim: true,
  },
  ownerDoctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
  },
  phone: { type: String, required: true },
  address: {
    line1: String,
    city: String,
    state: String,
    pincode: String,
  },
  opdTiming: {
    morning: { open: String, close: String },
    evening: { open: String, close: String },
  },
  supportedLanguages: {
    type: [String],
    enum: ['marathi', 'hindi', 'english'],
    default: ['marathi', 'hindi', 'english'],
  },
  whatsappEnabled: { type: Boolean, default: false },
  whatsappNumber: { type: String },
  subscriptionPlan: {
    type: String,
    enum: ['trial', 'basic', 'pro', 'enterprise'],
    default: 'trial',
  },
  trialEndsAt: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
  isActive: { type: Boolean, default: true },
  tokenResetTime: { type: String, default: '00:00' }, // daily token reset at midnight
  consultationFee: { type: Number, default: 200 },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Clinic', clinicSchema);
