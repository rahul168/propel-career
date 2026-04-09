import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? "support@propel8.com";
const SUPPORT_EMAIL = "support@propel8.com";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

function isConfigured(): boolean {
  return Boolean(SENDGRID_API_KEY);
}

export interface SupportTicketEmailParams {
  ticketId: string;
  userEmail: string;
  subject: string;
  category: string;
  message: string;
}

/** Notify the support team that a new ticket was submitted. */
export async function sendAdminTicketNotification(params: SupportTicketEmailParams) {
  if (!isConfigured()) {
    console.warn("[email] SENDGRID_API_KEY not set — skipping admin notification");
    return;
  }

  const categoryLabel = params.category.charAt(0).toUpperCase() + params.category.slice(1);

  await sgMail.send({
    to: SUPPORT_EMAIL,
    from: FROM_EMAIL,
    subject: `[Support] ${params.subject}`,
    text: [
      `New support ticket received.`,
      ``,
      `Ticket ID : ${params.ticketId}`,
      `From      : ${params.userEmail}`,
      `Category  : ${categoryLabel}`,
      `Subject   : ${params.subject}`,
      ``,
      `Message`,
      `-------`,
      params.message,
    ].join("\n"),
    html: `
      <p>A new support ticket has been submitted.</p>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
        <tr><td style="color:#64748b;padding-right:16px">Ticket ID</td><td><code>${params.ticketId}</code></td></tr>
        <tr><td style="color:#64748b;padding-right:16px">From</td><td>${params.userEmail}</td></tr>
        <tr><td style="color:#64748b;padding-right:16px">Category</td><td>${categoryLabel}</td></tr>
        <tr><td style="color:#64748b;padding-right:16px">Subject</td><td>${params.subject}</td></tr>
      </table>
      <br/>
      <p style="color:#64748b;margin-bottom:4px"><strong>Message</strong></p>
      <p style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px">${params.message}</p>
    `,
  });
}

/** Send a confirmation email to the user who submitted the ticket. */
export async function sendUserTicketConfirmation(params: SupportTicketEmailParams) {
  if (!isConfigured()) {
    console.warn("[email] SENDGRID_API_KEY not set — skipping user confirmation");
    return;
  }

  await sgMail.send({
    to: params.userEmail,
    from: FROM_EMAIL,
    subject: `We received your support request — ${params.subject}`,
    text: [
      `Hi,`,
      ``,
      `Thanks for reaching out! We've received your support ticket and will get back to you within 1–2 business days.`,
      ``,
      `Ticket ID : ${params.ticketId}`,
      `Subject   : ${params.subject}`,
      ``,
      `If your issue is urgent, you can also reply directly to this email.`,
      ``,
      `— The Propel8Career Team`,
    ].join("\n"),
    html: `
      <p>Hi,</p>
      <p>Thanks for reaching out! We've received your support ticket and will get back to you within <strong>1–2 business days</strong>.</p>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
        <tr><td style="color:#64748b;padding-right:16px">Ticket ID</td><td><code>${params.ticketId}</code></td></tr>
        <tr><td style="color:#64748b;padding-right:16px">Subject</td><td>${params.subject}</td></tr>
      </table>
      <br/>
      <p style="color:#64748b;font-size:13px">If your issue is urgent, you can reply directly to this email.</p>
      <p>— The Propel8Career Team</p>
    `,
  });
}
