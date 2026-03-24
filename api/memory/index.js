import { query } from '../_lib/db.js';
import { verifyToken, json, unauthorized } from '../_lib/auth.js';

// GET /api/memory
export async function GET(req) {
  const user = verifyToken(req);
  if (!user) return unauthorized();

  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category');

    let sql = 'SELECT * FROM memories WHERE user_id = $1';
    const params = [user.id];
    if (category) {
      sql += ' AND category = $2';
      params.push(category);
    }
    sql += ' ORDER BY importance DESC, updated_at DESC';

    const result = await query(sql, params);
    return json(result.rows);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// POST /api/memory
export async function POST(req) {
  const user = verifyToken(req);
  if (!user) return unauthorized();

  try {
    const { key, value, category, importance } = await req.json();
    if (!key || !value) return json({ error: 'Key and value are required' }, 400);

    const result = await query(
      `INSERT INTO memories (user_id, key, value, category, importance)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, key)
       DO UPDATE SET value = $3, category = $4, importance = $5, updated_at = NOW()
       RETURNING *`,
      [user.id, key, value, category || 'general', importance || 5]
    );
    return json(result.rows[0], 201);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
