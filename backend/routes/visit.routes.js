// visit.routes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { getVisits, getVisit, updateVisit } = require('../controllers/visit.controller');
router.use(protect);
router.get('/', getVisits);
router.get('/:id', getVisit);
router.put('/:id', updateVisit);
module.exports = router;
