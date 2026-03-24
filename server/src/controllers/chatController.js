import * as chatService from '../services/chatService.js';
import * as messageService from '../services/messageService.js';
import { extractAndSaveMemories } from '../services/memoryService.js';

export async function createChat(req, res, next) {
  try {
    const { title, model } = req.body;
    const chat = await chatService.createChat(req.user.id, title, model);
    res.status(201).json(chat);
  } catch (err) {
    next(err);
  }
}

export async function getUserChats(req, res, next) {
  try {
    const chats = await chatService.getUserChats(req.user.id);
    res.json(chats);
  } catch (err) {
    next(err);
  }
}

export async function getChat(req, res, next) {
  try {
    const chat = await chatService.getChat(req.params.chatId, req.user.id);
    res.json(chat);
  } catch (err) {
    next(err);
  }
}

export async function updateChat(req, res, next) {
  try {
    const { title } = req.body;
    const chat = await chatService.updateChatTitle(req.params.chatId, req.user.id, title);
    res.json(chat);
  } catch (err) {
    next(err);
  }
}

export async function deleteChat(req, res, next) {
  try {
    await chatService.deleteChat(req.params.chatId, req.user.id);
    res.json({ message: 'Chat deleted' });
  } catch (err) {
    next(err);
  }
}

export async function getMessages(req, res, next) {
  try {
    const messages = await messageService.getChatMessages(req.params.chatId, req.user.id);
    res.json(messages);
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(req, res, next) {
  try {
    const { content, provider, model } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const chatId = req.params.chatId;
    const userId = req.user.id;

    // Save user message
    await messageService.saveMessage(chatId, userId, 'user', content, null, null);

    // Check if this is the first message — auto-generate title
    const chat = await chatService.getChat(chatId, userId);
    if (chat.title === 'New Chat') {
      const title = await messageService.generateChatTitle(content);
      await chatService.updateChatTitle(chatId, userId, title);
    }

    // Generate AI response with streaming
    const stream = await messageService.generateAIResponse(chatId, userId, content, provider, model);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullResponse = '';
    let tokenUsage = null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullResponse += delta;
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }

      if (chunk.usage) {
        tokenUsage = chunk.usage;
      }

      if (chunk.choices[0]?.finish_reason === 'stop') {
        break;
      }
    }

    // Save assistant message
    const usedModel = model || chat.model || process.env.DEFAULT_AI_MODEL;
    await messageService.saveMessage(chatId, userId, 'assistant', fullResponse, usedModel, tokenUsage);

    // Extract and save memories from the conversation
    extractAndSaveMemories(userId, content, fullResponse).catch(() => {});

    res.write(`data: ${JSON.stringify({ done: true, token_usage: tokenUsage })}\n\n`);
    res.end();
  } catch (err) {
    // If headers already sent, close the stream
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    } else {
      next(err);
    }
  }
}
