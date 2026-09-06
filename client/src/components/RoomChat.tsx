import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { ChatMessage } from '@geoguess/shared';
import { sendChat } from '../socket';

type Props = {
  messages: ChatMessage[];
  selfId: string | null;
  collapsed?: boolean;
};

export default function RoomChat({ messages, selfId, collapsed = false }: Props) {
  const [open, setOpen] = useState(!collapsed);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setError(null);
    try {
      await sendChat(value);
      setText('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className={`room-chat ${open ? 'open' : ''}`}>
      <button type="button" className="room-chat-toggle" onClick={() => setOpen((v) => !v)}>
        Chat{messages.length ? ` (${messages.length})` : ''}
      </button>
      {open && (
        <div className="room-chat-panel">
          <div className="room-chat-list" ref={listRef}>
            {messages.length === 0 && <p className="muted">No messages yet</p>}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`room-chat-msg ${m.playerId === selfId ? 'mine' : ''}`}
              >
                <strong>{m.nickname}</strong>
                <span>{m.text}</span>
              </div>
            ))}
          </div>
          <form className="room-chat-form" onSubmit={onSubmit}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={200}
              placeholder="Say something…"
            />
            <button className="btn" type="submit" disabled={!text.trim()}>
              Send
            </button>
          </form>
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
}
