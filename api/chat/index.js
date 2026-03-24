import { query } from '../_lib/db.js';
import { verifyToken, json, unauthorized } from '../_lib/auth.js';

// GET /api/chat — list user's chats
export async function GET(req) {
  const user = verifyToken(req);
  if (!user) return unauthorized();

  try {
    const result = await query(
      `SELECT c.*,
         (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
       FROM chats c WHERE c.user_id = $1 ORDER BY c.updated_at DESC`,
      [user.id]
    );
    return json(result.rows);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// POST /api/chat — create new chat
export async function POST(req) {
  const user = verifyToken(req);
  if (!user) return unauthorized();

  try {
    const { title, model } = await req.json();
    const result = await query(
      'INSERT INTO chats (user_id, title, model) VALUES ($1, $2, $3) RETURNING *',
      [user.id, title || 'New Chat', model || 'gpt-3.5-turbo']
    );
    return json(result.rows[0], 201);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
