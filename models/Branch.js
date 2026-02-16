const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a branch name'],
        unique: true,
        trim: true,
        index: true
    },
    timezone: {
        type: String,
        required: [true, 'Please add a timezone'],
        default: 'Asia/Kolkata'
    },
    latitude: {
        type: Number,
        required: [true, 'Please add latitude']
    },
    longitude: {
        type: Number,
        required: [true, 'Please add longitude']
    },
    radiusInMeters: {
        type: Number,
        default: 100
    },
    searchRadius: {
        type: Number,
        default: 500
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Branch', branchSchema);
