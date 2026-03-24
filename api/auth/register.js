import bcrypt from 'bcrypt';
import { query } from '../_lib/db.js';
import { generateToken, json } from '../_lib/auth.js';
import { sendEmail, welcomeEmail, newUserNotification } from '../_lib/email.js';

export async function POST(req) {
  try {
    const { email, password, name } = await req.json();

    // Input validation
    if (!email || !password || !name) {
      return json({ error: 'Email, password, and name are required' }, 400);
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Invalid email format' }, 400);
    }
    if (email.length > 255) {
      return json({ error: 'Email too long' }, 400);
    }
    if (typeof password !== 'string' || password.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400);
    }
    if (password.length > 128) {
      return json({ error: 'Password too long' }, 400);
    }
    if (typeof name !== 'string' || name.trim().length < 1 || name.length > 100) {
      return json({ error: 'Name must be 1-100 characters' }, 400);
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return json({ error: 'Email already registered' }, 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
      [email.toLowerCase(), passwordHash, name.trim()]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    // Send welcome email to user (non-blocking)
    const welcome = welcomeEmail(name.trim());
    sendEmail(email.toLowerCase(), welcome.subject, welcome.html).catch(() => {});

    // Notify admin of new registration (non-blocking)
    if (process.env.ADMIN_EMAIL) {
      const notification = newUserNotification(name.trim(), email.toLowerCase());
      sendEmail(process.env.ADMIN_EMAIL, notification.subject, notification.html).catch(() => {});
    }

    return json({ user, token }, 201);
  } catch (err) {
    console.error('Register error:', err.message);
    return json({ error: 'Registration failed' }, 500);
  }
}
