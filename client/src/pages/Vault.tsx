import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useFamilyStore } from '../store/familyStore';

const CATEGORIES = ['Όλα', 'Αρχεία Εξετάσεων', 'Συνταγές', 'Νοσηλεία', 'Παραπομπές', 'Άλλο'];

const categoryColors: Record<string, string> = {
  'Αρχεία Εξετάσεων': 'bg-blue-100 text-blue-700',
  'Συνταγές': 'bg-green-100 text-green-700',
  'Νοσηλεία': 'bg-red-100 text-red-700',
  'Παραπομπές': 'bg-purple-100 text-purple-700',
  'Άλλο': 'bg-gray-100 text-gray-600',
};

export default function Vault() {
  const { activeMemberId, members } = useFamilyStore();
  const activeMember = activeMemberId ? members.find(m => m.id === activeMemberId) : null;
  const queryClient = useQueryClient();

  const [activeCategory, setActiveCategory] = useState('Όλα');
  const [showModal, setShowModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('Άλλο');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: docs, isLoading } = useQuery({
    queryKey: ['vault', activeMemberId, activeCategory],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeMemberId) params.set('familyMemberId', activeMemberId);
      if (activeCategory !== 'Όλα') params.set('category', activeCategory);
      const qs = params.toString();
      return api.get(`/vault${qs ? '?' + qs : ''}`).then(r => r.data.data);
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setShowModal(true);
    // reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', pendingFile);
      formData.append('category', selectedCategory);
      if (activeMemberId) formData.append('familyMemberId', activeMemberId);
      await api.post('/vault/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      queryClient.invalidateQueries({ queryKey: ['vault'] });
      setShowModal(false);
      setPendingFile(null);
      setSelectedCategory('Άλλο');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Σφάλμα αποθήκευσης');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, fileName: string) => {
    if (!confirm(`Διαγραφή "${fileName}";`)) return;
    await api.delete(`/vault/${id}`);
    queryClient.invalidateQueries({ queryKey: ['vault'] });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Αρχείο Εγγράφων</h1>
          <p className="text-sm text-gray-500 mt-0.5">Αποθήκη αρχείων — εκθέσεις, εικόνες, PDF</p>
          {activeMember && <p className="text-sm text-amber-600 mt-0.5">Προβολή για: <strong>{activeMember.name}</strong></p>}
        </div>
        <label className="btn-primary cursor-pointer flex items-center gap-2 px-4 py-2 text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ανέβασμα
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileSelect}
          />
        </label>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-40 rounded-xl" />)}
        </div>
      )}

      {/* Document grid */}
      {!isLoading && docs && docs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((doc: any) => (
            <div key={doc._id} className="card p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
                  {doc.mimeType?.includes('pdf') ? '📄' : doc.mimeType?.includes('image') ? '🖼️' : '📁'}
                </div>
                <span className={`badge text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[doc.category] || 'bg-gray-100 text-gray-600'}`}>
                  {doc.category}
                </span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm text-gray-900 line-clamp-2">{doc.fileName}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(doc.uploadedAt).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                {doc.aiSummary && (
                  <p className="text-xs text-gray-600 mt-2 line-clamp-3 italic">{doc.aiSummary}</p>
                )}
              </div>
              <div className="flex gap-2 pt-1 border-t border-gray-100">
                <button
                  onClick={() => window.open(doc.fileUrl, '_blank')}
                  className="btn-ghost text-xs flex items-center gap-1 px-2 py-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Λήψη
                </button>
                <button
                  onClick={() => handleDelete(doc._id, doc.fileName)}
                  className="btn-ghost text-xs text-red-500 hover:text-red-700 flex items-center gap-1 px-2 py-1.5 ml-auto"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Διαγραφή
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!docs || docs.length === 0) && (
        <div className="card p-10 text-center">
          <div className="text-5xl mb-4">📁</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Δεν υπάρχουν έγγραφα</h2>
          <p className="text-sm text-gray-500 mb-6">
            {activeCategory !== 'Όλα' ? `Δεν βρέθηκαν έγγραφα στη κατηγορία "${activeCategory}".` : 'Αποθηκεύστε εξετάσεις, συνταγές, και ιατρικά έγγραφα.'}
          </p>
          <label className="btn-primary cursor-pointer inline-flex items-center gap-2 px-5 py-2.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Ανεβάστε το πρώτο σας έγγραφο
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileSelect}
            />
          </label>
        </div>
      )}

      {/* Upload modal */}
      {showModal && pendingFile && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setPendingFile(null); } }}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ανέβασμα εγγράφου</h3>
            <div className="p-3 bg-gray-50 rounded-lg mb-4">
              <p className="text-sm text-gray-700 font-medium truncate">{pendingFile.name}</p>
              <p className="text-xs text-gray-400">{(pendingFile.size / 1024).toFixed(0)} KB</p>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Κατηγορία</label>
              <select
                className="input-field"
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
              >
                {CATEGORIES.filter(c => c !== 'Όλα').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowModal(false); setPendingFile(null); }}
                className="btn-ghost flex-1 py-2.5 justify-center"
                disabled={uploading}
              >
                Ακύρωση
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="btn-primary flex-1 py-2.5 justify-center flex items-center gap-2"
              >
                {uploading && <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Αποθήκευση
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
