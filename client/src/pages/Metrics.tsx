import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import ReactMarkdown from 'react-markdown';
import api from '../api/client';

const METRIC_LABELS: Record<string, { label: string; unit: string; normalRange?: [number, number] }> = {
  bloodPressure: { label: 'Αρτηριακή Πίεση', unit: 'mmHg', normalRange: [90, 130] },
  weight: { label: 'Βάρος', unit: 'kg' },
  bmi: { label: 'ΔΜΣ', unit: 'kg/m²', normalRange: [18.5, 24.9] },
  glucose: { label: 'Γλυκόζη', unit: 'mg/dL', normalRange: [70, 99] },
  steps: { label: 'Βήματα', unit: 'βήματα' },
  heartRate: { label: 'Καρδιακός Ρυθμός', unit: 'bpm', normalRange: [60, 100] },
  sleepHours: { label: 'Ώρες Ύπνου', unit: 'ώρες', normalRange: [7, 9] },
  oxygenSaturation: { label: 'Κορεσμός O₂', unit: '%', normalRange: [95, 100] },
  bodyFat: { label: 'Λίπος Σώματος', unit: '%' },
  waistCircumference: { label: 'Περίμετρος Μέσης', unit: 'cm' },
};

function getValueColor(value: number, normalRange?: [number, number]): string {
  if (!normalRange) return 'text-gray-900 bg-gray-100';
  const [min, max] = normalRange;
  if (value < min || value > max) return 'text-red-700 bg-red-100';
  return 'text-green-700 bg-green-100';
}

const INTEGRATIONS = [
  {
    id: 'apple-health',
    name: 'Apple Health',
    description: 'iPhone & Apple Watch',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-gray-800" xmlns="http://www.w3.org/2000/svg">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
      </svg>
    ),
    color: 'bg-gray-50 border-gray-200',
    accent: 'text-gray-800',
  },
  {
    id: 'google-fit',
    name: 'Google Fit',
    description: 'Android & Wear OS',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" fill="#4285F4"/>
      </svg>
    ),
    color: 'bg-blue-50 border-blue-100',
    accent: 'text-blue-700',
  },
  {
    id: 'garmin',
    name: 'Garmin Connect',
    description: 'Garmin Smartwatches',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" className="text-teal-600" stroke="#0D7377"/>
      </svg>
    ),
    color: 'bg-teal-50 border-teal-100',
    accent: 'text-teal-700',
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    description: 'Fitbit & Google Pixel Watch',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-cyan-600" fill="currentColor">
        <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
        <circle cx="5" cy="8.5" r="1.5"/><circle cx="5" cy="15.5" r="1.5"/>
        <circle cx="19" cy="8.5" r="1.5"/><circle cx="19" cy="15.5" r="1.5"/>
      </svg>
    ),
    color: 'bg-cyan-50 border-cyan-100',
    accent: 'text-cyan-700',
  },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="text-gray-500 mb-1">{label}</p>
      <p className="font-semibold text-gray-900">{payload[0]?.value}</p>
    </div>
  );
}

export default function Metrics() {
  const qc = useQueryClient();
  const [expandedModal, setExpandedModal] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [modalPhase, setModalPhase] = useState<'import' | 'analysis'>('import');
  const [modalAnalysisText, setModalAnalysisText] = useState('');
  const [modalAnalysisStreaming, setModalAnalysisStreaming] = useState(false);
  const [connectingApp, setConnectingApp] = useState<typeof INTEGRATIONS[0] | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<{ text: string; date: string } | null>(() => {
    try { const s = localStorage.getItem('lastMetricsAnalysis'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [parseError, setParseError] = useState('');
  const [analysisText, setAnalysisText] = useState('');
  const [analysisStreaming, setAnalysisStreaming] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const modalAbortRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: allMetrics, isLoading } = useQuery({
    queryKey: ['metrics', 'all'],
    queryFn: () => api.get('/patient/metrics/all').then(r => r.data.data),
  });

  const importMutation = useMutation({
    mutationFn: (metrics: any[]) => api.post('/patient/metrics/import', { metrics }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metrics', 'all'] });
    },
  });

  const closeImportModal = () => {
    modalAbortRef.current?.();
    setShowImport(false);
    setModalPhase('import');
    setModalAnalysisText('');
    setModalAnalysisStreaming(false);
    setParsedData([]);
    setParseError('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError('');
    setParsedData([]);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(json)) throw new Error('Το JSON πρέπει να είναι πίνακας');
        setParsedData(json);
      } catch (err: any) {
        setParseError(err.message || 'Μη έγκυρο JSON');
      }
    };
    reader.readAsText(file);
  };

  const streamAnalysis = async (
    inputMetrics: any[] | null,
    setText: React.Dispatch<React.SetStateAction<string>>,
    setStreaming: React.Dispatch<React.SetStateAction<boolean>>,
    abortRefObj: React.MutableRefObject<(() => void) | null>
  ) => {
    setText('');
    setStreaming(true);
    const controller = new AbortController();
    abortRefObj.current = () => controller.abort();
    try {
      const token = localStorage.getItem('accessToken');
      const body: Record<string, any> = {};
      if (inputMetrics) body.inputMetrics = inputMetrics;
      const response = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/v1/patient/metrics/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        setText(`Σφάλμα: ${errData?.error?.message || response.statusText || 'Άγνωστο σφάλμα'}`);
        return;
      }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) { setText('Σφάλμα ανάγνωσης απόκρισης.'); return; }
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
            if (payload.type === 'token') setText(prev => prev + payload.data);
            else if (payload.type === 'error') { setText(`Σφάλμα AI: ${payload.data}`); finished = true; break; }
            else if (payload.type === 'done') { finished = true; break; }
          } catch { /* malformed line */ }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') setText('Σφάλμα επικοινωνίας με AI.');
    } finally {
      setStreaming(false);
    }
  };

  const handleSaveAndAnalyze = async () => {
    await importMutation.mutateAsync(parsedData);
    setModalPhase('analysis');
    await streamAnalysis(parsedData, setModalAnalysisText, setModalAnalysisStreaming, modalAbortRef);
  };

  const handleSaveOnly = async () => {
    await importMutation.mutateAsync(parsedData);
    closeImportModal();
  };

  const closeAnalysisModal = () => {
    abortRef.current?.();
    if (analysisText) {
      const entry = { text: analysisText, date: new Date().toISOString() };
      localStorage.setItem('lastMetricsAnalysis', JSON.stringify(entry));
      setLastAnalysis(entry);
    }
    setShowAnalysis(false);
    setAnalysisText('');
    setAnalysisStreaming(false);
  };

  const openLastAnalysis = () => {
    if (!lastAnalysis) return;
    setAnalysisText(lastAnalysis.text);
    setShowAnalysis(true);
  };

  const handleAnalyze = async () => {
    if (analysisStreaming) { abortRef.current?.(); return; }
    setAnalysisText('');
    setShowAnalysis(true);
    await streamAnalysis(null, setAnalysisText, setAnalysisStreaming, abortRef);
  };

  const metricTypes = Object.keys(allMetrics || {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Μετρήσεις Υγείας</h1>
          <p className="text-sm text-gray-500 mt-0.5">Φυσική κατάσταση, σώμα &amp; ζωτικά σημεία</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowImport(true); setParsedData([]); setParseError(''); }}
            className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm border border-gray-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Εισαγωγή JSON
          </button>
          {lastAnalysis && (
            <button
              onClick={openLastAnalysis}
              title={`Τελευταία ανάλυση: ${new Date(lastAnalysis.date).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
              className="btn-ghost flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 text-gray-600 hover:text-primary"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Τελευταία Ανάλυση
            </button>
          )}
          <button
            onClick={handleAnalyze}
            disabled={analysisStreaming || metricTypes.length === 0}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
          >
            {analysisStreaming
              ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            }
            AI Ανάλυση
          </button>
        </div>
      </div>

      {/* App Integrations — compact bar */}
      <div className="card px-5 py-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Σύνδεση εφαρμογής</p>
          <p className="text-xs text-gray-400 mt-0.5">Αυτόματος συγχρονισμός μετρήσεων</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {INTEGRATIONS.map(app => (
            <button
              key={app.id}
              onClick={() => setConnectingApp(app)}
              title={app.name}
              className={`w-9 h-9 rounded-xl border ${app.color} flex items-center justify-center hover:shadow-md transition-all`}
            >
              {app.icon}
            </button>
          ))}
          <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-medium whitespace-nowrap">Σύντομα</span>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-48 rounded-xl" />)}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && metricTypes.length === 0 && (
        <div className="card p-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-500">Δεν υπάρχουν μετρήσεις. Εισάγετε ένα JSON αρχείο για να ξεκινήσετε.</p>
          <button
            onClick={() => setShowImport(true)}
            className="btn-primary mt-4 inline-flex items-center gap-2 px-5 py-2 text-sm"
          >
            Εισαγωγή JSON
          </button>
        </div>
      )}

      {/* Metrics grid */}
      {metricTypes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metricTypes.map((type) => {
            // Backend sorts newest-first; reverse for chronological chart
            const readings: any[] = (allMetrics[type] || []);
            const latest = readings[0]; // newest is first
            const meta = METRIC_LABELS[type] || { label: type, unit: '' };
            // Take last 20 readings (oldest among the newest), reverse to chronological order
            const chronological = readings.slice(0, 20).reverse();
            const chartData = chronological.map((m: any) => ({
              date: new Date(m.recordedAt || m.date).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: '2-digit' }),
              fullDate: new Date(m.recordedAt || m.date).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' }),
              value: typeof m.value === 'number' ? m.value : parseFloat(m.value),
            }));
            const latestValue = latest ? (typeof latest.value === 'number' ? latest.value : parseFloat(latest.value)) : null;
            const valueColor = latestValue !== null ? getValueColor(latestValue, meta.normalRange) : 'text-gray-900 bg-gray-100';
            return (
              <div key={type} className="card overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{meta.label}</h3>
                      {meta.normalRange && (
                        <p className="text-xs text-gray-400">Φυσιολογικό: {meta.normalRange[0]}–{meta.normalRange[1]} {meta.unit}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {latestValue !== null && (
                        <span className={`badge font-mono text-sm px-2.5 py-1 ${valueColor}`}>
                          {latestValue} {meta.unit}
                        </span>
                      )}
                      <button
                        onClick={() => setExpandedModal(type)}
                        className="text-gray-400 hover:text-primary transition-colors"
                        title="Μεγέθυνση"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {chartData.length > 1 ? (
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="value" stroke="#0066CC" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-20 flex items-center justify-center">
                      <p className="text-xs text-gray-400">Χρειάζονται τουλάχιστον 2 μετρήσεις για γράφημα</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">{readings.length} μετρήσεις · τελευταία: {latest ? new Date(latest.recordedAt || latest.date).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Metric expand modal */}
      {expandedModal && (() => {
        const type = expandedModal;
        const readings: any[] = allMetrics?.[type] || [];
        const meta = METRIC_LABELS[type] || { label: type, unit: '' };
        const chronological = readings.slice(0, 20).reverse();
        const chartData = chronological.map((m: any) => ({
          date: new Date(m.recordedAt || m.date).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: '2-digit' }),
          value: typeof m.value === 'number' ? m.value : parseFloat(m.value),
        }));
        return (
          <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setExpandedModal(null); }}
          >
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
              {/* Modal header */}
              <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{meta.label}</h3>
                  {meta.normalRange && (
                    <p className="text-xs text-gray-400 mt-0.5">Φυσιολογικό εύρος: {meta.normalRange[0]}–{meta.normalRange[1]} {meta.unit}</p>
                  )}
                </div>
                <button onClick={() => setExpandedModal(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal body */}
              <div className="px-6 py-5 overflow-y-auto flex-1">
                {chartData.length > 1 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="value" stroke="#0066CC" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-32 flex items-center justify-center">
                    <p className="text-sm text-gray-400">Χρειάζονται τουλάχιστον 2 μετρήσεις για γράφημα</p>
                  </div>
                )}

                {readings.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ιστορικό μετρήσεων</p>
                      <p className="text-xs text-gray-400">{readings.length} εγγραφές</p>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="py-2 px-4 text-left text-gray-500 font-medium">Ημερομηνία</th>
                            <th className="py-2 px-4 text-left text-gray-500 font-medium">Τιμή</th>
                            {readings[0]?.category && <th className="py-2 px-4 text-left text-gray-500 font-medium">Κατηγορία</th>}
                            <th className="py-2 px-4 text-left text-gray-500 font-medium">Κατάσταση</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {readings.map((m: any, i: number) => {
                            const val = typeof m.value === 'number' ? m.value : parseFloat(m.value);
                            const color = getValueColor(val, meta.normalRange);
                            return (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="py-2 px-4 text-gray-600">
                                  {new Date(m.recordedAt || m.date).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  <span className="text-gray-400 ml-1 text-xs">
                                    {new Date(m.recordedAt || m.date).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </td>
                                <td className="py-2 px-4">
                                  <span className={`badge font-mono ${color}`}>{val} {meta.unit}</span>
                                </td>
                                {readings[0]?.category && <td className="py-2 px-4 text-gray-500">{m.category || '—'}</td>}
                                <td className="py-2 px-4">
                                  {meta.normalRange ? (
                                    val < meta.normalRange[0] ? <span className="text-blue-600">Χαμηλό</span>
                                    : val > meta.normalRange[1] ? <span className="text-red-600">Υψηλό</span>
                                    : <span className="text-green-600">Φυσιολογικό</span>
                                  ) : <span className="text-gray-400">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* AI Analysis Modal */}
      {showAnalysis && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget && !analysisStreaming) closeAnalysisModal(); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">AI Ανάλυση Μετρήσεων</h3>
                {lastAnalysis && !analysisStreaming && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Τελευταία αποθήκευση: {new Date(lastAnalysis.date).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {analysisStreaming && (
                  <span className="flex items-center gap-2 text-sm text-primary">
                    <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Ανάλυση...
                  </span>
                )}
                <button
                  onClick={closeAnalysisModal}
                  disabled={analysisStreaming}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-40"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 overflow-y-auto flex-1">
              {analysisText ? (
                <div className="p-4 bg-primary-light rounded-xl text-sm text-gray-800 prose prose-sm max-w-none">
                  <ReactMarkdown>{analysisText}</ReactMarkdown>
                </div>
              ) : analysisStreaming ? (
                <div className="flex items-center justify-center py-16">
                  <span className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">Δεν υπάρχει ανάλυση ακόμα.</p>
              )}
            </div>

            {/* Modal footer */}
            {!analysisStreaming && (
              <div className="px-6 pb-6 flex-shrink-0 border-t border-gray-100 pt-4 flex justify-end">
                <button onClick={closeAnalysisModal} className="btn-primary px-6 py-2.5">
                  Κλείσιμο &amp; Αποθήκευση
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* App Integration Coming Soon modal */}
      {connectingApp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setConnectingApp(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
            <div className={`w-16 h-16 rounded-2xl ${connectingApp.color} border flex items-center justify-center mx-auto mb-4 [&_svg]:!w-8 [&_svg]:!h-8`}>
              {connectingApp.icon}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{connectingApp.name}</h3>
            <p className="text-sm text-gray-500 mb-5">{connectingApp.description}</p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
              <p className="text-sm font-medium text-amber-800">Σύντομα διαθέσιμο</p>
              <p className="text-xs text-amber-700 mt-1">
                Η σύνδεση με {connectingApp.name} βρίσκεται υπό ανάπτυξη.
                Σύντομα θα μπορείτε να συγχρονίζετε αυτόματα βήματα, καρδιακό ρυθμό, ύπνο και άλλες μετρήσεις.
              </p>
            </div>

            <div className="text-xs text-gray-400 mb-5">
              Μέχρι τότε, χρησιμοποιήστε <strong>Εισαγωγή JSON</strong> για χειροκίνητη εισαγωγή δεδομένων.
            </div>

            <button
              onClick={() => setConnectingApp(null)}
              className="btn-primary w-full"
            >
              Κατάλαβα
            </button>
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget && !modalAnalysisStreaming) closeImportModal(); }}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {modalPhase === 'import' ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Εισαγωγή Μετρήσεων</h3>
                <p className="text-sm text-gray-500 mb-5">Επιλέξτε ένα αρχείο JSON με τις μετρήσεις σας</p>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Αρχείο JSON</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="input-field"
                  />
                  {parseError && <p className="text-xs text-red-600 mt-1">{parseError}</p>}
                </div>

                {parsedData.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Προεπισκόπηση (πρώτα 5)</p>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="py-2 px-3 text-left text-gray-500 font-medium">Τύπος</th>
                            <th className="py-2 px-3 text-left text-gray-500 font-medium">Τιμή</th>
                            <th className="py-2 px-3 text-left text-gray-500 font-medium">Μονάδα</th>
                            <th className="py-2 px-3 text-left text-gray-500 font-medium">Ημερομηνία</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {parsedData.slice(0, 5).map((item, i) => (
                            <tr key={i}>
                              <td className="py-2 px-3 font-medium text-gray-900">{item.type || '—'}</td>
                              <td className="py-2 px-3 font-mono text-gray-700">{item.value ?? '—'}</td>
                              <td className="py-2 px-3 text-gray-500">{item.unit || '—'}</td>
                              <td className="py-2 px-3 text-gray-500">{item.date || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">{parsedData.length} εγγραφές συνολικά</p>
                  </div>
                )}

                {importMutation.isError && (
                  <p className="text-sm text-red-600 mb-3">Σφάλμα εισαγωγής. Δοκιμάστε ξανά.</p>
                )}

                <div className="flex flex-col gap-2">
                  <div className="flex gap-3">
                    <button
                      onClick={closeImportModal}
                      className="btn-ghost flex-1 py-2.5"
                      disabled={importMutation.isPending}
                    >
                      Ακύρωση
                    </button>
                    <button
                      onClick={handleSaveOnly}
                      disabled={parsedData.length === 0 || importMutation.isPending}
                      className="btn-ghost flex-1 py-2.5 flex items-center justify-center gap-2 border border-gray-300 disabled:opacity-50"
                    >
                      {importMutation.isPending && !modalAnalysisStreaming && (
                        <span className="inline-block w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                      )}
                      Αποθήκευση
                    </button>
                  </div>
                  <button
                    onClick={handleSaveAndAnalyze}
                    disabled={parsedData.length === 0 || importMutation.isPending}
                    className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Αποθήκευση &amp; Ανάλυση AI
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">AI Ανάλυση Μετρήσεων</h3>
                  {modalAnalysisStreaming && (
                    <span className="flex items-center gap-2 text-sm text-primary">
                      <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Ανάλυση...
                    </span>
                  )}
                </div>

                {modalAnalysisText ? (
                  <div className="p-4 bg-primary-light rounded-xl text-sm text-gray-800 prose prose-sm max-w-none mb-5 max-h-[55vh] overflow-y-auto">
                    <ReactMarkdown>{modalAnalysisText}</ReactMarkdown>
                  </div>
                ) : (
                  modalAnalysisStreaming && (
                    <div className="flex items-center justify-center py-12">
                      <span className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )
                )}

                {!modalAnalysisStreaming && (
                  <button onClick={closeImportModal} className="btn-primary w-full py-2.5">
                    Κλείσιμο
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
