const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { recommend, translateAdvice } = require('../controllers/ai.controller');

router.use(protect);
router.post('/recommend',        recommend);
router.post('/translate-advice', translateAdvice);

module.exports = router;
