import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import BookAppointmentModal from '../components/BookAppointmentModal';

interface Doctor {
  _id: string;
  profile: { firstName: string; lastName: string; bio?: string; avatar?: string; title?: string };
  specialties: string[];
  stats: { avgRating: number; totalPatients: number; rebookRate: number };
  locations: Array<{ city: string; clinicName: string; address?: string; phone?: string }>;
  cvData?: { education?: string[]; certifications?: string[] };
}

interface SearchResult {
  doctor: Doctor;
  matchScore: number;
  matchReason: string;
  relevantQnA?: { question: string; answerSnippet: string } | null;
}

interface QnAResult {
  _id: string;
  question: string;
  specialty: string;
  confidenceScore: number;
  answers: Array<{ text: string; doctorId?: any }>;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5 text-yellow-400 text-xs">
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
      <span className="text-gray-500 ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

function DoctorCard({ result, onBook, onSelect, selected }: { result: SearchResult; onBook: (d: Doctor) => void; onSelect: (d: Doctor) => void; selected: boolean }) {
  const { doctor, matchScore, matchReason, relevantQnA } = result;
  const qc = useQueryClient();
  const saveMutation = useMutation({
    mutationFn: (doctorId: string) => api.post(`/patient/saved-doctors/${doctorId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-doctors'] }),
  });

  return (
    <div className={`card p-5 hover:shadow-md transition-all cursor-pointer ${selected ? 'ring-2 ring-primary shadow-md' : ''}`} onClick={() => onSelect(doctor)}>
      <div className="flex gap-4">
        <div className="w-14 h-14 bg-primary-light rounded-xl flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
          {doctor.profile.firstName[0]}{doctor.profile.lastName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900">{doctor.profile.title} {doctor.profile.firstName} {doctor.profile.lastName}</h3>
              <div className="flex flex-wrap gap-1 mt-1">
                {doctor.specialties.map(s => <span key={s} className="badge bg-primary-light text-primary">{s}</span>)}
              </div>
            </div>
            <div className="flex items-start gap-2 flex-shrink-0">
              <button
                onClick={e => { e.stopPropagation(); saveMutation.mutate(doctor._id); }}
                disabled={saveMutation.isPending || saveMutation.isSuccess}
                title={saveMutation.isSuccess ? 'Αποθηκεύτηκε' : 'Αποθήκευση γιατρού'}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:border-primary hover:bg-primary-light transition-colors disabled:opacity-60"
              >
                <svg className={`w-4 h-4 ${saveMutation.isSuccess ? 'text-primary fill-primary' : 'text-gray-400'}`} fill={saveMutation.isSuccess ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
              <div className="text-right">
                <div className={`text-2xl font-bold ${matchScore >= 80 ? 'text-green-600' : matchScore >= 60 ? 'text-yellow-600' : 'text-gray-500'}`}>{matchScore}</div>
                <div className="text-xs text-gray-400">match</div>
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
            <StarRating rating={doctor.stats.avgRating} />
            <span>·</span>
            <span>{doctor.stats.totalPatients}+ ασθενείς</span>
            {doctor.locations[0] && <><span>·</span><span>📍 {doctor.locations[0].city}</span></>}
          </div>
          <p className="text-xs text-primary-medium mt-1.5">✓ {matchReason}</p>
          {relevantQnA && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 font-medium mb-1">Σχετική απάντηση γιατρού:</p>
              <p className="text-xs text-gray-600 italic">"{relevantQnA.answerSnippet}"</p>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button onClick={e => { e.stopPropagation(); onBook(doctor); }} className="btn-primary text-sm py-1.5">Κλείστε Ραντεβού</button>
            <button onClick={e => { e.stopPropagation(); onSelect(doctor); }} className="btn-secondary text-sm py-1.5">Προφίλ →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DoctorDrawer({ doctorId, onClose, onBook }: { doctorId: string; onClose: () => void; onBook: (d: Doctor, slot?: { date: string; time: string }) => void }) {
  const { data: doctor, isLoading } = useQuery({
    queryKey: ['doctor', doctorId],
    queryFn: () => api.get(`/doctors/${doctorId}`).then(r => r.data.data),
  });
  const { data: availability } = useQuery({
    queryKey: ['availability', doctorId],
    queryFn: () => api.get(`/doctors/${doctorId}/availability`).then(r => r.data.data),
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-2xl z-40 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <span className="text-sm font-medium text-gray-500">Προφίλ Γιατρού</span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="p-5 space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
            </div>
          )}

          {doctor && (
            <div className="p-5 space-y-5">
              {/* Doctor header */}
              <div className="flex gap-4 items-start">
                <div className="w-16 h-16 bg-primary-light rounded-2xl flex items-center justify-center text-primary text-xl font-bold flex-shrink-0">
                  {doctor.profile.firstName[0]}{doctor.profile.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-gray-900 leading-tight">{doctor.profile.title} {doctor.profile.firstName} {doctor.profile.lastName}</h2>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {doctor.specialties.map((s: string) => <span key={s} className="badge bg-primary-light text-primary">{s}</span>)}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                    <span>⭐ {doctor.stats.avgRating.toFixed(1)}</span>
                    <span>· {doctor.stats.totalPatients}+ ασθενείς</span>
                    <span>· {doctor.stats.rebookRate}% επαναραντεβού</span>
                  </div>
                </div>
              </div>

              {doctor.profile.bio && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1.5">Βιογραφικό</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{doctor.profile.bio}</p>
                </div>
              )}

              {/* Locations */}
              {doctor.locations?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Τοποθεσία</h3>
                  <div className="space-y-2">
                    {doctor.locations.map((loc: any, i: number) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
                        <p className="font-medium text-gray-800">{loc.clinicName}</p>
                        <p>{loc.address && `${loc.address}, `}{loc.city}</p>
                        {loc.phone && <p className="text-primary mt-0.5">📞 {loc.phone}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {(doctor.cvData?.education?.length > 0 || doctor.cvData?.certifications?.length > 0) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Εκπαίδευση & Πιστοποιήσεις</h3>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {doctor.cvData.education?.map((e: string, i: number) => <li key={i}>• {e}</li>)}
                    {doctor.cvData.certifications?.map((c: string, i: number) => <li key={i} className="text-teal">🏅 {c}</li>)}
                  </ul>
                </div>
              )}

              {/* Availability */}
              {availability && availability.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Διαθέσιμα Ραντεβού</h3>
                  <div className="flex flex-wrap gap-2">
                    {availability.slice(0, 12).map((slot: any, i: number) => (
                      <button
                        key={i}
                        onClick={() => onBook(doctor, { date: slot.date, time: slot.time })}
                        className="px-3 py-1.5 text-xs font-medium bg-gray-50 hover:bg-primary-light hover:text-primary border border-gray-200 rounded-lg transition-colors"
                      >
                        {new Date(slot.date + 'T00:00:00').toLocaleDateString('el-GR', { weekday: 'short', day: 'numeric', month: 'short' })} {slot.time}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        {doctor && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 bg-white">
            <button onClick={() => onBook(doctor)} className="btn-primary w-full py-3 text-base">
              Κλείστε Ραντεβού
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function Search() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ doctors: SearchResult[]; qna: QnAResult[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null);
  const [bookingSlot, setBookingSlot] = useState<{ date: string; time: string } | undefined>();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const suggestTimeout = useRef<any>(null);

  // Auto-search when navigated from AI assistant with ?q=
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      handleSearch(q);
    }
  }, []);

  const handleSearch = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true);
    setSelectedDoctorId(null);
    try {
      const { data } = await api.post('/search', { query: q });
      setResults(data.data);
    } finally {
      setLoading(false);
      setSuggestions([]);
    }
  };

  const handleInput = (val: string) => {
    setQuery(val);
    clearTimeout(suggestTimeout.current);
    if (val.length >= 3) {
      suggestTimeout.current = setTimeout(async () => {
        const { data } = await api.get(`/search/suggestions?q=${encodeURIComponent(val)}`);
        setSuggestions(data.data || []);
      }, 300);
    } else {
      setSuggestions([]);
    }
  };

  const handleBook = (doctor: Doctor, slot?: { date: string; time: string }) => {
    setBookingDoctor(doctor);
    setBookingSlot(slot);
  };

  return (
    <div className="space-y-6">
      {/* Search hero */}
      <div className="card p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Αναζήτηση Γιατρού</h1>
        <p className="text-sm text-gray-500 mb-5">Περιγράψτε τα συμπτώματά σας ή αναζητήστε ειδικότητα</p>
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                value={query}
                onChange={e => handleInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="input-field h-12 text-base"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="π.χ. πόνος στο γόνατο, υψηλή πίεση, παιδίατρος..."
              />
              <svg className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 z-10 overflow-hidden">
                  {suggestions.map((s, i) => (
                    <button key={i} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700" onClick={() => { setQuery(s); handleSearch(s); setSuggestions([]); }}>{s}</button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => handleSearch()} disabled={loading} className="btn-primary px-6 h-12 flex items-center gap-2 flex-shrink-0">
              {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Αναζήτηση'}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {['Υπέρταση', 'Πόνος στο γόνατο', 'Ακμή', 'Ημικρανία', 'Διαβήτης'].map(s => (
            <button key={s} onClick={() => { setQuery(s); handleSearch(s); }} className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-primary-light hover:text-primary rounded-full transition-colors text-gray-600">{s}</button>
          ))}
        </div>
      </div>

      {results && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Doctors */}
          <div className={`space-y-4 ${selectedDoctorId ? 'lg:col-span-5' : 'lg:col-span-3'}`}>
            <h2 className="font-semibold text-gray-900">{results.doctors.length} Γιατροί</h2>
            {results.doctors.length === 0 && <div className="card p-8 text-center text-gray-400">Δεν βρέθηκαν γιατροί για αυτήν την αναζήτηση</div>}
            {results.doctors.map((r, i) => (
              <DoctorCard
                key={i}
                result={r}
                selected={selectedDoctorId === r.doctor._id}
                onBook={handleBook}
                onSelect={d => setSelectedDoctorId(prev => prev === d._id ? null : d._id)}
              />
            ))}
          </div>

          {/* Q&A — hidden when drawer is open */}
          {!selectedDoctorId && (
            <div className="lg:col-span-2 space-y-4">
              <h2 className="font-semibold text-gray-900">Σχετικές Ερωτήσεις</h2>
              {results.qna.length === 0 && <div className="card p-6 text-center text-gray-400 text-sm">Δεν βρέθηκαν ερωτήσεις</div>}
              {results.qna.map((q: QnAResult) => (
                <div key={q._id} className="card p-4">
                  <p className="font-medium text-sm text-gray-900">{q.question}</p>
                  {q.answers[0] && <p className="text-xs text-gray-500 mt-2 line-clamp-3">{q.answers[0].text.slice(0, 200)}...</p>}
                  <div className="mt-3">
                    <span className="badge bg-green-100 text-green-700">{Math.round((q.confidenceScore || 0.7) * 100)}% εμπιστοσύνη</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Doctor profile drawer */}
      {selectedDoctorId && (
        <DoctorDrawer
          doctorId={selectedDoctorId}
          onClose={() => setSelectedDoctorId(null)}
          onBook={handleBook}
        />
      )}

      {/* Booking modal */}
      {bookingDoctor && (
        <BookAppointmentModal
          prefill={{
            doctorId: bookingDoctor._id,
            doctorName: `${bookingDoctor.profile.firstName} ${bookingDoctor.profile.lastName}`,
            specialty: bookingDoctor.specialties[0],
            preferredDate: bookingSlot?.date,
            preferredTime: bookingSlot?.time,
          }}
          onClose={() => { setBookingDoctor(null); setBookingSlot(undefined); }}
          onBooked={() => { setBookingDoctor(null); setBookingSlot(undefined); }}
        />
      )}
    </div>
  );
}
