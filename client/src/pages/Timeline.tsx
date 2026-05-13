import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { useFamilyStore } from '../store/familyStore';

const dotColor: Record<string, string> = {
  completed: 'bg-blue-500',
  confirmed: 'bg-green-500',
  pending: 'bg-yellow-400',
  cancelled: 'bg-gray-400',
};

const statusLabel: Record<string, string> = {
  completed: 'Ολοκληρώθηκε',
  confirmed: 'Επιβεβαιωμένο',
  pending: 'Εκκρεμές',
  cancelled: 'Ακυρώθηκε',
};

const statusBadge: Record<string, string> = {
  completed: 'bg-gray-100 text-gray-600',
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-600',
};

function getDefaultFrom(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function getDefaultTo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 2, 0); // last day of next month
  d.setHours(23, 59, 59, 999);
  return d.toISOString().split('T')[0];
}

export default function Timeline() {
  const { activeMemberId, members } = useFamilyStore();
  const activeMember = activeMemberId ? members.find(m => m.id === activeMemberId) : null;

  const [from, setFrom] = useState(getDefaultFrom());
  const [to, setTo] = useState(getDefaultTo());
  const [showAll, setShowAll] = useState(false);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['timeline', activeMemberId, from, to, showAll],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeMemberId) params.set('familyMemberId', activeMemberId);
      if (!showAll) {
        if (from) params.set('from', from);
        if (to) params.set('to', to);
      }
      const url = `/patient/timeline?${params.toString()}`;
      return api.get(url).then(r => r.data.data);
    },
  });

  function handleToggleShowAll() {
    if (!showAll) {
      // switching to showAll
      setShowAll(true);
    } else {
      // switching back to date range — reset to defaults
      setFrom(getDefaultFrom());
      setTo(getDefaultTo());
      setShowAll(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ιστορικό Υγείας</h1>
          {activeMember && (
            <p className="text-sm text-amber-600 mt-0.5">
              Προβολή για: <strong>{activeMember.name}</strong>
            </p>
          )}
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600 font-medium">Περίοδος:</span>
          <input
            type="date"
            value={from}
            onChange={e => { setFrom(e.target.value); setShowAll(false); }}
            disabled={showAll}
            className="input-field w-36 text-sm"
          />
          <span className="text-sm text-gray-500">έως</span>
          <input
            type="date"
            value={to}
            onChange={e => { setTo(e.target.value); setShowAll(false); }}
            disabled={showAll}
            className="input-field w-36 text-sm"
          />
          <button
            onClick={handleToggleShowAll}
            className="btn-ghost text-sm px-3 py-1.5"
          >
            {showAll ? 'Τρέχων Μήνας' : 'Εμφάνιση Όλων'}
          </button>
          <span className="badge bg-gray-100 text-gray-600">
            {appointments?.length || 0} αποτελέσματα
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      )}

      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
        <div className="space-y-4">
          {appointments?.map((appt: any) => (
            <div key={appt._id} className="relative flex gap-4 pl-12">
              <div
                className={`absolute left-3.5 w-3 h-3 rounded-full ${dotColor[appt.status] || 'bg-gray-400'} ring-2 ring-white`}
                style={{ top: '1.2rem' }}
              />
              <div className="card p-4 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{appt.service}</p>
                    <p className="text-xs text-gray-500">
                      {appt.doctorId?.profile?.firstName} {appt.doctorId?.profile?.lastName}
                      {appt.doctorId?.specialties?.length > 0 && (
                        <span className="text-gray-400"> · {appt.doctorId.specialties[0]}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <p className="text-xs text-gray-400">
                      {new Date(appt.dateTime).toLocaleDateString('el-GR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    {appt.status && (
                      <span className={`badge text-xs ${statusBadge[appt.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabel[appt.status] || appt.status}
                      </span>
                    )}
                  </div>
                </div>
                {appt.notes && (
                  <p className="text-xs text-gray-500 mt-2">{appt.notes}</p>
                )}
                {appt.diagnosis?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {appt.diagnosis.map((d: any, i: number) => (
                      <span key={i} className="badge bg-blue-50 text-blue-700 text-xs">
                        {d.description}
                      </span>
                    ))}
                  </div>
                )}
                {appt.prescriptions?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {appt.prescriptions.map((p: any, i: number) => (
                      <span key={i} className="badge bg-purple-50 text-purple-700 text-xs">
                        {p.medication || p.name || p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {!isLoading && appointments?.length === 0 && (
            <div className="card p-8 text-center space-y-3">
              <p className="text-gray-400 text-sm">
                {showAll
                  ? 'Δεν υπάρχει ιστορικό'
                  : 'Δεν υπάρχουν ραντεβού στην επιλεγμένη περίοδο'}
              </p>
              {!showAll && (
                <button
                  onClick={() => setShowAll(true)}
                  className="btn-ghost text-sm px-3 py-1.5"
                >
                  Εμφάνιση Όλων
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
