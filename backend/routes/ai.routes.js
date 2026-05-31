const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { recommend } = require('../controllers/ai.controller');

router.use(protect);
router.post('/recommend', recommend);

module.exports = router;
