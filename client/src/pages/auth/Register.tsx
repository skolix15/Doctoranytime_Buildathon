import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';

const BLOOD_TYPES = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1 — account
  const [account, setAccount] = useState({ firstName: '', lastName: '', email: '', password: '' });

  // Step 2 — profile (optional)
  const [profile, setProfile] = useState({ dateOfBirth: '', gender: '', phone: '', height: '', weight: '', bloodType: '' });

  // Step 3 — medical (optional) + files
  const [conditionInput, setConditionInput] = useState('');
  const [allergyInput, setAllergyInput] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setAcc = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAccount(f => ({ ...f, [k]: e.target.value }));
  const setProf = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setProfile(f => ({ ...f, [k]: e.target.value }));

  const addCondition = () => {
    const v = conditionInput.trim();
    if (v && !conditions.includes(v)) setConditions(prev => [...prev, v]);
    setConditionInput('');
  };
  const addAllergy = () => {
    const v = allergyInput.trim();
    if (v && !allergies.includes(v)) setAllergies(prev => [...prev, v]);
    setAllergyInput('');
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const picked = Array.from(e.target.files || []);
    const invalid = picked.filter(f => !f.name.endsWith('.json'));
    if (invalid.length) { setFileError('Μόνο αρχεία .json επιτρέπονται'); return; }
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      return [...prev, ...picked.filter(f => !existing.has(f.name))];
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (name: string) => setFiles(prev => prev.filter(f => f.name !== name));

  const parseAllFiles = async (): Promise<any[]> => {
    const all: any[] = [];
    for (const file of files) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        if (Array.isArray(json)) all.push(...json);
      } catch { /* skip bad files */ }
    }
    return all;
  };

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Σφάλμα εγγραφής');
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async (skip = false) => {
    if (skip) { setStep(3); return; }
    setLoading(true);
    try {
      const body: Record<string, any> = {};
      if (profile.dateOfBirth) body['profile.dateOfBirth'] = profile.dateOfBirth;
      if (profile.gender) body['profile.gender'] = profile.gender;
      if (profile.phone) body['profile.phone'] = profile.phone;
      if (profile.height) body['profile.height'] = Number(profile.height);
      if (profile.weight) body['profile.weight'] = Number(profile.weight);
      if (profile.bloodType) body['profile.bloodType'] = profile.bloodType;
      if (Object.keys(body).length > 0) await api.put('/patient/me', body);
      setStep(3);
    } catch { /* non-critical */ } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async (skip = false) => {
    setLoading(true);
    try {
      if (!skip) {
        const body: Record<string, any> = {};
        if (conditions.length) body['aiContext.knownConditions'] = conditions;
        if (allergies.length) body['aiContext.allergies'] = allergies;
        if (Object.keys(body).length > 0) await api.put('/patient/me', body);

        if (files.length > 0) {
          const metrics = await parseAllFiles();
          if (metrics.length > 0) await api.post('/patient/metrics/import', { metrics });
        }
      }
      navigate('/');
    } catch { navigate('/'); } finally {
      setLoading(false);
    }
  };

  const totalSteps = 3;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-2xl mb-3">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">MedPlatform</h1>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6 px-1">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                s < step ? 'bg-primary text-white' : s === step ? 'bg-primary text-white ring-4 ring-primary/20' : 'bg-gray-200 text-gray-400'
              }`}>
                {s < step ? '✓' : s}
              </div>
              <span className="text-xs text-gray-400 hidden sm:block">
                {s === 1 ? 'Λογαριασμός' : s === 2 ? 'Προφίλ' : 'Ιατρικό'}
              </span>
            </div>
          ))}
        </div>

        <div className="card p-8">
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

          {/* ── Step 1: Account ── */}
          {step === 1 && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Δημιουργία λογαριασμού</h2>
              <p className="text-sm text-gray-400 mb-5">Βήμα 1 από {totalSteps}</p>
              <form onSubmit={handleStep1} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Όνομα *</label>
                    <input className="input-field" value={account.firstName} onChange={setAcc('firstName')} placeholder="Γιώργος" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Επώνυμο *</label>
                    <input className="input-field" value={account.lastName} onChange={setAcc('lastName')} placeholder="Δημητρίου" required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                  <input type="email" className="input-field" value={account.email} onChange={setAcc('email')} placeholder="email@example.com" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Κωδικός *</label>
                  <input type="password" className="input-field" value={account.password} onChange={setAcc('password')} placeholder="Τουλάχιστον 8 χαρακτήρες" required />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center flex py-2.5 mt-2">
                  {loading ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Συνέχεια →'}
                </button>
              </form>
              <p className="text-center text-sm text-gray-500 mt-5">
                Έχετε ήδη λογαριασμό; <Link to="/login" className="text-primary font-medium hover:underline">Σύνδεση</Link>
              </p>
            </>
          )}

          {/* ── Step 2: Profile (optional) ── */}
          {step === 2 && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Βασικά στοιχεία</h2>
              <p className="text-sm text-gray-400 mb-5">Βήμα 2 από {totalSteps} · Προαιρετικό</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ημ/νία Γέννησης</label>
                  <input type="date" className="input-field" value={profile.dateOfBirth} onChange={setProf('dateOfBirth')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Φύλο</label>
                    <select className="input-field" value={profile.gender} onChange={setProf('gender')}>
                      <option value="">—</option>
                      <option value="male">Άνδρας</option>
                      <option value="female">Γυναίκα</option>
                      <option value="other">Άλλο</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Τηλέφωνο</label>
                    <input className="input-field" value={profile.phone} onChange={setProf('phone')} placeholder="69xxxxxxxx" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Ύψος (cm)</label>
                    <input type="number" className="input-field" value={profile.height} onChange={setProf('height')} placeholder="175" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Βάρος (kg)</label>
                    <input type="number" className="input-field" value={profile.weight} onChange={setProf('weight')} placeholder="75" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Αίμα</label>
                    <select className="input-field" value={profile.bloodType} onChange={setProf('bloodType')}>
                      {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt || '—'}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => handleStep2(true)} className="btn-ghost flex-1 py-2.5 text-gray-400 text-sm">
                  Παράλειψη
                </button>
                <button onClick={() => handleStep2(false)} disabled={loading} className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2">
                  {loading ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Συνέχεια →'}
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Medical + Files (optional) ── */}
          {step === 3 && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Ιατρικό ιστορικό</h2>
              <p className="text-sm text-gray-400 mb-5">Βήμα 3 από {totalSteps} · Προαιρετικό — για εξατομικευμένες AI προτάσεις</p>
              <div className="space-y-5">
                {/* Conditions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Γνωστές Παθήσεις</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {conditions.map(c => (
                      <span key={c} className="badge bg-red-50 text-red-600 text-xs flex items-center gap-1">
                        {c}
                        <button onClick={() => setConditions(p => p.filter(x => x !== c))} className="hover:text-red-800 font-bold">✕</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="input-field flex-1"
                      placeholder="π.χ. Διαβήτης τύπου 2..."
                      value={conditionInput}
                      onChange={e => setConditionInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCondition(); } }}
                    />
                    <button onClick={addCondition} className="btn-primary px-3">+</button>
                  </div>
                </div>

                {/* Allergies */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Αλλεργίες</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {allergies.map(a => (
                      <span key={a} className="badge bg-orange-50 text-orange-600 text-xs flex items-center gap-1">
                        {a}
                        <button onClick={() => setAllergies(p => p.filter(x => x !== a))} className="hover:text-orange-800 font-bold">✕</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="input-field flex-1"
                      placeholder="π.χ. Πενικιλίνη..."
                      value={allergyInput}
                      onChange={e => setAllergyInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAllergy(); } }}
                    />
                    <button onClick={addAllergy} className="btn-primary px-3">+</button>
                  </div>
                </div>

                {/* File upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Αρχεία Μετρήσεων (JSON)
                    <span className="text-xs text-gray-400 font-normal ml-1">— προαιρετικό</span>
                  </label>
                  <p className="text-xs text-gray-400 mb-2">Μπορείτε να ανεβάσετε πολλαπλά αρχεία με μετρήσεις (Apple Health, Garmin, κ.ά.) για άμεση AI ανάλυση</p>
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-primary transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <p className="text-xs text-gray-500">Κάντε κλικ για επιλογή αρχείων .json</p>
                    <input ref={fileInputRef} type="file" accept=".json" multiple onChange={handleFiles} className="hidden" />
                  </div>
                  {fileError && <p className="text-xs text-red-600 mt-1">{fileError}</p>}
                  {files.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {files.map(f => (
                        <div key={f.name} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-xs text-gray-700 truncate">{f.name}</span>
                          <button onClick={() => removeFile(f.name)} className="text-gray-400 hover:text-red-500 text-xs ml-2 flex-shrink-0">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => handleStep3(true)} className="btn-ghost flex-1 py-2.5 text-gray-400 text-sm">
                  Παράλειψη
                </button>
                <button onClick={() => handleStep3(false)} disabled={loading} className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2">
                  {loading ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Ολοκλήρωση ✓'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
