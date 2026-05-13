import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useFamilyStore } from '../store/familyStore';
import ReminderModal from '../components/ReminderModal';

export default function Medications() {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', dosage: '', frequency: '1x daily', startDate: new Date().toISOString().split('T')[0], isActive: true });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reminderMed, setReminderMed] = useState<any | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const { activeMemberId, members } = useFamilyStore();
  const activeMember = activeMemberId ? members.find(m => m.id === activeMemberId) : null;

  const { data: meds, isLoading } = useQuery({
    queryKey: ['medications', activeMemberId],
    queryFn: () => {
      const params = activeMemberId ? `?familyMemberId=${activeMemberId}` : '';
      return api.get(`/medications${params}`).then(r => r.data.data);
    }
  });

  const addMut = useMutation({
    mutationFn: () => api.post('/medications', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['medications'] }); setAdding(false); setForm({ name: '', dosage: '', frequency: '1x daily', startDate: new Date().toISOString().split('T')[0], isActive: true }); }
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/medications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['medications'] })
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Φάρμακα</h1>
          {activeMember && <p className="text-sm text-amber-600 mt-0.5">Προβολή για: <strong>{activeMember.name}</strong></p>}
        </div>
        {!activeMember && <button onClick={() => setAdding(true)} className="btn-primary text-sm">+ Προσθήκη</button>}
      </div>

      {isLoading && <div className="grid grid-cols-2 gap-4">{[1,2,3,4].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {meds?.map((med: any) => (
          <div key={med._id} className={`card p-5 ${!med.isActive ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-light rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{med.name}</h3>
                  <p className="text-sm text-gray-500">{med.dosage} · {med.frequency}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const pronoun = activeMember ? `της` : `μου`;
                    const msg = activeMember
                      ? `Παίρνει η ${activeMember.name} (${activeMember.relation}) το φάρμακο ${med.name} ${med.dosage} (${med.frequency}). Γιατί της έχει συνταγογραφηθεί; Πώς πρέπει να το παίρνει; Τι παρενέργειες έχει και αν υπάρχουν αλληλεπιδράσεις με άλλα φάρμακα ${pronoun};`
                      : `Παίρνω το φάρμακο ${med.name} ${med.dosage} (${med.frequency}). Γιατί μου έχει συνταγογραφηθεί; Πώς πρέπει να το παίρνω; Τι παρενέργειες έχει και αν υπάρχουν αλληλεπιδράσεις με άλλα φάρμακά μου;`;
                    navigate(`/assistant?prefill=${encodeURIComponent(msg)}`);
                  }}
                  title="Medical Assistant"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-purple-500 hover:bg-purple-50 transition-colors text-sm"
                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </button>
                <button onClick={() => setReminderMed(med)} title="Ορισμός υπενθύμισης"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary-light transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </button>
                <button onClick={() => deleteMut.mutate(med._id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors text-xs">✕</button>
              </div>
            </div>
            {med.reminders?.length > 0 && (
              <div className="mt-2 flex gap-1">
                {med.reminders.map((r: any, i: number) => <span key={i} className="badge bg-yellow-50 text-yellow-700">⏰ {r.time}</span>)}
              </div>
            )}
            {med.plainDescription && (
              <div className="mt-3">
                <button onClick={() => setExpanded(expanded === med._id ? null : med._id)} className="text-xs text-primary hover:underline">
                  {expanded === med._id ? '▲ Απόκρυψη' : '▼ Γιατί παίρνω αυτό;'}
                </button>
                {expanded === med._id && <p className="text-xs text-gray-600 mt-2 p-2 bg-blue-50 rounded-lg">{med.plainDescription}</p>}
              </div>
            )}
            {med.prescribedBy && <p className="text-xs text-gray-400 mt-2">Συνταγογράφηση: {med.prescribedBy?.profile?.firstName} {med.prescribedBy?.profile?.lastName}</p>}
          </div>
        ))}
      </div>

      {!isLoading && meds?.length === 0 && (
        <div className="card p-10 text-center text-gray-400">
          <p className="text-sm mb-3">Δεν υπάρχουν καταγεγραμμένα φάρμακα{activeMember ? ` για ${activeMember.name}` : ''}</p>
          {!activeMember && <button onClick={() => setAdding(true)} className="btn-primary text-sm">Προσθήκη Φαρμάκου</button>}
        </div>
      )}

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

      {adding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setAdding(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Νέο Φάρμακο</h2>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Όνομα</label><input className="input-field" value={form.name} onChange={set('name')} placeholder="π.χ. Amlodipine" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Δόση</label><input className="input-field" value={form.dosage} onChange={set('dosage')} placeholder="π.χ. 5mg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Συχνότητα</label>
                  <select className="input-field" value={form.frequency} onChange={set('frequency')}>
                    <option>1x daily</option><option>2x daily</option><option>3x daily</option><option>As needed</option>
                  </select>
                </div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Ημ/νία Έναρξης</label><input type="date" className="input-field" value={form.startDate} onChange={set('startDate')} /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setAdding(false)} className="btn-ghost flex-1">Ακύρωση</button>
              <button onClick={() => addMut.mutate()} disabled={!form.name || addMut.isPending} className="btn-primary flex-1">Αποθήκευση</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
