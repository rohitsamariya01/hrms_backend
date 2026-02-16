const express = require('express');
const router = express.Router();
const Branch = require('../models/Branch');

// @desc    Create a branch
// @route   POST /api/branch
// @access  Public (TODO: Protect with ADMIN middleware)
router.post('/', async (req, res) => {
    try {
        const branch = await Branch.create(req.body);
        res.status(201).json({
            success: true,
            data: branch
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// @desc    Get all branches
// @route   GET /api/branch
// @access  Public
router.get('/', async (req, res) => {
    try {
        const branches = await Branch.find();
        res.status(200).json({
            success: true,
            count: branches.length,
            data: branches
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
