import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useSuggestionStore } from '../store/suggestionStore';

export default function SuggestionsModal() {
  const { showModal, suggestionText, streaming, closeModal, setSuggestionText, setStreaming, saveLastSuggestions } =
    useSuggestionStore();
  const abortRef = useRef<AbortController | null>(null);
  const finalTextRef = useRef<string>('');

  useEffect(() => {
    if (!showModal) return;

    const run = async () => {
      setSuggestionText('');
      finalTextRef.current = '';
      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch('/api/v1/patient/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) {
          setSuggestionText('Σφάλμα φόρτωσης προτάσεων. Δοκιμάστε ξανά.');
          return;
        }
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) return;
        let buffer = '';
        let finished = false;
        while (!finished) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.type === 'token') { finalTextRef.current += payload.data; setSuggestionText((prev) => prev + payload.data); }
              else if (payload.type === 'error') { setSuggestionText(`Σφάλμα: ${payload.data}`); finished = true; break; }
              else if (payload.type === 'done') { finished = true; break; }
            } catch { /* malformed */ }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') setSuggestionText('Σφάλμα επικοινωνίας με AI.');
      } finally {
        setStreaming(false);
        if (finalTextRef.current) saveLastSuggestions(finalTextRef.current);
      }
    };

    run();

    return () => {
      abortRef.current?.abort();
    };
  }, [showModal]);

  const handleClose = () => {
    abortRef.current?.abort();
    closeModal();
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => !streaming && e.target === e.currentTarget && handleClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-base">Προτάσεις Υγείας</h2>
              <p className="text-xs text-gray-400">Εξατομικευμένες συμβουλές AI</p>
            </div>
          </div>
          {streaming && (
            <span className="flex items-center gap-2 text-xs text-primary">
              <span className="inline-block w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Ανάλυση...
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {suggestionText ? (
            <div className="prose prose-sm max-w-none text-gray-800">
              <ReactMarkdown>{suggestionText}</ReactMarkdown>
            </div>
          ) : streaming ? (
            <div className="flex items-center justify-center py-16">
              <span className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {!streaming && (
          <div className="px-6 py-4 border-t border-gray-100">
            <button onClick={handleClose} className="btn-primary w-full py-2.5">
              Κατάλαβα, ευχαριστώ!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
