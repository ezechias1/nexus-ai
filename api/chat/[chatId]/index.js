import { query } from '../../_lib/db.js';
import { verifyToken, json, unauthorized } from '../../_lib/auth.js';

// GET /api/chat/[chatId]
export async function GET(req, { params }) {
  const user = verifyToken(req);
  if (!user) return unauthorized();
  const { chatId } = params;

  try {
    const result = await query('SELECT * FROM chats WHERE id = $1 AND user_id = $2', [chatId, user.id]);
    if (result.rows.length === 0) return json({ error: 'Chat not found' }, 404);
    return json(result.rows[0]);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// PATCH /api/chat/[chatId]
export async function PATCH(req, { params }) {
  const user = verifyToken(req);
  if (!user) return unauthorized();
  const { chatId } = params;

  try {
    const { title } = await req.json();
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return json({ error: 'Title is required' }, 400);
    }
    const trimmedTitle = title.trim().substring(0, 100);
    const result = await query(
      'UPDATE chats SET title = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
      [trimmedTitle, chatId, user.id]
    );
    if (result.rows.length === 0) return json({ error: 'Chat not found' }, 404);
    return json(result.rows[0]);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// DELETE /api/chat/[chatId]
export async function DELETE(req, { params }) {
  const user = verifyToken(req);
  if (!user) return unauthorized();
  const { chatId } = params;

  try {
    const result = await query('DELETE FROM chats WHERE id = $1 AND user_id = $2 RETURNING id', [chatId, user.id]);
    if (result.rows.length === 0) return json({ error: 'Chat not found' }, 404);
    return json({ message: 'Chat deleted' });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
