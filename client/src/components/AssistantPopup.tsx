import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { useAssistantStore } from '../store/assistantStore';
import BookAppointmentModal from './BookAppointmentModal';
import type { BookingPreFill } from './BookAppointmentModal';

interface PopupMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function AssistantPopup() {
  const { popupOpen, popupPrefill, closePopup } = useAssistantStore();

  const [messages, setMessages] = useState<PopupMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [bookingPrefill, setBookingPrefill] = useState<BookingPreFill | null>(null);
  const [showBooking, setShowBooking] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prefillSentRef = useRef(false);

  // Reset when popup opens
  useEffect(() => {
    if (popupOpen) {
      setMessages([]);
      setInput('');
      setStreaming(false);
      setMinimized(false);
      setBookingPrefill(null);
      prefillSentRef.current = false;
    }
  }, [popupOpen]);

  // Auto-send prefill after open
  useEffect(() => {
    if (popupOpen && popupPrefill && !prefillSentRef.current) {
      prefillSentRef.current = true;
      setTimeout(() => sendMessage(popupPrefill), 400);
    }
  }, [popupOpen, popupPrefill]);

  useEffect(() => {
    if (!minimized) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, minimized]);

  const sendMessage = async (overrideText?: string) => {
    const text = overrideText ?? input.trim();
    if (!text || streaming) return;
    if (!overrideText) setInput('');

    const userMsg: PopupMessage = { id: Date.now().toString(), role: 'user', content: text };
    const aiMsg: PopupMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: '' };

    setMessages(prev => [...prev, userMsg, aiMsg]);
    setStreaming(true);

    let pendingBooking: BookingPreFill | null = null;

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/v1/assistant/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text }),
      });

      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'token') {
              setMessages(prev => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: msgs[msgs.length - 1].content + evt.data };
                return msgs;
              });
            } else if (evt.type === 'booking_intent') {
              pendingBooking = evt.data as BookingPreFill;
            }
          } catch {}
        }
      }

      if (pendingBooking) {
        setBookingPrefill(pendingBooking);
        setMessages(prev => {
          const msgs = [...prev];
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1] };
          return msgs;
        });
      }
    } catch {
      setMessages(prev => {
        const msgs = [...prev];
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: 'Σφάλμα επικοινωνίας. Δοκιμάστε ξανά.' };
        return msgs;
      });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  if (!popupOpen) return null;

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col w-[380px] max-h-[560px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
        style={{ maxHeight: minimized ? 'auto' : '560px' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-primary text-white flex-shrink-0">
          <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight">Medical Assistant</p>
            {!minimized && <p className="text-xs text-white/70 truncate">{popupPrefill ? 'Απάντηση σε εξέλιξη...' : 'Πώς μπορώ να βοηθήσω;'}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Link
              to="/assistant"
              onClick={closePopup}
              title="Άνοιγμα σε πλήρη προβολή"
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </Link>
            <button
              onClick={() => setMinimized(m => !m)}
              title={minimized ? 'Ανάπτυξη' : 'Ελαχιστοποίηση'}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {minimized
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />}
              </svg>
            </button>
            <button onClick={closePopup} title="Κλείσιμο" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {!minimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50" style={{ minHeight: 0 }}>
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full py-8">
                  <p className="text-xs text-gray-400 text-center">Η απάντηση θα εμφανιστεί εδώ</p>
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'}`}>
                    {msg.role === 'user' ? (
                      <span>{msg.content}</span>
                    ) : msg.content ? (
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <span className="inline-flex gap-1 items-center py-0.5">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                      </span>
                    )}
                    {/* Booking CTA inside AI bubble */}
                    {msg.role === 'assistant' && msg === messages[messages.length - 1] && bookingPrefill && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <button onClick={() => setShowBooking(true)} className="btn-primary text-xs py-1.5 px-3 w-full">
                          Κλείσιμο Ραντεβού →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2 px-3 py-3 border-t border-gray-100 bg-white flex-shrink-0">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition-all"
                placeholder="Γράψτε ερώτησή σας..."
                disabled={streaming}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || streaming}
                className="btn-primary w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 disabled:opacity-50"
              >
                {streaming
                  ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                }
              </button>
            </div>
          </>
        )}
      </div>

      {showBooking && bookingPrefill && (
        <BookAppointmentModal
          prefill={bookingPrefill}
          onClose={() => setShowBooking(false)}
          onBooked={() => setShowBooking(false)}
        />
      )}
    </>
  );
}
