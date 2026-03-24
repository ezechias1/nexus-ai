import { query } from '../_lib/db.js';
import { verifyToken, json, unauthorized } from '../_lib/auth.js';

export async function GET(req) {
  const user = verifyToken(req);
  if (!user) return unauthorized();

  try {
    const result = await query(
      'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = $1',
      [user.id]
    );
    if (result.rows.length === 0) return json({ error: 'User not found' }, 404);
    return json(result.rows[0]);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
