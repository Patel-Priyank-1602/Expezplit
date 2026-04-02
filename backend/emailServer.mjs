/**
 * Simple Express server for sending email notifications
 * 
 * Setup:
 * 1. npm install express cors nodemailer dotenv
 * 2. Create .env file with EMAIL and APP_PASSWORD
 * 3. Run: node emailServer.mjs
 * 
 * Environment variables required:
 * - EMAIL: Your Gmail address
 * - APP_PASSWORD: Gmail App Password (16-character code from Google Account)
 * - PORT: Server port (default: 3001)
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import dns from "node:dns";

// Some networks cannot route IPv6 properly; prefer IPv4 for SMTP.
dns.setDefaultResultOrder("ipv4first");

// Debug: Check if credentials are loaded
console.log("EMAIL loaded:", process.env.EMAIL ? "✓" : "✗ MISSING");
console.log("APP_PASSWORD loaded:", process.env.APP_PASSWORD ? "✓" : "✗ MISSING");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Create nodemailer transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    family: 4,
    auth: {
      user: process.env.EMAIL,
      pass: process.env.APP_PASSWORD,
    },
  });
};

/**
 * POST /api/send-email
 * 
 * Request body:
 * {
 *   participants: [{ name: string, email: string, amount: number }],
 *   groupName: string,
 *   payerName: string,
 *   payerEmail: string,
 *   payerUpiId?: string,
 *   expenseDescription: string
 * }
 */
app.post("/api/send-email", async (req, res) => {
  try {
    const {
      participants,
      groupName,
      payerName,
      payerEmail,
      payerUpiId,
      expenseDescription,
    } = req.body;

    // Validate required fields
    if (!participants || !groupName || !payerName || !payerEmail || !expenseDescription) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    // Filter out the payer from recipients
    const recipients = participants.filter(
      (p) => p.email.toLowerCase() !== payerEmail.toLowerCase()
    );

    if (recipients.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No emails to send (payer is the only participant)",
        sent: 0,
      });
    }

    const transporter = createTransporter();
    const results = [];

    // Send email to each participant
    for (const participant of recipients) {
      const upiLine = payerUpiId
        ? `Payer UPI ID (to pay): ${payerUpiId}`
        : "Payer UPI ID (to pay): Not provided";

      const mailOptions = {
        from: process.env.EMAIL,
        to: participant.email,
        subject: `Expense Reminder - ${groupName}`,
        text: `Hi ${participant.name},

Group: ${groupName}
Who paid: ${payerName} (${payerEmail})
Who should pay now: ${participant.name} (${participant.email})
Amount to pay: ₹${participant.amount.toFixed(2)}
Pay to: ${payerName}
For: ${expenseDescription}
${upiLine}

Please settle when possible.

Thanks,
Expezplit`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Expense Reminder</h2>
            <p>Hi <strong>${participant.name}</strong>,</p>
            <p>Below are your payment details:</p>
            <table style="border-collapse: collapse; width: 100%; margin: 12px 0;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; width: 40%;"><strong>Group</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${groupName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Who paid</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${payerName} (${payerEmail})</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Who should pay now</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${participant.name} (${participant.email})</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount to pay</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong style="color: #e74c3c;">₹${participant.amount.toFixed(2)}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Pay to</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${payerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>For</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${expenseDescription}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Payer UPI ID</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${payerUpiId || "Not provided"}</td>
              </tr>
            </table>
            <p>Please settle when possible.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px;">Sent via Expezplit</p>
          </div>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        results.push({ email: participant.email, success: true });
      } catch (emailError) {
        console.error(`Failed to send email to ${participant.email}:`, emailError.message);
        results.push({ email: participant.email, success: false, error: emailError.message });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    res.status(200).json({
      success: true,
      message: `Sent ${successCount}/${recipients.length} emails`,
      sent: successCount,
      results,
    });
  } catch (error) {
    console.error("Email API error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to send emails",
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Email server running on http://localhost:${PORT}`);
});
