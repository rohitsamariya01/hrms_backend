const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Profile = require('../models/Profile');

// @desc    Submit onboarding profile
// @route   POST /api/onboarding/submit
// @access  Private (ONBOARDING status only)
router.post('/submit', protect, async (req, res) => {
    try {
        if (req.user.status !== 'ONBOARDING') {
            return res.status(403).json({
                success: false,
                error: `Action not allowed. Current status: ${req.user.status}. Required: ONBOARDING.`
            });
        }

        const {
            phone,
            address,
            emergencyContact,
            designation,
            department,
            joiningDate,
            documents
        } = req.body;

        if (!phone || !address || !emergencyContact || !designation || !department || !joiningDate) {
            return res.status(400).json({ success: false, error: 'Please provide all required fields' });
        }

        const profile = await Profile.create({
            user: req.user._id,
            phone,
            address,
            emergencyContact,
            designation,
            department,
            joiningDate,
            documents
        });

        // Update User Status
        req.user.status = 'UNDER_REVIEW';
        await req.user.save();

        res.status(201).json({
            success: true,
            message: 'Profile submitted successfully. Account under review.',
            data: profile
        });

    } catch (error) {
        console.error(error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, error: 'Profile already submitted for this user' });
        }
        res.status(500).json({ success: false, error: 'Server Error' });
    }
});

module.exports = router;
