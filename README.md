# 💸 Expezplit

**Expezplit** is an advanced, all-in-one expense tracking and bill-splitting application. It is designed to help individuals and groups manage their finances, keep track of personal expenses, and seamlessly split shared costs (like dinners, trips, or rent) with friends and roommates. 

---

## 🔗 Live Deployments

Check out the live application on your preferred platform:
- ⚡ **Cloudflare Pages:** [expezplit.pages.dev](https://expezplit.pages.dev)
- 🌐 **Netlify:** [expezplit.netlify.app](https://expezplit.netlify.app)

---

## ✨ Comprehensive Features

Expezplit is built to handle every aspect of your shared and personal finances natively. Here is a detailed breakdown of what the application can do:

### 1. 📊 Advanced Expense Tracker & Analytics Dashboards
- **Advanced Expense Logging:** Granularly log individual and group expenses, categorize them intelligently, and keep a meticulous record of every penny spent locally and internationally.
- **Visual Insights:** Comprehensive interactive charts (powered by Recharts) showing spending habits over time.
- **Category Breakdown:** Automatically categorize your spending to see exactly where your money goes.
- **Historical Trends:** Track month-over-month expenses and deep-dive analytics through an elegant, readable UI instead of boring spreadsheets.

### 2. 🤝 Group Management & Bill Splitting
- **Dynamic Groups:** Create custom groups for roommates, trips, or specific events.
- **Fair Splitting:** Input collective bills, and the app calculates exactly who owes whom, minimizing the number of total transactions needed.
- **Debt Tracking:** See a live summary of your total owed amounts and clearly view people who currently owe you.

### 3. 📷 QR Code Magic: Instant Group Joins & Payments
- **Join Groups via QR:** Effortlessly add friends to a group by having them scan a unique group QR code. No need to type out long email invites!
- **Built-in Payment Codes:** Generate a personalized payment link/QR code for your account. No more sharing bank details or phone numbers manually.
- **In-App Camera Scanner:** Scan your friends' codes directly through the Expezplit app to instantly join their groups or securely settle debts.
- **One-Click Settlements:** Mark debts as paid smoothly within the application UI after scanning a code.

### 4. 🌍 Global Currency Support
- **Travel Ready:** Log expenses in any global fiat currency. 
- **Auto-Conversion:** The application easily handles multi-currency logs, so international trips with friends are split without any manual exchange-rate math.

### 5. 📧 Automated Email Notifications
- **Smart Alerts:** Never chase someone for money again. The app automatically sends email reminders for due payments.
- **Expense Updates:** Get notified automatically when a new expense is added to your group.
- **Secure Invites:** Send group invitations via email reliably to onboard your remote friends quickly.

### 6. 🔔 In-App Notifications
- **Instant Alerts:** Get real-time notifications directly within the app for important events like new expenses, settled debts, or group updates.

### 7. 📥 Data Export & Download
- **Download Your Data:** Easily download and export your expense history, groups, and analytics data for personal record-keeping securely.

---

## 📂 Folder Structure

The project is built as a highly scalable full-stack application and organized as follows:

```text
Expezplit/
├── backend/                  # Node.js/Express server (Microservice)
│   ├── emailServer.mjs       # Email notification logic
│   ├── package.json          # Backend dependencies
│   └── .env                  # Backend environment variables
└── frontend/                 # React frontend web application
    ├── public/               # Static assets
    ├── src/                  # Main UI components, styles, and logic
    │   ├── App.tsx           # Application entry point
    │   ├── Analytics.tsx     # Expense analysis dashboard
    │   ├── ExpenseTracker.tsx# Main expense tracking features
    │   └── ...               
    ├── package.json          # Frontend dependencies
    └── vite.config.ts        # Vite build configuration
```

---

## 🛠️ Technology Stack & Architecture

We utilized cutting-edge, modern tech to ensure a flawless experience:

- **Frontend:** **React 19 (TypeScript), Vite, CSS** — Provides a lightning-fast, highly responsive user interface with a modern component-based architecture.
- **Authentication:** **Clerk** — Handles secure user authentication, login securely without building custom risky flows.
- **Database & Backend Services:** **Supabase (PostgreSQL, Auth, Storage)** — Acts as the primary robust backend, handling the Postgres database and real-time synchronizations.
- **Data Visualization:** **Recharts** — Powers the beautiful, interactive analytics charts and line graphs.
- **QR Integrations:** **`html5-qrcode` & `qrcode.react`** — Enables the app's camera scanner and code generation natively in the browser.
- **Backend (Microservice):** **Node.js, Express.js** — Serves as a lightweight dedicated backend for custom server-side logic.
- **Email Service:** **Nodemailer** — Handles reliable automated email dispatching continuously running on the server.

---

## 🤔 Why is it Useful?
It completely removes the awkwardness and mathematical headache of figuring out "who owes what" after a group event. It serves a dual purpose by replacing standalone personal budgeting apps and complicated spreadsheet formulas. Furthermore, the built-in email alerts and QR payments mean you no longer have to chase people for payments manually—the app does the heavy lifting for you.

## 🚀 What Makes it Different?
Unlike standard expense trackers that just show a list of numbers, **Expezplit** merges robust **beautiful analytics**, **instant QR payment integrations**, and **automated email notifications** into a single premium solution. Excellent support for **all global currencies** natively sets it apart as a true travel-ready companion. The ultra-modern, dynamic UI ensures it feels much faster, more intuitive, and visually far more premium than traditional market alternatives.

## 👥 For Whom is it Used?
- **Travelers & Backpackers:** Managing shared costs across different borders and currencies efficiently.
- **Roommates:** Splitting rent, utilities, and groceries smoothly month-over-month.
- **Friend Groups:** Resolving dinner bills, outing costs, or shared event tickets.
- **Individuals:** Everyday users who just want a high-quality visualization and tracking of their personal financial health.