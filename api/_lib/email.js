import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  // Gmail SMTP (free — requires App Password, not regular password)
  // Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in env vars
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn('Email not configured: SMTP_USER and SMTP_PASS required');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

export async function sendEmail(to, subject, html) {
  const t = getTransporter();
  if (!t) {
    console.warn('Email skipped — SMTP not configured');
    return false;
  }

  try {
    await t.sendMail({
      from: `"Nexus AI" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error('Email send failed:', err.message);
    return false;
  }
}

// Email templates
export function welcomeEmail(name) {
  return {
    subject: 'Welcome to Nexus AI',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4c6ef5;">Welcome to Nexus AI, ${escapeHtml(name)}!</h2>
        <p>Your account has been created. You can now start chatting with AI that remembers your preferences.</p>
        <p style="margin-top: 20px;">
          <a href="${process.env.APP_URL || 'https://nexus-ai-mu-black.vercel.app'}"
             style="background: #4c6ef5; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
            Start Chatting
          </a>
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">Nexus AI — Your intelligent assistant</p>
      </div>
    `,
  };
}

export function newUserNotification(name, email) {
  return {
    subject: `New Nexus AI user: ${name}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h3>New User Registration</h3>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      </div>
    `,
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
