const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
// Connect to database
connectDB();

// Start Scheduler
const startScheduler = require('./services/schedulerService');
startScheduler();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.get('/', (req, res) => {
    res.send('API is running...');
});

app.use('/api/branch', require('./routes/branchRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/onboarding', require('./routes/onboardingRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/shifts', require('./routes/shiftRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/discipline', require('./routes/disciplineRoutes'));




// Temporary Test Route
// Temporary Test Route
const { protect } = require('./middleware/authMiddleware');
const { protectActiveOnly } = require('./middleware/statusMiddleware');

app.get('/api/test/protected', protect, protectActiveOnly, (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Protected route accessed',
        user: req.user
    });
});




const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
