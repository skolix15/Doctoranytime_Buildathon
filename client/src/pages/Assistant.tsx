import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAssistantStore, Message } from '../store/assistantStore';
import BookAppointmentModal, { BookingPreFill } from '../components/BookAppointmentModal';
import api from '../api/client';

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700';
  return <span className={`badge ${color} text-xs font-mono`}>{pct}% confident</span>;
}

function QnAModal({ qnaId, onClose }: { qnaId: string; onClose: () => void }) {
  const [qna, setQna] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/qna/${qnaId}`).then(r => setQna(r.data.data)).finally(() => setLoading(false));
  }, [qnaId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Πηγή Q&A</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading && (
            <div className="space-y-3">
              <div className="skeleton h-5 w-3/4 rounded" />
              <div className="skeleton h-20 rounded-xl" />
            </div>
          )}

          {qna && (
            <>
              {/* Question */}
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Ερώτηση</p>
                <p className="text-sm font-medium text-gray-900">{qna.question}</p>
                {qna.specialty && (
                  <span className="mt-2 inline-block badge bg-primary-light text-primary text-xs">{qna.specialty}</span>
                )}
              </div>

              {/* Answers */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{qna.answers.length} Απαντήσεις</p>
                {qna.answers.map((ans: any, i: number) => {
                  const doc = ans.doctorId;
                  const isBest = qna.bestAnswerId && ans._id === qna.bestAnswerId?.toString();
                  return (
                    <div key={i} className={`rounded-xl border p-4 space-y-2 ${isBest ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-white'}`}>
                      {isBest && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          Καλύτερη απάντηση
                        </span>
                      )}
                      {doc && (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-primary-light rounded-full flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                            {doc.profile?.firstName?.[0]}{doc.profile?.lastName?.[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-900 leading-tight">Δρ. {doc.profile?.firstName} {doc.profile?.lastName}</p>
                            {doc.specialties?.[0] && <p className="text-xs text-gray-400">{doc.specialties[0]}</p>}
                          </div>
                          <div className="ml-auto text-xs text-gray-400 flex-shrink-0">
                            {new Date(ans.answeredAt).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      )}
                      <p className="text-sm text-gray-700 leading-relaxed">{ans.text}</p>
                      {ans.votes > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905a3.61 3.61 0 01-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                          {ans.votes} ψήφοι
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


interface BookingCardProps {
  prefill: BookingPreFill;
  onBook: (overridePrefill?: BookingPreFill) => void;
}

function BookingCard({ prefill, onBook }: BookingCardProps) {
  const navigate = useNavigate();
  const [showPrevious, setShowPrevious] = useState(false);
  const [savedDoctors, setSavedDoctors] = useState<any[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  const handleShowPrevious = async () => {
    if (showPrevious) { setShowPrevious(false); return; }
    setShowPrevious(true);
    if (savedDoctors.length > 0) return;
    setLoadingDoctors(true);
    try {
      const [savedRes, apptRes] = await Promise.all([
        api.get('/patient/saved-doctors'),
        api.get('/appointments?status=all'),
      ]);
      const saved: any[] = savedRes.data.data || [];
      const pastDoctors: any[] = (apptRes.data.data || [])
        .map((a: any) => a.doctorId)
        .filter(Boolean);

      // Merge, deduplicate by _id, saved first
      const seen = new Set<string>();
      const merged: any[] = [];
      for (const d of [...saved, ...pastDoctors]) {
        const id = d._id?.toString();
        if (id && !seen.has(id)) { seen.add(id); merged.push(d); }
      }
      setSavedDoctors(merged);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const searchQuery = [prefill.specialty, prefill.service].filter(Boolean).join(' ');

  const handleSearch = () => {
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <div className="mt-3 border border-primary/20 bg-primary-light rounded-xl overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">📅</span>
          <p className="font-semibold text-gray-900 text-sm">Κλείστε Ραντεβού</p>
        </div>
        {(prefill.specialty || prefill.service) && (
          <p className="text-xs text-gray-500 ml-6">
            {[prefill.specialty, prefill.service].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      <div className="px-3 pb-3 flex gap-2">
        <button
          onClick={handleShowPrevious}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-3 rounded-lg border transition-colors ${showPrevious ? 'bg-white border-primary text-primary' : 'bg-white border-gray-200 text-gray-700 hover:border-primary/50 hover:text-primary'}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          Προηγούμενοι γιατροί
          <svg className={`w-3 h-3 transition-transform ${showPrevious ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        <button
          onClick={handleSearch}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-3 rounded-lg bg-primary text-white hover:bg-primary-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          Αναζήτηση γιατρού
        </button>
      </div>

      {showPrevious && (
        <div className="border-t border-primary/10 bg-white">
          {loadingDoctors && (
            <div className="flex items-center justify-center py-4">
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loadingDoctors && savedDoctors.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4 px-4">Δεν βρέθηκαν προηγούμενοι γιατροί</p>
          )}
          {savedDoctors.map((doc: any) => (
            <div key={doc._id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
              <div className="w-7 h-7 bg-primary-light rounded-full flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                {doc.profile?.firstName?.[0]}{doc.profile?.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 leading-tight truncate">Δρ. {doc.profile?.firstName} {doc.profile?.lastName}</p>
                <p className="text-xs text-gray-400 truncate">{doc.specialties?.[0]}</p>
              </div>
              <button
                onClick={() => onBook({
                  ...prefill,
                  doctorId: doc._id,
                  doctorName: `${doc.profile?.firstName} ${doc.profile?.lastName}`,
                  specialty: doc.specialties?.[0] || prefill.specialty,
                })}
                className="text-xs font-medium text-primary hover:text-primary-medium px-2 py-1 rounded-lg hover:bg-primary-light transition-colors flex-shrink-0"
              >
                Κλείσε →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DoctorSuggestionRow({ doctors, onBook, bookingIntent }: {
  doctors: Message['suggestedDoctors'];
  onBook: (prefill: BookingPreFill) => void;
  bookingIntent?: BookingPreFill | null;
}) {
  if (!doctors || doctors.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Διαθέσιμοι γιατροί στην πλατφόρμα</p>
      {doctors.map(doc => (
        <div key={doc._id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
          <div className="w-9 h-9 bg-primary-light rounded-full flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
            {doc.profile.firstName[0]}{doc.profile.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Δρ. {doc.profile.firstName} {doc.profile.lastName}</p>
            <p className="text-xs text-gray-500">{doc.specialties.join(', ')}</p>
          </div>
          <button
            onClick={() => onBook({
              ...(bookingIntent || {}),
              doctorId: doc._id,
              doctorName: `${doc.profile.firstName} ${doc.profile.lastName}`,
              specialty: doc.specialties[0],
            })}
            className="btn-primary text-xs py-1.5 px-3 flex-shrink-0"
          >
            Κλείσε →
          </button>
        </div>
      ))}
    </div>
  );
}

function MessageBubble({ message, bookingPrefill, onBook }: {
  message: Message;
  bookingPrefill?: BookingPreFill | null;
  onBook?: (prefill: BookingPreFill) => void;
}) {
  const isUser = message.role === 'user';
  const [openQnaId, setOpenQnaId] = useState<string | null>(null);
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1 ${isUser ? 'bg-primary text-white' : 'bg-gradient-to-br from-primary-light to-blue-100 text-primary'}`}>
        {isUser ? 'Ε' : '⚕'}
      </div>
      <div className="max-w-[78%] space-y-2">
        {message.urgencyLevel === 'emergency' && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-sm text-red-800 font-medium">
            🚨 Αν αντιμετωπίζετε επείγον, καλέστε άμεσα <strong>166</strong> ή 112.
          </div>
        )}
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? 'bg-primary text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'}`}>
          {message.content ? (
            isUser ? (
              <span>{message.content}</span>
            ) : (
              <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-strong:text-gray-900 prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-code:text-xs">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )
          ) : (
            <span className="inline-flex gap-1 items-center py-0.5">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
            </span>
          )}
          {/* Booking card rendered inside the AI bubble */}
          {!isUser && bookingPrefill && onBook && (
            <BookingCard prefill={bookingPrefill} onBook={(override) => onBook(override ?? bookingPrefill)} />
          )}
          {/* Suggested doctors from specialty detection */}
          {!isUser && message.suggestedDoctors && message.suggestedDoctors.length > 0 && onBook && (
            <DoctorSuggestionRow doctors={message.suggestedDoctors} onBook={onBook} bookingIntent={bookingPrefill} />
          )}
        </div>
        {openQnaId && <QnAModal qnaId={openQnaId} onClose={() => setOpenQnaId(null)} />}
        {!isUser && message.content && (message.confidenceScore !== undefined || (message.sources && message.sources.length > 0)) && (
          <div className="flex flex-wrap items-center gap-2 px-1">
            {message.confidenceScore !== undefined && <ConfidenceBadge score={message.confidenceScore} />}
            {message.sources && message.sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {message.sources.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => src.qnaId && setOpenQnaId(src.qnaId)}
                    title="Δες την πλήρη ερώτηση & απαντήσεις"
                    className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 hover:bg-primary-light hover:text-primary border border-gray-200 hover:border-primary/30 rounded-full px-2 py-0.5 transition-colors"
                  >
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="max-w-[140px] truncate">Δρ. {src.doctorName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface SessionMeta {
  _id: string;
  sessionSummary?: string;
  messages: Array<{ role: string; content: string }>;
  createdAt: string;
  updatedAt: string;
}

export default function Assistant() {
  const { messages, sessionId, isStreaming, addMessage, setSessionId, setStreaming, updateLastMessage, setMessages, clearSession } = useAssistantStore();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Sessions sidebar
  const [sessions, setSessions] = useState<SessionMeta[]>([]);

  const fetchSessions = async () => {
    try {
      const res = await api.get('/assistant/sessions');
      setSessions(res.data?.data || []);
    } catch {}
  };

  // Booking modal state
  const [bookingPrefill, setBookingPrefill] = useState<BookingPreFill | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingMsgIndex, setBookingMsgIndex] = useState<number | null>(null);

  // Reset streaming flag on mount
  useEffect(() => { setStreaming(false); }, []);

  // Load sessions + last active session on mount
  useEffect(() => {
    const savedSessionId = localStorage.getItem('assistantSessionId');

    const init = async () => {
      try {
        const sessionsRes = await api.get('/assistant/sessions');
        const sessionList: SessionMeta[] = sessionsRes.data?.data || [];
        setSessions(sessionList);

        let targetSessionId = savedSessionId;
        if (savedSessionId && !sessionList.find(s => s._id === savedSessionId)) {
          targetSessionId = sessionList[0]?._id ?? null;
        } else if (!savedSessionId && sessionList.length > 0) {
          targetSessionId = sessionList[0]._id;
        }

        if (targetSessionId) {
          const sessionRes = await api.get(`/assistant/sessions/${targetSessionId}`);
          const sessionData = sessionRes.data?.data;
          if (sessionData?.messages?.length > 0) {
            setMessages(sessionData.messages.map((m: any, idx: number) => ({
              id: m._id || `loaded-${idx}`,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              sources: m.sources,
              confidenceScore: m.confidenceScore,
              urgencyLevel: m.urgencyLevel,
              timestamp: new Date(m.timestamp)
            })));
            setSessionId(targetSessionId);
          }
        }
      } catch {}
    };

    init();
  }, []);

  const loadSession = async (sid: string) => {
    if (sid === sessionId) return;
    try {
      const res = await api.get(`/assistant/sessions/${sid}`);
      const data = res.data?.data;
      if (data?.messages) {
        setMessages(data.messages.map((m: any, idx: number) => ({
          id: m._id || `loaded-${idx}`,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          sources: m.sources,
          confidenceScore: m.confidenceScore,
          urgencyLevel: m.urgencyLevel,
          timestamp: new Date(m.timestamp)
        })));
        setSessionId(sid);
        setBookingPrefill(null);
        setBookingMsgIndex(null);
      }
    } catch {}
  };

  const startNewChat = () => {
    if (messages.length === 0) return;
    clearSession();
    setBookingPrefill(null);
    setBookingMsgIndex(null);
    fetchSessions();
  };

  // Handle ?prefill= URL param: auto-send message on navigation
  const prefillSentRef = useRef(false);
  useEffect(() => {
    const prefillText = searchParams.get('prefill');
    if (prefillText && !prefillSentRef.current) {
      prefillSentRef.current = true;
      navigate('/assistant', { replace: true });
      setTimeout(() => sendMessage(prefillText), 600);
    }
  }, [searchParams]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async (overrideText?: string) => {
    const text = overrideText ?? input.trim();
    if (!text || isStreaming) return;
    if (!overrideText) setInput('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() };
    addMessage(userMsg);

    const aiMsgId = (Date.now() + 1).toString();
    const aiMsg: Message = { id: aiMsgId, role: 'assistant', content: '', timestamp: new Date() };
    addMessage(aiMsg);
    setStreaming(true);

    // Track pending booking intent during stream
    let pendingBookingData: BookingPreFill | null = null;

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/v1/assistant/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, sessionId })
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
              useAssistantStore.setState(s => {
                const msgs = [...s.messages];
                if (msgs.length > 0) {
                  msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: msgs[msgs.length - 1].content + evt.data };
                }
                return { messages: msgs };
              });
            } else if (evt.type === 'sources') {
              updateLastMessage({ sources: evt.data });
            } else if (evt.type === 'confidence') {
              updateLastMessage({ confidenceScore: evt.data });
            } else if (evt.type === 'sessionId') {
              setSessionId(evt.data);
            } else if (evt.type === 'urgency') {
              updateLastMessage({ urgencyLevel: evt.data });
            } else if (evt.type === 'booking_intent') {
              pendingBookingData = evt.data as BookingPreFill;
            } else if (evt.type === 'suggested_doctors') {
              updateLastMessage({ suggestedDoctors: evt.data });
            }
          } catch {}
        }
      }

      // After stream completes, attach bookingIntent to the message itself (persists across reloads)
      if (pendingBookingData) {
        useAssistantStore.setState(s => {
          const msgs = [...s.messages];
          const lastIdx = msgs.length - 1;
          if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
            msgs[lastIdx] = { ...msgs[lastIdx], bookingIntent: pendingBookingData };
            setBookingPrefill(pendingBookingData);
            setBookingMsgIndex(lastIdx);
          }
          return { messages: msgs };
        });
      }
    } catch {
      updateLastMessage({ content: 'Σφάλμα επικοινωνίας με τον server. Παρακαλώ δοκιμάστε ξανά.' });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
      fetchSessions();
    }
  };

  const handleBookingComplete = () => {
    qc.invalidateQueries({ queryKey: ['appointments'] });
    setShowBookingModal(false);
    // Show a success message in chat
    const successMsg: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: '✅ Το ραντεβού σας κλείστηκε επιτυχώς! Μπορείτε να το δείτε στη σελίδα Ραντεβού.',
      timestamp: new Date()
    };
    addMessage(successMsg);
  };

  const suggestions = ['Έχω πόνο στο στήθος', 'Ποια φάρμακα υπάρχουν για υπέρταση;', 'Πότε να πάω σε καρδιολόγο;', 'Ποια είναι τα συμπτώματα διαβήτη;'];

  return (
    <div className="flex gap-4 h-[calc(100vh-7rem)]">
      {/* Booking Modal */}
      {showBookingModal && bookingPrefill && (
        <BookAppointmentModal
          prefill={bookingPrefill}
          onClose={() => setShowBookingModal(false)}
          onBooked={handleBookingComplete}
        />
      )}

      {/* Sessions sidebar */}
      <div className="w-56 flex-shrink-0 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-3 pt-4 pb-2 flex-shrink-0">
          <button
            onClick={startNewChat}
            disabled={messages.length === 0}
            className="w-full flex items-center justify-center gap-2 btn-primary py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Νέα συνομιλία
          </button>
        </div>

        <div className="px-2 pb-2 flex-shrink-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 py-1">Ιστορικό</p>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {sessions.map(s => {
            const isActive = s._id === sessionId;
            const firstUserMsg = s.messages.find(m => m.role === 'user')?.content;
            const title = s.sessionSummary || firstUserMsg || 'Συνομιλία';
            const date = new Date(s.updatedAt);
            const isToday = date.toDateString() === new Date().toDateString();
            const dateLabel = isToday
              ? date.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
              : date.toLocaleDateString('el-GR', { day: 'numeric', month: 'short' });
            return (
              <button
                key={s._id}
                onClick={() => loadSession(s._id)}
                className={`w-full text-left px-2 py-2 rounded-lg transition-colors group ${isActive ? 'bg-primary-light text-primary' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                <p className="text-xs font-medium leading-snug line-clamp-2">{title}</p>
                <p className={`text-xs mt-0.5 ${isActive ? 'text-primary/60' : 'text-gray-400'}`}>{dateLabel}</p>
              </button>
            );
          })}
          {sessions.length === 0 && (
            <p className="text-xs text-gray-400 text-center px-2 py-4">Δεν υπάρχουν αποθηκευμένες συνομιλίες</p>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="card p-3 mb-3 flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 bg-primary-light rounded-xl flex items-center justify-center text-primary text-base flex-shrink-0">⚕</div>
          <div className="min-w-0">
            <h1 className="font-semibold text-gray-900 text-sm leading-tight">MedAssist AI</h1>
            <p className="text-xs text-gray-500 truncate">Τεκμηριωμένες απαντήσεις από γιατρούς</p>
          </div>
          <span className="ml-auto badge bg-green-100 text-green-700 flex-shrink-0">Online</span>
        </div>

        {/* Messages */}
        <div className="flex-1 card p-4 overflow-y-auto space-y-5 mb-3 min-h-0">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="text-5xl mb-4">⚕️</div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Πώς μπορώ να σας βοηθήσω;</h2>
              <p className="text-sm text-gray-500 mb-6 max-w-md">Ρωτήστε οτιδήποτε για την υγεία σας. Οι απαντήσεις βασίζονται σε πραγματικές απαντήσεις γιατρών της πλατφόρμας.</p>
              <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
                {suggestions.map(s => (
                  <button key={s} onClick={() => setInput(s)} className="text-sm text-left p-3 bg-gray-50 hover:bg-primary-light hover:text-primary rounded-xl transition-colors text-gray-600 border border-gray-200">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, idx) => {
            const activeIntent = bookingMsgIndex === idx && bookingPrefill && !isStreaming
              ? bookingPrefill
              : msg.bookingIntent && !isStreaming
              ? msg.bookingIntent
              : null;
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                bookingPrefill={activeIntent}
                onBook={(prefill) => { setBookingPrefill(prefill ?? activeIntent); setShowBookingModal(true); }}
              />
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="card p-3 flex gap-2 items-center flex-shrink-0">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition-all"
            placeholder="Γράψτε ερώτησή σας..."
            disabled={isStreaming}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isStreaming}
            className="btn-primary w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0 disabled:opacity-50"
          >
            {isStreaming
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            }
          </button>
        </div>
        <p className="text-xs text-center text-gray-400 mt-2">Δεν αποτελεί ιατρική συμβουλή. Πάντα συμβουλευτείτε γιατρό.</p>
      </div>
    </div>
  );
}
