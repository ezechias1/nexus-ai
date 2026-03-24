import { query } from '../_lib/db.js';
import { verifyToken, json, unauthorized } from '../_lib/auth.js';

// PATCH /api/memory/[memoryId]
export async function PATCH(req, { params }) {
  const user = verifyToken(req);
  if (!user) return unauthorized();
  const { memoryId } = params;

  try {
    const { value, category, importance } = await req.json();
    const fields = [];
    const values = [memoryId, user.id];
    let idx = 3;

    if (value !== undefined) { fields.push(`value = $${idx++}`); values.push(value); }
    if (category !== undefined) { fields.push(`category = $${idx++}`); values.push(category); }
    if (importance !== undefined) { fields.push(`importance = $${idx++}`); values.push(importance); }

    if (fields.length === 0) return json({ error: 'No fields to update' }, 400);

    const result = await query(
      `UPDATE memories SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
      values
    );
    if (result.rows.length === 0) return json({ error: 'Memory not found' }, 404);
    return json(result.rows[0]);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// DELETE /api/memory/[memoryId]
export async function DELETE(req, { params }) {
  const user = verifyToken(req);
  if (!user) return unauthorized();
  const { memoryId } = params;

  try {
    const result = await query('DELETE FROM memories WHERE id = $1 AND user_id = $2 RETURNING id', [memoryId, user.id]);
    if (result.rows.length === 0) return json({ error: 'Memory not found' }, 404);
    return json({ message: 'Memory deleted' });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
