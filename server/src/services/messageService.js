import { query } from '../config/db.js';
import { getProvider } from '../config/ai.js';
import { getRelevantMemories } from './memoryService.js';

export async function getChatMessages(chatId, userId) {
  // Verify ownership
  const chat = await query('SELECT id FROM chats WHERE id = $1 AND user_id = $2', [
    chatId,
    userId,
  ]);
  if (chat.rows.length === 0) {
    const err = new Error('Chat not found');
    err.status = 404;
    throw err;
  }

  const result = await query(
    'SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC',
    [chatId]
  );
  return result.rows;
}

export async function saveMessage(chatId, userId, role, content, model, tokenUsage) {
  const result = await query(
    'INSERT INTO messages (chat_id, user_id, role, content, model, token_usage) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [chatId, userId, role, content, model, tokenUsage ? JSON.stringify(tokenUsage) : null]
  );

  // Update chat timestamp
  await query('UPDATE chats SET updated_at = NOW() WHERE id = $1', [chatId]);

  return result.rows[0];
}

export async function generateAIResponse(chatId, userId, userMessage, providerName, model) {
  // 1. Get chat history (short-term memory)
  const history = await query(
    'SELECT role, content FROM messages WHERE chat_id = $1 ORDER BY created_at ASC LIMIT 50',
    [chatId]
  );

  // 2. Get relevant long-term memories
  const memories = await getRelevantMemories(userId, userMessage);

  // 3. Build system prompt with memory injection
  let systemPrompt = `You are Nexus AI, a helpful and knowledgeable assistant. Be concise, clear, and helpful.`;

  if (memories.length > 0) {
    const memoryContext = memories
      .map((m) => `- ${m.key}: ${m.value}`)
      .join('\n');
    systemPrompt += `\n\nUser context (from memory):\n${memoryContext}\n\nUse this context to personalize your responses when relevant.`;
  }

  // 4. Assemble messages
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.rows.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  // 5. Get AI provider and generate
  const provider = getProvider(providerName);
  return provider.chat(messages, model, true); // stream=true
}

// Auto-generate chat title from first message
export async function generateChatTitle(content) {
  try {
    const provider = getProvider();
    const response = await provider.chat(
      [
        {
          role: 'system',
          content: 'Generate a short title (max 6 words) for a chat that starts with this message. Return only the title, no quotes.',
        },
        { role: 'user', content },
      ],
      null,
      false
    );
    return response.choices[0].message.content.trim();
  } catch {
    return content.substring(0, 40) + (content.length > 40 ? '...' : '');
  }
}
