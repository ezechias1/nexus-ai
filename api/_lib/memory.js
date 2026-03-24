import { query } from './db.js';

export async function getRelevantMemories(userId, messageContent) {
  const keywords = messageContent
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (keywords.length === 0) {
    const result = await query(
      'SELECT * FROM memories WHERE user_id = $1 ORDER BY importance DESC LIMIT 5',
      [userId]
    );
    return result.rows;
  }

  const conditions = keywords.map((_, i) => `(LOWER(key) LIKE $${i + 2} OR LOWER(value) LIKE $${i + 2})`);
  const params = [userId, ...keywords.map((k) => `%${k}%`)];

  const result = await query(
    `SELECT * FROM memories
     WHERE user_id = $1 AND (${conditions.join(' OR ')})
     ORDER BY importance DESC LIMIT 10`,
    params
  );
  return result.rows;
}

export async function extractAndSaveMemories(userId, message) {
  const patterns = [
    { regex: /my name is (\w+)/i, key: 'user_name', category: 'personal' },
    { regex: /i (?:work|am working) (?:at|for|in) (.+?)(?:\.|,|$)/i, key: 'workplace', category: 'professional' },
    { regex: /i (?:like|love|enjoy|prefer) (.+?)(?:\.|,|$)/i, key: 'preference', category: 'preferences' },
    { regex: /i(?:'m| am) (?:a|an) (.+?)(?:\.|,|$)/i, key: 'role', category: 'personal' },
    { regex: /i live in (.+?)(?:\.|,|$)/i, key: 'location', category: 'personal' },
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern.regex);
    if (match) {
      try {
        await query(
          `INSERT INTO memories (user_id, key, value, category, importance)
           VALUES ($1, $2, $3, $4, 7)
           ON CONFLICT (user_id, key) DO UPDATE SET value = $3, updated_at = NOW()`,
          [userId, pattern.key, match[1].trim(), pattern.category]
        );
      } catch { /* silent */ }
    }
  }
}
