import bcrypt from 'bcrypt';
import { query } from '../_lib/db.js';
import { generateToken, json } from '../_lib/auth.js';

export async function POST(req) {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password || !name) {
      return json({ error: 'Email, password, and name are required' }, 400);
    }
    if (password.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400);
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return json({ error: 'Email already registered' }, 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
      [email, passwordHash, name]
    );

    const user = result.rows[0];
    const token = generateToken(user);
    return json({ user, token }, 201);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
