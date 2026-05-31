const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth.middleware');
const { getPrescriptions, createPrescription, getPrescription, updatePrescription, deletePrescription, sendWhatsApp } = require('../controllers/prescription.controller');

const rxValidation = [
  body('patientId').notEmpty().withMessage('Patient ID is required'),
  body('medicines').isArray({ min: 1 }).withMessage('At least one medicine is required'),
  body('medicines.*.name').notEmpty().withMessage('Medicine name is required'),
  body('medicines.*.dosage').notEmpty().withMessage('Dosage is required'),
  body('medicines.*.frequency').notEmpty().withMessage('Frequency is required'),
  body('medicines.*.duration').notEmpty().withMessage('Duration is required'),
];

router.use(protect);
router.get('/', getPrescriptions);
router.post('/', rxValidation, createPrescription);
router.get('/:id', getPrescription);
router.put('/:id', updatePrescription);
router.delete('/:id', deletePrescription);
router.post('/:id/whatsapp', sendWhatsApp);

module.exports = router;
