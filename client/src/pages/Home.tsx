import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useFamilyStore } from '../store/familyStore';
import { useSuggestionStore } from '../store/suggestionStore';
import api from '../api/client';
import ReactMarkdown from 'react-markdown';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend, CartesianGrid } from 'recharts';

const METRIC_LABELS: Record<string, { label: string; unit: string; normalRange?: [number, number]; color: string }> = {
  bloodPressure: { label: 'Αρτηριακή Πίεση', unit: 'mmHg', normalRange: [90, 130], color: '#ef4444' },
  weight:        { label: 'Βάρος', unit: 'kg', color: '#8b5cf6' },
  bmi:           { label: 'ΔΜΣ', unit: 'kg/m²', normalRange: [18.5, 24.9], color: '#f59e0b' },
  glucose:       { label: 'Γλυκόζη', unit: 'mg/dL', normalRange: [70, 99], color: '#f97316' },
  steps:         { label: 'Βήματα', unit: 'βήμ.', color: '#22c55e' },
  heartRate:     { label: 'Καρδιακός Ρυθμός', unit: 'bpm', normalRange: [60, 100], color: '#ec4899' },
  sleepHours:    { label: 'Ύπνος', unit: 'ώρες', normalRange: [7, 9], color: '#6366f1' },
  oxygenSaturation: { label: 'O₂', unit: '%', normalRange: [95, 100], color: '#0ea5e9' },
  bodyFat:       { label: 'Λίπος', unit: '%', color: '#d97706' },
  waistCircumference: { label: 'Μέση', unit: 'cm', color: '#14b8a6' },
};

function getStatusColor(status: string) {
  const map: Record<string, string> = { confirmed: 'bg-green-100 text-green-700', pending: 'bg-yellow-100 text-yellow-700', completed: 'bg-gray-100 text-gray-600', cancelled: 'bg-red-100 text-red-700' };
  return map[status] || 'bg-gray-100 text-gray-600';
}

function getUrgencyStyle(urgency: string) {
  if (urgency === 'important') return 'border-l-4 border-orange-400 bg-orange-50';
  if (urgency === 'attention') return 'border-l-4 border-yellow-400 bg-yellow-50';
  return 'border-l-4 border-blue-400 bg-blue-50';
}

export default function Home() {
  const { user } = useAuthStore();
  const { activeMemberId, members } = useFamilyStore();
  const { openModal: openSuggestions, setSuggestionText, setStreaming, lastSuggestions, lastSuggestionsDate, showLastPanel, openLastPanel, closeLastPanel } = useSuggestionStore();

  const handleOpenSuggestions = () => {
    setSuggestionText('');
    setStreaming(false);
    openSuggestions();
  };
  const activeMember = activeMemberId ? members.find(m => m.id === activeMemberId) : null;

  const familyParam = activeMemberId ? `?familyMemberId=${activeMemberId}` : '';

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', activeMemberId],
    queryFn: () => api.get('/patient/dashboard').then(r => r.data.data)
  });

  const { data: insights } = useQuery({
    queryKey: ['insights', activeMemberId],
    queryFn: () => api.get('/patient/insights').then(r => r.data.data)
  });

  const { data: upcomingAppts } = useQuery({
    queryKey: ['appointments', 'upcoming', activeMemberId],
    queryFn: () => api.get(`/appointments?status=upcoming${activeMemberId ? `&familyMemberId=${activeMemberId}` : ''}`).then(r => r.data.data)
  });

  const { data: meds } = useQuery({
    queryKey: ['medications', activeMemberId],
    queryFn: () => api.get(`/medications${familyParam}`).then(r => r.data.data)
  });

  const { data: metricsData } = useQuery({
    queryKey: ['metrics', 'bloodPressure', activeMemberId],
    queryFn: () => api.get('/patient/metrics/bloodPressure').then(r => r.data.data),
    enabled: !activeMemberId // metrics only for self
  });

  const { data: allAppointments } = useQuery({
    queryKey: ['appointments', 'all'],
    queryFn: () => api.get('/appointments').then(r => r.data.data),
    enabled: !activeMemberId
  });

  const { data: testResults } = useQuery({
    queryKey: ['results'],
    queryFn: () => api.get('/results').then(r => r.data.data),
    enabled: !activeMemberId
  });

  const { data: allMetrics } = useQuery({
    queryKey: ['metrics', 'all'],
    queryFn: () => api.get('/patient/metrics/all').then(r => r.data.data),
    enabled: !activeMemberId
  });

  const chartData = metricsData?.map((m: any) => ({
    date: new Date(m.recordedAt).toLocaleDateString('el-GR', { month: 'short', day: 'numeric' }),
    value: m.value
  })).reverse() || [];

  const abnormalCount = (testResults || []).reduce((acc: number, r: any) => {
    return acc + (r.values || []).filter((v: any) => ['high', 'low', 'critical'].includes(v.status)).length;
  }, 0);

  const lastMetricDate = (() => {
    const types = Object.keys(allMetrics || {});
    if (types.length === 0) return 'Καμία';
    let latest: Date | null = null;
    for (const type of types) {
      const readings: any[] = allMetrics[type] || [];
      for (const r of readings) {
        const d = new Date(r.recordedAt || r.date);
        if (!latest || d > latest) latest = d;
      }
    }
    return latest ? latest.toLocaleDateString('el-GR', { day: 'numeric', month: 'short' }) : 'Καμία';
  })();

  const apptByStatus = [
    { name: 'Επιβεβαιωμένα', value: allAppointments?.filter((a: any) => a.status === 'confirmed').length || 0, fill: '#22c55e' },
    { name: 'Εκκρεμή', value: allAppointments?.filter((a: any) => a.status === 'pending').length || 0, fill: '#f59e0b' },
    { name: 'Ολοκληρωμένα', value: allAppointments?.filter((a: any) => a.status === 'completed').length || 0, fill: '#6366f1' },
    { name: 'Ακυρωμένα', value: allAppointments?.filter((a: any) => a.status === 'cancelled').length || 0, fill: '#ef4444' },
  ].filter(d => d.value > 0);

  const medsByFreq = Object.entries(
    (meds || []).reduce((acc: any, m: any) => {
      acc[m.frequency] = (acc[m.frequency] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value: value as number }));

  const PIE_COLORS = ['#0066CC', '#22c55e', '#f59e0b', '#a855f7', '#ef4444'];

  const abnormalValues = (testResults || []).flatMap((r: any) =>
    (r.values || [])
      .filter((v: any) => v.status !== 'normal')
      .map((v: any) => ({ ...v, testType: r.testType }))
  );

  const statusColor: Record<string, string> = {
    normal: 'text-green-600 bg-green-50',
    high: 'text-red-600 bg-red-50',
    low: 'text-blue-600 bg-blue-50',
    critical: 'text-red-800 bg-red-100'
  };

  const displayName = activeMember ? activeMember.name.split(' ')[0] : user?.firstName;

  if (isLoading) return (
    <div className="space-y-6">
      <div className="skeleton h-40 rounded-2xl" />
      <div className="grid grid-cols-3 gap-4">{[1, 2, 3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className={`rounded-2xl p-6 text-white ${activeMember ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-primary to-primary-medium'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {activeMember ? `Προφίλ: ${activeMember.name}` : `Καλημέρα, ${displayName}! 👋`}
            </h1>
            <p className={`mt-1 text-sm ${activeMember ? 'text-orange-100' : 'text-blue-100'}`}>
              {activeMember
                ? `Βλέπετε τα δεδομένα υγείας για ${activeMember.name} (${activeMember.relation === 'child' ? 'Παιδί' : activeMember.relation === 'spouse' ? 'Σύζυγος' : activeMember.relation === 'parent' ? 'Γονέας' : 'Μέλος'})`
                : 'Πώς νιώθετε σήμερα;'}
            </p>
          </div>
          <div className="text-right hidden md:block">
            <p className={`text-sm ${activeMember ? 'text-orange-100' : 'text-blue-100'}`}>{new Date().toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/search" className="inline-flex items-center gap-2 bg-white text-gray-800 font-medium text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            Αναζήτηση Γιατρού
          </Link>
          {!activeMember && (
            <Link to="/assistant" className="inline-flex items-center gap-2 bg-white/20 text-white font-medium text-sm px-4 py-2 rounded-lg hover:bg-white/30 transition-colors border border-white/30">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              Medical Assistant
            </Link>
          )}
          {activeMember?.conditions?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {activeMember.conditions.map(c => <span key={c} className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full border border-white/30">{c}</span>)}
            </div>
          )}
        </div>
      </div>

      {/* AI Suggestions card — self only */}
      {!activeMember && (
        <div className="card p-5 flex items-center justify-between gap-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Προτάσεις Υγείας AI</p>
              <p className="text-xs text-gray-500 truncate">
                {lastSuggestionsDate
                  ? `Τελευταία ανάλυση: ${new Date(lastSuggestionsDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                  : 'Εξατομικευμένες συμβουλές βάσει του προφίλ σας'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {lastSuggestions && (
              <button
                onClick={openLastPanel}
                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                Προηγούμενες
              </button>
            )}
            <button
              onClick={handleOpenSuggestions}
              className="inline-flex items-center gap-1.5 btn-primary text-sm px-4 py-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              {lastSuggestions ? 'Ανανέωση' : 'Δημιουργία Προτάσεων'}
            </button>
          </div>
        </div>
      )}

      {/* Stats cards row — self only */}
      {!activeMember && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Ραντεβού */}
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{allAppointments?.length ?? '—'}</p>
              <p className="text-xs text-gray-500">Ραντεβού · Σύνολο</p>
            </div>
          </div>
          {/* Ενεργά Φάρμακα */}
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-light rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{meds?.filter((m: any) => m.isActive).length ?? '—'}</p>
              <p className="text-xs text-gray-500">Ενεργά Φάρμακα</p>
            </div>
          </div>
          {/* Ανώμαλες Τιμές */}
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{abnormalCount}</p>
              <p className="text-xs text-gray-500">Ανώμαλες Τιμές</p>
            </div>
          </div>
          {/* Τελευταία Μέτρηση */}
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{lastMetricDate}</p>
              <p className="text-xs text-gray-500">Τελευταία Μέτρηση</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming appointments */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Επερχόμενα Ραντεβού{activeMember ? ` · ${activeMember.name.split(' ')[0]}` : ''}</h2>
            <Link to="/appointments" className="text-sm text-primary hover:underline">Όλα →</Link>
          </div>
          {upcomingAppts?.length > 0 ? (
            <div className="space-y-3">
              {upcomingAppts.slice(0, 3).map((appt: any) => (
                <div key={appt._id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{appt.doctorId?.profile?.firstName} {appt.doctorId?.profile?.lastName}</p>
                    <p className="text-xs text-gray-500">{appt.service} · {new Date(appt.dateTime).toLocaleDateString('el-GR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span className={`badge ${getStatusColor(appt.status)}`}>{appt.status === 'confirmed' ? 'Επιβεβαιωμένο' : 'Εκκρεμές'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <p className="text-sm">Δεν υπάρχουν επερχόμενα ραντεβού</p>
              <Link to="/search" className="btn-primary mt-3 inline-flex text-sm py-1.5">Κλείστε Ραντεβού</Link>
            </div>
          )}
        </div>

        {/* Medications */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Φάρμακα{activeMember ? ` · ${activeMember.name.split(' ')[0]}` : ''}</h2>
            <Link to="/health-records?tab=medications" className="text-sm text-primary hover:underline">Όλα →</Link>
          </div>
          {meds?.filter((m: any) => m.isActive).length > 0 ? (
            <div className="space-y-2.5">
              {meds.filter((m: any) => m.isActive).slice(0, 4).map((med: any) => (
                <div key={med._id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                  <div className="w-7 h-7 bg-teal-light rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{med.name}</p>
                    <p className="text-xs text-gray-500">{med.dosage} · {med.frequency}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">Δεν υπάρχουν ενεργά φάρμακα</p>
          )}
        </div>
      </div>

      {/* AI Insights (only for self) */}
      {!activeMember && insights?.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">AI Παρατηρήσεις Υγείας</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {insights.map((insight: any, i: number) => (
              <div key={i} className={`p-4 rounded-xl ${getUrgencyStyle(insight.urgency)}`}>
                <h3 className="font-medium text-gray-900 text-sm">{insight.title}</h3>
                <p className="text-xs text-gray-600 mt-1">{insight.description}</p>
                {insight.suggestedAction && <p className="text-xs font-medium text-gray-700 mt-2">→ {insight.suggestedAction}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Family member known conditions */}
      {activeMember && (activeMember.conditions?.length > 0 || activeMember.medications?.length > 0 || activeMember.notes) && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Ιατρικό Ιστορικό · {activeMember.name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeMember.conditions?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Γνωστές Παθήσεις</p>
                <div className="flex flex-wrap gap-1.5">
                  {activeMember.conditions.map(c => <span key={c} className="badge bg-red-50 text-red-700">{c}</span>)}
                </div>
              </div>
            )}
            {activeMember.medications?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Φάρμακα</p>
                <div className="flex flex-wrap gap-1.5">
                  {activeMember.medications.map(m => <span key={m} className="badge bg-teal-light text-teal">{m}</span>)}
                </div>
              </div>
            )}
            {activeMember.notes && (
              <div className="md:col-span-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Σημειώσεις</p>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{activeMember.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charts section — self only */}
      {!activeMember && (
        <>
          {/* Row A+B: Appointments by status & Medications by frequency */}
          {(apptByStatus.length > 0 || medsByFreq.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {apptByStatus.length > 0 && (
                <div className="card p-5">
                  <h2 className="font-semibold text-gray-900 mb-4">Ραντεβού ανά Κατάσταση</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={apptByStatus} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {apptByStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {medsByFreq.length > 0 && (
                <div className="card p-5">
                  <h2 className="font-semibold text-gray-900 mb-4">Φάρμακα ανά Συχνότητα</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={medsByFreq} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                        {medsByFreq.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Row C: Abnormal test values */}
          {abnormalValues.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Ανώμαλες Τιμές Εξετάσεων</h2>
              <div className="flex flex-wrap gap-2">
                {abnormalValues.map((v: any, i: number) => (
                  <span key={i} className={`badge ${statusColor[v.status] || 'bg-gray-100 text-gray-600'}`}>
                    {v.name}: {v.value} {v.unit}
                    {v.status === 'high' ? ' ↑' : v.status === 'low' ? ' ↓' : ' ⚠'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Row D: All metric charts */}
          {allMetrics && Object.keys(allMetrics).length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Μετρήσεις Υγείας</h2>
                <Link to="/metrics" className="text-sm text-primary hover:underline">Αναλυτικά →</Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {Object.keys(allMetrics).map((type) => {
                  const raw: any[] = allMetrics[type] || [];
                  // newest-first from API; take 15 newest, reverse to chronological
                  const readings = raw.slice(0, 15).reverse().map((m: any) => ({
                    date: new Date(m.recordedAt || m.date).toLocaleDateString('el-GR', { day: 'numeric', month: 'short' }),
                    value: typeof m.value === 'number' ? m.value : parseFloat(m.value),
                  }));
                  const meta = METRIC_LABELS[type] || { label: type, unit: '', color: '#0066CC' };
                  const latest = raw[0];
                  const latestVal = latest ? (typeof latest.value === 'number' ? latest.value : parseFloat(latest.value)) : null;
                  const isAbnormal = latestVal !== null && meta.normalRange
                    ? (latestVal < meta.normalRange[0] || latestVal > meta.normalRange[1])
                    : false;

                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-semibold text-gray-700">{meta.label}</p>
                          {meta.normalRange && (
                            <p className="text-xs text-gray-400">Φυσ.: {meta.normalRange[0]}–{meta.normalRange[1]} {meta.unit}</p>
                          )}
                        </div>
                        {latestVal !== null && (
                          <span className={`badge font-mono text-xs px-2 py-0.5 ${isAbnormal ? 'bg-red-100 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            {latestVal} {meta.unit}
                          </span>
                        )}
                      </div>
                      {readings.length > 1 ? (
                        <ResponsiveContainer width="100%" height={120}>
                          <LineChart data={readings} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
                            <Tooltip
                              contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6 }}
                              formatter={(v: any) => [`${v} ${meta.unit}`, meta.label]}
                            />
                            <Line type="monotone" dataKey="value" stroke={meta.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[120px] flex items-center justify-center bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-400 text-center px-2">1 μέτρηση<br/>{latestVal} {meta.unit}</p>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{raw.length} μετρήσεις · {latest ? new Date(latest.recordedAt || latest.date).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Last suggestions panel */}
      {showLastPanel && lastSuggestions && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && closeLastPanel()}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 text-base">Τελευταίες Προτάσεις</h2>
                  {lastSuggestionsDate && (
                    <p className="text-xs text-gray-400">{new Date(lastSuggestionsDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  )}
                </div>
              </div>
              <button onClick={closeLastPanel} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="prose prose-sm max-w-none text-gray-800">
                <ReactMarkdown>{lastSuggestions}</ReactMarkdown>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => { closeLastPanel(); handleOpenSuggestions(); }}
                className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Ανανέωση
              </button>
              <button onClick={closeLastPanel} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm font-medium">
                Κλείσιμο
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
