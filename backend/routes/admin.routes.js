const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { getStats, getClinics, getClinicDetail, updateClinic, updateDoctor } = require('../controllers/admin.controller');

// All admin routes require auth + admin role
router.use(protect, authorize('superadmin'));

router.get('/stats',            getStats);
router.get('/clinics',          getClinics);
router.get('/clinics/:id',      getClinicDetail);
router.put('/clinics/:id',      updateClinic);
router.put('/doctors/:id',      updateDoctor);

module.exports = router;
