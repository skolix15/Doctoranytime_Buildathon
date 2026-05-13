import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'onboarding_seen_v1';

const SLIDES = [
  {
    icon: '🏥',
    accent: 'from-blue-600 to-indigo-600',
    title: 'Καλώς ήρθατε στο MedPlatform',
    subtitle: 'Ο ιατρικός σας βοηθός που σας γνωρίζει πραγματικά',
    body: 'Σε αντίθεση με το ChatGPT ή άλλα AI tools, το MedPlatform γνωρίζει το ιστορικό σας, τα φάρμακά σας, τις εξετάσεις σας και τα ραντεβού σας. Κάθε απάντηση είναι εξατομικευμένη για εσάς.',
    features: [],
    tip: '',
  },
  {
    icon: '🤖',
    accent: 'from-indigo-600 to-purple-600',
    title: 'Ιατρικός Βοηθός AI',
    subtitle: 'Γνωρίζει τα πάντα για την υγεία σας',
    body: 'Ο Medical Assistant διαβάζει αυτόματα το ιατρικό σας ιστορικό πριν κάθε απάντηση — χρόνιες παθήσεις, αλλεργίες, φάρμακα, πρόσφατες εξετάσεις και επερχόμενα ραντεβού.',
    features: [
      '💬 Streaming chat με confidence score σε κάθε απάντηση',
      '📚 Πηγές από πραγματικές ερωτήσεις ιατρών — κλικ για ολόκληρο το thread',
      '💬 Θυμάται τι συζητήσατε σε προηγούμενες συνεδρίες',
      '📋 Sidebar με ιστορικό συνομιλιών — επαναφορά παλιών sessions',
    ],
    tip: '💡 Δοκιμάστε: "Έχω πονοκέφαλο και παίρνω Amlodipine — υπάρχει σχέση;"',
  },
  {
    icon: '💬',
    accent: 'from-purple-600 to-pink-600',
    title: 'AI Popup — Πάντα Διαθέσιμος',
    subtitle: 'Ρωτήστε AI χωρίς να φύγετε από τη σελίδα',
    body: 'Το AI bubble κάτω δεξιά είναι διαθέσιμο σε κάθε σελίδα. Κάθε κουμπί 💬 στην εφαρμογή ανοίγει αυτόματα το popup με προ-συμπληρωμένο ερώτημα — χωρίς να χρειαστεί να πληκτρολογήσετε τίποτα.',
    features: [
      '🔗 Κουμπί σε κάθε φάρμακο: "Γιατί παίρνω αυτό και τι παρενέργειες έχει;"',
      '🔬 Κουμπί σε κάθε εξέταση: στέλνει αυτόματα τις τιμές σας',
      '📅 Κουμπί σε ραντεβού: "Ετοίμασε ερωτήσεις για τον γιατρό μου"',
      '↗️ Link για πλήρη προβολή Medical Assistant',
    ],
    tip: '💡 Δοκιμάστε: κλικ στο 💬 δίπλα σε ένα φάρμακό σας',
  },
  {
    icon: '📅',
    accent: 'from-pink-600 to-rose-600',
    title: 'Κράτηση Ραντεβού μέσα από Chat',
    subtitle: 'Από AI σύσταση σε ραντεβού με 2 κλικ',
    body: 'Όταν το AI προτείνει επίσκεψη σε ειδικό, εμφανίζεται αυτόματα κάρτα κράτησης μέσα στη συνομιλία. Μπορείτε να επιλέξετε γιατρό που έχετε ξαναδεί ή να αναζητήσετε νέο.',
    features: [
      '👨‍⚕️ Προηγούμενοι γιατροί: λίστα από αποθηκευμένους & παρελθοντικά ραντεβού',
      '🔍 Αναζήτηση: redirect στη Αναζήτηση με προ-συμπληρωμένη ειδικότητα',
      '✍️ Προ-συμπλήρωση στοιχείων ραντεβού από τα δεδομένα της συνομιλίας',
      '🗓️ Επιλογή διαθέσιμης ώρας απευθείας',
    ],
    tip: '💡 Δοκιμάστε: "Χρειάζομαι καρδιολόγο για τα αποτελέσματά μου"',
  },
  {
    icon: '🔍',
    accent: 'from-rose-600 to-orange-500',
    title: 'Αναζήτηση Γιατρών',
    subtitle: 'Βρείτε τον κατάλληλο ειδικό',
    body: 'Αναζητήστε γιατρό με σύμπτωμα, ειδικότητα ή όνομα. Κάθε αποτέλεσμα έχει score συμβατότητας. Δίπλα εμφανίζονται σχετικές ερωτήσεις από πραγματικούς ιατρούς.',
    features: [
      '📋 Slide-in drawer με πλήρες προφίλ γιατρού χωρίς να φύγετε από τη σελίδα',
      '🗓️ Διαθέσιμες ώρες απευθείας στο drawer',
      '⭐ Στατιστικά: ασθενείς, μέσος βαθμός, ποσοστό επανακράτησης',
      '🏥 Τοποθεσία κλινικής, τηλέφωνο, γλώσσες',
    ],
    tip: '💡 Δοκιμάστε: πληκτρολογήστε "υπέρταση" ή "ημικρανία"',
  },
  {
    icon: '💊',
    accent: 'from-orange-500 to-yellow-500',
    title: 'Φάρμακα & Εξετάσεις',
    subtitle: 'Κατανοήστε τη θεραπεία σας',
    body: 'Η ενότητα Υγεία συγκεντρώνει φάρμακα, εξετάσεις και έγγραφα σε ένα μέρος. Το AI εξηγεί τα πάντα με απλή γλώσσα.',
    features: [
      '💊 "Γιατί παίρνω αυτό;" — AI εξήγηση για κάθε φάρμακο',
      '🔬 Τιμές εξετάσεων με badge (φυσιολογικό / αυξημένο / μειωμένο)',
      '📄 AI ανάλυση αποτελεσμάτων σε κατανοητή γλώσσα',
      '📁 Vault εγγράφων: αποθήκευση MRI, αιματολογικών, ακτινογραφιών',
    ],
    tip: '💡 Δοκιμάστε: κουμπί 💬 στις εξετάσεις αίματος σας',
  },
  {
    icon: '📊',
    accent: 'from-yellow-500 to-green-500',
    title: 'Ιστορικό & Metrics',
    subtitle: 'Παρακολουθήστε την πορεία της υγείας σας',
    body: 'Το Ιστορικό Υγείας συγκεντρώνει όλα τα ραντεβού με σημειώσεις γιατρού, διάγνωση και συνταγογραφήσεις. Τα Metrics δείχνουν τάσεις μέσα στον χρόνο.',
    features: [
      '📅 4 tabs: Επερχόμενα, Προηγούμενα, Όλα, Γράφημα',
      '👨‍⚕️ Σημειώσεις γιατρού, διάγνωση, συνταγογραφήσεις ανά ραντεβού',
      '📈 Charts: αρτηριακή πίεση, γλυκόζη, βάρος, βήματα, ύπνος',
      '🔗 Σύνδεση με εξωτερικές εφαρμογές για αυτόματη καταγραφή',
    ],
    tip: '💡 Δοκιμάστε: tab "Γράφημα" στο Ιστορικό Υγείας',
  },
  {
    icon: '👨‍👩‍👧',
    accent: 'from-green-500 to-teal-500',
    title: 'Οικογένεια',
    subtitle: 'Διαχειριστείτε την υγεία όλης της οικογένειας',
    body: 'Προσθέστε μέλη οικογένειας με πλήρες ιατρικό ιστορικό. Ο Medical Assistant αλλάζει context αυτόματα όταν επιλέγετε μέλος — οι απαντήσεις αφορούν εκείνο το άτομο.',
    features: [
      '👶 Παιδιά, σύζυγος, γονείς — κάθε σχέση με ξεχωριστό προφίλ',
      '💊 Παθήσεις, αλλεργίες, φάρμακα, ύψος, βάρος, ομάδα αίματος',
      '🤖 AI context switching: ρωτήστε για οποιοδήποτε μέλος',
      '📝 Σημειώσεις ανά μέλος για γρήγορη αναφορά',
    ],
    tip: '💡 Δοκιμάστε: επιλέξτε παιδί → ρωτήστε για το άσθμα του',
  },
  {
    icon: '✨',
    accent: 'from-teal-500 to-blue-600',
    title: 'AI Προτάσεις & Dashboard',
    subtitle: 'Προληπτική φροντίδα με AI insights',
    body: 'Το Dashboard εμφανίζει εξατομικευμένες AI προτάσεις βασισμένες στα δεδομένα σας. Λαμβάνετε ειδοποίηση 24 ώρες πριν κάθε ραντεβού με προτεινόμενες ερωτήσεις.',
    features: [
      '💡 3 AI insight cards: τάσεις, ειδοποιήσεις, συστάσεις',
      '🔔 Pre-appointment briefing: "Ετοιμάσου για αύριο"',
      '📌 Αποθήκευση τελευταίας ανάλυσης — δείτε ξανά όποτε θέλετε',
      '⏰ Υπενθυμίσεις φαρμάκων και ραντεβού',
    ],
    tip: '💡 Δοκιμάστε: "Δημιουργία Προτάσεων" στο Dashboard',
  },
  {
    icon: '🚀',
    accent: 'from-blue-600 to-indigo-600',
    title: 'Είστε έτοιμοι!',
    subtitle: 'Ξεκινήστε να χρησιμοποιείτε το MedPlatform',
    body: 'Μπορείτε να επανέλθετε σε αυτόν τον οδηγό οποιαδήποτε στιγμή από τις Ρυθμίσεις. Καλή χρήση!',
    features: [
      '⚙️ Ρυθμίσεις → "Οδηγός Χρήσης" για να δείτε ξανά',
      '💬 Medical Assistant: /assistant',
      '🔍 Αναζήτηση γιατρών: /search',
      '💊 Φάρμακα & Εξετάσεις: /health-records',
    ],
    tip: '',
  },
];

interface Props {
  onClose: () => void;
}

export default function OnboardingGuide({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    onClose();
  };

  const goTo = (path: string) => {
    finish();
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className={`h-full bg-gradient-to-r ${slide.accent} transition-all duration-500`}
            style={{ width: `${((step + 1) / SLIDES.length) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className={`bg-gradient-to-br ${slide.accent} p-6 text-white`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{slide.icon}</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
                  {step + 1} / {SLIDES.length}
                </p>
                <h2 className="text-xl font-bold leading-tight">{slide.title}</h2>
                <p className="text-sm opacity-90 mt-0.5">{slide.subtitle}</p>
              </div>
            </div>
            <button onClick={finish} className="opacity-60 hover:opacity-100 text-white text-xl leading-none mt-1">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <p className="text-gray-600 text-sm leading-relaxed">{slide.body}</p>

          {slide.features.length > 0 && (
            <ul className="space-y-2">
              {slide.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                  {f}
                </li>
              ))}
            </ul>
          )}

          {slide.tip && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
              {slide.tip}
            </div>
          )}

          {/* Last step quick actions */}
          {isLast && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={() => goTo('/assistant')} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg p-3 text-sm font-medium text-left transition-colors">
                🤖 Medical Assistant
              </button>
              <button onClick={() => goTo('/search')} className="bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg p-3 text-sm font-medium text-left transition-colors">
                🔍 Αναζήτηση Γιατρών
              </button>
              <button onClick={() => goTo('/health-records')} className="bg-green-50 hover:bg-green-100 text-green-700 rounded-lg p-3 text-sm font-medium text-left transition-colors">
                💊 Φάρμακα & Εξετάσεις
              </button>
              <button onClick={() => goTo('/appointments')} className="bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg p-3 text-sm font-medium text-left transition-colors">
                📅 Ιστορικό Υγείας
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-4 flex items-center justify-between gap-3">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="text-sm text-gray-400 hover:text-gray-600 disabled:opacity-0 transition-colors"
          >
            ← Πίσω
          </button>

          {/* Dots */}
          <div className="flex gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === step ? 'w-4 bg-indigo-500' : 'bg-gray-200 hover:bg-gray-300'}`}
              />
            ))}
          </div>

          {isLast ? (
            <button
              onClick={finish}
              className="btn-primary text-sm px-4 py-2"
            >
              Ξεκινήστε →
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              className="btn-primary text-sm px-4 py-2"
            >
              Επόμενο →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export { STORAGE_KEY };
