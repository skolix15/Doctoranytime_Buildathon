import { useState, useEffect, useRef, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useFamilyStore } from '../store/familyStore';

export interface BookingPreFill {
  doctorId?: string;
  doctorName?: string;
  specialty?: string;
  service?: string;
  preferredDate?: string;
  preferredTime?: string;
  forFamilyMemberId?: string;
  notes?: string;
}

interface Props {
  prefill: BookingPreFill;
  onClose: () => void;
  onBooked: () => void;
}

interface DoctorResult {
  doctor: {
    _id: string;
    profile: { firstName: string; lastName: string; title?: string; bio?: string };
    specialties: string[];
    stats?: { avgRating: number };
    locations?: Array<{ clinicName: string; address: string; city: string }>;
  };
  matchScore: number;
}

interface AvailSlot { date: string; time: string; type: string }

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function findClosestSlot(slots: string[], preferred: string): string {
  const prefMin = timeToMinutes(preferred);
  return slots.reduce((best, s) =>
    Math.abs(timeToMinutes(s) - prefMin) < Math.abs(timeToMinutes(best) - prefMin) ? s : best
  , slots[0]);
}

const DAY_EL = ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ'];
const MONTH_EL = ['Ιαν','Φεβ','Μάρ','Απρ','Μαΐ','Ιούν','Ιούλ','Αύγ','Σεπ','Οκτ','Νοε','Δεκ'];

const INSURANCE_OPTIONS = [
  'Χωρίς ασφάλεια (ιδιώτης)',
  'ΕΟΠΥΥ',
  'Allianz',
  'AXA',
  'Interamerican',
  'Υγεία',
  'ING',
  'Metlife',
  'Groupama',
  'Άλλη ασφάλεια',
];

const RELATION_LABELS: Record<string, string> = {
  spouse: 'Σύζυγος',
  child: 'Παιδί',
  parent: 'Γονέας',
  other: 'Άλλο'
};

export default function BookAppointmentModal({ prefill, onClose, onBooked }: Props) {
  const { members } = useFamilyStore();
  const qc = useQueryClient();
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Doctor state
  const [doctorId, setDoctorId] = useState(prefill.doctorId || '');
  const [doctorInfo, setDoctorInfo] = useState<DoctorResult['doctor'] | null>(null);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [searchResults, setSearchResults] = useState<DoctorResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [doctorTab, setDoctorTab] = useState<'visited' | 'search'>('visited');

  // Form state
  const [apptType, setApptType] = useState<'in-person' | 'phone' | 'video'>('in-person');
  const [selectedDate, setSelectedDate] = useState(prefill.preferredDate || '');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [forMemberId, setForMemberId] = useState(prefill.forFamilyMemberId || '');
  const [service, setService] = useState(prefill.service || '');
  const [insurance, setInsurance] = useState('Χωρίς ασφάλεια (ιδιώτης)');
  const [notes, setNotes] = useState(prefill.notes || '');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  // Load doctor info if pre-filled
  useEffect(() => {
    if (prefill.doctorId) {
      api.get(`/doctors/${prefill.doctorId}`).then(r => {
        const doc = r.data.data;
        setDoctorInfo(doc);
        // Auto-select best matching specialty if no service pre-filled
        if (!prefill.service && doc?.specialties?.length > 0) {
          const hint = (prefill.specialty || '').toLowerCase();
          const match = hint ? doc.specialties.find((s: string) => s.toLowerCase().includes(hint) || hint.includes(s.toLowerCase())) : null;
          setService(match || doc.specialties[0]);
        }
      }).catch(() => {});
    }
  }, [prefill.doctorId]);

  // Previously visited doctors (from past appointments)
  const { data: pastAppointments } = useQuery({
    queryKey: ['appointments', 'past'],
    queryFn: () => api.get('/appointments?status=past').then(r => r.data.data),
    staleTime: 120_000
  });

  const visitedDoctors = useMemo(() => {
    if (!pastAppointments) return [];
    const seen = new Set<string>();
    const result: Array<{ _id: string; profile: any; specialties: string[]; stats?: any; locations?: any[] }> = [];
    for (const appt of pastAppointments) {
      const doc = appt.doctorId;
      if (doc?._id && !seen.has(doc._id)) {
        seen.add(doc._id);
        result.push(doc);
      }
    }
    return result;
  }, [pastAppointments]);

  // Fetch availability (all slots for next 14 days)
  const { data: availData } = useQuery<AvailSlot[]>({
    queryKey: ['availability', doctorId],
    queryFn: () => api.get(`/doctors/${doctorId}/availability`).then(r => r.data.data),
    enabled: !!doctorId,
    staleTime: 60_000
  });

  // Fetch slots for selected date
  const { data: slotsData, isFetching: slotsLoading } = useQuery<string[]>({
    queryKey: ['slots', doctorId, selectedDate],
    queryFn: () => api.get(`/doctors/${doctorId}/slots?date=${selectedDate}`).then(r => r.data.data.slots),
    enabled: !!doctorId && !!selectedDate,
    staleTime: 30_000
  });

  // Auto-select closest slot when slots load
  useEffect(() => {
    if (!slotsData?.length) { setSelectedSlot(''); return; }
    if (prefill.preferredTime) {
      setSelectedSlot(findClosestSlot(slotsData, prefill.preferredTime));
    } else {
      setSelectedSlot(slotsData[0]);
    }
  }, [slotsData]);

  // Build available dates set
  const availDates = new Set((availData || []).map(s => s.date));

  // Build 7-day week starting from weekOffset*7 days from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + weekOffset * 7 + i + 1);
    return d;
  }).slice(0, 7);

  // Doctor search
  useEffect(() => {
    if (doctorSearch.length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setSearchLoading(true);
      api.post('/search', { query: doctorSearch })
        .then(r => { setSearchResults(r.data?.data?.doctors || []); setShowDropdown(true); })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 350);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [doctorSearch]);

  const bookMutation = useMutation({
    mutationFn: (payload: any) => api.post('/appointments', payload),
    onSuccess: async (res) => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['reminders'] });
      setToast('Το ραντεβού κλείστηκε επιτυχώς! ✓');
      // Auto-create reminder 1 day before appointment
      try {
        const appt = res.data?.data;
        if (appt?.dateTime) {
          const remindAt = new Date(new Date(appt.dateTime).getTime() - 24 * 3_600_000).toISOString();
          await api.post('/reminders', {
            type: 'appointment',
            title: `Ραντεβού αύριο: ${service || 'Εξέταση'}`,
            description: displayName,
            referenceId: appt._id,
            familyMemberId: forMemberId || undefined,
            remindAt
          });
        }
      } catch { /* non-fatal */ }
      setTimeout(() => { onBooked(); onClose(); }, 1800);
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error?.message || 'Σφάλμα κατά την κράτηση.');
    }
  });

  const handleSelectDoctor = (result: DoctorResult) => {
    setDoctorId(result.doctor._id);
    setDoctorInfo(result.doctor);
    setDoctorSearch('');
    setShowDropdown(false);
    setSelectedDate('');
    setSelectedSlot('');
    // Auto-select best matching specialty as service
    const specs = result.doctor.specialties || [];
    if (specs.length > 0 && !prefill.service) {
      const hint = (prefill.specialty || '').toLowerCase();
      const match = hint ? specs.find((s: string) => s.toLowerCase().includes(hint) || hint.includes(s.toLowerCase())) : null;
      setService(match || specs[0]);
    }
  };

  const handleClearDoctor = () => {
    setDoctorId('');
    setDoctorInfo(null);
    setSelectedDate('');
    setSelectedSlot('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!doctorId) { setError('Παρακαλώ επιλέξτε γιατρό.'); return; }
    if (!selectedDate) { setError('Παρακαλώ επιλέξτε ημερομηνία.'); return; }
    if (!selectedSlot) { setError('Παρακαλώ επιλέξτε ώρα.'); return; }

    // Build UTC dateTime from local date+time
    const [y, mo, d] = selectedDate.split('-').map(Number);
    const [h, mi] = selectedSlot.split(':').map(Number);
    const dt = new Date(y, mo - 1, d, h, mi);

    bookMutation.mutate({
      doctorId,
      dateTime: dt.toISOString(),
      type: apptType,
      service: service || 'Εξέταση',
      familyMemberId: forMemberId || undefined,
      notes: notes || undefined,
      insurance
    });
  };

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const displayName = doctorInfo
    ? `${doctorInfo.profile.title ? doctorInfo.profile.title + ' ' : ''}${doctorInfo.profile.firstName} ${doctorInfo.profile.lastName}`
    : prefill.doctorName || '';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-xl my-6 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary-medium px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-white text-base">Κλείσιμο Ραντεβού</h2>
              <p className="text-blue-100 text-xs">Συμπληρώστε τα στοιχεία της κράτησης</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-5">

            {/* Feedback */}
            {toast && (
              <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                {toast}
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </div>
            )}

            {/* ── DOCTOR ── */}
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Γιατρός</p>

              {/* Selected doctor */}
              {doctorId && doctorInfo ? (
                <div className="flex items-center gap-3 p-3 bg-primary-light border border-primary/15 rounded-xl">
                  <div className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {doctorInfo.profile.firstName[0]}{doctorInfo.profile.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{displayName}</p>
                    <p className="text-xs text-gray-500 truncate">{doctorInfo.specialties?.slice(0, 2).join(' · ')}</p>
                    {doctorInfo.locations?.[0] && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">📍 {doctorInfo.locations[0].clinicName}, {doctorInfo.locations[0].city}</p>
                    )}
                  </div>
                  {(doctorInfo.stats?.avgRating ?? 0) > 0 && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      <span className="text-xs font-medium text-gray-700">{doctorInfo.stats.avgRating.toFixed(1)}</span>
                    </div>
                  )}
                  <button type="button" onClick={handleClearDoctor} className="text-xs text-primary hover:underline flex-shrink-0 ml-1">Αλλαγή</button>
                </div>
              ) : (
                <div>
                  {/* Tabs */}
                  <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-3">
                    <button type="button" onClick={() => setDoctorTab('visited')}
                      className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${doctorTab === 'visited' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      Προηγούμενοι γιατροί
                    </button>
                    <button type="button" onClick={() => setDoctorTab('search')}
                      className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${doctorTab === 'search' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      Αναζήτηση γιατρού
                    </button>
                  </div>

                  {/* Previously visited */}
                  {doctorTab === 'visited' && (
                    <div>
                      {visitedDoctors.length === 0 ? (
                        <div className="text-center py-4 text-sm text-gray-400">
                          <p>Δεν υπάρχουν προηγούμενα ραντεβού.</p>
                          <button type="button" onClick={() => setDoctorTab('search')} className="text-primary text-xs mt-1 hover:underline">
                            Αναζητήστε νέο γιατρό →
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-52 overflow-y-auto">
                          {visitedDoctors.map(doc => (
                            <button key={doc._id} type="button"
                              onClick={() => {
                                setDoctorId(doc._id);
                                setDoctorInfo(doc);
                                setSelectedDate('');
                                setSelectedSlot('');
                                const specs = doc.specialties || [];
                                if (specs.length > 0 && !prefill.service) {
                                  const hint = (prefill.specialty || '').toLowerCase();
                                  const match = hint ? specs.find((s: string) => s.toLowerCase().includes(hint) || hint.includes(s.toLowerCase())) : null;
                                  setService(match || specs[0]);
                                }
                              }}
                              className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-primary-light border border-gray-200 hover:border-primary/30 rounded-xl transition-all text-left">
                              <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                                {doc.profile.firstName[0]}{doc.profile.lastName[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {doc.profile.title ? `${doc.profile.title} ` : ''}{doc.profile.firstName} {doc.profile.lastName}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{doc.specialties?.slice(0, 2).join(' · ')}</p>
                              </div>
                              {(doc.stats?.avgRating ?? 0) > 0 && (
                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                  <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                  <span className="text-xs text-gray-600">{doc.stats.avgRating.toFixed(1)}</span>
                                </div>
                              )}
                              <svg className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* LLM search */}
                  {doctorTab === 'search' && (
                    <div className="relative">
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                          type="text"
                          className="input-field"
                          style={{ paddingLeft: '2.25rem' }}
                          placeholder="π.χ. καρδιολόγος, πόνος στο στήθος, παιδίατρος..."
                          value={doctorSearch}
                          onChange={e => setDoctorSearch(e.target.value)}
                          onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                          autoFocus
                          autoComplete="off"
                        />
                        {searchLoading && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin block" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">Αναζητήστε με συμπτώματα, ειδικότητα ή όνομα γιατρού</p>
                      {showDropdown && (
                        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                          {searchResults.length > 0 ? searchResults.map(r => (
                            <button key={r.doctor._id} type="button" onMouseDown={() => handleSelectDoctor(r)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0 transition-colors">
                              <div className="w-9 h-9 bg-primary-light rounded-xl flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                                {r.doctor.profile.firstName[0]}{r.doctor.profile.lastName[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {r.doctor.profile.title ? `${r.doctor.profile.title} ` : ''}{r.doctor.profile.firstName} {r.doctor.profile.lastName}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{r.doctor.specialties.slice(0, 2).join(' · ')}</p>
                              </div>
                              {(r.doctor.stats?.avgRating ?? 0) > 0 && (
                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                  <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                  <span className="text-xs text-gray-600">{r.doctor.stats.avgRating.toFixed(1)}</span>
                                </div>
                              )}
                            </button>
                          )) : doctorSearch.length >= 2 && !searchLoading ? (
                            <p className="px-4 py-3 text-sm text-gray-500">Δεν βρέθηκαν γιατροί για «{doctorSearch}»</p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── APPOINTMENT TYPE ── */}
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Τύπος επίσκεψης</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'in-person', label: 'Δια ζώσης', icon: '🏥', desc: 'Φυσική παρουσία' },
                  { value: 'video', label: 'Βιντεοκλήση', icon: '📹', desc: 'Online εξέταση' },
                  { value: 'phone', label: 'Τηλέφωνο', icon: '📞', desc: 'Τηλεφωνική συνδιάλεξη' }
                ] as const).map(opt => (
                  <button key={opt.value} type="button" onClick={() => setApptType(opt.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                      apptType === opt.value
                        ? 'border-primary bg-primary-light text-primary'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}>
                    <span className="text-xl">{opt.icon}</span>
                    <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                    <span className={`text-xs leading-tight ${apptType === opt.value ? 'text-primary/70' : 'text-gray-400'}`}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* ── DATE & SLOTS ── */}
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ημερομηνία & Ώρα</p>
              {!doctorId ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-5 text-center text-sm text-gray-400">
                  Επιλέξτε πρώτα γιατρό για να δείτε τις διαθέσιμες ημερομηνίες
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Week navigation */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                    <button type="button" onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
                      disabled={weekOffset === 0}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-200 disabled:opacity-30 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <span className="text-xs font-medium text-gray-600">
                      {MONTH_EL[weekDays[0].getMonth()]} {weekDays[0].getFullYear()}
                    </span>
                    <button type="button" onClick={() => setWeekOffset(w => w + 1)}
                      disabled={weekOffset >= 1}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-200 disabled:opacity-30 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>

                  {/* Day buttons */}
                  <div className="grid grid-cols-7 divide-x divide-gray-100">
                    {weekDays.map(d => {
                      const iso = formatDate(d);
                      const hasSlots = availDates.has(iso);
                      const isSelected = selectedDate === iso;
                      const isPast = d < today;
                      return (
                        <button key={iso} type="button"
                          disabled={!hasSlots || isPast}
                          onClick={() => { setSelectedDate(iso); setSelectedSlot(''); }}
                          className={`flex flex-col items-center gap-1 py-3 transition-all ${
                            isSelected
                              ? 'bg-primary text-white'
                              : hasSlots && !isPast
                              ? 'hover:bg-primary-light text-gray-800'
                              : 'text-gray-300 cursor-not-allowed bg-gray-50'
                          }`}>
                          <span className={`text-xs ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>{DAY_EL[d.getDay()]}</span>
                          <span className="font-semibold text-sm">{d.getDate()}</span>
                          {hasSlots && !isPast && !isSelected && (
                            <span className="w-1 h-1 rounded-full bg-primary" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Time slots */}
                  {selectedDate && (
                    <div className="p-4 border-t border-gray-100">
                      {slotsLoading ? (
                        <div className="flex gap-2 flex-wrap">
                          {[1,2,3,4].map(i => <div key={i} className="skeleton h-9 w-16 rounded-lg" />)}
                        </div>
                      ) : !slotsData?.length ? (
                        <p className="text-sm text-gray-400 text-center py-2">Δεν υπάρχουν διαθέσιμες ώρες για αυτή την ημέρα</p>
                      ) : (
                        <>
                          <p className="text-xs text-gray-500 mb-2">Διαθέσιμες ώρες:</p>
                          <div className="flex flex-wrap gap-2">
                            {slotsData.map(slot => (
                              <button key={slot} type="button" onClick={() => setSelectedSlot(slot)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                                  selectedSlot === slot
                                    ? 'bg-primary text-white border-primary shadow-sm'
                                    : 'bg-white text-gray-700 border-gray-200 hover:border-primary hover:text-primary'
                                }`}>
                                {slot}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── FOR WHOM ── */}
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Στοιχεία κράτησης</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Για ποιον</label>
                  <select className="input-field" value={forMemberId} onChange={e => setForMemberId(e.target.value)}>
                    <option value="">Για εμένα</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} · {RELATION_LABELS[m.relation] || m.relation}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Αιτία επίσκεψης</label>
                  {doctorInfo?.specialties?.length > 0 ? (
                    <select
                      className="input-field"
                      value={service}
                      onChange={e => setService(e.target.value)}
                    >
                      <option value="">— Επιλέξτε υπηρεσία —</option>
                      {doctorInfo.specialties.map((s: string) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="__other__">Άλλο (συμπληρώστε παρακάτω)</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="input-field"
                      placeholder="π.χ. Γενική εξέταση, Καρδιογράφημα, Επανεξέταση..."
                      value={service}
                      onChange={e => setService(e.target.value)}
                    />
                  )}
                  {service === '__other__' && (
                    <input
                      type="text"
                      className="input-field mt-2"
                      placeholder="Περιγράψτε την αιτία επίσκεψης..."
                      onChange={e => setService(e.target.value)}
                      autoFocus
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ασφαλιστική κάλυψη</label>
                  <select className="input-field" value={insurance} onChange={e => setInsurance(e.target.value)}>
                    {INSURANCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Σημειώσεις <span className="text-gray-400 font-normal">(προαιρετικό)</span>
                  </label>
                  <textarea
                    className="input-field resize-none"
                    rows={3}
                    placeholder="Περιγράψτε τα συμπτώματά σας, ερωτήματα, ή οποιαδήποτε σχετική πληροφορία για τον γιατρό..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* ── SUMMARY ── */}
            {doctorId && selectedDate && selectedSlot && (
              <div className="bg-blue-50 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-gray-900 mb-1">Σύνοψη Κράτησης</p>
                  <p className="text-gray-600">{displayName}</p>
                  <p className="text-gray-600">
                    {(() => {
                      const d = new Date(selectedDate + 'T00:00:00');
                      return `${DAY_EL[d.getDay()]}, ${d.getDate()} ${MONTH_EL[d.getMonth()]} ${d.getFullYear()}`;
                    })()} · {selectedSlot}
                  </p>
                  <p className="text-gray-600">{service || 'Εξέταση'} · {apptType === 'in-person' ? 'Δια ζώσης' : apptType === 'video' ? 'Βιντεοκλήση' : 'Τηλέφωνο'}</p>
                  {forMemberId && <p className="text-amber-700">Για: {members.find(m => m.id === forMemberId)?.name}</p>}
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-5 pb-5 flex gap-3">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Ακύρωση
            </button>
            <button
              type="submit"
              disabled={bookMutation.isPending || !!toast || !doctorId || !selectedSlot}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {bookMutation.isPending ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Κράτηση...</>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Επιβεβαίωση Ραντεβού
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
