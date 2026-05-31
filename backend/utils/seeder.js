require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/database');

const Doctor = require('../models/Doctor.model');
const Clinic = require('../models/Clinic.model');
const Patient = require('../models/Patient.model');
const Token = require('../models/Token.model');
const Prescription = require('../models/Prescription.model');
const Visit = require('../models/Visit.model');

const seed = async () => {
  await connectDB();
  console.log('🌱 Seeding database...');

  // Clear existing
  await Promise.all([
    Doctor.deleteMany({}), Clinic.deleteMany({}),
    Patient.deleteMany({}), Token.deleteMany({}),
    Prescription.deleteMany({}), Visit.deleteMany({}),
  ]);

  // Clinic
  const clinic = await Clinic.create({
    name: "Dr. Sharma's Clinic",
    ownerDoctor: new mongoose.Types.ObjectId(),
    phone: '9876543210',
    address: { line1: 'Shop 4, Ganesh Nagar', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
    opdTiming: { morning: { open: '09:00', close: '13:00' }, evening: { open: '17:00', close: '21:00' } },
    supportedLanguages: ['marathi', 'hindi', 'english'],
    consultationFee: 300,
    whatsappEnabled: false,
  });

  // Doctor
  const doctor = await Doctor.create({
    name: 'Dr. Deepak Sharma',
    email: 'doctor@voiceopd.com',
    password: 'password123',
    phone: '9876543210',
    specialization: 'General Physician',
    role: 'superadmin',
    clinicId: clinic._id,
    registrationNumber: 'MH-12345',
  });

  clinic.ownerDoctor = doctor._id;
  await clinic.save();

  // Patients
  const patientData = [
    { name: 'Ganesh Shelar', phone: '9812345670', age: 45, gender: 'male' },
    { name: 'Priya Joshi', phone: '9823456781', age: 35, gender: 'female' },
    { name: 'Suresh Patil', phone: '9834567892', age: 42, gender: 'male' },
    { name: 'Anjali Deshmukh', phone: '9845678903', age: 28, gender: 'female' },
    { name: 'Ramesh More', phone: '9856789014', age: 60, gender: 'male' },
    { name: 'Sunita Jadhav', phone: '9867890125', age: 38, gender: 'female' },
    { name: 'Amit Kulkarni', phone: '9878901236', age: 52, gender: 'male' },
    { name: 'Kavita Singh', phone: '9889012347', age: 44, gender: 'female' },
  ];

  const patients = [];
  for (const p of patientData) {
    const patient = await Patient.create({ ...p, clinicId: clinic._id, registeredVia: 'voice' });
    patients.push(patient);
  }

  // Today's tokens
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < patients.length; i++) {
    await Token.create({
      clinicId: clinic._id,
      patientId: patients[i]._id,
      doctorId: doctor._id,
      tokenNumber: i + 1,
      date: today,
      status: i < 3 ? 'completed' : i === 3 ? 'in-consultation' : 'waiting',
      registeredVia: 'voice',
      chiefComplaint: ['Fever, Cough', 'Diabetes F/U', 'BP Check', 'Cold', 'Knee Pain', 'Migraine', 'Thyroid', 'Skin Allergy'][i],
    });
  }

  console.log('✅ Seed complete!');
  console.log('📧 Login: doctor@voiceopd.com');
  console.log('🔑 Password: password123');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
