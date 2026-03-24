import { useState, useRef, useEffect } from 'react';

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  }, [text]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="border-t border-zinc-800 bg-zinc-900 p-4">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus-within:border-nexus-500 focus-within:ring-1 focus-within:ring-nexus-500 transition-colors">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent text-white placeholder-zinc-500 resize-none focus:outline-none text-sm leading-relaxed max-h-[200px]"
          />
          <button
            type="submit"
            disabled={disabled || !text.trim()}
            className="flex-shrink-0 p-2 bg-nexus-600 hover:bg-nexus-700 disabled:opacity-30 disabled:hover:bg-nexus-600 text-white rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs text-zinc-600 mt-2">
          Nexus AI can make mistakes. Verify important information.
        </p>
      </form>
    </div>
  );
}
