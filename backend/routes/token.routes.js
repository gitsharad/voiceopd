// token.routes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { getTodayTokens, createToken, callToken, callNext, skipToken, completeToken } = require('../controllers/token.controller');

router.use(protect);
router.get('/today', getTodayTokens);
router.post('/', createToken);
router.post('/next', callNext);
router.post('/:id/call', callToken);
router.post('/:id/skip', skipToken);
router.post('/:id/complete', completeToken);

module.exports = router;
