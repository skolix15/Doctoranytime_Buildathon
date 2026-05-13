import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import BookAppointmentModal from '../components/BookAppointmentModal';

interface Doctor {
  _id: string;
  profile: { firstName: string; lastName: string; title?: string; avatar?: string };
  specialties: string[];
  stats: { avgRating: number; totalPatients: number; rebookRate: number };
  locations: Array<{ city: string; clinicName: string }>;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5 text-yellow-400 text-xs">
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
      <span className="text-gray-500 ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function SavedDoctors() {
  const qc = useQueryClient();
  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null);

  const { data: doctors, isLoading } = useQuery<Doctor[]>({
    queryKey: ['saved-doctors'],
    queryFn: () => api.get('/patient/saved-doctors').then(r => r.data.data),
    staleTime: 60_000,
  });

  const removeMutation = useMutation({
    mutationFn: (doctorId: string) => api.delete(`/patient/saved-doctors/${doctorId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-doctors'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Αγαπημένοι Γιατροί</h1>
        <p className="text-sm text-gray-500">Οι γιατροί που έχετε αποθηκεύσει</p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card p-5">
              <div className="flex gap-4">
                <div className="skeleton w-14 h-14 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-36 rounded" />
                  <div className="skeleton h-3 w-24 rounded" />
                  <div className="skeleton h-3 w-28 rounded" />
                  <div className="flex gap-2 mt-3">
                    <div className="skeleton h-8 w-24 rounded-lg" />
                    <div className="skeleton h-8 w-20 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && doctors && doctors.length === 0 && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">
            Δεν έχετε αποθηκευμένους γιατρούς. Βρείτε γιατρούς στην{' '}
            <a href="/search" className="text-primary hover:underline">Αναζήτηση</a>.
          </p>
        </div>
      )}

      {!isLoading && doctors && doctors.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {doctors.map(doctor => (
            <div key={doctor._id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex gap-4">
                <div className="w-14 h-14 bg-primary-light rounded-xl flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                  {doctor.profile.firstName[0]}{doctor.profile.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">
                    {doctor.profile.title && `${doctor.profile.title} `}
                    {doctor.profile.firstName} {doctor.profile.lastName}
                  </h3>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {doctor.specialties.map(s => (
                      <span key={s} className="badge bg-primary-light text-primary">{s}</span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
                    <StarRating rating={doctor.stats.avgRating} />
                    {doctor.locations[0] && (
                      <>
                        <span>·</span>
                        <span>📍 {doctor.locations[0].city}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => setBookingDoctor(doctor)}
                      className="btn-primary text-sm py-1.5"
                    >
                      Κράτηση
                    </button>
                    <button
                      onClick={() => removeMutation.mutate(doctor._id)}
                      disabled={removeMutation.isPending}
                      className="btn-ghost text-sm py-1.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      Αφαίρεση
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {bookingDoctor && (
        <BookAppointmentModal
          prefill={{
            doctorId: bookingDoctor._id,
            doctorName: `${bookingDoctor.profile.firstName} ${bookingDoctor.profile.lastName}`,
            specialty: bookingDoctor.specialties[0],
          }}
          onClose={() => setBookingDoctor(null)}
          onBooked={() => setBookingDoctor(null)}
        />
      )}
    </div>
  );
}
