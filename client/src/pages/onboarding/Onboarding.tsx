import { useState, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

interface FamilyMemberForm {
  name: string;
  relation: string;
  dateOfBirth: string;
}

const RELATIONS = ['Σύζυγος', 'Παιδί', 'Γονέας', 'Αδερφός/Αδερφή', 'Παππούς/Γιαγιά', 'Άλλο'];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 state
  const [step1, setStep1] = useState({ dateOfBirth: '', gender: '', phone: '', city: '' });

  // Step 2 state
  const [conditions, setConditions] = useState<string[]>([]);
  const [conditionInput, setConditionInput] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [allergyInput, setAllergyInput] = useState('');
  const [commStyle, setCommStyle] = useState<'simple' | 'technical'>('simple');

  // Step 3 state
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberForm[]>([]);
  const [newMember, setNewMember] = useState<FamilyMemberForm>({ name: '', relation: 'Σύζυγος', dateOfBirth: '' });

  const addCondition = () => {
    const val = conditionInput.trim();
    if (val && !conditions.includes(val)) setConditions(c => [...c, val]);
    setConditionInput('');
  };

  const addAllergy = () => {
    const val = allergyInput.trim();
    if (val && !allergies.includes(val)) setAllergies(a => [...a, val]);
    setAllergyInput('');
  };

  const addMember = () => {
    if (!newMember.name.trim()) return;
    setFamilyMembers(m => [...m, { ...newMember }]);
    setNewMember({ name: '', relation: 'Σύζυγος', dateOfBirth: '' });
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      // Step 1 data
      await api.put('/patient/me', {
        profile: {
          dateOfBirth: step1.dateOfBirth || undefined,
          gender: step1.gender || undefined,
          phone: step1.phone || undefined,
          city: step1.city || undefined,
        }
      }).catch(() => {});

      // Step 2 data — ai context
      await api.post('/patient/ai-context', {
        conditions,
        allergies,
        communicationStyle: commStyle,
      }).catch(() => {}); // 404 is OK

      // Step 3 — family members
      for (const member of familyMembers) {
        await api.post('/family', {
          name: member.name,
          relation: member.relation,
          dateOfBirth: member.dateOfBirth || undefined,
        }).catch(() => {});
      }

      localStorage.setItem('onboardingDone', 'true');
      navigate('/');
    } catch {
      navigate('/');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboardingDone', 'true');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Καλώς ήρθατε!</h1>
          <p className="text-gray-500 text-sm mt-1">Ας ρυθμίσουμε το προφίλ σας</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className={`w-2.5 h-2.5 rounded-full transition-colors ${s === step ? 'bg-primary' : s < step ? 'bg-primary/40' : 'bg-gray-200'}`} />
          ))}
        </div>
        {/* Progress bar */}
        <div className="w-full h-1 bg-gray-200 rounded-full mb-8">
          <div
            className="h-1 bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((step - 1) / 2) * 100}%` }}
          />
        </div>

        <div className="card p-8">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-gray-900">Προσωπικά στοιχεία</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ημ. γέννησης</label>
                  <input
                    type="date"
                    className="input-field"
                    value={step1.dateOfBirth}
                    onChange={e => setStep1(s => ({ ...s, dateOfBirth: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Φύλο</label>
                  <select
                    className="input-field"
                    value={step1.gender}
                    onChange={e => setStep1(s => ({ ...s, gender: e.target.value }))}
                  >
                    <option value="">Επιλέξτε</option>
                    <option value="male">Άνδρας</option>
                    <option value="female">Γυναίκα</option>
                    <option value="other">Άλλο</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Τηλέφωνο</label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="69XXXXXXXX"
                  value={step1.phone}
                  onChange={e => setStep1(s => ({ ...s, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Πόλη</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="π.χ. Αθήνα"
                  value={step1.city}
                  onChange={e => setStep1(s => ({ ...s, city: e.target.value }))}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSkip} className="btn-ghost flex-1 py-2.5 justify-center">Παράλειψη</button>
                <button onClick={() => setStep(2)} className="btn-primary flex-1 py-2.5 justify-center">Επόμενο</button>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-gray-900">Ιστορικό υγείας</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Γνωστές παθήσεις</label>
                <div className="flex gap-2 mb-2">
                  <input
                    className="input-field flex-1"
                    placeholder="π.χ. Διαβήτης τύπου 2"
                    value={conditionInput}
                    onChange={e => setConditionInput(e.target.value)}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); addCondition(); } }}
                  />
                  <button onClick={addCondition} className="btn-primary px-4 py-2">+</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {conditions.map(c => (
                    <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      {c}
                      <button onClick={() => setConditions(prev => prev.filter(x => x !== c))} className="hover:text-blue-900 ml-0.5">×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Αλλεργίες</label>
                <div className="flex gap-2 mb-2">
                  <input
                    className="input-field flex-1"
                    placeholder="π.χ. Πενικιλίνη"
                    value={allergyInput}
                    onChange={e => setAllergyInput(e.target.value)}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); addAllergy(); } }}
                  />
                  <button onClick={addAllergy} className="btn-primary px-4 py-2">+</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allergies.map(a => (
                    <span key={a} className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                      {a}
                      <button onClick={() => setAllergies(prev => prev.filter(x => x !== a))} className="hover:text-red-900 ml-0.5">×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Προτίμηση επικοινωνίας</label>
                <div className="flex gap-4">
                  {([['simple', 'Απλή γλώσσα'], ['technical', 'Τεχνικοί όροι']] as const).map(([val, label]) => (
                    <label key={val} className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer flex-1 transition-colors ${commStyle === val ? 'border-primary bg-primary-light' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="commStyle" value={val} checked={commStyle === val} onChange={() => setCommStyle(val)} className="accent-primary" />
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)} className="btn-ghost flex-1 py-2.5 justify-center">Πίσω</button>
                <button onClick={() => setStep(3)} className="btn-primary flex-1 py-2.5 justify-center">Επόμενο</button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-gray-900">Μέλη οικογένειας</h2>
              <p className="text-sm text-gray-500">Προσθέστε μέλη για να παρακολουθείτε και την υγεία τους.</p>

              <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Όνομα</label>
                    <input
                      className="input-field"
                      placeholder="π.χ. Μαρία"
                      value={newMember.name}
                      onChange={e => setNewMember(m => ({ ...m, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Σχέση</label>
                    <select
                      className="input-field"
                      value={newMember.relation}
                      onChange={e => setNewMember(m => ({ ...m, relation: e.target.value }))}
                    >
                      {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ημ. γέννησης (προαιρετικό)</label>
                  <input
                    type="date"
                    className="input-field"
                    value={newMember.dateOfBirth}
                    onChange={e => setNewMember(m => ({ ...m, dateOfBirth: e.target.value }))}
                  />
                </div>
                <button
                  onClick={addMember}
                  disabled={!newMember.name.trim()}
                  className="btn-primary w-full py-2 justify-center disabled:opacity-50"
                >
                  Προσθήκη μέλους
                </button>
              </div>

              {familyMembers.length > 0 && (
                <div className="space-y-2">
                  {familyMembers.map((m, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.name}</p>
                        <p className="text-xs text-gray-500">{m.relation}{m.dateOfBirth ? ` · ${new Date(m.dateOfBirth).toLocaleDateString('el-GR')}` : ''}</p>
                      </div>
                      <button
                        onClick={() => setFamilyMembers(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-600 text-lg leading-none px-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(2)} className="btn-ghost flex-1 py-2.5 justify-center">Πίσω</button>
                <button
                  onClick={handleComplete}
                  disabled={submitting}
                  className="btn-primary flex-1 py-2.5 justify-center flex items-center gap-2"
                >
                  {submitting && <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Ολοκλήρωση
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
