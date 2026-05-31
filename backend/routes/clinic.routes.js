const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { getClinic, updateClinic } = require('../controllers/clinic.controller');
router.use(protect);
router.get('/', getClinic);
router.put('/', authorize('admin'), updateClinic);
module.exports = router;
