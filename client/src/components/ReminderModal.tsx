import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

interface Props {
  type: 'medication' | 'examination' | 'appointment';
  title: string;
  description?: string;
  referenceId?: string;
  familyMemberId?: string;
  defaultDate?: string;   // YYYY-MM-DD
  defaultTime?: string;   // HH:MM
  onClose: () => void;
}

const TYPE_LABELS = {
  medication: { icon: '💊', label: 'Φάρμακο', color: 'bg-teal-light text-teal border-teal/20' },
  examination: { icon: '🔬', label: 'Εξέταση', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  appointment: { icon: '📅', label: 'Ραντεβού', color: 'bg-primary-light text-primary border-primary/20' }
};

export default function ReminderModal({ type, title, description, referenceId, familyMemberId, defaultDate, defaultTime, onClose }: Props) {
  const qc = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(defaultDate || today);
  const [time, setTime] = useState(defaultTime || '08:00');
  const [recurring, setRecurring] = useState(false);
  const [recurDays, setRecurDays] = useState<number[]>([]);
  const [note, setNote] = useState(description || '');
  const [done, setDone] = useState(false);

  const meta = TYPE_LABELS[type];
  const DAY_LABELS = ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ'];

  const mutation = useMutation({
    mutationFn: () => {
      const remindAt = new Date(`${date}T${time}:00`).toISOString();
      return api.post('/reminders', {
        type,
        title,
        description: note || undefined,
        referenceId,
        familyMemberId,
        remindAt,
        recurring: recurring ? { enabled: true, days: recurDays, time } : { enabled: false, days: [], time }
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders'] });
      setDone(true);
      setTimeout(onClose, 1400);
    }
  });

  const toggleDay = (d: number) =>
    setRecurDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg border ${meta.color}`}>
            {meta.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 text-sm">Υπενθύμιση</h2>
            <p className="text-xs text-gray-500 truncate">{title}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {done ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="font-semibold text-gray-900">Η υπενθύμιση αποθηκεύτηκε!</p>
            </div>
          ) : (
            <>
              {/* Date & time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ημερομηνία</label>
                  <input type="date" className="input-field text-sm" value={date} min={today} onChange={e => setDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ώρα</label>
                  <input type="time" className="input-field text-sm" value={time} onChange={e => setTime(e.target.value)} />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Σημείωση <span className="text-gray-400">(προαιρετικό)</span></label>
                <input type="text" className="input-field text-sm" placeholder="π.χ. Με νερό, πριν το φαγητό..." value={note} onChange={e => setNote(e.target.value)} />
              </div>

              {/* Recurring toggle */}
              <div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${recurring ? 'bg-primary' : 'bg-gray-300'}`}
                    onClick={() => setRecurring(r => !r)}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${recurring ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Επαναλαμβανόμενη</span>
                </label>

                {recurring && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-2">Επιλέξτε ημέρες</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {DAY_LABELS.map((label, i) => (
                        <button key={i} type="button" onClick={() => toggleDay(i)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                            recurDays.includes(i)
                              ? 'bg-primary text-white border-primary'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-primary/50'
                          }`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="btn-ghost flex-1 text-sm">Ακύρωση</button>
                <button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                  className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {mutation.isPending
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>Αποθήκευση</>
                  }
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
