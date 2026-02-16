# HRMS Backend – Attendance & Discipline System

## 🚀 Project Overview

The **HRMS Backend** is a robust, enterprise-grade system designed to manage employee attendance, shifts, and discipline with high precision. It features a strict **3-6-9 Violation Policy** to automate discipline tracking, ensuring fairness and compliance.

Key capabilities include:
- **Self-Registration & Onboarding**: Secure email-based OTP verification and role-based approval workflows.
- **Geo-Fenced Attendance**: Location-based check-in/out via mobile/web with strict radius validation.
- **Shift Management**: Flexible shift creation and assignment (Day/Night shifts).
- **Multi-Punch Support**: Handles multiple check-ins/outs per day, calculating total productive hours and breaks.
- **Auto-Checkout System**: Intelligent cron scheduler that auto-closes shifts if an employee forgets to check out, preventing data inconsistencies.
- **Discipline Engine**: Automated tracking of Late Arrivals, Early Exits, and Auto-Checkouts. Enforces the "3 Violations = 0.5 Day Deduction" rule automatically.

## 🛠️ Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) with [Mongoose](https://mongoosejs.com/)
- **Authentication**: JWT (JSON Web Tokens)
- **Time Management**: [Luxon](https://moment.github.io/luxon/) (Strict Timezone Handling)
- **Scheduling**: [Node-Cron](https://www.npmjs.com/package/node-cron) (Background Jobs)
- **Validation**: Geo-Distance Utils

## 🏗️ Architecture Overview

The system is built on a modular MVC architecture:

1.  **User Lifecycle**: `Registration (Pending)` -> `OTP Verification` -> `Approval (Active/Rejected)` -> `Shift/Branch Assignment`.
2.  **Attendance Flow**:
    - **Check-In**: Validates Status + Geo-Location + Branch Radius.
    - **Check-Out**: Validates Location + Calculates Duration + Marks Late/Early.
    - **Auto-Close**: Scheduler runs every 10 mins to check for periodic open, abandoned shifts (Shift End + 2 Hours).
3.  **Discipline Engine**:
    - Events (Late, Early, Auto-Close) trigger a `Violation` record.
    - Monthly aggregator counts violations per user.
    - **Rule**: `Math.floor(Violations / 3) * 0.5 Days = Deduction`.

## 📡 API Structure Summary

| Module | Base Path | Description |
| :--- | :--- | :--- |
| **Auth** | `/api/auth` | Register, verify OTP, login, admin approval. |
| **Admin** | `/api/admin` | User management, onboarding approvals. |
| **Shifts** | `/api/shifts` | CRUD operations for shifts. |
| **Attendance** | `/api/attendance` | Check-in, check-out, personal & branch reports. |
| **Discipline** | `/api/discipline` | Violation reports, penalty calculations. |

## 🔑 Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/attendance_db
JWT_SECRET=your_super_secret_key_here
# Email Settings (Optional for Dev, Required for OTP)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

## 🏃 check-in-checkout-system How to Run Locally

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-repo/hrms-backend.git
    cd hrms-backend
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Start MongoDB**:
    Ensure your local MongoDB instance is running.

4.  **Run the Server**:
    ```bash
    # Development Mode (Nodemon)
    npm run dev
    
    # Production Mode
    npm start
    ```

5.  **Test Endpoints**:
    Import the Postman Collection (if available) or use the API documentation to test flows.

## 🔮 Future Roadmap

- [ ] **Payroll Engine**: Auto-calculate salaries based on attendance status (Present/Half-Day/Absent).
- [ ] **Leave Management**: Leave requests, approvals, and balance tracking.
- [ ] **Offer Letter Automation**: Generate PDFs for onboarded employees.
- [ ] **Multi-Branch Analytics**: comprehensive dashboard for HR Directors.

---
*Built for High-Performance Enterprise Environments.*
