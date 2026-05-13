import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useFamilyStore } from '../../store/familyStore';
import RemindersPanel from '../RemindersPanel';
import api from '../../api/client';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const { activeMemberId, members, setActiveMember, setMembers } = useFamilyStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Load family members once user is set
  useEffect(() => {
    if (!user) return;
    api.get('/family').then(r => setMembers(r.data.data || [])).catch(() => {});
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeMember = activeMemberId ? members.find(m => m.id === activeMemberId) : null;
  const displayName = activeMember ? activeMember.name.split(' ')[0] : user?.firstName;
  const initials = activeMember
    ? activeMember.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`;

  const relationLabel: Record<string, string> = { spouse: 'Σύζυγος', child: 'Παιδί', parent: 'Γονέας', other: 'Άλλο' };

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-primary hidden sm:block">MedPlatform</span>
        </Link>

        {/* Active profile banner (center) */}
        {activeMember && (
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 text-sm">
              <div className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center text-amber-800 text-xs font-bold">{initials}</div>
              <span className="text-amber-800 font-medium">{activeMember.name}</span>
              <span className="text-amber-500 text-xs">· {relationLabel[activeMember.relation] || activeMember.relation}</span>
              <button onClick={() => setActiveMember(null)} className="text-amber-400 hover:text-amber-700 ml-1 leading-none" title="Επιστροφή στο δικό μου προφίλ">✕</button>
            </div>
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Profile switcher */}
          {user && (members.length > 0 || true) && (
            <div className="relative" ref={ref}>
              <button
                onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors text-sm font-medium ${activeMember ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                title="Εναλλαγή προφίλ"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${activeMember ? 'bg-amber-200 text-amber-800' : 'bg-primary-light text-primary'}`}>
                  {initials}
                </div>
                <span className="hidden sm:block max-w-[100px] truncate">{displayName}</span>
                <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {open && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  {/* Self */}
                  <button
                    onClick={() => { setActiveMember(null); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 transition-colors ${!activeMemberId ? 'bg-primary-light' : ''}`}
                  >
                    <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                      {`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-medium text-gray-900 truncate">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-gray-500">Ο λογαριασμός μου</p>
                    </div>
                    {!activeMemberId && <svg className="w-4 h-4 text-primary ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                  </button>

                  {members.length > 0 && (
                    <>
                      <div className="px-4 py-1.5 text-xs text-gray-400 font-medium uppercase tracking-wide border-t border-gray-100">Οικογένεια</div>
                      {members.map(m => {
                        const mInitials = m.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                        const age = m.dateOfBirth ? new Date().getFullYear() - new Date(m.dateOfBirth).getFullYear() : null;
                        return (
                          <button
                            key={m.id}
                            onClick={() => { setActiveMember(m.id); setOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 transition-colors ${activeMemberId === m.id ? 'bg-amber-50' : ''}`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${activeMemberId === m.id ? 'bg-amber-200 text-amber-800' : 'bg-gray-200 text-gray-700'}`}>
                              {mInitials}
                            </div>
                            <div className="text-left min-w-0">
                              <p className="font-medium text-gray-900 truncate">{m.name}</p>
                              <p className="text-xs text-gray-500">{relationLabel[m.relation] || m.relation}{age ? ` · ${age} ετών` : ''}</p>
                            </div>
                            {activeMemberId === m.id && <svg className="w-4 h-4 text-amber-500 ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                          </button>
                        );
                      })}
                    </>
                  )}

                  <div className="border-t border-gray-100">
                    <Link to="/family" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-primary hover:bg-primary-light transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Διαχείριση Οικογένειας
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {user && <RemindersPanel />}

          {user && (
            <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors hidden sm:block">
              Έξοδος
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
