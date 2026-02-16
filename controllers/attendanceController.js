const Attendance = require('../models/Attendance');
const Branch = require('../models/Branch');
const Shift = require('../models/Shift');
const User = require('../models/User');
const Violation = require('../models/Violation');
const { calculateDistance } = require('../utils/geoUtils');
const { DateTime } = require('luxon');

// Helper to convert HH:mm string to minutes from start of day
const toMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

// ... checkIn function (unchanged) ...
// @desc    Check In
// @route   POST /api/attendance/check-in
// @access  Private (Active Users)
exports.checkIn = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, error: 'Location (latitude, longitude) is required' });
        }

        const user = req.user;

        // 1. Status Check
        if (user.status !== 'ACTIVE') {
            return res.status(403).json({ success: false, error: 'User is not ACTIVE' });
        }

        // 2. Branch/Shift Check
        if (!user.branch || !user.shift) {
            return res.status(400).json({ success: false, error: 'User must have an assigned Branch and Shift' });
        }

        // 3. Radius Validation
        const branch = await Branch.findById(user.branch);
        if (!branch) {
            return res.status(404).json({ success: false, error: 'Branch not found' });
        }

        const branchLat = branch.location.coordinates[1];
        const branchLng = branch.location.coordinates[0];

        const dist = calculateDistance(
            latitude,
            longitude,
            branchLat,
            branchLng
        );

        if (dist > branch.radius) {
            return res.status(400).json({
                success: false,
                error: `You are outside the allowed radius (${Math.round(dist)}m > ${branch.radius}m)`
            });
        }

        // 4. Timezone & Date
        const timezone = branch.timezone || 'UTC';
        const now = DateTime.now().setZone(timezone);
        const todayMidnight = now.startOf('day').toJSDate();

        // 5. Find Attendance
        let attendance = await Attendance.findOne({
            user: user._id,
            date: todayMidnight
        });

        // 6. Check Logic
        if (attendance) {
            // Check if last punch is open
            const lastPunch = attendance.punches[attendance.punches.length - 1];
            if (lastPunch && !lastPunch.checkOut) {
                return res.status(400).json({ success: false, error: 'You are already checked in. Please check out first.' });
            }

            // Add new punch
            attendance.punches.push({
                checkIn: new Date(),
                checkInLocation: { latitude, longitude }
            });
        } else {
            // Create new
            attendance = new Attendance({
                user: user._id,
                branch: user.branch,
                shift: user.shift,
                date: todayMidnight,
                status: 'PRESENT', // Initial status, updated on checkout
                punches: [{
                    checkIn: new Date(),
                    checkInLocation: { latitude, longitude }
                }]
            });
        }

        await attendance.save();

        res.status(200).json({ success: true, message: 'Checked In Successfully', data: attendance });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Check Out
// @route   POST /api/attendance/check-out
// @access  Private (Active Users)
exports.checkOut = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, error: 'Location (latitude, longitude) is required' });
        }

        const user = await User.findById(req.user._id); // Re-fetch to get lateCount/earlyExitCount access

        if (user.status !== 'ACTIVE') {
            return res.status(403).json({ success: false, error: 'User is not ACTIVE' });
        }

        const branch = await Branch.findById(user.branch);
        if (!branch) {
            return res.status(404).json({ success: false, error: 'Branch not found' });
        }

        // Radius Check
        const branchLat = branch.location.coordinates[1];
        const branchLng = branch.location.coordinates[0];
        const dist = calculateDistance(latitude, longitude, branchLat, branchLng);

        if (dist > branch.radius) {
            return res.status(400).json({
                success: false,
                error: `You are outside the allowed radius (${Math.round(dist)}m > ${branch.radius}m)`
            });
        }

        // Timezone
        const timezone = branch.timezone || 'UTC';
        const now = DateTime.now().setZone(timezone);
        const todayMidnight = now.startOf('day').toJSDate();

        const attendance = await Attendance.findOne({
            user: user._id,
            date: todayMidnight
        });

        if (!attendance) {
            return res.status(400).json({ success: false, error: 'No attendance record found.' });
        }

        const lastPunch = attendance.punches[attendance.punches.length - 1];
        if (!lastPunch || lastPunch.checkOut) {
            return res.status(400).json({ success: false, error: 'You are not checked in.' });
        }

        // 1. Close Punch
        lastPunch.checkOut = new Date();
        lastPunch.checkOutLocation = { latitude, longitude };

        // 2. Fetch Shift & Calc Times
        const shift = await Shift.findById(user.shift);
        if (!shift) {
            // Should not happen, but safe fallback
            await attendance.save();
            return res.status(200).json({ success: true, message: 'Checked Out', data: attendance });
        }

        // --- DURATION CALCULATION ---

        let totalWorkingMs = 0;
        let totalBreakMs = 0;

        // Calculate totals from ALL punches
        for (let i = 0; i < attendance.punches.length; i++) {
            const punch = attendance.punches[i];
            if (punch.checkIn && punch.checkOut) {
                totalWorkingMs += (new Date(punch.checkOut) - new Date(punch.checkIn));
            }

            // Break time: Gap between previous checkOut and current checkIn
            if (i > 0) {
                const prevPunch = attendance.punches[i - 1];
                if (prevPunch.checkOut && punch.checkIn) {
                    totalBreakMs += (new Date(punch.checkIn) - new Date(prevPunch.checkOut));
                }
            }
        }

        attendance.totalWorkingMinutes = Math.floor(totalWorkingMs / 1000 / 60);
        attendance.totalBreakMinutes = Math.floor(totalBreakMs / 1000 / 60);

        // --- LATE / EARLY LOGIC ---

        // Convert Shift Times to Date for Today (using luxon for TZ accuracy)
        const shiftStartParts = shift.startTime.split(':');
        const shiftEndParts = shift.endTime.split(':');

        const shiftStart = now.set({ hour: parseInt(shiftStartParts[0]), minute: parseInt(shiftStartParts[1]), second: 0, millisecond: 0 });
        const shiftEnd = now.set({ hour: parseInt(shiftEndParts[0]), minute: parseInt(shiftEndParts[1]), second: 0, millisecond: 0 });

        // A. Late Arrival (Check First Punch)
        if (!attendance.lateMarked && attendance.punches.length > 0) {
            const firstCheckIn = DateTime.fromJSDate(attendance.punches[0].checkIn).setZone(timezone);
            const lateThreshold = shiftStart.plus({ minutes: shift.allowedLateMinutes });

            if (firstCheckIn > lateThreshold) {
                attendance.lateMarked = true;
                user.lateCount += 1;
            }
        }

        // B. Early Exit (Check Last Punch)
        const lastCheckOut = DateTime.fromJSDate(lastPunch.checkOut).setZone(timezone);
        const earlyThreshold = shiftEnd.minus({ minutes: shift.allowedEarlyExitMinutes });

        // Logic: 
        // If checking out BEFORE threshold -> Early Exit. 
        // If previously marked early but now (latest punch) is AFTER threshold -> We assume they came back? 
        // Or simpler: Just check current situation.

        if (lastCheckOut < earlyThreshold) {
            if (!attendance.earlyExitMarked) {
                attendance.earlyExitMarked = true;
                user.earlyExitCount += 1;
                // Create Violation Record
                await Violation.create({
                    user: user._id,
                    branch: user.branch,
                    attendance: attendance._id,
                    type: 'EARLY_EXIT',
                    date: todayMidnight,
                    month: now.month,
                    year: now.year
                });
            }
        } else {
            // They left on time (or late).
            // If previously marked early (e.g. from a midday punch), should we revert? 
            // "Multi-punch" implies they might embrace a split shift or breaks. 
            // If they finish the day properly, they shouldn't be penalized for "Early Exit" on an intermediate punch.
            if (attendance.earlyExitMarked) {
                attendance.earlyExitMarked = false;
                user.earlyExitCount = Math.max(0, user.earlyExitCount - 1);

                // Optional: Remove violation.
                await Violation.deleteOne({
                    attendance: attendance._id,
                    type: 'EARLY_EXIT'
                });
            }
        }

        // --- STATUS CALCULATION ---

        const shiftDurationMinutes = toMinutes(shift.endTime) - toMinutes(shift.startTime);
        // Note: Assumes day shift. Safe as per current limitations.

        // 3-Lates Penalty Rule
        if (user.lateCount >= 3) {
            attendance.status = 'HALF_DAY';
            user.lateCount -= 3; // Reset block
        } else {
            // Duration Rules
            const percentage = attendance.totalWorkingMinutes / shiftDurationMinutes;

            if (percentage >= 0.99) { // Tolerance for tiny gaps 
                attendance.status = 'PRESENT';
            } else if (percentage >= 0.5) {
                attendance.status = 'HALF_DAY';
            } else {
                attendance.status = 'ABSENT';
                // Note: Usually "ABSENT" is default if < some threshold, or "PRESENT" but Short Hours. 
                // Requirement: "< 50% -> ABSENT"
            }
        }

        await attendance.save();
        await user.save();

        res.status(200).json({ success: true, message: 'Checked Out Successfully', data: attendance });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};
// @desc    Get My Attendance History
// @route   GET /api/attendance/my
// @access  Private (Active Users)
exports.getMyAttendance = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const startIndex = (page - 1) * limit;

        const total = await Attendance.countDocuments({ user: req.user._id });

        const attendance = await Attendance.find({ user: req.user._id })
            .sort({ date: -1 }) // Newest first
            .skip(startIndex)
            .limit(limit)
            .populate('branch', 'name')
            .populate('shift', 'name startTime endTime');

        res.status(200).json({
            success: true,
            count: attendance.length,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            },
            data: attendance
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Get Branch Attendance (Admin/HR)
// @route   GET /api/attendance/branch/:branchId
// @access  Private (ADMIN, HR)
exports.getBranchAttendance = async (req, res) => {
    try {
        const { branchId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20; // Default larger limit for reports
        const startIndex = (page - 1) * limit;

        // Security: HR can only view their own branch
        if (req.user.role === 'HR' && req.user.branch.toString() !== branchId) {
            return res.status(403).json({ success: false, error: 'Not authorized to view other branches' });
        }

        const stats = { branch: branchId };

        // Optional Date Filter ?date=YYYY-MM-DD
        if (req.query.date) {
            const queryDate = DateTime.fromISO(req.query.date).toJSDate();
            // Note: This matches exact midnight ISODate if passed correctly. 
            // Better: Range query for the day? 
            // Current Model stores "Midnight UTC" representing the day. 
            // If query matches that UTC Midnight, it works.
            // Let's assume frontend sends YYYY-MM-DD. 
            // We need to know branch timezone to construct the correct midnight.
            // For simplicity in this step, exact match on Date (if provided as ISO) or just simple sort.
            // Re-reading requirement: "GET /api/attendance/date/:date" is separate. 
            // This endpoint is "All attendance for branch" (paginated).
        }

        const total = await Attendance.countDocuments(stats);

        const attendance = await Attendance.find(stats)
            .sort({ date: -1 })
            .skip(startIndex)
            .limit(limit)
            .populate('user', 'name email role')
            .populate('shift', 'name startTime endTime');

        res.status(200).json({
            success: true,
            count: attendance.length,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            },
            data: attendance
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Get Attendance By Date (Admin/HR)
// @route   GET /api/attendance/date/:date
// @access  Private (ADMIN, HR)
exports.getAttendanceByDate = async (req, res) => {
    try {
        const dateStr = req.params.date; // YYYY-MM-DD
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const startIndex = (page - 1) * limit;

        // We need to find all attendance documents where the "date" field (which is Midnight UTC)
        // corresponds to this calendar date. 
        // Issue: Different branches have different midnights. 
        // "2026-02-16" in India is different absolute time than "2026-02-16" in USA.
        // Option 1: Filter by user's branch timezone?
        // Option 2: Frontend sends specific ISO timestamp?
        // Option 3 (Robust): We search for range [Start of Day Max East, End of day Max West].
        // Option 4 (Simple): We assume the query is for the Requester's Branch Timezone context.

        let query = {};

        if (req.user.role === 'HR') {
            query.branch = req.user.branch;
        } else if (req.user.role === 'ADMIN' && req.query.branchId) {
            query.branch = req.query.branchId;
        }

        // If we have a branch, we can get precise timezone midnight.
        if (query.branch) {
            const branch = await Branch.findById(query.branch);
            if (branch) {
                const tz = branch.timezone || 'UTC';
                const dt = DateTime.fromISO(dateStr, { zone: tz }).startOf('day').toJSDate();
                query.date = dt;
            }
        } else {
            // ADMIN querying ALL branches for a date? 
            // Complex because "2026-02-16" means different absolute times.
            // For now, let's restrict ADMIN to provide a branchId OR we accept lax matching (not implemented here).
            // Let's enforce branchId for ADMIN if date is specific, or just allow querying if logic permits.
            // Simplified: If no branch context, we might miss alignment. 
            // Return error if ADMIN doesn't specify branch? 
            // Requirement didn't specify. I will assume simplified logic: 
            // If ADMIN and no branch specific, maybe standard UTC day? 
            // Let's stick to "Requester's Branch" logic for HR, and require Branch for ADMIN or default to UTC.
            const dt = DateTime.fromISO(dateStr, { zone: 'UTC' }).startOf('day').toJSDate();
            // This might find only UTC-based branches. 
            // FIX: If ADMIN, let's just accept they might need to pass branchId query.
        }

        const total = await Attendance.countDocuments(query);

        const attendance = await Attendance.find(query)
            .skip(startIndex)
            .limit(limit)
            .populate('user', 'name email')
            .populate('branch', 'name')
            .populate('shift', 'name');

        res.status(200).json({
            success: true,
            count: attendance.length,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            },
            data: attendance
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};
