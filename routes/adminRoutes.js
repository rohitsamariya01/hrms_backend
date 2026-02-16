const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const {
    getPendingUsers,
    approveUser,
    rejectUser,
    changeRole,
    changeBranch
} = require('../controllers/adminController');

// All routes are protected and restricted to minimal roles
router.use(protect);

// Get Pending Users (ADMIN, HR, MANAGER)
router.get('/pending', authorize('ADMIN', 'HR', 'MANAGER'), getPendingUsers);

// Approve User (ADMIN, HR, MANAGER)
router.put('/approve/:id', authorize('ADMIN', 'HR', 'MANAGER'), approveUser);

// Reject User (ADMIN, HR, MANAGER)
router.put('/reject/:id', authorize('ADMIN', 'HR', 'MANAGER'), rejectUser);

// Change Role (ADMIN, HR, MANAGER - Controller has more logic)
router.put('/role/:id', authorize('ADMIN', 'HR', 'MANAGER'), changeRole);

// Change Branch (ADMIN, HR)
// Note: Manager might not have permission to change branch
router.put('/branch/:id', authorize('ADMIN', 'HR'), changeBranch);

module.exports = router;
