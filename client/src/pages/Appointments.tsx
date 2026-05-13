import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import api from '../api/client';
import { useFamilyStore } from '../store/familyStore';

const statusLabel: Record<string, string> = {
  confirmed: 'Επιβεβαιωμένο',
  pending: 'Εκκρεμές',
  completed: 'Ολοκληρωμένο',
  cancelled: 'Ακυρωμένο',
};
const statusColor: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};
const dotColor: Record<string, string> = {
  completed: 'bg-blue-400',
  confirmed: 'bg-green-500',
  pending: 'bg-yellow-400',
  cancelled: 'bg-gray-300',
};
const chartColors: Record<string, string> = {
  completed: '#60a5fa',
  confirmed: '#34d399',
  pending: '#fbbf24',
  cancelled: '#d1d5db',
};
const MONTH_EL = ['Ιαν','Φεβ','Μάρ','Απρ','Μαΐ','Ιούν','Ιούλ','Αύγ','Σεπ','Οκτ','Νοε','Δεκ'];

function formatMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function formatMonthLabel(key: string) {
  const [y, m] = key.split('-');
  return `${MONTH_EL[parseInt(m) - 1]} '${y.slice(2)}`;
}

// ── Graph View ───────────────────────────────────────────────────────────────

function GraphView({ appointments }: { appointments: any[] }) {
  const [selectedDot, setSelectedDot] = useState<any>(null);

  // Group by month
  const byMonth: Record<string, any[]> = {};
  (appointments || []).forEach((a: any) => {
    const key = formatMonthKey(new Date(a.dateTime));
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(a);
  });
  const sortedMonths = Object.keys(byMonth).sort();

  // Chart data
  const chartData = sortedMonths.map(key => ({
    month: formatMonthLabel(key),
    Ολοκληρωμένα: byMonth[key].filter(a => a.status === 'completed').length,
    Επιβεβαιωμένα: byMonth[key].filter(a => a.status === 'confirmed').length,
    Εκκρεμή: byMonth[key].filter(a => a.status === 'pending').length,
    Ακυρωμένα: byMonth[key].filter(a => a.status === 'cancelled').length,
  }));

  // Summary stats
  const total = appointments?.length || 0;
  const completed = appointments?.filter(a => a.status === 'completed').length || 0;
  const upcoming = appointments?.filter(a => new Date(a.dateTime) >= new Date() && a.status !== 'cancelled').length || 0;
  const cancelled = appointments?.filter(a => a.status === 'cancelled').length || 0;

  const stats = [
    { label: 'Σύνολο', value: total, color: 'text-gray-700', bg: 'bg-gray-50' },
    { label: 'Ολοκληρωμένα', value: completed, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Επερχόμενα', value: upcoming, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Ακυρωμένα', value: cancelled, color: 'text-gray-400', bg: 'bg-gray-50' },
  ];

  if (!appointments?.length) {
    return (
      <div className="card p-10 text-center text-gray-400">
        <p className="text-sm">Δεν υπάρχουν δεδομένα για γράφημα</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className={`card p-4 ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Ραντεβού ανά μήνα</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={28} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: 12 }}
                cursor={{ fill: '#f9fafb' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Bar dataKey="Ολοκληρωμένα" stackId="a" fill={chartColors.completed} radius={[0,0,0,0]} />
              <Bar dataKey="Επιβεβαιωμένα" stackId="a" fill={chartColors.confirmed} radius={[0,0,0,0]} />
              <Bar dataKey="Εκκρεμή" stackId="a" fill={chartColors.pending} radius={[0,0,0,0]} />
              <Bar dataKey="Ακυρωμένα" stackId="a" fill={chartColors.cancelled} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">Δεν υπάρχουν δεδομένα</p>
        )}
      </div>

      {/* Horizontal dot timeline */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-5">Χρονολόγιο επισκέψεων</h2>
        <div className="overflow-x-auto pb-2">
          <div className="relative min-w-max">
            {/* Horizontal connecting line */}
            <div className="absolute top-[2.75rem] left-0 right-0 h-0.5 bg-gray-200" />

            <div className="flex">
              {sortedMonths.map(key => {
                const appts = byMonth[key];
                return (
                  <div key={key} className="flex flex-col items-center px-3 min-w-[100px]">
                    {/* Month label */}
                    <p className="text-xs font-semibold text-gray-500 mb-3 whitespace-nowrap">
                      {formatMonthLabel(key)}
                    </p>
                    {/* Dot row */}
                    <div className="relative z-10 flex flex-col items-center gap-2 mt-1">
                      {appts.map((a: any) => (
                        <button
                          key={a._id}
                          onClick={() => setSelectedDot(selectedDot?._id === a._id ? null : a)}
                          title={`${a.doctorId?.profile?.firstName} ${a.doctorId?.profile?.lastName} — ${statusLabel[a.status]}`}
                          className="relative group"
                        >
                          <div className={`w-3.5 h-3.5 rounded-full ring-2 ring-white shadow-sm transition-transform group-hover:scale-125 ${dotColor[a.status] || 'bg-gray-300'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-gray-100">
          {Object.entries(dotColor).map(([status, cls]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${cls}`} />
              <span className="text-xs text-gray-500">{statusLabel[status]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected dot detail card */}
      {selectedDot && (
        <div className="card p-4 border-l-4 border-primary animate-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm text-gray-900">
                {selectedDot.doctorId?.profile?.firstName} {selectedDot.doctorId?.profile?.lastName}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedDot.service}
                {selectedDot.doctorId?.specialties?.[0] && ` · ${selectedDot.doctorId.specialties[0]}`}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(selectedDot.dateTime).toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              {selectedDot.diagnosis?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedDot.diagnosis.map((d: any, i: number) => (
                    <span key={i} className="badge bg-blue-50 text-blue-700 text-xs">{d.description}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className={`badge text-xs ${statusColor[selectedDot.status] || 'bg-gray-100 text-gray-600'}`}>
                {statusLabel[selectedDot.status]}
              </span>
              <button onClick={() => setSelectedDot(null)} className="text-gray-300 hover:text-gray-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type View = 'upcoming' | 'past' | 'all' | 'graph';

export default function Appointments() {
  const [view, setView] = useState<View>('upcoming');
  const [questionsAppt, setQuestionsAppt] = useState<any>(null);
  const [questionsText, setQuestionsText] = useState('');
  const [doctorNotesAppt, setDoctorNotesAppt] = useState<any>(null);
  const qc = useQueryClient();
  const { activeMemberId, members } = useFamilyStore();
  const activeMember = activeMemberId ? members.find(m => m.id === activeMemberId) : null;

  // List query (upcoming / past / all)
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments', view === 'graph' ? 'all' : view, activeMemberId],
    queryFn: () => {
      const params = new URLSearchParams({ status: view === 'graph' ? 'all' : view });
      if (activeMemberId) params.set('familyMemberId', activeMemberId);
      return api.get(`/appointments?${params}`).then(r => r.data.data);
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.put(`/appointments/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  });

  const saveNotesMut = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      api.patch(`/appointments/${id}/notes`, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      setQuestionsAppt(null);
    },
  });

  const openNotesModal = (appt: any) => {
    setQuestionsText(appt.notes || '');
    setQuestionsAppt(appt);
  };

  const tabs: { id: View; label: string }[] = [
    { id: 'upcoming', label: 'Επερχόμενα' },
    { id: 'past', label: 'Προηγούμενα' },
    { id: 'all', label: 'Όλα' },
    { id: 'graph', label: 'Γραφήματα' },
  ];

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Ιστορικό Υγείας</h1>
        <p className="text-sm text-gray-500 mt-0.5">Ραντεβού &amp; επισκέψεις</p>
        {activeMember && (
          <p className="text-sm text-amber-600 mt-0.5">Προβολή για: <strong>{activeMember.name}</strong></p>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── GRAPH VIEW ─────────────────────────────────────────────────────── */}
      {view === 'graph' && (
        isLoading
          ? <div className="space-y-4">{[1,2].map(i => <div key={i} className="skeleton h-40 rounded-xl" />)}</div>
          : <GraphView appointments={appointments || []} />
      )}

      {/* ── LIST VIEW ──────────────────────────────────────────────────────── */}
      {view !== 'graph' && (
        <>
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
            </div>
          )}

          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-4">
              {appointments?.map((appt: any) => (
                <div key={appt._id} className="relative flex gap-4 pl-12">
                  <div
                    className={`absolute left-3.5 w-3 h-3 rounded-full ring-2 ring-white ${dotColor[appt.status] || 'bg-gray-400'}`}
                    style={{ top: '1.4rem' }}
                  />
                  <div className="card p-5 flex-1">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                        {appt.doctorId?.profile?.firstName?.[0]}{appt.doctorId?.profile?.lastName?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-sm text-gray-900">
                              {appt.doctorId?.profile?.firstName} {appt.doctorId?.profile?.lastName}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {appt.service}
                              {appt.doctorId?.specialties?.length > 0 && (
                                <span className="text-gray-400"> · {appt.doctorId.specialties[0]}</span>
                              )}
                            </p>
                            {appt.familyMemberId && (
                              <span className="inline-block mt-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                                {members.find(m => m.id === appt.familyMemberId)?.name || 'Μέλος οικογένειας'}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <p className="text-xs text-gray-400">
                              {new Date(appt.dateTime).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {' '}
                              {new Date(appt.dateTime).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <span className={`badge text-xs ${statusColor[appt.status] || 'bg-gray-100 text-gray-600'}`}>
                              {statusLabel[appt.status] || appt.status}
                            </span>
                            <span className="text-xs text-gray-400">
                              {appt.type === 'in-person' ? 'Δια ζώσης' : appt.type === 'video' ? 'Βιντεοκλήση' : 'Τηλέφωνο'}
                            </span>
                          </div>
                        </div>

                        {appt.notes && (
                          <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded-lg">
                            <p className="text-xs font-semibold text-blue-700 mb-0.5">📝 Σημειώσεις</p>
                            <p className="text-xs text-gray-700 whitespace-pre-wrap">{appt.notes}</p>
                          </div>
                        )}

                        {appt.diagnosis?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {appt.diagnosis.map((d: any, i: number) => (
                              <span key={i} className="badge bg-blue-50 text-blue-700 text-xs">{d.description}</span>
                            ))}
                          </div>
                        )}

                        {appt.prescriptions?.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {appt.prescriptions.map((p: any, i: number) => (
                              <span key={i} className="badge bg-purple-50 text-purple-700 text-xs">
                                {p.medication || p.name || p}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 flex items-center gap-4 flex-wrap">
                          {(appt.status === 'pending' || appt.status === 'confirmed') && (
                            <>
                              <button
                                onClick={() => openNotesModal(appt)}
                                className="text-sm text-purple-600 hover:text-purple-700 hover:underline flex items-center gap-1"
                              >
                                📝 {appt.notes ? 'Επεξεργασία Σημειώσεων' : 'Προσθήκη Σημειώσεων'}
                              </button>
                              <button
                                onClick={() => cancelMut.mutate(appt._id)}
                                className="text-sm text-red-500 hover:text-red-700 hover:underline"
                              >
                                Ακύρωση
                              </button>
                            </>
                          )}
                          {appt.status === 'completed' &&
                            (appt.doctorNotes || appt.diagnosis?.length > 0 || appt.prescriptions?.length > 0 || appt.followUpDate) && (
                              <button
                                onClick={() => setDoctorNotesAppt(appt)}
                                className="text-sm text-teal-700 hover:text-teal-800 hover:underline flex items-center gap-1.5"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Σημειώσεις Γιατρού
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {!isLoading && appointments?.length === 0 && (
                <div className="card p-10 text-center text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">
                    Δεν υπάρχουν ραντεβού{activeMember ? ` για ${activeMember.name}` : ''}
                    {view === 'upcoming' ? ' στο μέλλον' : view === 'past' ? ' στο παρελθόν' : ''}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Doctor's Notes Modal (read-only) ────────────────────────────────── */}
      {doctorNotesAppt && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setDoctorNotesAppt(null); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between flex-shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </span>
                  <h3 className="text-lg font-semibold text-gray-900">Σημειώσεις Γιατρού</h3>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {doctorNotesAppt.doctorId?.profile?.firstName} {doctorNotesAppt.doctorId?.profile?.lastName}
                  {' · '}
                  {new Date(doctorNotesAppt.dateTime).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setDoctorNotesAppt(null)} className="text-gray-400 hover:text-gray-600 mt-0.5">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
              {doctorNotesAppt.doctorNotes && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Σημειώσεις</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-xl p-4 leading-relaxed">
                    {doctorNotesAppt.doctorNotes}
                  </p>
                </div>
              )}
              {doctorNotesAppt.diagnosis?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Διάγνωση</p>
                  <div className="flex flex-wrap gap-2">
                    {doctorNotesAppt.diagnosis.map((d: any, i: number) => (
                      <span key={i} className="px-3 py-1.5 bg-blue-50 text-blue-800 border border-blue-100 rounded-lg text-sm">
                        {d.description}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {doctorNotesAppt.prescriptions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Συνταγογράφηση</p>
                  <div className="space-y-2">
                    {doctorNotesAppt.prescriptions.map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-teal-50 border border-teal-100 rounded-xl text-sm">
                        <span className="font-medium text-teal-900">{p.medication}</span>
                        <div className="flex items-center gap-3 text-teal-700 text-xs">
                          {p.dosage && <span>{p.dosage}</span>}
                          {p.duration && <span>· {p.duration}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {doctorNotesAppt.followUpDate && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Επόμενο Ραντεβού</p>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {new Date(doctorNotesAppt.followUpDate).toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              )}
              {!doctorNotesAppt.doctorNotes && !doctorNotesAppt.diagnosis?.length && !doctorNotesAppt.prescriptions?.length && !doctorNotesAppt.followUpDate && (
                <p className="text-sm text-gray-400 text-center py-6">Ο γιατρός δεν έχει προσθέσει σημειώσεις ακόμα.</p>
              )}
            </div>

            <div className="px-6 pb-6 pt-4 border-t border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Αυτές οι σημειώσεις είναι μόνο για ανάγνωση
              </div>
              <button onClick={() => setDoctorNotesAppt(null)} className="btn-primary w-full py-2.5">Κλείσιμο</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Patient Notes Modal ──────────────────────────────────────────────── */}
      {questionsAppt && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget && !saveNotesMut.isPending) setQuestionsAppt(null); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Σημειώσεις Ραντεβού</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {questionsAppt.doctorId?.profile?.firstName} {questionsAppt.doctorId?.profile?.lastName}
                    {' · '}
                    {new Date(questionsAppt.dateTime).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button
                  onClick={() => setQuestionsAppt(null)}
                  disabled={saveNotesMut.isPending}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-40"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-xs text-gray-500 mb-3">
                Γράψτε οτιδήποτε θέλετε να θυμηθείτε ή να συζητήσετε με τον γιατρό. Θα είναι ορατό κατά τη διάρκεια του ραντεβού.
              </p>
              <textarea
                value={questionsText}
                onChange={e => setQuestionsText(e.target.value)}
                rows={7}
                placeholder={`π.χ.\n• Πόσο συχνά πρέπει να μετράω την πίεσή μου;\n• Μπορώ να συνεχίσω τη φυσική δραστηριότητα;\n• Υπάρχουν παρενέργειες από τα φάρμακά μου;`}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              />
              {saveNotesMut.isError && (
                <p className="text-xs text-red-600 mt-2">Σφάλμα αποθήκευσης. Δοκιμάστε ξανά.</p>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setQuestionsAppt(null)} disabled={saveNotesMut.isPending} className="btn-ghost flex-1 py-2.5 disabled:opacity-50">
                Ακύρωση
              </button>
              <button
                onClick={() => saveNotesMut.mutate({ id: questionsAppt._id, notes: questionsText })}
                disabled={saveNotesMut.isPending}
                className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saveNotesMut.isPending && (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Αποθήκευση
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
