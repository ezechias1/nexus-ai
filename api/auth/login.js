import bcrypt from 'bcrypt';
import { query } from '../_lib/db.js';
import { generateToken, json } from '../_lib/auth.js';

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return json({ error: 'Email and password are required' }, 400);
    }

    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return json({ error: 'Invalid email or password' }, 401);
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return json({ error: 'Invalid email or password' }, 401);
    }

    const token = generateToken(user);
    return json({
      user: { id: user.id, email: user.email, name: user.name, created_at: user.created_at },
      token,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
