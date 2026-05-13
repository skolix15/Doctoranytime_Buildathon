import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import BookAppointmentModal from '../components/BookAppointmentModal';

export default function DoctorProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(false);
  const [prefillTime, setPrefillTime] = useState<{ date: string; time: string } | null>(null);

  const { data: doctor, isLoading } = useQuery({
    queryKey: ['doctor', id],
    queryFn: () => api.get(`/doctors/${id}`).then(r => r.data.data)
  });

  const { data: availability } = useQuery({
    queryKey: ['availability', id],
    queryFn: () => api.get(`/doctors/${id}/availability`).then(r => r.data.data)
  });

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>;
  if (!doctor) return <div className="card p-8 text-center text-gray-400">Ο γιατρός δεν βρέθηκε</div>;

  const openBooking = (slot?: { date: string; time: string }) => {
    if (slot) setPrefillTime(slot);
    else setPrefillTime(null);
    setBooking(true);
  };

  return (
    <div className="max-w-3xl space-y-5">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">← Πίσω</button>

      <div className="card p-6">
        <div className="flex gap-5 items-start">
          <div className="w-20 h-20 bg-primary-light rounded-2xl flex items-center justify-center text-primary text-2xl font-bold flex-shrink-0">
            {doctor.profile.firstName[0]}{doctor.profile.lastName[0]}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{doctor.profile.title} {doctor.profile.firstName} {doctor.profile.lastName}</h1>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {doctor.specialties.map((s: string) => <span key={s} className="badge bg-primary-light text-primary">{s}</span>)}
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              <span>⭐ {doctor.stats.avgRating.toFixed(1)}</span>
              <span>· {doctor.stats.totalPatients}+ ασθενείς</span>
              <span>· {doctor.stats.rebookRate}% επαναραντεβού</span>
            </div>
            {doctor.profile.bio && <p className="text-sm text-gray-600 mt-3">{doctor.profile.bio}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Τοποθεσία</h3>
          {doctor.locations.map((loc: any, i: number) => (
            <div key={i} className="text-sm text-gray-600">
              <p className="font-medium">{loc.clinicName}</p>
              <p>{loc.address}, {loc.city}</p>
              {loc.phone && <p className="text-primary">📞 {loc.phone}</p>}
            </div>
          ))}
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Εκπαίδευση</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            {doctor.cvData?.education?.map((e: string, i: number) => <li key={i}>• {e}</li>)}
            {doctor.cvData?.certifications?.map((c: string, i: number) => <li key={i} className="text-teal">🏅 {c}</li>)}
          </ul>
        </div>
      </div>

      {/* Availability — clicking a slot pre-fills date+time in modal */}
      {availability && availability.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Διαθέσιμα Ραντεβού</h3>
          <div className="flex flex-wrap gap-2">
            {availability.slice(0, 12).map((slot: any, i: number) => (
              <button key={i} onClick={() => openBooking({ date: slot.date, time: slot.time })}
                className="px-3 py-1.5 text-xs font-medium bg-gray-50 hover:bg-primary-light hover:text-primary border border-gray-200 rounded-lg transition-colors">
                {new Date(slot.date + 'T00:00:00').toLocaleDateString('el-GR', { weekday: 'short', day: 'numeric', month: 'short' })} {slot.time}
              </button>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => openBooking()} className="btn-primary w-full py-3 text-base">
        Κλείστε Ραντεβού
      </button>

      {booking && (
        <BookAppointmentModal
          prefill={{
            doctorId: id,
            doctorName: `${doctor.profile.firstName} ${doctor.profile.lastName}`,
            specialty: doctor.specialties[0],
            preferredDate: prefillTime?.date,
            preferredTime: prefillTime?.time
          }}
          onClose={() => setBooking(false)}
          onBooked={() => { setBooking(false); navigate('/appointments'); }}
        />
      )}
    </div>
  );
}
