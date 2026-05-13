import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

const TYPE_ICON: Record<string, string> = { medication: '💊', examination: '🔬', appointment: '📅' };
const TYPE_COLOR: Record<string, string> = {
  medication: 'bg-teal-light text-teal',
  examination: 'bg-blue-50 text-blue-700',
  appointment: 'bg-primary-light text-primary'
};

function formatRemindAt(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffH = diffMs / 3_600_000;
  if (diffH < 0) return `Πριν από ${Math.abs(Math.round(diffH))}ω`;
  if (diffH < 1) return `Σε ${Math.round(diffH * 60)} λεπτά`;
  if (diffH < 24) return `Σε ${Math.round(diffH)} ώρες`;
  return d.toLocaleDateString('el-GR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function RemindersPanel() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: reminders } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => api.get('/reminders').then(r => r.data.data),
    refetchInterval: 60_000
  });

  const ackMut = useMutation({
    mutationFn: (id: string) => api.put(`/reminders/${id}`, { acknowledged: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] })
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/reminders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] })
  });

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const count = reminders?.length || 0;

  // Upcoming within 24h (for badge highlight)
  const urgent = (reminders || []).filter((r: any) => {
    const diff = new Date(r.remindAt).getTime() - Date.now();
    return diff > 0 && diff < 86_400_000;
  }).length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
        title="Υπενθυμίσεις"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white text-xs flex items-center justify-center font-bold ${urgent > 0 ? 'bg-red-500' : 'bg-primary'}`}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Υπενθυμίσεις</h3>
            {count > 0 && (
              <button
                onClick={() => { reminders.forEach((r: any) => ackMut.mutate(r._id)); }}
                className="text-xs text-primary hover:underline"
              >
                Όλες ως αναγνωσμένες
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {count === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm">Δεν υπάρχουν υπενθυμίσεις</p>
              </div>
            ) : (
              (reminders || []).map((r: any) => (
                <div key={r._id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 group">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 mt-0.5 ${TYPE_COLOR[r.type] || 'bg-gray-100 text-gray-600'}`}>
                    {TYPE_ICON[r.type] || '🔔'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                    {r.description && <p className="text-xs text-gray-500 truncate">{r.description}</p>}
                    <p className="text-xs text-primary mt-0.5 font-medium">{formatRemindAt(r.remindAt)}</p>
                    {r.recurring?.enabled && r.recurring.days?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        🔁 {['Κυρ','Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ'].filter((_, i) => r.recurring.days.includes(i)).join(', ')} · {r.recurring.time}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => ackMut.mutate(r._id)} title="Αναγνώριση"
                      className="w-6 h-6 rounded-md bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center text-xs">✓</button>
                    <button onClick={() => deleteMut.mutate(r._id)} title="Διαγραφή"
                      className="w-6 h-6 rounded-md bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center text-xs">✕</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
