import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

const BLOOD_TYPES = ['—', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const COMM_STYLES: Record<string, string> = {
  plain: 'Απλή γλώσσα',
  technical: 'Ιατρική ορολογία',
  brief: 'Σύντομες απαντήσεις',
  detailed: 'Αναλυτικές απαντήσεις',
};

const initForm = (patient: any) => ({
  firstName: patient.profile?.firstName || '',
  lastName: patient.profile?.lastName || '',
  phone: patient.profile?.phone || '',
  gender: patient.profile?.gender || '',
  dateOfBirth: patient.profile?.dateOfBirth
    ? new Date(patient.profile.dateOfBirth).toISOString().split('T')[0]
    : '',
  height: patient.profile?.height || '',
  weight: patient.profile?.weight || '',
  bloodType: patient.profile?.bloodType || '',
  allergies: patient.aiContext?.allergies || [],
  knownConditions: patient.aiContext?.knownConditions || [],
  communicationStyle: patient.aiContext?.communicationStyle || 'plain',
});

export default function Settings() {
  const qc = useQueryClient();
  const { data: patient } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/patient/me').then(r => r.data.data),
  });

  const [tab, setTab] = useState<'personal' | 'medical' | 'account'>('personal');
  const [form, setForm] = useState<any>(null);
  const initialized = useRef(false);
  const [toast, setToast] = useState(false);

  // Tag input states
  const [allergyInput, setAllergyInput] = useState('');
  const [conditionInput, setConditionInput] = useState('');

  useEffect(() => {
    if (patient && !initialized.current) {
      setForm(initForm(patient));
      initialized.current = true;
    }
  }, [patient]);

  const updateMut = useMutation({
    mutationFn: () =>
      api.put('/patient/me', {
        'profile.height': form.height,
        'profile.weight': form.weight,
        'profile.bloodType': form.bloodType,
        'profile.dateOfBirth': form.dateOfBirth || undefined,
        'profile.firstName': form.firstName,
        'profile.lastName': form.lastName,
        'profile.phone': form.phone,
        'profile.gender': form.gender,
        'aiContext.allergies': form.allergies,
        'aiContext.knownConditions': form.knownConditions,
        'aiContext.communicationStyle': form.communicationStyle,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      setToast(true);
      setTimeout(() => setToast(false), 2000);
    },
  });

  if (!patient || !form) return <div className="skeleton h-64 rounded-xl" />;

  const setField = (k: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f: any) => ({ ...f, [k]: e.target.value }));

  const addAllergy = () => {
    const val = allergyInput.trim();
    if (val && !form.allergies.includes(val)) {
      setForm((f: any) => ({ ...f, allergies: [...f.allergies, val] }));
    }
    setAllergyInput('');
  };

  const removeAllergy = (a: string) =>
    setForm((f: any) => ({ ...f, allergies: f.allergies.filter((x: string) => x !== a) }));

  const addCondition = () => {
    const val = conditionInput.trim();
    if (val && !form.knownConditions.includes(val)) {
      setForm((f: any) => ({ ...f, knownConditions: [...f.knownConditions, val] }));
    }
    setConditionInput('');
  };

  const removeCondition = (c: string) =>
    setForm((f: any) => ({ ...f, knownConditions: f.knownConditions.filter((x: string) => x !== c) }));

  return (
    <div className="max-w-lg space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
          Αποθηκεύτηκε!
        </div>
      )}

      <h1 className="text-xl font-bold text-gray-900">Ρυθμίσεις</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([
          { key: 'personal', label: 'Προσωπικά' },
          { key: 'medical', label: 'Κλινικό Προφίλ' },
          { key: 'account', label: 'Λογαριασμός' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Personal */}
      {tab === 'personal' && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Προσωπικά Στοιχεία</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Όνομα</label>
              <input className="input-field" value={form.firstName} onChange={setField('firstName')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Επώνυμο</label>
              <input className="input-field" value={form.lastName} onChange={setField('lastName')} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ημ/νία Γέννησης</label>
            <input
              type="date"
              className="input-field"
              value={form.dateOfBirth}
              onChange={setField('dateOfBirth')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Φύλο</label>
            <select className="input-field" value={form.gender} onChange={setField('gender')}>
              <option value="">—</option>
              <option value="male">Άνδρας</option>
              <option value="female">Γυναίκα</option>
              <option value="other">Άλλο</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Τηλέφωνο</label>
            <input className="input-field" value={form.phone} onChange={setField('phone')} />
          </div>
          <button
            onClick={() => updateMut.mutate()}
            disabled={updateMut.isPending}
            className="btn-primary w-full"
          >
            Αποθήκευση
          </button>
        </div>
      )}

      {/* Tab 2: Clinical Profile */}
      {tab === 'medical' && (
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Κλινικό Προφίλ</h2>

          {/* Physical measurements */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ύψος (cm)</label>
              <input
                type="number"
                className="input-field"
                placeholder="175"
                value={form.height}
                onChange={setField('height')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Βάρος (kg)</label>
              <input
                type="number"
                className="input-field"
                placeholder="75"
                value={form.weight}
                onChange={setField('weight')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ομάδα Αίματος</label>
              <select className="input-field" value={form.bloodType} onChange={setField('bloodType')}>
                {BLOOD_TYPES.map(bt => (
                  <option key={bt} value={bt === '—' ? '' : bt}>{bt}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Allergies */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Αλλεργίες</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {form.allergies.map((a: string) => (
                <span key={a} className="badge bg-red-50 text-red-600 text-xs flex items-center gap-1">
                  {a}
                  <button
                    onClick={() => removeAllergy(a)}
                    className="hover:text-red-800 font-bold leading-none"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input-field flex-1"
                placeholder="Προσθήκη αλλεργίας..."
                value={allergyInput}
                onChange={e => setAllergyInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAllergy(); } }}
              />
              <button onClick={addAllergy} className="btn-primary px-3">+</button>
            </div>
          </div>

          {/* Known Conditions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Γνωστές Παθήσεις</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {form.knownConditions.map((c: string) => (
                <span key={c} className="badge bg-blue-50 text-blue-600 text-xs flex items-center gap-1">
                  {c}
                  <button
                    onClick={() => removeCondition(c)}
                    className="hover:text-blue-800 font-bold leading-none"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input-field flex-1"
                placeholder="Προσθήκη πάθησης..."
                value={conditionInput}
                onChange={e => setConditionInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCondition(); } }}
              />
              <button onClick={addCondition} className="btn-primary px-3">+</button>
            </div>
          </div>

          {/* Communication Style */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Στυλ Επικοινωνίας ΑΙ</label>
            <select
              className="input-field"
              value={form.communicationStyle}
              onChange={setField('communicationStyle')}
            >
              {Object.entries(COMM_STYLES).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => updateMut.mutate()}
            disabled={updateMut.isPending}
            className="btn-primary w-full"
          >
            Αποθήκευση
          </button>
        </div>
      )}

      {/* Tab 3: Account */}
      {tab === 'account' && (
        <div className="card p-6 space-y-3">
          <h2 className="font-semibold text-gray-900">Λογαριασμός</h2>
          <p className="text-sm text-gray-500">
            Email: <strong>{patient.email}</strong>
          </p>
          <p className="text-sm text-gray-400">
            Για αλλαγή κωδικού ή διαγραφή λογαριασμού επικοινωνήστε με την υποστήριξη.
          </p>
        </div>
      )}
    </div>
  );
}
