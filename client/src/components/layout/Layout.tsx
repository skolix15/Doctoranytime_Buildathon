import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import AssistantPopup from '../AssistantPopup';
import OnboardingGuide, { STORAGE_KEY } from '../OnboardingGuide';

export default function Layout() {
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setShowGuide(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
      <AssistantPopup />
      {showGuide && <OnboardingGuide onClose={() => setShowGuide(false)} />}
    </div>
  );
}
