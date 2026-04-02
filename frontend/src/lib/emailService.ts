/**
 * Email Service - Frontend utility to send expense notifications
 */

const EMAIL_API_URL = import.meta.env.VITE_EMAIL_API_URL || "http://localhost:3001";

export interface EmailParticipant {
  name: string;
  email: string;
  amount: number;
}

export interface SendEmailRequest {
  participants: EmailParticipant[];
  groupName: string;
  payerName: string;
  payerEmail: string;
  payerUpiId?: string | null;
  expenseDescription: string;
}

export interface SendEmailResponse {
  success: boolean;
  message?: string;
  sent?: number;
  error?: string;
}

/**
 * Sends email notifications to all participants (excluding payer)
 * Call this after successfully saving an expense to Supabase
 */
export async function sendExpenseEmailNotifications(
  request: SendEmailRequest
): Promise<SendEmailResponse> {
  try {
    const response = await fetch(`${EMAIL_API_URL}/api/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Email API error:", data.error);
      return { success: false, error: data.error || "Failed to send emails" };
    }

    return data;
  } catch (error) {
    console.error("Failed to send email notifications:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
