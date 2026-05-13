import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

const relationLabels: Record<string, string> = { spouse: 'Σύζυγος', child: 'Παιδί', parent: 'Γονέας', other: 'Άλλο' };
const BLOOD_TYPES = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const initEditForm = (m: any) => ({
  name: m.name || '',
  relation: m.relation || 'child',
  dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth).toISOString().split('T')[0] : '',
  gender: m.gender || '',
  height: m.height || '',
  weight: m.weight || '',
  bloodType: m.bloodType || '',
  conditions: m.conditions || [],
  allergies: m.allergies || [],
  medications: m.medications || [],
  notes: m.notes || '',
});

function TagInput({ label, items, onAdd, onRemove, placeholder, color }: {
  label: string;
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder: string;
  color: string;
}) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !items.includes(v)) onAdd(v);
    setInput('');
  };
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-1 mb-2">
        {items.map((item) => (
          <span key={item} className={`badge text-xs flex items-center gap-1 ${color}`}>
            {item}
            <button onClick={() => onRemove(item)} className="hover:opacity-70 font-bold leading-none">✕</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input-field flex-1"
          placeholder={placeholder}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button onClick={add} className="btn-primary px-3">+</button>
      </div>
    </div>
  );
}

const BLANK_FORM = () => initEditForm({});

export default function FamilyHub() {
  const qc = useQueryClient();

  // Add modal
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<any>(BLANK_FORM());
  const [addTab, setAddTab] = useState<'profile' | 'clinical'>('profile');

  // Edit modal
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [editTab, setEditTab] = useState<'profile' | 'clinical'>('profile');

  const addOverlayRef = useRef<HTMLDivElement>(null);
  const editOverlayRef = useRef<HTMLDivElement>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ['family'],
    queryFn: () => api.get('/family').then(r => r.data.data)
  });

  const addMut = useMutation({
    mutationFn: () => api.post('/family', addForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family'] });
      setAdding(false);
      setAddForm(BLANK_FORM());
      setAddTab('profile');
    }
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/family/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['family'] })
  });

  const editMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/family/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['family'] }); setEditingMember(null); }
  });

  const openEdit = (m: any) => {
    setEditingMember(m);
    setEditForm(initEditForm(m));
    setEditTab('profile');
  };

  // Add form helpers
  const setAF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setAddForm((f: any) => ({ ...f, [k]: e.target.value }));
  const addToAddArr = (key: string, val: string) =>
    setAddForm((f: any) => ({ ...f, [key]: f[key].includes(val) ? f[key] : [...f[key], val] }));
  const removeFromAddArr = (key: string, val: string) =>
    setAddForm((f: any) => ({ ...f, [key]: f[key].filter((x: string) => x !== val) }));

  // Edit form helpers
  const setEF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEditForm((f: any) => ({ ...f, [k]: e.target.value }));
  const addToArr = (key: string, val: string) =>
    setEditForm((f: any) => ({ ...f, [key]: f[key].includes(val) ? f[key] : [...f[key], val] }));
  const removeFromArr = (key: string, val: string) =>
    setEditForm((f: any) => ({ ...f, [key]: f[key].filter((x: string) => x !== val) }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Οικογένεια</h1>
        <button onClick={() => setAdding(true)} className="btn-primary text-sm">+ Προσθήκη Μέλους</button>
      </div>

      {isLoading && <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="skeleton h-40 rounded-xl" />)}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members?.map((m: any) => (
          <div key={m.id} className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-primary-light rounded-2xl flex items-center justify-center text-primary font-bold text-lg">
                {m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{m.name}</h3>
                <p className="text-xs text-gray-500">
                  {relationLabels[m.relation] || m.relation}
                  {m.dateOfBirth ? ` · ${new Date().getFullYear() - new Date(m.dateOfBirth).getFullYear()} ετών` : ''}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => openEdit(m)} className="text-gray-400 hover:text-primary text-sm" title="Επεξεργασία">✏️</button>
                <button onClick={() => deleteMut.mutate(m.id)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
              </div>
            </div>
            {/* Clinical badges */}
            <div className="flex flex-wrap gap-1 mb-1">
              {m.height && <span className="badge bg-gray-100 text-gray-600 text-xs">{m.height} cm</span>}
              {m.weight && <span className="badge bg-gray-100 text-gray-600 text-xs">{m.weight} kg</span>}
              {m.bloodType && <span className="badge bg-red-50 text-red-600 text-xs">{m.bloodType}</span>}
            </div>
            {m.conditions?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {m.conditions.map((c: string) => <span key={c} className="badge bg-orange-50 text-orange-600 text-xs">{c}</span>)}
              </div>
            )}
            {m.allergies?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {m.allergies.map((a: string) => <span key={a} className="badge bg-red-50 text-red-500 text-xs">{a}</span>)}
              </div>
            )}
            {m.medications?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {m.medications.map((med: string) => <span key={med} className="badge bg-teal-light text-teal text-xs">{med}</span>)}
              </div>
            )}
            {m.notes && <p className="text-xs text-gray-400 mt-2">{m.notes}</p>}
          </div>
        ))}
      </div>

      {!isLoading && members?.length === 0 && (
        <div className="card p-10 text-center text-gray-400">
          <p className="text-sm">Δεν έχετε προσθέσει μέλη οικογένειας</p>
          <button onClick={() => setAdding(true)} className="btn-primary mt-3 text-sm">Προσθήκη</button>
        </div>
      )}

      {/* Add member modal — tabbed */}
      {adding && (
        <div
          ref={addOverlayRef}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === addOverlayRef.current) { setAdding(false); setAddForm(BLANK_FORM()); setAddTab('profile'); } }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[90vh]">
            <div className="px-6 pt-5 pb-0 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Νέο Μέλος Οικογένειας</h2>
                <button onClick={() => { setAdding(false); setAddForm(BLANK_FORM()); setAddTab('profile'); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setAddTab('profile')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${addTab === 'profile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Προφίλ
                </button>
                <button
                  onClick={() => setAddTab('clinical')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${addTab === 'clinical' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Κλινικό Προφίλ
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {addTab === 'profile' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Όνομα</label>
                    <input className="input-field" value={addForm.name} onChange={setAF('name')} placeholder="Πλήρες Όνομα" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Σχέση</label>
                      <select className="input-field" value={addForm.relation} onChange={setAF('relation')}>
                        <option value="child">Παιδί</option>
                        <option value="spouse">Σύζυγος</option>
                        <option value="parent">Γονέας</option>
                        <option value="other">Άλλο</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Φύλο</label>
                      <select className="input-field" value={addForm.gender} onChange={setAF('gender')}>
                        <option value="">—</option>
                        <option value="male">Άνδρας</option>
                        <option value="female">Γυναίκα</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ημ/νία Γέννησης</label>
                    <input type="date" className="input-field" value={addForm.dateOfBirth} onChange={setAF('dateOfBirth')} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Σημειώσεις</label>
                    <textarea className="input-field resize-none" rows={3} value={addForm.notes} onChange={setAF('notes')} placeholder="Πρόσθετες σημειώσεις..." />
                  </div>
                </>
              )}

              {addTab === 'clinical' && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ύψος (cm)</label>
                      <input type="number" className="input-field" placeholder="175" value={addForm.height} onChange={setAF('height')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Βάρος (kg)</label>
                      <input type="number" className="input-field" placeholder="75" value={addForm.weight} onChange={setAF('weight')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Αίμα</label>
                      <select className="input-field" value={addForm.bloodType} onChange={setAF('bloodType')}>
                        {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt || '—'}</option>)}
                      </select>
                    </div>
                  </div>
                  <TagInput label="Παθήσεις" items={addForm.conditions} onAdd={v => addToAddArr('conditions', v)} onRemove={v => removeFromAddArr('conditions', v)} placeholder="π.χ. Άσθμα..." color="bg-orange-50 text-orange-600" />
                  <TagInput label="Αλλεργίες" items={addForm.allergies} onAdd={v => addToAddArr('allergies', v)} onRemove={v => removeFromAddArr('allergies', v)} placeholder="π.χ. Πενικιλίνη..." color="bg-red-50 text-red-600" />
                  <TagInput label="Φάρμακα" items={addForm.medications} onAdd={v => addToAddArr('medications', v)} onRemove={v => removeFromAddArr('medications', v)} placeholder="π.χ. Βενταλίνη..." color="bg-teal-50 text-teal-700" />
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button onClick={() => { setAdding(false); setAddForm(BLANK_FORM()); setAddTab('profile'); }} className="btn-ghost flex-1">Ακύρωση</button>
              <button onClick={() => addMut.mutate()} disabled={!addForm.name || addMut.isPending} className="btn-primary flex-1">
                {addMut.isPending ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit member modal — tabbed */}
      {editingMember && editForm && (
        <div
          ref={editOverlayRef}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === editOverlayRef.current) setEditingMember(null); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="px-6 pt-5 pb-0 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Επεξεργασία: {editForm.name || editingMember.name}</h2>
                <button onClick={() => setEditingMember(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
              </div>
              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setEditTab('profile')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${editTab === 'profile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Προφίλ
                </button>
                <button
                  onClick={() => setEditTab('clinical')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${editTab === 'clinical' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Κλινικό Προφίλ
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {editTab === 'profile' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Όνομα</label>
                    <input className="input-field" value={editForm.name} onChange={setEF('name')} placeholder="Πλήρες Όνομα" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Σχέση</label>
                      <select className="input-field" value={editForm.relation} onChange={setEF('relation')}>
                        <option value="child">Παιδί</option>
                        <option value="spouse">Σύζυγος</option>
                        <option value="parent">Γονέας</option>
                        <option value="other">Άλλο</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Φύλο</label>
                      <select className="input-field" value={editForm.gender} onChange={setEF('gender')}>
                        <option value="">—</option>
                        <option value="male">Άνδρας</option>
                        <option value="female">Γυναίκα</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ημ/νία Γέννησης</label>
                    <input type="date" className="input-field" value={editForm.dateOfBirth} onChange={setEF('dateOfBirth')} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Σημειώσεις</label>
                    <textarea
                      className="input-field resize-none"
                      rows={3}
                      value={editForm.notes}
                      onChange={setEF('notes')}
                      placeholder="Πρόσθετες σημειώσεις..."
                    />
                  </div>
                </>
              )}

              {editTab === 'clinical' && (
                <>
                  {/* Physical */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ύψος (cm)</label>
                      <input type="number" className="input-field" placeholder="175" value={editForm.height} onChange={setEF('height')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Βάρος (kg)</label>
                      <input type="number" className="input-field" placeholder="75" value={editForm.weight} onChange={setEF('weight')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Αίμα</label>
                      <select className="input-field" value={editForm.bloodType} onChange={setEF('bloodType')}>
                        {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt || '—'}</option>)}
                      </select>
                    </div>
                  </div>

                  <TagInput
                    label="Παθήσεις"
                    items={editForm.conditions}
                    onAdd={v => addToArr('conditions', v)}
                    onRemove={v => removeFromArr('conditions', v)}
                    placeholder="π.χ. Άσθμα..."
                    color="bg-orange-50 text-orange-600"
                  />

                  <TagInput
                    label="Αλλεργίες"
                    items={editForm.allergies}
                    onAdd={v => addToArr('allergies', v)}
                    onRemove={v => removeFromArr('allergies', v)}
                    placeholder="π.χ. Πενικιλίνη..."
                    color="bg-red-50 text-red-600"
                  />

                  <TagInput
                    label="Φάρμακα"
                    items={editForm.medications}
                    onAdd={v => addToArr('medications', v)}
                    onRemove={v => removeFromArr('medications', v)}
                    placeholder="π.χ. Βενταλίνη..."
                    color="bg-teal-50 text-teal-700"
                  />
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button onClick={() => setEditingMember(null)} className="btn-ghost flex-1">Ακύρωση</button>
              <button
                onClick={() => editMut.mutate({ id: editingMember.id, data: editForm })}
                disabled={!editForm.name || editMut.isPending}
                className="btn-primary flex-1"
              >
                {editMut.isPending ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
