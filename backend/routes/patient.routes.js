const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth.middleware');
const {
  getPatients, createPatient, getPatient, updatePatient, deletePatient, getPatientHistory,
} = require('../controllers/patient.controller');

const patientValidation = [
  body('name').trim().notEmpty().withMessage('Patient name is required'),
  body('phone').matches(/^[6-9]\d{9}$/).withMessage('Valid 10-digit mobile number required'),
  body('age').isInt({ min: 0, max: 150 }).withMessage('Valid age required'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
];

router.use(protect);
router.get('/', getPatients);
router.post('/', patientValidation, createPatient);
router.get('/:id', getPatient);
router.put('/:id', updatePatient);
router.delete('/:id', deletePatient);
router.get('/:id/history', getPatientHistory);

module.exports = router;
