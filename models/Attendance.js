const mongoose = require('mongoose');

const punchSchema = new mongoose.Schema({
    checkIn: {
        type: Date,
        required: true
    },
    checkInLocation: {
        latitude: Number,
        longitude: Number
    },
    checkOut: {
        type: Date
    },
    checkOutLocation: {
        latitude: Number,
        longitude: Number
    },
    autoClosed: {
        type: Boolean,
        default: false
    }
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: true
    },
    shift: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shift',
        required: true
    },
    date: {
        type: Date, // Branch Timezone Midnight
        required: true
    },
    punches: [punchSchema],
    totalWorkingMinutes: {
        type: Number,
        default: 0
    },
    totalBreakMinutes: {
        type: Number,
        default: 0
    },
    lateMarked: {
        type: Boolean,
        default: false
    },
    earlyExitMarked: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['PRESENT', 'HALF_DAY', 'ABSENT'], // LEAVE removed as per specific request
        default: 'PRESENT'
    }
}, {
    timestamps: true
});

// Compound index: One attendance document per user per day
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
