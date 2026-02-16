const User = require('../models/User');
const Branch = require('../models/Branch');
const { generateOTP } = require('../services/otpService');
const sendEmail = require('../services/emailService');
const bcrypt = require('bcryptjs');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
    try {
        const { name, email, password, branch_id } = req.body;

        // 1. Validate fields
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'Please provide name, email and password' });
        }

        // 2. Check if branch exists (Optional)
        if (branch_id) {
            const branch = await Branch.findById(branch_id);
            if (!branch) {
                return res.status(404).json({ success: false, error: 'Branch not found' });
            }
        }

        // 3. Check if email already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, error: 'Email already exists' });
        }

        // 4. Generate OTP
        const otp = generateOTP();

        // 5. Hash OTP
        const salt = await bcrypt.genSalt(10);
        const hashedOTP = await bcrypt.hash(otp, salt);

        // 6. Create User
        // Role defaults to EMPLOYEE, Status defaults to PENDING_VERIFICATION in Schema
        const user = await User.create({
            name,
            email,
            password, // Hashed in pre-save hook
            branch: branch_id || undefined, // undefined will not set the field
            otp: hashedOTP,
            otpExpires: Date.now() + 10 * 60 * 1000 // 10 minutes
        });

        // 7. Send OTP (Temporary Console Log)
        console.log('OTP for email ' + email + ': ' + otp);

        /* 
        // Email Service Disabled for Dev
        const message = `Your OTP for HRMS registration is: ${otp}. It expires in 10 minutes.`;
        try {
            await sendEmail({
                email: user.email,
                subject: 'HRMS Registration OTP',
                message
            });
        } catch (err) {
            // If email fails, delete user so they can try again? 
            // Or keep user and allow resend?
            // For now, keep user but return error about email
            console.error(err);
            res.status(500).json({ success: false, error: 'Email could not be sent' });
        } 
        */

        res.status(201).json({
            success: true,
            message: 'OTP generated successfully. Check server console.'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Verify OTP and Login
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        // 1. Validate fields
        if (!email || !otp) {
            return res.status(400).json({ success: false, error: 'Please provide email and OTP' });
        }

        // 2. Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // 3. Check Status (Must be PENDING_VERIFICATION)
        if (user.status !== 'PENDING_VERIFICATION') {
            return res.status(400).json({ success: false, error: 'User already verified or invalid status' });
        }

        // 4. Check Expiry
        if (user.otpExpires < Date.now()) {
            return res.status(400).json({ success: false, error: 'OTP expired' });
        }

        // 5. Compare OTP
        const isMatch = await bcrypt.compare(otp, user.otp);
        if (!isMatch) {
            return res.status(400).json({ success: false, error: 'Invalid OTP' });
        }

        // 6. Success: Update User
        user.status = 'ONBOARDING';
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        // 7. Generate Token
        const generateToken = require('../utils/generateToken');
        const token = generateToken(user._id);

        res.status(200).json({
            success: true,
            message: 'OTP verified successfully',
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                branch: user.branch
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};


// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Validate fields
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Please provide email and password' });
        }

        // 2. Find user
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // 3. Match Password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // 4. Check Status
        if (user.status === 'PENDING_VERIFICATION') {
            return res.status(401).json({ success: false, error: 'Verify your email first' });
        }

        if (user.status === 'UNDER_REVIEW') {
            return res.status(403).json({ success: false, error: 'Account under review' });
        }

        if (user.status === 'REJECTED' || user.status === 'INACTIVE') {
            return res.status(403).json({ success: false, error: 'Account not active' });
        }

        // 5. Success (ONBOARDING or ACTIVE)
        const generateToken = require('../utils/generateToken');
        const token = generateToken(user._id);

        res.status(200).json({
            success: true,
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                branch: user.branch
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};
