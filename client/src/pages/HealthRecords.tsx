import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import api from '../api/client';
import { useFamilyStore } from '../store/familyStore';
import ReminderModal from '../components/ReminderModal';
import { useAssistantStore } from '../store/assistantStore';

// ── shared constants ────────────────────────────────────────────────────────

const statusColor: Record<string, string> = {
  normal: 'text-green-600 bg-green-50',
  high: 'text-red-600 bg-red-50',
  low: 'text-blue-600 bg-blue-50',
  critical: 'text-red-800 bg-red-100',
};

const TEST_TYPES = [
  { value: 'blood', label: 'Αιματολογικός' },
  { value: 'biochemistry', label: 'Βιοχημικός' },
  { value: 'urine', label: 'Ούρα' },
  { value: 'xray', label: 'Ακτινολογικός' },
  { value: 'other', label: 'Άλλο' },
];
const testTypeLabel = (t: string) => TEST_TYPES.find(x => x.value === t)?.label || t;

const DOC_CATEGORIES = ['Όλα', 'Συνταγές', 'Νοσηλεία', 'Παραπομπές', 'Άλλο'];
const categoryColors: Record<string, string> = {
  'Συνταγές': 'bg-green-100 text-green-700',
  'Νοσηλεία': 'bg-red-100 text-red-700',
  'Παραπομπές': 'bg-purple-100 text-purple-700',
  'Άλλο': 'bg-gray-100 text-gray-600',
};

type Tab = 'medications' | 'results' | 'documents';

// ── component ────────────────────────────────────────────────────────────────

export default function HealthRecords() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'medications');

  const { openPopup } = useAssistantStore();
  const qc = useQueryClient();
  const { activeMemberId, members } = useFamilyStore();
  const activeMember = activeMemberId ? members.find(m => m.id === activeMemberId) : null;

  // ── medications state ───────────────────────────────────────────────────
  const [addingMed, setAddingMed] = useState(false);
  const [medForm, setMedForm] = useState({
    name: '', dosage: '', frequency: '1x daily',
    startDate: new Date().toISOString().split('T')[0], isActive: true,
  });
  const [expandedMed, setExpandedMed] = useState<string | null>(null);
  const [reminderMed, setReminderMed] = useState<any | null>(null);
  const setMedField = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setMedForm(f => ({ ...f, [k]: e.target.value }));

  const { data: meds, isLoading: medsLoading } = useQuery({
    queryKey: ['medications', activeMemberId],
    queryFn: () =>
      api.get(`/medications${activeMemberId ? `?familyMemberId=${activeMemberId}` : ''}`).then(r => r.data.data),
  });
  const addMedMut = useMutation({
    mutationFn: () => api.post('/medications', medForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medications'] });
      setAddingMed(false);
      setMedForm({ name: '', dosage: '', frequency: '1x daily', startDate: new Date().toISOString().split('T')[0], isActive: true });
    },
  });
  const deleteMedMut = useMutation({
    mutationFn: (id: string) => api.delete(`/medications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['medications'] }),
  });

  // ── test results state ──────────────────────────────────────────────────
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [showAddResultModal, setShowAddResultModal] = useState(false);
  const [addResultForm, setAddResultForm] = useState({ testType: 'blood', labName: '', testDate: '', notes: '' });
  const [addingResult, setAddingResult] = useState(false);
  const [showResultReminder, setShowResultReminder] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('Εξήγησε μου τα αποτελέσματα');
  const [aiResponse, setAiResponse] = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const [attachingFile, setAttachingFile] = useState(false);
  const attachFileRef = useRef<HTMLInputElement>(null);

  const { data: results, isLoading: resultsLoading } = useQuery({
    queryKey: ['results', activeMemberId],
    queryFn: () =>
      api.get(`/results${activeMemberId ? `?familyMemberId=${activeMemberId}` : ''}`).then(r => r.data.data),
  });
  const { data: resultDetail } = useQuery({
    queryKey: ['result', selectedResult],
    queryFn: () => api.get(`/results/${selectedResult}`).then(r => r.data.data),
    enabled: !!selectedResult,
  });
  const activeResult = resultDetail || results?.find((r: any) => r._id === selectedResult);

  const handleAddResult = async () => {
    setAddingResult(true);
    try {
      await api.post('/results/upload', {
        testType: addResultForm.testType,
        labName: addResultForm.labName || undefined,
        testDate: addResultForm.testDate || undefined,
        values: [],
      });
      qc.invalidateQueries({ queryKey: ['results'] });
      setShowAddResultModal(false);
      setAddResultForm({ testType: 'blood', labName: '', testDate: '', notes: '' });
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Σφάλμα');
    } finally {
      setAddingResult(false);
    }
  };

  const handleAskAI = async (overrideQuestion?: string) => {
    if (!selectedResult || aiStreaming) return;
    setAiResponse('');
    setAiStreaming(true);
    const controller = new AbortController();
    abortRef.current = () => controller.abort();
    const q = overrideQuestion ?? aiQuestion;
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/v1/results/${selectedResult}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: q }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setAiResponse(`Σφάλμα: ${e?.error?.message || res.statusText}`);
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) { setAiResponse('Σφάλμα ανάγνωσης.'); return; }
      let buffer = '';
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const p = JSON.parse(line.slice(6));
            if (p.type === 'token') setAiResponse(prev => prev + p.data);
            else if (p.type === 'error') { setAiResponse(`Σφάλμα AI: ${p.data}`); done = true; break; }
            else if (p.type === 'done') { done = true; break; }
          } catch { /* skip */ }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') setAiResponse('Σφάλμα επικοινωνίας με AI.');
    } finally {
      setAiStreaming(false);
    }
  };

  const handleSelectResult = (id: string) => {
    setSelectedResult(id === selectedResult ? null : id);
    setShowAiChat(false);
    setAiResponse('');
    setAiQuestion('Εξήγησε μου τα αποτελέσματα');
  };

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedResult) return;
    e.target.value = '';
    setAttachingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/results/${selectedResult}/files`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      qc.invalidateQueries({ queryKey: ['result', selectedResult] });
      qc.invalidateQueries({ queryKey: ['results'] });
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Σφάλμα αποθήκευσης');
    } finally {
      setAttachingFile(false);
    }
  };

  const handleDeleteAttachedFile = async (fileIndex: number, fileName: string) => {
    if (!selectedResult || !confirm(`Διαγραφή "${fileName}";`)) return;
    await api.delete(`/results/${selectedResult}/files/${fileIndex}`);
    qc.invalidateQueries({ queryKey: ['result', selectedResult] });
    qc.invalidateQueries({ queryKey: ['results'] });
  };

  // ── documents (vault) state ─────────────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState('Όλα');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('Άλλο');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputEmptyRef = useRef<HTMLInputElement>(null);

  const { data: docs, isLoading: docsLoading } = useQuery({
    queryKey: ['vault', activeMemberId, activeCategory],
    queryFn: () => {
      const p = new URLSearchParams();
      if (activeMemberId) p.set('familyMemberId', activeMemberId);
      if (activeCategory !== 'Όλα') p.set('category', activeCategory);
      const qs = p.toString();
      return api.get(`/vault${qs ? '?' + qs : ''}`).then(r => r.data.data);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setShowUploadModal(true);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', pendingFile);
      formData.append('category', selectedCategory);
      if (activeMemberId) formData.append('familyMemberId', activeMemberId);
      await api.post('/vault/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      qc.invalidateQueries({ queryKey: ['vault'] });
      setShowUploadModal(false);
      setPendingFile(null);
      setSelectedCategory('Άλλο');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Σφάλμα αποθήκευσης');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (id: string, fileName: string) => {
    if (!confirm(`Διαγραφή "${fileName}";`)) return;
    await api.delete(`/vault/${id}`);
    qc.invalidateQueries({ queryKey: ['vault'] });
  };

  // ── render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Αρχεία Υγείας</h1>
          <p className="text-sm text-gray-500 mt-0.5">Φάρμακα, εξετάσεις &amp; έγγραφα</p>
          {activeMember && <p className="text-sm text-amber-600 mt-0.5">Προβολή για: <strong>{activeMember.name}</strong></p>}
        </div>
        <div>
          {tab === 'medications' && !activeMember && (
            <button onClick={() => setAddingMed(true)} className="btn-primary text-sm">+ Προσθήκη</button>
          )}
          {tab === 'results' && (
            <button onClick={() => setShowAddResultModal(true)} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Προσθήκη
            </button>
          )}
          {tab === 'documents' && (
            <label className="btn-primary cursor-pointer flex items-center gap-2 px-4 py-2 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Ανέβασμα
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileSelect} />
            </label>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {([
          { id: 'medications' as Tab, label: '💊 Φάρμακα' },
          { id: 'results' as Tab, label: '🔬 Εξετάσεις' },
          { id: 'documents' as Tab, label: '📁 Έγγραφα' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ MEDICATIONS ══════════════════════════════════════════════════════ */}
      {tab === 'medications' && (
        <>
          {medsLoading && (
            <div className="grid grid-cols-2 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {meds?.map((med: any) => (
              <div key={med._id} className={`card p-5 ${!med.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-light rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{med.name}</h3>
                      <p className="text-sm text-gray-500">{med.dosage} · {med.frequency}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const msg = activeMember
                          ? `Εξήγησέ μου για το φάρμακο ${med.name} που παίρνει η ${activeMember.name} στο προφίλ μου.`
                          : `Εξήγησέ μου για το φάρμακο ${med.name} που υπάρχει στο προφίλ μου.`;
                        openPopup(msg);
                      }}
                      title="Medical Assistant"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-purple-500 hover:bg-purple-50 transition-colors text-sm"
                    >                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg></button>
                    <button
                      onClick={() => setReminderMed(med)}
                      title="Ορισμός υπενθύμισης"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary-light transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteMedMut.mutate(med._id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors text-xs"
                    >✕</button>
                  </div>
                </div>
                {med.reminders?.length > 0 && (
                  <div className="mt-2 flex gap-1">
                    {med.reminders.map((r: any, i: number) => (
                      <span key={i} className="badge bg-yellow-50 text-yellow-700">⏰ {r.time}</span>
                    ))}
                  </div>
                )}
                {med.plainDescription && (
                  <div className="mt-3">
                    <button
                      onClick={() => setExpandedMed(expandedMed === med._id ? null : med._id)}
                      className="text-xs text-primary hover:underline"
                    >
                      {expandedMed === med._id ? '▲ Απόκρυψη' : '▼ Γιατί παίρνω αυτό;'}
                    </button>
                    {expandedMed === med._id && (
                      <p className="text-xs text-gray-600 mt-2 p-2 bg-blue-50 rounded-lg">{med.plainDescription}</p>
                    )}
                  </div>
                )}
                {med.prescribedBy && (
                  <p className="text-xs text-gray-400 mt-2">
                    Συνταγογράφηση: {med.prescribedBy?.profile?.firstName} {med.prescribedBy?.profile?.lastName}
                  </p>
                )}
              </div>
            ))}
          </div>
          {!medsLoading && meds?.length === 0 && (
            <div className="card p-10 text-center text-gray-400">
              <p className="text-sm mb-3">Δεν υπάρχουν καταγεγραμμένα φάρμακα{activeMember ? ` για ${activeMember.name}` : ''}</p>
              {!activeMember && (
                <button onClick={() => setAddingMed(true)} className="btn-primary text-sm">Προσθήκη Φαρμάκου</button>
              )}
            </div>
          )}
        </>
      )}

      {/* ══ TEST RESULTS ═════════════════════════════════════════════════════ */}
      {tab === 'results' && (
        <>
          {resultsLoading && (
            <div className="space-y-3">{[1,2].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* List */}
            <div className="space-y-3">
              {results?.map((r: any) => (
                <button
                  key={r._id}
                  onClick={() => handleSelectResult(r._id)}
                  className={`card p-4 w-full text-left hover:shadow-md transition-shadow ${selectedResult === r._id ? 'ring-2 ring-primary' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 text-lg flex-shrink-0">🔬</div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">{testTypeLabel(r.testType)}</p>
                      <p className="text-xs text-gray-500">{r.labName} · {new Date(r.testDate).toLocaleDateString('el-GR')}</p>
                      <div className="flex gap-1 mt-1.5">
                        {r.values?.slice(0, 2).map((v: any, i: number) => (
                          <span key={i} className={`badge text-xs ${statusColor[v.status] || 'bg-gray-100 text-gray-600'}`}>{v.name}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {!resultsLoading && results?.length === 0 && (
                <div className="card p-8 text-center text-gray-400 text-sm">
                  Δεν υπάρχουν εξετάσεις{activeMember ? ` για ${activeMember.name}` : ''}
                </div>
              )}
            </div>

            {/* Detail */}
            {activeResult && (
              <div className="lg:col-span-2 space-y-4">
                <div className="card p-5">
                  <h2 className="font-semibold text-gray-900 mb-1">{testTypeLabel(activeResult.testType)}</h2>
                  <p className="text-sm text-gray-500 mb-4">
                    {activeResult.labName} · {new Date(activeResult.testDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
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
                      {activeResult.values
                        .filter((v: any) => v.aiExplanation && v.status !== 'normal')
                        .map((v: any, i: number) => (
                          <div key={i} className={`p-3 rounded-lg text-xs ${statusColor[v.status]}`}>
                            <strong>{v.name}:</strong> {v.aiExplanation}
                          </div>
                        ))}
                    </div>
                  )}
                  {/* Attached files section */}
                  <div className="mt-5 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-700">Αρχεία Εξέτασης</h3>
                      <label className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 cursor-pointer transition-colors ${attachingFile ? 'opacity-50 pointer-events-none' : 'hover:bg-gray-50 text-gray-600'}`}>
                        {attachingFile
                          ? <span className="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        }
                        Επισύναψη
                        <input ref={attachFileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleAttachFile} />
                      </label>
                    </div>
                    {activeResult.attachedFiles?.length > 0 ? (
                      <div className="space-y-2">
                        {activeResult.attachedFiles.map((f: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg group">
                            <span className="text-base flex-shrink-0">
                              {f.mimeType?.includes('pdf') ? '📄' : f.mimeType?.includes('image') ? '🖼️' : '📎'}
                            </span>
                            <span className="flex-1 text-xs text-gray-700 truncate">{f.fileName}</span>
                            <button
                              onClick={() => window.open(f.fileUrl, '_blank')}
                              className="text-xs text-primary hover:underline flex-shrink-0"
                            >Λήψη</button>
                            <button
                              onClick={() => handleDeleteAttachedFile(idx, f.fileName)}
                              className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">Δεν υπάρχουν επισυναπτόμενα αρχεία.</p>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => {
                        const msg = activeMember
                          ? `Εξήγησέ μου την εξέταση ${testTypeLabel(activeResult.testType)} της ${activeMember.name} από ${new Date(activeResult.testDate).toLocaleDateString('el-GR')} που υπάρχει στο προφίλ μου.`
                          : `Εξήγησέ μου την εξέταση ${testTypeLabel(activeResult.testType)} από ${new Date(activeResult.testDate).toLocaleDateString('el-GR')} που υπάρχει στο προφίλ μου.`;
                        openPopup(msg);
                      }}
                      className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      Medical Assistant
                    </button>
                    <button
                      onClick={() => setShowResultReminder(true)}
                      className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm border border-gray-200"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      Υπενθύμιση Επανεξέτασης
                    </button>
                  </div>
                </div>
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
        </>
      )}

      {/* ══ DOCUMENTS ════════════════════════════════════════════════════════ */}
      {tab === 'documents' && (
        <>
          <div className="flex flex-wrap gap-2">
            {DOC_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCategory === cat ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {docsLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="skeleton h-40 rounded-xl" />)}
            </div>
          )}

          {!docsLoading && docs && docs.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {docs.map((doc: any) => (
                <div key={doc._id} className="card p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
                      {doc.mimeType?.includes('pdf') ? '📄' : doc.mimeType?.includes('image') ? '🖼️' : '📁'}
                    </div>
                    <span className={`badge text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[doc.category] || 'bg-gray-100 text-gray-600'}`}>
                      {doc.category}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900 line-clamp-2">{doc.fileName}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(doc.uploadedAt).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {doc.aiSummary && (
                      <p className="text-xs text-gray-600 mt-2 line-clamp-3 italic">{doc.aiSummary}</p>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1 border-t border-gray-100">
                    <button
                      onClick={() => window.open(doc.fileUrl, '_blank')}
                      className="btn-ghost text-xs flex items-center gap-1 px-2 py-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Λήψη
                    </button>
                    <button
                      onClick={() => handleDeleteDoc(doc._id, doc.fileName)}
                      className="btn-ghost text-xs text-red-500 hover:text-red-700 flex items-center gap-1 px-2 py-1.5 ml-auto"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Διαγραφή
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!docsLoading && (!docs || docs.length === 0) && (
            <div className="card p-10 text-center">
              <div className="text-5xl mb-4">📁</div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Δεν υπάρχουν έγγραφα</h2>
              <p className="text-sm text-gray-500 mb-6">
                {activeCategory !== 'Όλα'
                  ? `Δεν βρέθηκαν έγγραφα στη κατηγορία "${activeCategory}".`
                  : 'Αποθηκεύστε εξετάσεις, συνταγές, και ιατρικά έγγραφα.'}
              </p>
              <label className="btn-primary cursor-pointer inline-flex items-center gap-2 px-5 py-2.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Ανεβάστε το πρώτο σας έγγραφο
                <input
                  ref={fileInputEmptyRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={handleFileSelect}
                />
              </label>
            </div>
          )}
        </>
      )}

      {/* ══ SHARED MODALS ════════════════════════════════════════════════════ */}

      {reminderMed && (
        <ReminderModal
          type="medication"
          title={`${reminderMed.name} ${reminderMed.dosage}`}
          description={reminderMed.frequency}
          referenceId={reminderMed._id}
          familyMemberId={activeMemberId || undefined}
          onClose={() => setReminderMed(null)}
        />
      )}

      {addingMed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setAddingMed(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Νέο Φάρμακο</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Όνομα</label>
                <input className="input-field" value={medForm.name} onChange={setMedField('name')} placeholder="π.χ. Amlodipine" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Δόση</label>
                  <input className="input-field" value={medForm.dosage} onChange={setMedField('dosage')} placeholder="π.χ. 5mg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Συχνότητα</label>
                  <select className="input-field" value={medForm.frequency} onChange={setMedField('frequency')}>
                    <option>1x daily</option><option>2x daily</option><option>3x daily</option><option>As needed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ημ/νία Έναρξης</label>
                <input type="date" className="input-field" value={medForm.startDate} onChange={setMedField('startDate')} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setAddingMed(false)} className="btn-ghost flex-1">Ακύρωση</button>
              <button onClick={() => addMedMut.mutate()} disabled={!medForm.name || addMedMut.isPending} className="btn-primary flex-1">Αποθήκευση</button>
            </div>
          </div>
        </div>
      )}

      {showAddResultModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowAddResultModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-5">Νέα εξέταση</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Τύπος εξέτασης</label>
                <select className="input-field" value={addResultForm.testType} onChange={e => setAddResultForm(f => ({ ...f, testType: e.target.value }))}>
                  {TEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Εργαστήριο</label>
                <input className="input-field" placeholder="π.χ. Γενικό Νοσοκομείο Αθηνών" value={addResultForm.labName} onChange={e => setAddResultForm(f => ({ ...f, labName: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ημερομηνία εξέτασης</label>
                <input type="date" className="input-field" value={addResultForm.testDate} onChange={e => setAddResultForm(f => ({ ...f, testDate: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Αξίες (JSON ή κείμενο)</label>
                <textarea
                  className="input-field min-h-[80px] resize-y"
                  placeholder='π.χ. [{"name":"Αιμοσφαιρίνη","value":"14","unit":"g/dL","status":"normal"}]'
                  value={addResultForm.notes}
                  onChange={e => setAddResultForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddResultModal(false)} className="btn-ghost flex-1 py-2.5 justify-center" disabled={addingResult}>Ακύρωση</button>
              <button onClick={handleAddResult} disabled={addingResult} className="btn-primary flex-1 py-2.5 justify-center flex items-center gap-2">
                {addingResult && <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Αποθήκευση
              </button>
            </div>
          </div>
        </div>
      )}

      {showResultReminder && activeResult && (
        <ReminderModal
          type="examination"
          title={`Επανεξέταση: ${testTypeLabel(activeResult.testType)}`}
          description={activeResult.labName}
          referenceId={activeResult._id}
          familyMemberId={activeMemberId || undefined}
          onClose={() => setShowResultReminder(false)}
        />
      )}

      {showUploadModal && pendingFile && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) { setShowUploadModal(false); setPendingFile(null); } }}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ανέβασμα εγγράφου</h3>
            <div className="p-3 bg-gray-50 rounded-lg mb-4">
              <p className="text-sm text-gray-700 font-medium truncate">{pendingFile.name}</p>
              <p className="text-xs text-gray-400">{(pendingFile.size / 1024).toFixed(0)} KB</p>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Κατηγορία</label>
              <select className="input-field" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                {DOC_CATEGORIES.filter(c => c !== 'Όλα').map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowUploadModal(false); setPendingFile(null); }} className="btn-ghost flex-1 py-2.5 justify-center" disabled={uploading}>Ακύρωση</button>
              <button onClick={handleUpload} disabled={uploading} className="btn-primary flex-1 py-2.5 justify-center flex items-center gap-2">
                {uploading && <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Αποθήκευση
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
