import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { useSuggestionStore } from './store/suggestionStore';
import api from './api/client';

import Layout from './components/layout/Layout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Home from './pages/Home';
import Search from './pages/Search';
import Assistant from './pages/Assistant';
import Appointments from './pages/Appointments';
import DoctorProfile from './pages/DoctorProfile';
import FamilyHub from './pages/FamilyHub';
import HealthRecords from './pages/HealthRecords';
import Settings from './pages/Settings';
import Onboarding from './pages/onboarding/Onboarding';
import SavedDoctors from './pages/SavedDoctors';
import Payments from './pages/Payments';
import Metrics from './pages/Metrics';
import SuggestionsModal from './components/SuggestionsModal';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);
  const token = localStorage.getItem('accessToken');
  if (!user && !token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { setUser } = useAuthStore();
  const { openModal, shownThisSession, markShown } = useSuggestionStore();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      api.get('/patient/me').then(({ data }) => {
        const p = data.data;
        setUser({ id: p._id, email: p.email, firstName: p.profile?.firstName, lastName: p.profile?.lastName, role: 'patient', avatar: p.profile?.avatar });
        if (!shownThisSession) {
          markShown();
          openModal();
        }
      }).catch(() => {});
    }
  }, []);

  return (
    <>
    <SuggestionsModal />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="doctors/:id" element={<DoctorProfile />} />
        <Route path="family" element={<FamilyHub />} />
        <Route path="timeline" element={<Navigate to="/appointments" replace />} />
        <Route path="health-records" element={<HealthRecords />} />
        <Route path="medications" element={<Navigate to="/health-records?tab=medications" replace />} />
        <Route path="results" element={<Navigate to="/health-records?tab=results" replace />} />
        <Route path="vault" element={<Navigate to="/health-records?tab=documents" replace />} />
        <Route path="settings" element={<Settings />} />
        <Route path="saved-doctors" element={<SavedDoctors />} />
        <Route path="payments" element={<Payments />} />
        <Route path="metrics" element={<Metrics />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
