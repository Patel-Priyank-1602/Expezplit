/**
 * Email Sending Handler
 *
 * Extracted from the original emailServer.mjs — same Nodemailer logic,
 * but now runs as a BullMQ job with automatic retries and exponential backoff.
 *
 * The worker calls this function for each job in the "email-queue".
 */

import nodemailer from "nodemailer";
import dns from "node:dns";
import { emailsSent } from "../../shared/metrics.js";
import { captureException } from "../../shared/sentry.js";

// Prefer IPv4 for SMTP (some networks can't route IPv6 properly)
dns.setDefaultResultOrder("ipv4first");

/**
 * Create a Nodemailer transporter using Gmail SMTP.
 */
function createTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    family: 4,
    auth: {
      user: process.env.EMAIL || process.env.EMAIL_USER,
      pass: process.env.APP_PASSWORD || process.env.EMAIL_PASS,
    },
  });
}

/**
 * Process a single email-queue job.
 *
 * Job data shape (same as the original POST /api/send-email body):
 * {
 *   participants: [{ name, email, amount }],
 *   groupName, payerName, payerEmail, payerUpiId?, expenseDescription
 * }
 */
export async function sendExpenseEmail(data) {
  const {
    participants,
    groupName,
    payerName,
    payerEmail,
    payerUpiId,
    expenseDescription,
  } = data;

  const transporter = createTransporter();
  const results = [];

  for (const participant of participants) {
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
      emailsSent.inc({ status: "success" });
      console.log(`[Email] ✓ Sent to ${participant.email}`);
    } catch (emailError) {
      console.error(`[Email] ✗ Failed to send to ${participant.email}:`, emailError.message);
      captureException(emailError, { recipient: participant.email, groupName });
      emailsSent.inc({ status: "failure" });
      results.push({ email: participant.email, success: false, error: emailError.message });
      // Throw to trigger BullMQ retry on failure
      throw emailError;
    }
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(`[Email] Job complete: ${successCount}/${participants.length} emails sent`);
  return { sent: successCount, total: participants.length, results };
}
