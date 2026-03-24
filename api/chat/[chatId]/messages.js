import { query } from '../../_lib/db.js';
import { verifyToken, json, unauthorized } from '../../_lib/auth.js';
import { getClient } from '../../_lib/ai.js';
import { getRelevantMemories, extractAndSaveMemories } from '../../_lib/memory.js';

// GET /api/chat/[chatId]/messages
export async function GET(req, { params }) {
  const user = verifyToken(req);
  if (!user) return unauthorized();
  const { chatId } = params;

  try {
    const chat = await query('SELECT id FROM chats WHERE id = $1 AND user_id = $2', [chatId, user.id]);
    if (chat.rows.length === 0) return json({ error: 'Chat not found' }, 404);

    const result = await query(
      'SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC',
      [chatId]
    );
    return json(result.rows);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// POST /api/chat/[chatId]/messages — send message + stream AI response
export async function POST(req, { params }) {
  const user = verifyToken(req);
  if (!user) return unauthorized();
  const { chatId } = params;

  try {
    const { content, provider, model } = await req.json();
    if (!content || typeof content !== 'string') {
      return json({ error: 'Message content is required' }, 400);
    }
    if (content.length > 10000) {
      return json({ error: 'Message too long (max 10000 chars)' }, 400);
    }

    // Verify chat ownership
    const chatResult = await query('SELECT * FROM chats WHERE id = $1 AND user_id = $2', [chatId, user.id]);
    if (chatResult.rows.length === 0) return json({ error: 'Chat not found' }, 404);
    const chat = chatResult.rows[0];

    // Save user message
    await query(
      'INSERT INTO messages (chat_id, user_id, role, content) VALUES ($1, $2, $3, $4)',
      [chatId, user.id, 'user', content]
    );

    // Auto-generate title on first message
    if (chat.title === 'New Chat') {
      const titleSnippet = content.substring(0, 50) + (content.length > 50 ? '...' : '');
      await query('UPDATE chats SET title = $1 WHERE id = $2', [titleSnippet, chatId]);
    }

    // Get chat history (limit to recent 50 messages for context window)
    const history = await query(
      'SELECT role, content FROM messages WHERE chat_id = $1 ORDER BY created_at ASC LIMIT 50',
      [chatId]
    );

    // Get relevant memories
    const memories = await getRelevantMemories(user.id, content);

    // Build system prompt with memory injection
    let systemPrompt = 'You are Nexus AI, a helpful and knowledgeable assistant. Be concise, clear, and helpful.';
    if (memories.length > 0) {
      const memCtx = memories.map((m) => `- ${m.key}: ${m.value}`).join('\n');
      systemPrompt += `\n\nUser context (from memory):\n${memCtx}\n\nUse this context to personalize your responses when relevant.`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.rows.map((m) => ({ role: m.role, content: m.content })),
    ];

    // Stream AI response
    const { client, defaultModel } = getClient(provider);
    const usedModel = model || chat.model || defaultModel;

    const stream = await client.chat.completions.create({
      model: usedModel,
      messages,
      stream: true,
      max_tokens: 2048,
    });

    const encoder = new TextEncoder();
    let fullResponse = '';

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              fullResponse += delta;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`));
            }
            if (chunk.choices[0]?.finish_reason === 'stop') break;
          }
        } catch (streamErr) {
          const errMsg = streamErr.message || 'Stream error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`));
          console.error('Stream error:', errMsg);
        } finally {
          // Always save the assistant message (even partial on error)
          if (fullResponse) {
            try {
              await query(
                'INSERT INTO messages (chat_id, user_id, role, content, model) VALUES ($1, $2, $3, $4, $5)',
                [chatId, user.id, 'assistant', fullResponse, usedModel]
              );
              await query('UPDATE chats SET updated_at = NOW() WHERE id = $1', [chatId]);
            } catch (dbErr) {
              console.error('Failed to save assistant message:', dbErr.message);
            }
          }

          // Extract memories from the conversation
          extractAndSaveMemories(user.id, content, fullResponse).catch((err) => {
            console.error('Memory extraction failed:', err.message);
          });

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('Message POST error:', err.message);
    return json({ error: err.message }, 500);
  }
}
