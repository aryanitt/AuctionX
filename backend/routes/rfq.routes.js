const express = require('express');
const { createRFQ, listRFQs, getRFQById, updateRFQ } = require('../controllers/rfq.controller');
const { submitBid, getBidsForRFQ } = require('../controllers/bid.controller');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { buyerOnly, supplierOnly } = require('../middlewares/roleGuard');

const router = express.Router();

// All RFQ routes require authentication
router.use(authMiddleware);

// RFQ CRUD
router.get('/', listRFQs);
router.get('/:id', getRFQById);
router.post('/', buyerOnly, createRFQ);
router.put('/:id', buyerOnly, updateRFQ);

// Bids nested under RFQs
router.get('/:rfqId/bids', getBidsForRFQ);
router.post('/:rfqId/bids', supplierOnly, submitBid);

module.exports = router;
