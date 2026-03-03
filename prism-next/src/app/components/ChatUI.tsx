import React from 'react';
import { Send } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatUIProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  sendLabel?: string;
}

export function ChatUI({
  messages,
  onSendMessage,
  placeholder = "메시지를 입력하세요...",
  disabled = false,
  sendLabel = '전송',
}: ChatUIProps) {
  const [input, setInput] = React.useState('');
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  React.useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [input]);

  const handleSend = () => {
    if (disabled) return;
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className="flex"
            style={{
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            <div
              className="max-w-[80%] px-4 py-3 rounded-lg text-[14px] leading-relaxed"
              style={{
                backgroundColor: message.role === 'user' ? 'var(--color-accent)' : 'var(--color-bg-card)',
                color: 'var(--color-text-primary)',
                border: message.role === 'assistant' ? '1px solid var(--color-border)' : 'none'
              }}
            >
              {message.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 px-4 py-3 rounded-lg text-[14px] leading-relaxed"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            opacity: disabled ? 0.75 : 1,
            resize: 'none',
            overflowY: 'auto',
          }}
        />
        <button
          onClick={handleSend}
          disabled={disabled}
          className="px-5 py-3 rounded-lg text-[14px] transition-colors flex items-center gap-2"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-text-primary)',
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <Send className="w-4 h-4" style={{ strokeWidth: 1.5 }} />
          {sendLabel}
        </button>
      </div>
    </div>
  );
}
