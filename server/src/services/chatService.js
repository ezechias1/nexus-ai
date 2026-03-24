import { query } from '../config/db.js';

export async function createChat(userId, title, model) {
  const result = await query(
    'INSERT INTO chats (user_id, title, model) VALUES ($1, $2, $3) RETURNING *',
    [userId, title || 'New Chat', model || 'gpt-3.5-turbo']
  );
  return result.rows[0];
}

export async function getUserChats(userId) {
  const result = await query(
    `SELECT c.*,
       (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
     FROM chats c
     WHERE c.user_id = $1
     ORDER BY c.updated_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function getChat(chatId, userId) {
  const result = await query('SELECT * FROM chats WHERE id = $1 AND user_id = $2', [
    chatId,
    userId,
  ]);
  if (result.rows.length === 0) {
    const err = new Error('Chat not found');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
}

export async function updateChatTitle(chatId, userId, title) {
  const result = await query(
    'UPDATE chats SET title = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
    [title, chatId, userId]
  );
  if (result.rows.length === 0) {
    const err = new Error('Chat not found');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
}

export async function deleteChat(chatId, userId) {
  const result = await query('DELETE FROM chats WHERE id = $1 AND user_id = $2 RETURNING id', [
    chatId,
    userId,
  ]);
  if (result.rows.length === 0) {
    const err = new Error('Chat not found');
    err.status = 404;
    throw err;
  }
  return true;
}
