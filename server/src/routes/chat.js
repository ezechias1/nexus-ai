import { Router } from 'express';
import {
  createChat,
  getUserChats,
  getChat,
  updateChat,
  deleteChat,
  getMessages,
  sendMessage,
} from '../controllers/chatController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/', createChat);
router.get('/', getUserChats);
router.get('/:chatId', getChat);
router.patch('/:chatId', updateChat);
router.delete('/:chatId', deleteChat);
router.get('/:chatId/messages', getMessages);
router.post('/:chatId/messages', sendMessage);

export default router;
