import { Router } from 'express';
import {
  createMemory,
  getMemories,
  updateMemory,
  deleteMemory,
  searchMemories,
} from '../controllers/memoryController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/', createMemory);
router.get('/', getMemories);
router.get('/search', searchMemories);
router.patch('/:memoryId', updateMemory);
router.delete('/:memoryId', deleteMemory);

export default router;
