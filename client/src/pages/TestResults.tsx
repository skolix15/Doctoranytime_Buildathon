import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import api from '../api/client';
import { useFamilyStore } from '../store/familyStore';
import ReminderModal from '../components/ReminderModal';

const statusColor: Record<string, string> = {
  normal: 'text-green-600 bg-green-50',
  high: 'text-red-600 bg-red-50',
  low: 'text-blue-600 bg-blue-50',
  critical: 'text-red-800 bg-red-100'
};

const TEST_TYPES = [
  { value: 'blood', label: 'Αιματολογικός' },
  { value: 'biochemistry', label: 'Βιοχημικός' },
  { value: 'urine', label: 'Ούρα' },
  { value: 'xray', label: 'Ακτινολογικός' },
  { value: 'other', label: 'Άλλο' },
];

const testTypeLabel = (t: string) => TEST_TYPES.find(x => x.value === t)?.label || t;

export default function TestResults() {
  const [selected, setSelected] = useState<string | null>(null);
  const { activeMemberId, members } = useFamilyStore();
  const activeMember = activeMemberId ? members.find(m => m.id === activeMemberId) : null;
  const queryClient = useQueryClient();

  // Add result modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ testType: 'blood', labName: '', testDate: '', notes: '' });
  const [adding, setAdding] = useState(false);

  // Reminder state
  const [showReminder, setShowReminder] = useState(false);

  // AI chat state
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('Εξήγησε μου τα αποτελέσματα');
  const [aiResponse, setAiResponse] = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);

  const navigate = useNavigate();

  const { data: results, isLoading } = useQuery({
    queryKey: ['results', activeMemberId],
    queryFn: () => {
      const params = activeMemberId ? `?familyMemberId=${activeMemberId}` : '';
      return api.get(`/results${params}`).then(r => r.data.data);
    }
  });

  const { data: detail } = useQuery({
    queryKey: ['result', selected],
    queryFn: () => api.get(`/results/${selected}`).then(r => r.data.data),
    enabled: !!selected
  });

  const activeResult = detail || results?.find((r: any) => r._id === selected);

  const handleAddResult = async () => {
    setAdding(true);
    try {
      await api.post('/results/upload', {
        testType: addForm.testType,
        labName: addForm.labName || undefined,
        testDate: addForm.testDate || undefined,
        values: [],
      });
      queryClient.invalidateQueries({ queryKey: ['results'] });
      setShowAddModal(false);
      setAddForm({ testType: 'blood', labName: '', testDate: '', notes: '' });
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Σφάλμα');
    } finally {
      setAdding(false);
    }
  };

  const handleAskAI = async (overrideQuestion?: string) => {
    if (!selected || aiStreaming) return;
    setAiResponse('');
    setAiStreaming(true);

    const controller = new AbortController();
    abortRef.current = () => controller.abort();

    const questionToSend = overrideQuestion ?? aiQuestion;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/v1/results/${selected}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: questionToSend }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        setAiResponse(`Σφάλμα: ${errData?.error?.message || response.statusText || 'Άγνωστο σφάλμα'}`);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) { setAiResponse('Σφάλμα ανάγνωσης απόκρισης.'); return; }

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
            if (payload.type === 'token') setAiResponse(prev => prev + payload.data);
            else if (payload.type === 'error') { setAiResponse(`Σφάλμα AI: ${payload.data}`); finished = true; break; }
            else if (payload.type === 'done') { finished = true; break; }
          } catch { /* malformed line */ }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setAiResponse('Σφάλμα επικοινωνίας με AI.');
      }
    } finally {
      setAiStreaming(false);
    }
  };

  const handleSelectResult = (id: string) => {
    setSelected(id === selected ? null : id);
    setShowAiChat(false);
    setAiResponse('');
    setAiQuestion('Εξήγησε μου τα αποτελέσματα');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Αποτελέσματα Εξετάσεων</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ανάλυση, ερμηνεία τιμών & AI βοηθός</p>
          {activeMember && <p className="text-sm text-amber-600 mt-0.5">Προβολή για: <strong>{activeMember.name}</strong></p>}
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Προσθήκη
        </button>
      </div>

      {isLoading && <div className="space-y-3">{[1,2].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-3">
          {results?.map((r: any) => (
            <button key={r._id} onClick={() => handleSelectResult(r._id)}
              className={`card p-4 w-full text-left hover:shadow-md transition-shadow ${selected === r._id ? 'ring-2 ring-primary' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 text-lg flex-shrink-0">🔬</div>
                <div>
                  <p className="font-medium text-sm text-gray-900">{testTypeLabel(r.testType)}</p>
                  <p className="text-xs text-gray-500">{r.labName} · {new Date(r.testDate).toLocaleDateString('el-GR')}</p>
                  <div className="flex gap-1 mt-1.5">
                    {r.values?.slice(0, 2).map((v: any, i: number) => <span key={i} className={`badge text-xs ${statusColor[v.status] || 'bg-gray-100 text-gray-600'}`}>{v.name}</span>)}
                  </div>
                </div>
              </div>
            </button>
          ))}
          {!isLoading && results?.length === 0 && (
            <div className="card p-8 text-center text-gray-400 text-sm">Δεν υπάρχουν εξετάσεις{activeMember ? ` για ${activeMember.name}` : ''}</div>
          )}
        </div>

        {activeResult && (
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-1">{testTypeLabel(activeResult.testType)}</h2>
              <p className="text-sm text-gray-500 mb-4">{activeResult.labName} · {new Date(activeResult.testDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

              {activeResult.aiSummary && (
                <div className="p-4 bg-primary-light rounded-xl mb-4">
                  <p className="text-xs font-semibold text-primary mb-1">AI Σύνοψη</p>
                  <p className="text-sm text-gray-700">{activeResult.aiSummary}</p>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                      <th className="pb-2 pr-4">Εξέταση</th>
                      <th className="pb-2 pr-4">Τιμή</th>
                      <th className="pb-2 pr-4">Φυσιολογικό</th>
                      <th className="pb-2">Κατάσταση</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeResult.values?.map((v: any, i: number) => (
                      <tr key={i}>
                        <td className="py-2.5 pr-4 font-medium text-gray-900">{v.name}</td>
                        <td className="py-2.5 pr-4 font-mono">{v.value} {v.unit}</td>
                        <td className="py-2.5 pr-4 text-gray-500 text-xs">{v.referenceRange}</td>
                        <td className="py-2.5">
                          <span className={`badge ${statusColor[v.status] || 'bg-gray-100 text-gray-600'}`}>
                            {v.status === 'normal' ? 'Φυσιολογικό' : v.status === 'high' ? 'Υψηλό' : v.status === 'low' ? 'Χαμηλό' : 'Κρίσιμο'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {activeResult.values?.some((v: any) => v.aiExplanation) && (
                <div className="mt-4 space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900">Επεξηγήσεις AI</h3>
                  {activeResult.values.filter((v: any) => v.aiExplanation && v.status !== 'normal').map((v: any, i: number) => (
                    <div key={i} className={`p-3 rounded-lg text-xs ${statusColor[v.status]}`}>
                      <strong>{v.name}:</strong> {v.aiExplanation}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions row */}
              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => {
                    if (showAiChat) {
                      setShowAiChat(false);
                      setAiResponse('');
                    } else {
                      setShowAiChat(true);
                      setAiQuestion('Εξήγησε μου τα αποτελέσματα');
                      handleAskAI('Εξήγησε μου τα αποτελέσματα');
                    }
                  }}
                  className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
                >
                  <span>⚕</span>
                  Ρώτησε AI
                </button>
                <button
                  onClick={() => {
                    const msg = activeMember
                      ? `Εξήγησέ μου την εξέταση ${testTypeLabel(activeResult.testType)} της ${activeMember.name} από ${new Date(activeResult.testDate).toLocaleDateString('el-GR')} που υπάρχει στο προφίλ μου.`
                      : `Εξήγησέ μου την εξέταση ${testTypeLabel(activeResult.testType)} από ${new Date(activeResult.testDate).toLocaleDateString('el-GR')} που υπάρχει στο προφίλ μου.`;
                    navigate(`/assistant?prefill=${encodeURIComponent(msg)}`);
                  }}
                  className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm border border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> Medical Assistant
                </button>
                <button
                  onClick={() => setShowReminder(true)}
                  className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm border border-gray-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  Υπενθύμιση Επανεξέτασης
                </button>
              </div>
            </div>

            {/* AI Chat panel */}
            {showAiChat && (
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                  <span>⚕</span> AI Ιατρικός Βοηθός
                </h3>
                <div className="flex gap-2">
                  <input
                    className="input-field flex-1"
                    value={aiQuestion}
                    onChange={e => setAiQuestion(e.target.value)}
                    placeholder="Ρώτησε για τα αποτελέσματά σου..."
                    onKeyDown={e => { if (e.key === 'Enter' && !aiStreaming) handleAskAI(); }}
                    disabled={aiStreaming}
                  />
                  <button
                    onClick={() => handleAskAI()}
                    disabled={aiStreaming || !aiQuestion.trim()}
                    className="btn-primary px-4 py-2 disabled:opacity-50 flex items-center gap-1"
                  >
                    {aiStreaming
                      ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    }
                    Αποστολή
                  </button>
                </div>
                {aiResponse && (
                  <div className="p-4 bg-primary-light rounded-xl text-sm text-gray-800 prose prose-sm max-w-none">
                    <ReactMarkdown>{aiResponse}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Result Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-5">Νέα εξέταση</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Τύπος εξέτασης</label>
                <select
                  className="input-field"
                  value={addForm.testType}
                  onChange={e => setAddForm(f => ({ ...f, testType: e.target.value }))}
                >
                  {TEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Εργαστήριο</label>
                <input
                  className="input-field"
                  placeholder="π.χ. Γενικό Νοσοκομείο Αθηνών"
                  value={addForm.labName}
                  onChange={e => setAddForm(f => ({ ...f, labName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ημερομηνία εξέτασης</label>
                <input
                  type="date"
                  className="input-field"
                  value={addForm.testDate}
                  onChange={e => setAddForm(f => ({ ...f, testDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Αξίες (JSON ή κείμενο)</label>
                <textarea
                  className="input-field min-h-[80px] resize-y"
                  placeholder='π.χ. [{"name":"Αιμοσφαιρίνη","value":"14","unit":"g/dL","status":"normal"}]'
                  value={addForm.notes}
                  onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="btn-ghost flex-1 py-2.5 justify-center"
                disabled={adding}
              >
                Ακύρωση
              </button>
              <button
                onClick={handleAddResult}
                disabled={adding}
                className="btn-primary flex-1 py-2.5 justify-center flex items-center gap-2"
              >
                {adding && <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Αποθήκευση
              </button>
            </div>
          </div>
        </div>
      )}

      {showReminder && activeResult && (
        <ReminderModal
          type="examination"
          title={`Επανεξέταση: ${testTypeLabel(activeResult.testType)}`}
          description={activeResult.labName}
          referenceId={activeResult._id}
          familyMemberId={activeMemberId || undefined}
          onClose={() => setShowReminder(false)}
        />
      )}
    </div>
  );
}
