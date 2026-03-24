import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import ChatInput from '../components/ChatInput';
import { api, streamMessage } from '../services/api';

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const abortRef = useRef(null);

  // Load chat list
  useEffect(() => {
    setChatsLoading(true);
    api
      .get('/chat')
      .then(setChats)
      .catch(console.error)
      .finally(() => setChatsLoading(false));
  }, []);

  // Load messages when chat changes
  useEffect(() => {
    if (chatId) {
      setMessagesLoading(true);
      api
        .get(`/chat/${chatId}/messages`)
        .then(setMessages)
        .catch(console.error)
        .finally(() => setMessagesLoading(false));
    } else {
      setMessages([]);
    }
  }, [chatId]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current();
    };
  }, []);

  const createNewChat = useCallback(async () => {
    const chat = await api.post('/chat', {});
    setChats((prev) => [chat, ...prev]);
    navigate(`/chat/${chat.id}`);
    return chat;
  }, [navigate]);

  const deleteChat = useCallback(
    async (id) => {
      await api.delete(`/chat/${id}`);
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (chatId === id) navigate('/');
    },
    [chatId, navigate]
  );

  const sendMessage = useCallback(
    async (content) => {
      let activeChatId = chatId;

      // Create a new chat if none selected
      if (!activeChatId) {
        const chat = await createNewChat();
        activeChatId = chat.id;
      }

      // Add user message to UI immediately
      const userMsgId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const userMsg = {
        id: userMsgId,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Add placeholder for assistant
      const assistantId = `temp-ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', created_at: new Date().toISOString() },
      ]);

      setStreaming(true);

      const abort = streamMessage(
        activeChatId,
        content,
        null,
        null,
        // onChunk
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))
          );
        },
        // onDone
        () => {
          setStreaming(false);
          abortRef.current = null;
          // Refresh chat list to get updated title
          api.get('/chat').then(setChats).catch(console.error);
        },
        // onError
        (err) => {
          setStreaming(false);
          abortRef.current = null;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content || `Error: ${err.message}` }
                : m
            )
          );
        }
      );

      abortRef.current = abort;
    },
    [chatId, createNewChat]
  );

  return (
    <div className="flex h-screen bg-zinc-900 dark:bg-zinc-900 bg-white">
      <Sidebar
        chats={chats}
        chatsLoading={chatsLoading}
        activeChatId={chatId}
        onNewChat={createNewChat}
        onDeleteChat={deleteChat}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="flex items-center gap-3 p-3 border-b border-zinc-800 dark:border-zinc-800 border-zinc-200 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-zinc-800 dark:hover:bg-zinc-800 hover:bg-zinc-100 rounded-lg text-zinc-400"
            aria-label="Open sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-medium text-zinc-200 dark:text-zinc-200 text-zinc-800">Nexus AI</span>
        </div>

        <ChatWindow messages={messages} streaming={streaming} loading={messagesLoading} />
        <ChatInput onSend={sendMessage} disabled={streaming} />
      </div>
    </div>
  );
}
