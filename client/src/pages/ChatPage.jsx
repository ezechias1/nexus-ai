import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import ChatInput from '../components/ChatInput';
import { api, streamMessage } from '../services/api';

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load chat list
  useEffect(() => {
    api.get('/chat').then(setChats).catch(console.error);
  }, []);

  // Load messages when chat changes
  useEffect(() => {
    if (chatId) {
      api
        .get(`/chat/${chatId}/messages`)
        .then(setMessages)
        .catch(console.error);
    } else {
      setMessages([]);
    }
  }, [chatId]);

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
      const userMsg = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Add placeholder for assistant
      const assistantId = `temp-ai-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', created_at: new Date().toISOString() },
      ]);

      setStreaming(true);

      streamMessage(
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
          // Refresh chat list to get updated title
          api.get('/chat').then(setChats).catch(console.error);
        },
        // onError
        (err) => {
          setStreaming(false);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content || `Error: ${err.message}` }
                : m
            )
          );
        }
      );
    },
    [chatId, createNewChat]
  );

  return (
    <div className="flex h-screen bg-zinc-900">
      <Sidebar
        chats={chats}
        activeChatId={chatId}
        onNewChat={createNewChat}
        onDeleteChat={deleteChat}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="flex items-center gap-3 p-3 border-b border-zinc-800 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-medium text-zinc-200">Nexus AI</span>
        </div>

        <ChatWindow messages={messages} streaming={streaming} />
        <ChatInput onSend={sendMessage} disabled={streaming} />
      </div>
    </div>
  );
}
