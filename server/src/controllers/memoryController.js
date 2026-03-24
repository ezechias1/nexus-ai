import * as memoryService from '../services/memoryService.js';

export async function createMemory(req, res, next) {
  try {
    const { key, value, category, importance } = req.body;
    if (!key || !value) {
      return res.status(400).json({ error: 'Key and value are required' });
    }
    const memory = await memoryService.createMemory(req.user.id, key, value, category, importance);
    res.status(201).json(memory);
  } catch (err) {
    next(err);
  }
}

export async function getMemories(req, res, next) {
  try {
    const { category } = req.query;
    const memories = await memoryService.getUserMemories(req.user.id, category);
    res.json(memories);
  } catch (err) {
    next(err);
  }
}

export async function updateMemory(req, res, next) {
  try {
    const { value, category, importance } = req.body;
    const memory = await memoryService.updateMemory(req.params.memoryId, req.user.id, {
      value,
      category,
      importance,
    });
    res.json(memory);
  } catch (err) {
    next(err);
  }
}

export async function deleteMemory(req, res, next) {
  try {
    await memoryService.deleteMemory(req.params.memoryId, req.user.id);
    res.json({ message: 'Memory deleted' });
  } catch (err) {
    next(err);
  }
}

export async function searchMemories(req, res, next) {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    const memories = await memoryService.getRelevantMemories(req.user.id, q);
    res.json(memories);
  } catch (err) {
    next(err);
  }
}
