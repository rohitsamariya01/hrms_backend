const User = require('../models/User');
const Branch = require('../models/Branch');

// @desc    Approve User (UNDER_REVIEW -> ACTIVE)
// @route   PUT /api/admin/approve/:id
// @access  ADMIN, HR, MANAGER
exports.approveUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (user.status !== 'UNDER_REVIEW') {
            return res.status(400).json({ success: false, error: 'User is not in UNDER_REVIEW status' });
        }

        // Check if Branch and Shift are assigned
        if (!user.branch) {
            return res.status(400).json({ success: false, error: 'Cannot approve user without an assigned Branch' });
        }

        if (!user.shift) {
            return res.status(400).json({ success: false, error: 'Cannot approve user without an assigned Shift' });
        }

        user.status = 'ACTIVE';
        await user.save();

        res.status(200).json({ success: true, message: 'User approved and activated', data: user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Reject User (Any -> REJECTED)
// @route   PUT /api/admin/reject/:id
// @access  ADMIN, HR, MANAGER
exports.rejectUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        user.status = 'REJECTED';
        await user.save();

        res.status(200).json({ success: true, message: 'User rejected', data: user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Change Role
// @route   PUT /api/admin/role/:id
// @access  ADMIN, HR, MANAGER (Restricted logic inside)
exports.changeRole = async (req, res) => {
    try {
        const { role } = req.body;
        const userToUpdate = await User.findById(req.params.id);

        if (!userToUpdate) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Prevent changing own role
        if (req.user._id.toString() === req.params.id) {
            return res.status(400).json({ success: false, error: 'Cannot change your own role' });
        }

        // Prevent modifying ADMIN
        if (userToUpdate.role === 'ADMIN') {
            return res.status(403).json({ success: false, error: 'Cannot modify an ADMIN user' });
        }

        // Logic
        if (role === 'HR' || role === 'MANAGER') {
            // Only ADMIN can promote to HR/MANAGER
            if (req.user.role !== 'ADMIN') {
                return res.status(403).json({ success: false, error: 'Only ADMIN can promote to HR or MANAGER' });
            }
        } else if (role === 'TEAM_LEADER') {
            // ADMIN, HR, MANAGER can promote to TL
            // Already covered by route middleware, but can be strict here if needed
        } else if (role === 'EMPLOYEE') {
            // Demotion allowed by higher ups
        } else {
            return res.status(400).json({ success: false, error: 'Invalid role' });
        }

        userToUpdate.role = role;
        await userToUpdate.save();

        res.status(200).json({ success: true, message: `User role updated to ${role}`, data: userToUpdate });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Change Branch
// @route   PUT /api/admin/branch/:id
// @access  ADMIN, HR
exports.changeBranch = async (req, res) => {
    try {
        const { branch_id } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const branch = await Branch.findById(branch_id);
        if (!branch) {
            return res.status(404).json({ success: false, error: 'Branch not found' });
        }

        user.branch = branch_id;
        await user.save();

        res.status(200).json({ success: true, message: 'User branch updated', data: user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Get Pending Users
// @route   GET /api/admin/pending
// @access  ADMIN, HR, MANAGER
exports.getPendingUsers = async (req, res) => {
    try {
        // Find users in UNDER_REVIEW
        // Populate branch name
        const users = await User.find({ status: 'UNDER_REVIEW' }).populate('branch', 'name');

        res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};
