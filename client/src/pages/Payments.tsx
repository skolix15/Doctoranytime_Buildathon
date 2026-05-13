import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

interface Doctor {
  _id: string;
  profile: { firstName: string; lastName: string; title?: string };
  specialties: string[];
}

interface Appointment {
  _id: string;
  dateTime: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  service: string;
  type: string;
  doctorId: Doctor;
}

const SPECIALTY_PRICE: Record<string, number> = {
  Cardiology: 120,
  Neurology: 120,
  Endocrinology: 120,
  Dermatology: 80,
  Psychiatry: 80,
  Gynaecology: 80,
};

function getPrice(specialties: string[]): number {
  for (const s of specialties) {
    if (SPECIALTY_PRICE[s] !== undefined) return SPECIALTY_PRICE[s];
  }
  return 60;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Payments() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ['appointments'],
    queryFn: () => api.get('/appointments').then(r => r.data.data),
    staleTime: 60_000,
  });

  const now = new Date();
  const thisYear = now.getFullYear();

  const pendingAppointments = (appointments || []).filter(a => {
    const dt = new Date(a.dateTime);
    return (a.status === 'pending' || a.status === 'confirmed') && dt >= now;
  });

  const historyAppointments = (appointments || []).filter(a => a.status === 'completed');

  const totalPending = pendingAppointments.reduce((sum, a) => {
    const price = getPrice(a.doctorId?.specialties || []);
    return sum + price;
  }, 0);

  const totalPaidThisYear = historyAppointments
    .filter(a => new Date(a.dateTime).getFullYear() === thisYear)
    .reduce((sum, a) => {
      const price = getPrice(a.doctorId?.specialties || []);
      return sum + price;
    }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Πληρωμές</h1>
        <p className="text-sm text-gray-500">Ιστορικό & Εκκρεμείς Πληρωμές</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Εκκρεμείς πληρωμές</p>
              <p className="text-2xl font-bold text-gray-900">{totalPending}€</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Πληρώθηκε φέτος ({thisYear})</p>
              <p className="text-2xl font-bold text-gray-900">{totalPaidThisYear}€</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'pending'
                ? 'text-primary border-b-2 border-primary bg-primary-light/30'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Εκκρεμείς
            {pendingAppointments.length > 0 && (
              <span className="ml-2 bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5 rounded-full">
                {pendingAppointments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-primary border-b-2 border-primary bg-primary-light/30'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Ιστορικό
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isLoading && (
            <>
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-4 p-4 border border-gray-100 rounded-xl">
                  <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-48 rounded" />
                    <div className="skeleton h-3 w-32 rounded" />
                    <div className="skeleton h-3 w-24 rounded" />
                  </div>
                  <div className="skeleton h-6 w-16 rounded" />
                </div>
              ))}
            </>
          )}

          {!isLoading && activeTab === 'pending' && (
            <>
              {pendingAppointments.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Δεν υπάρχουν εκκρεμείς πληρωμές
                </div>
              ) : (
                pendingAppointments.map(appt => {
                  const price = getPrice(appt.doctorId?.specialties || []);
                  const doctor = appt.doctorId;
                  const doctorName = doctor
                    ? `${doctor.profile.title ? doctor.profile.title + ' ' : ''}${doctor.profile.firstName} ${doctor.profile.lastName}`
                    : 'Άγνωστος γιατρός';
                  const specialty = doctor?.specialties?.[0] || '';

                  return (
                    <div key={appt._id} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border border-yellow-100 bg-yellow-50/30 rounded-xl">
                      <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{doctorName}</p>
                        {specialty && <p className="text-xs text-gray-500">{specialty}</p>}
                        <p className="text-xs text-gray-500 mt-0.5">{appt.service}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(appt.dateTime)}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="badge bg-yellow-100 text-yellow-700">Προς Πληρωμή</span>
                        <span className="font-bold text-gray-900">{price}€</span>
                        <div className="relative group">
                          <button
                            disabled
                            className="btn-primary text-sm py-1.5 opacity-50 cursor-not-allowed"
                          >
                            Πληρωμή Online
                          </button>
                          <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-10">
                            Σύντομα διαθέσιμο
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {!isLoading && activeTab === 'history' && (
            <>
              {historyAppointments.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Δεν υπάρχουν ολοκληρωμένες πληρωμές
                </div>
              ) : (
                historyAppointments.map(appt => {
                  const price = getPrice(appt.doctorId?.specialties || []);
                  const doctor = appt.doctorId;
                  const doctorName = doctor
                    ? `${doctor.profile.title ? doctor.profile.title + ' ' : ''}${doctor.profile.firstName} ${doctor.profile.lastName}`
                    : 'Άγνωστος γιατρός';
                  const specialty = doctor?.specialties?.[0] || '';

                  return (
                    <div key={appt._id} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{doctorName}</p>
                        {specialty && <p className="text-xs text-gray-500">{specialty}</p>}
                        <p className="text-xs text-gray-500 mt-0.5">{appt.service}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(appt.dateTime)}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="badge bg-green-100 text-green-700">Πληρώθηκε</span>
                        <span className="font-bold text-gray-900">{price}€</span>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
