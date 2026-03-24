import { query } from '../config/db.js';

export async function createMemory(userId, key, value, category, importance) {
  const result = await query(
    `INSERT INTO memories (user_id, key, value, category, importance)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, key)
     DO UPDATE SET value = $3, category = $4, importance = $5, updated_at = NOW()
     RETURNING *`,
    [userId, key, value, category || 'general', importance || 5]
  );
  return result.rows[0];
}

export async function getUserMemories(userId, category) {
  let sql = 'SELECT * FROM memories WHERE user_id = $1';
  const params = [userId];

  if (category) {
    sql += ' AND category = $2';
    params.push(category);
  }

  sql += ' ORDER BY importance DESC, updated_at DESC';
  const result = await query(sql, params);
  return result.rows;
}

export async function getRelevantMemories(userId, messageContent) {
  // Keyword-based memory retrieval
  // Split the message into meaningful keywords (3+ chars)
  const keywords = messageContent
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (keywords.length === 0) {
    // Return top memories by importance
    const result = await query(
      'SELECT * FROM memories WHERE user_id = $1 ORDER BY importance DESC LIMIT 5',
      [userId]
    );
    return result.rows;
  }

  // Search memories where key or value contains any keyword
  const conditions = keywords.map((_, i) => `(LOWER(key) LIKE $${i + 2} OR LOWER(value) LIKE $${i + 2})`);
  const params = [userId, ...keywords.map((k) => `%${k}%`)];

  const result = await query(
    `SELECT *,
       (importance * 2 +
        CASE WHEN updated_at > NOW() - INTERVAL '7 days' THEN 3 ELSE 0 END
       ) as relevance_score
     FROM memories
     WHERE user_id = $1 AND (${conditions.join(' OR ')})
     ORDER BY relevance_score DESC
     LIMIT 10`,
    params
  );

  // Also include top-importance memories not already in results
  const memoryIds = result.rows.map((m) => m.id);
  const topMemories = await query(
    `SELECT * FROM memories
     WHERE user_id = $1 AND importance >= 8
     ${memoryIds.length > 0 ? `AND id NOT IN (${memoryIds.map((_, i) => `$${i + 2}`).join(',')})` : ''}
     ORDER BY importance DESC LIMIT 3`,
    [userId, ...memoryIds]
  );

  return [...result.rows, ...topMemories.rows];
}

export async function updateMemory(memoryId, userId, updates) {
  const fields = [];
  const values = [memoryId, userId];
  let idx = 3;

  if (updates.value !== undefined) {
    fields.push(`value = $${idx++}`);
    values.push(updates.value);
  }
  if (updates.category !== undefined) {
    fields.push(`category = $${idx++}`);
    values.push(updates.category);
  }
  if (updates.importance !== undefined) {
    fields.push(`importance = $${idx++}`);
    values.push(updates.importance);
  }

  if (fields.length === 0) {
    const err = new Error('No fields to update');
    err.status = 400;
    throw err;
  }

  const result = await query(
    `UPDATE memories SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    const err = new Error('Memory not found');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
}

export async function deleteMemory(memoryId, userId) {
  const result = await query('DELETE FROM memories WHERE id = $1 AND user_id = $2 RETURNING id', [
    memoryId,
    userId,
  ]);
  if (result.rows.length === 0) {
    const err = new Error('Memory not found');
    err.status = 404;
    throw err;
  }
  return true;
}

// Auto-extract memories from conversation
export async function extractAndSaveMemories(userId, userMessage, aiResponse) {
  const patterns = [
    { regex: /my name is (\w+)/i, key: 'user_name', category: 'personal' },
    { regex: /i (?:work|am working) (?:at|for|in) (.+?)(?:\.|,|$)/i, key: 'workplace', category: 'professional' },
    { regex: /i (?:like|love|enjoy|prefer) (.+?)(?:\.|,|$)/i, key: 'preference', category: 'preferences' },
    { regex: /i(?:'m| am) (?:a|an) (.+?)(?:\.|,|$)/i, key: 'role', category: 'personal' },
    { regex: /i live in (.+?)(?:\.|,|$)/i, key: 'location', category: 'personal' },
    { regex: /i speak (.+?)(?:\.|,|$)/i, key: 'languages', category: 'personal' },
  ];

  for (const pattern of patterns) {
    const match = userMessage.match(pattern.regex);
    if (match) {
      const value = match[1].trim();
      try {
        await createMemory(userId, pattern.key, value, pattern.category, 7);
      } catch {
        // Silently fail on memory extraction errors
      }
    }
  }
}
