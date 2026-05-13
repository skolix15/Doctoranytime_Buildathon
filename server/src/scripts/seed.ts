import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Patient from '../models/Patient';
import Doctor from '../models/Doctor';
import QnA from '../models/QnA';
import Appointment from '../models/Appointment';
import Medication from '../models/Medication';
import TestResult from '../models/TestResult';
import AssistantSession from '../models/AssistantSession';
import Reminder from '../models/Reminder';
import MedDocument from '../models/MedDocument';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/BuildathonDB';
const DB_DIR = path.join(__dirname, 'database');

function loadJSON(file: string) {
  return require(path.join(DB_DIR, file));
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB:', MONGODB_URI);

  await Promise.all([
    Patient.deleteMany({}),
    Doctor.deleteMany({}),
    QnA.deleteMany({}),
    Appointment.deleteMany({}),
    Medication.deleteMany({}),
    TestResult.deleteMany({}),
    AssistantSession.deleteMany({}),
    Reminder.deleteMany({}),
    MedDocument.deleteMany({}),
  ]);
  console.log('Cleared existing data');

  const hash = await bcrypt.hash('Test1234!', 10);

  // ─── DOCTORS ────────────────────────────────────────────────────────────────
  const doctorData: any[] = loadJSON('doctors.json');
  const doctors = await Doctor.insertMany(
    doctorData.map(d => ({
      ...d,
      passwordHash: hash,
      availability: [
        { dayOfWeek: 1, slots: [{ start: '09:00', end: '09:30' }, { start: '10:00', end: '10:30' }, { start: '11:00', end: '11:30' }, { start: '12:00', end: '12:30' }], appointmentType: 'both' },
        { dayOfWeek: 3, slots: [{ start: '14:00', end: '14:30' }, { start: '15:00', end: '15:30' }, { start: '16:00', end: '16:30' }, { start: '17:00', end: '17:30' }], appointmentType: 'both' },
        { dayOfWeek: 5, slots: [{ start: '09:00', end: '09:30' }, { start: '10:00', end: '10:30' }, { start: '11:00', end: '11:30' }], appointmentType: 'in-person' },
      ],
      subscription: { plan: 'premium', status: 'active', expiresAt: new Date('2027-12-31') },
    }))
  );
  console.log(`Seeded ${doctors.length} doctors`);

  // Build email → ObjectId map for doctors
  const doctorMap = new Map<string, mongoose.Types.ObjectId>();
  doctors.forEach(d => doctorMap.set(d.email, d._id));

  // ─── Q&A ────────────────────────────────────────────────────────────────────
  const qnaData: any[] = loadJSON('qna.json');
  const qnaDocs: any[] = [];
  for (const q of qnaData) {
    const specialtyDoctors = doctors.filter(d => d.specialties.includes(q.specialty));
    const pool = specialtyDoctors.length >= 2 ? specialtyDoctors : doctors;
    const qnaAnswers = q.answers.map((text: string, i: number) => ({
      doctorId: pool[i % pool.length]._id,
      text,
      answeredAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      votes: Math.floor(Math.random() * 80) + 10,
      rating: 4 + Math.random(),
    }));
    qnaDocs.push({
      question: q.question,
      specialty: q.specialty,
      tags: q.tags,
      answers: qnaAnswers,
      confidenceScore: 0.72 + Math.random() * 0.28,
      viewCount: Math.floor(Math.random() * 800) + 60,
    });
  }
  const qnas = await QnA.insertMany(qnaDocs);
  for (const qna of qnas) {
    if (qna.answers.length > 0) {
      qna.bestAnswerId = qna.answers[0]._id;
      await qna.save();
    }
  }
  console.log(`Seeded ${qnas.length} Q&A entries`);

  // ─── PATIENTS ───────────────────────────────────────────────────────────────
  const patientData: any[] = loadJSON('patients.json');
  const patients: any[] = [];

  for (const p of patientData) {
    const metrics: any[] = [];
    const now = Date.now();

    // Generate 120 days of health metrics
    for (let i = 120; i >= 0; i--) {
      const ts = new Date(now - i * 24 * 60 * 60 * 1000);

      if (p.email === 'patient@test.com') {
        // BP: trending down from 158 to 138 over 120 days (treatment effect)
        const bpBase = 158 - (120 - i) * (20 / 120);
        metrics.push({ metricType: 'bloodPressure', value: Math.round(bpBase + (Math.random() * 8 - 4)), unit: 'mmHg', recordedAt: ts, source: 'manual' });
        if (i % 3 === 0) metrics.push({ metricType: 'glucose', value: Math.round(108 + (Math.random() * 14 - 7)), unit: 'mg/dL', recordedAt: ts, source: 'manual' });
        if (i % 7 === 0) metrics.push({ metricType: 'weight', value: +(84.5 - i * 0.01 + (Math.random() * 0.4 - 0.2)).toFixed(1), unit: 'kg', recordedAt: ts, source: 'manual' });
        metrics.push({ metricType: 'steps', value: Math.round(6500 + Math.random() * 3000), unit: 'steps', recordedAt: ts, source: 'manual' });
        metrics.push({ metricType: 'heartRate', value: Math.round(68 + Math.random() * 16), unit: 'bpm', recordedAt: ts, source: 'manual' });
        if (i % 2 === 0) metrics.push({ metricType: 'sleepHours', value: +(6.5 + Math.random() * 2).toFixed(1), unit: 'hours', recordedAt: ts, source: 'manual' });

      } else if (p.email === 'patient2@test.com') {
        if (i % 2 === 0) metrics.push({ metricType: 'heartRate', value: Math.round(72 + Math.random() * 20), unit: 'bpm', recordedAt: ts, source: 'manual' });
        if (i % 7 === 0) metrics.push({ metricType: 'weight', value: +(61.5 + Math.random() * 1.0 - 0.3).toFixed(1), unit: 'kg', recordedAt: ts, source: 'manual' });
        metrics.push({ metricType: 'sleepHours', value: +(5.5 + Math.random() * 2.5).toFixed(1), unit: 'hours', recordedAt: ts, source: 'manual' });
        if (i % 3 === 0) metrics.push({ metricType: 'steps', value: Math.round(5000 + Math.random() * 4000), unit: 'steps', recordedAt: ts, source: 'manual' });

      } else if (p.email === 'patient3@test.com') {
        // BP: very high initially, gradually coming down with treatment
        const bpBase = 162 - (120 - i) * (32 / 120);
        metrics.push({ metricType: 'bloodPressure', value: Math.round(bpBase + (Math.random() * 10 - 5)), unit: 'mmHg', recordedAt: ts, source: 'manual' });
        // Glucose: trending down with treatment
        const gBase = 168 - (120 - i) * (30 / 120);
        if (i % 2 === 0) metrics.push({ metricType: 'glucose', value: Math.round(gBase + (Math.random() * 20 - 10)), unit: 'mg/dL', recordedAt: ts, source: 'manual' });
        if (i % 7 === 0) metrics.push({ metricType: 'weight', value: +(92.0 - i * 0.008 + (Math.random() * 0.6 - 0.3)).toFixed(1), unit: 'kg', recordedAt: ts, source: 'manual' });
        if (i % 2 === 0) metrics.push({ metricType: 'steps', value: Math.round(2500 + Math.random() * 1500), unit: 'steps', recordedAt: ts, source: 'manual' });
        metrics.push({ metricType: 'heartRate', value: Math.round(74 + Math.random() * 18), unit: 'bpm', recordedAt: ts, source: 'manual' });
      }
    }

    const patientDoc: any = {
      email: p.email,
      passwordHash: hash,
      profile: {
        ...p.profile,
        dateOfBirth: new Date(p.profile.dateOfBirth),
      },
      familyMembers: p.familyMembers.map((fm: any) => ({
        ...fm,
        dateOfBirth: fm.dateOfBirth ? new Date(fm.dateOfBirth) : undefined,
      })),
      aiContext: p.aiContext,
      healthMetrics: metrics,
      preferences: p.preferences,
    };

    const created = await Patient.create(patientDoc);
    patients.push(created);
  }
  console.log(`Seeded ${patients.length} patients with health metrics`);

  // Build email → ObjectId map for patients
  const patientMap = new Map<string, mongoose.Types.ObjectId>();
  patients.forEach(p => patientMap.set(p.email, p._id));

  // ─── APPOINTMENTS ───────────────────────────────────────────────────────────
  const apptData: any[] = loadJSON('appointments.json');
  const apptDocs = apptData.map((a: any) => {
    const patientId = patientMap.get(a._patientEmail);
    const doctorId = doctorMap.get(a._doctorEmail);
    if (!patientId || !doctorId) {
      console.warn(`  Skipping appt: unknown patient ${a._patientEmail} or doctor ${a._doctorEmail}`);
      return null;
    }
    const dateTime = a.daysFromNow >= 0 ? daysFromNow(a.daysFromNow) : daysAgo(Math.abs(a.daysFromNow));
    const { _patientEmail, _doctorEmail, daysFromNow: _, ...rest } = a;
    return { ...rest, patientId, doctorId, dateTime };
  }).filter(Boolean);

  await Appointment.insertMany(apptDocs);
  console.log(`Seeded ${apptDocs.length} appointments`);

  // ─── MEDICATIONS ────────────────────────────────────────────────────────────
  const medData: any[] = loadJSON('medications.json');
  const medDocs = medData.map((m: any) => {
    const patientId = patientMap.get(m._patientEmail);
    if (!patientId) return null;
    const prescribedBy = m._prescribedByEmail ? doctorMap.get(m._prescribedByEmail) : undefined;
    const startDate = daysAgo(m.startDateDaysAgo || 0);
    const { _patientEmail, _prescribedByEmail, startDateDaysAgo, ...rest } = m;
    return { ...rest, patientId, prescribedBy, startDate };
  }).filter(Boolean);

  await Medication.insertMany(medDocs);
  console.log(`Seeded ${medDocs.length} medications`);

  // ─── TEST RESULTS ───────────────────────────────────────────────────────────
  const resultsData: any[] = loadJSON('test_results.json');
  const resultDocs = resultsData.map((r: any) => {
    const patientId = patientMap.get(r._patientEmail);
    if (!patientId) return null;
    const testDate = daysAgo(r.testDateDaysAgo || 0);
    const { _patientEmail, testDateDaysAgo, ...rest } = r;
    return { ...rest, patientId, testDate };
  }).filter(Boolean);

  await TestResult.insertMany(resultDocs);
  console.log(`Seeded ${resultDocs.length} test results`);

  // ─── SAVED DOCTORS ──────────────────────────────────────────────────────────
  const savedDoctorsByEmail: Record<string, string[]> = {
    'patient@test.com':  ['doctor@test.com', 'gp@medplatform.gr', 'endo@medplatform.gr'],
    'patient2@test.com': ['gyn@medplatform.gr', 'psych@medplatform.gr', 'neuro@medplatform.gr'],
    'patient3@test.com': ['endo@medplatform.gr', 'doctor@test.com', 'ortho@medplatform.gr'],
  };
  for (const [email, docEmails] of Object.entries(savedDoctorsByEmail)) {
    const patId = patientMap.get(email);
    if (!patId) continue;
    const docIds = docEmails.map(e => doctorMap.get(e)?.toString()).filter(Boolean) as string[];
    await Patient.findByIdAndUpdate(patId, { savedDoctors: docIds });
  }
  console.log('Updated savedDoctors for all patients');

  // ─── DOCTOR NOTES ON COMPLETED APPOINTMENTS ─────────────────────────────────
  const doctorNotesMap: Array<{ _patientEmail: string; _doctorEmail: string; daysFromNow: number; doctorNotes: string }> = [
    {
      _patientEmail: 'patient@test.com', _doctorEmail: 'gp@medplatform.gr', daysFromNow: -14,
      doctorNotes: 'Ο ασθενής εμφανίζεται σε καλή γενική κατάσταση. Η αρτηριακή πίεση παραμένει ελαφρά αυξημένη (140/88 mmHg) παρά τη θεραπεία με Amlodipine 5mg. Σύσταση αύξησης δόσης σε 10mg. Επαναλαμβάνω σύσταση για μείωση αλατιού και αυξημένη φυσική δραστηριότητα. Επανέλεγχος σε 6 εβδομάδες με νέο HbA1c.'
    },
    {
      _patientEmail: 'patient@test.com', _doctorEmail: 'doctor@test.com', daysFromNow: -45,
      doctorNotes: 'Υπερηχοκαρδιογράφημα εμφανίζει φυσιολογική λειτουργία κοιλιών, EF 62%. Δεν υπάρχουν ενδείξεις υπερτασικής καρδιαγγειακής νόσου. Η ανταπόκριση στη θεραπεία είναι ικανοποιητική. Συνέχιση τρέχουσας αγωγής. Επόμενο ραντεβού σε 3 μήνες.'
    },
    {
      _patientEmail: 'patient@test.com', _doctorEmail: 'endo@medplatform.gr', daysFromNow: -75,
      doctorNotes: 'HbA1c 5.9% — εντός ορίων prediabetes. Γλυκόζη νηστείας 108 mg/dL. Συζητήσαμε λεπτομερώς τη Mediterranean diet και τη σημασία της 150 λεπτά/εβδ αερόβιας άσκησης. Δεν απαιτείται φαρμακευτική αγωγή σε αυτό το στάδιο. Επανέλεγχος HbA1c σε 3 μήνες.'
    },
    {
      _patientEmail: 'patient2@test.com', _doctorEmail: 'neuro@medplatform.gr', daysFromNow: -10,
      doctorNotes: 'Ημικρανία με αύρα επιβεβαιωμένη βάσει ιστορικού και κριτηρίων ICHD-3. Εκκίνηση Topiramate 25mg βραδινό ως προφυλαξη — αύξηση σε 50mg μετά 4 εβδομάδες εφόσον ανεκτό. Triptan (Sumatriptan 50mg) PRN για οξείες κρίσεις. Αποφυγή αντισυλληπτικών με οιστρογόνα λόγω αύξησης εγκεφαλοαγγειακού κινδύνου.'
    },
    {
      _patientEmail: 'patient2@test.com', _doctorEmail: 'gyn@medplatform.gr', daysFromNow: -60,
      doctorNotes: 'PCOS επιβεβαιωμένο με ανώμαλο κύκλο, υπερηχογραφικά πολυκυστικές ωοθήκες και ελαφρά αυξημένη τεστοστερόνη (1.2 ng/mL). Συζητήσαμε επιλογές αντισύλληψης — δεδομένης της ημικρανίας με αύρα, αντενδείκνυται η combined OCP. Σύσταση low-GI διατροφή, μείωση βάρους 5-10%. Επανέλεγχος σε 3 μήνες.'
    },
    {
      _patientEmail: 'patient2@test.com', _doctorEmail: 'psych@medplatform.gr', daysFromNow: -90,
      doctorNotes: 'ΓΑΔ (GAD-7 score: 16 — σοβαρό). Έναρξη εβδομαδιαίων συνεδριών CBT. Εκπαίδευση σε τεχνικές αναπνοής και progressive muscle relaxation. Χωρίς φαρμακευτική αγωγή αρχικά. Επανεκτίμηση σε 8 εβδομάδες — εάν δεν υπάρξει ανταπόκριση, συζήτηση SSRI.'
    },
    {
      _patientEmail: 'patient3@test.com', _doctorEmail: 'ortho@medplatform.gr', daysFromNow: -8,
      doctorNotes: 'Αμφίπλευρη οστεοαρθρίτιδα γονάτων grade II-III (αριστερό χειρότερο). Ενδείξεις αρθροπλαστικής αριστερού γόνατος εφόσον δεν ανταποκριθεί στη συντηρητική αγωγή. Χορήγηση ενδαρθρικής υαλουρονικής οξύ (3ml) αριστερά. Φυσιοθεραπεία 2x/εβδ x 8 εβδομάδες. Αποφυγή βαρέων φορτίων. Επανεκτίμηση σε 8 εβδομάδες.'
    },
    {
      _patientEmail: 'patient3@test.com', _doctorEmail: 'endo@medplatform.gr', daysFromNow: -55,
      doctorNotes: 'HbA1c 7.2% — άνω του στόχου (<7%). Τροποποίηση θεραπείας: αύξηση Metformin σε 2000mg/ημέρα και προσθήκη Sitagliptin 100mg. Επανέλεγχος νεφρικής λειτουργίας σε 3 μήνες (GFR 68). Τονίζω αποφυγή υπογλυκαιμίας — ο ασθενής οδηγεί. Θρεπτολόγος για διατροφή σακχαροδιαβητικού.'
    },
    {
      _patientEmail: 'patient3@test.com', _doctorEmail: 'doctor@test.com', daysFromNow: -130,
      doctorNotes: 'Αρτηριακή πίεση 158/98 υπό διπλή αγωγή — ανεπαρκής ρύθμιση. Προσθήκη Indapamide SR 1.5mg. Holter 24ωρο: χωρίς ανεπαρκή ρύθμιση ή παύσεις. Αξιολόγηση καρδιαγγειακού κινδύνου SCORE2: υψηλός. Σύσταση για εγκατάσταση οικιακού πιεσόμετρου και ημερολόγιο πίεσης. Επανέλεγχος σε 6 εβδομάδες.'
    },
  ];

  let doctorNotesCount = 0;
  for (const entry of doctorNotesMap) {
    const patientId = patientMap.get(entry._patientEmail);
    const doctorId = doctorMap.get(entry._doctorEmail);
    if (!patientId || !doctorId) continue;
    const dateTime = entry.daysFromNow >= 0 ? daysFromNow(entry.daysFromNow) : daysAgo(Math.abs(entry.daysFromNow));
    const result = await Appointment.findOneAndUpdate(
      { patientId, doctorId, dateTime: { $gte: new Date(dateTime.getTime() - 12 * 3600000), $lte: new Date(dateTime.getTime() + 12 * 3600000) } },
      { doctorNotes: entry.doctorNotes },
      { new: true }
    );
    if (result) doctorNotesCount++;
  }
  console.log(`Updated doctorNotes on ${doctorNotesCount} appointments`);

  // ─── CACHED INSIGHTS ────────────────────────────────────────────────────────
  const insightsByEmail: Record<string, any[]> = {
    'patient@test.com': [
      { type: 'trend', icon: '📉', title: 'Βελτίωση Αρτηριακής Πίεσης', description: 'Η αρτηριακή σας πίεση έχει μειωθεί κατά 14% τις τελευταίες 4 εβδομάδες. Συνεχίστε τη φαρμακευτική αγωγή και την αποφυγή αλατιού.', severity: 'positive', metric: 'bloodPressure' },
      { type: 'alert', icon: '⚠️', title: 'Prediabetes — Έλεγχος Γλυκόζης', description: 'Με βάση τα τελευταία αποτελέσματα (HbA1c 5.9%), παραμένετε στα όρια prediabetes. Συστήνεται Mediterranean diet και 150 λεπτά αερόβιας άσκησης/εβδομάδα.', severity: 'warning', metric: 'glucose' },
      { type: 'recommendation', icon: '🏃', title: 'Στόχος Βημάτων', description: 'Ο μέσος όρος βημάτων σας (7.800/ημέρα) πλησιάζει το στόχο. Αυξήστε σε 10.000 για να βελτιώσετε την ευαισθησία στην ινσουλίνη.', severity: 'info', metric: 'steps' },
    ],
    'patient2@test.com': [
      { type: 'trend', icon: '😴', title: 'Μη Επαρκής Ύπνος', description: 'Ο μέσος ύπνος σας τις τελευταίες 2 εβδομάδες είναι 5.8 ώρες — κάτω του συνιστώμενου (7-9 ώρες). Αυτό μπορεί να επιδεινώνει το άγχος και τις ημικρανίες.', severity: 'warning', metric: 'sleepHours' },
      { type: 'alert', icon: '🧠', title: 'Παράγοντες Ημικρανίας', description: 'Οι ημικρανίες σας φαίνεται να σχετίζονται με ύπνο <6 ωρών και ορμονικές διακυμάνσεις. Τηρήστε ημερολόγιο για να εντοπίσετε triggers.', severity: 'warning', metric: 'heartRate' },
      { type: 'recommendation', icon: '🧘', title: 'CBT & Άγχος', description: 'Η τακτική παρακολούθηση των CBT συνεδριών δείχνει θετικά αποτελέσματα. Εξασκηθείτε στις τεχνικές αναπνοής 10 λεπτά/ημέρα.', severity: 'positive', metric: null },
    ],
    'patient3@test.com': [
      { type: 'alert', icon: '🩸', title: 'Γλυκόζη Ανεπαρκώς Ελεγχόμενη', description: 'Η γλυκόζη νηστείας παραμένει αυξημένη (μ.ο. 148 mg/dL τον τελευταίο μήνα). Θυμηθείτε την αναπροσαρμογή δόσης Metformin που συμφωνήθηκε.', severity: 'danger', metric: 'glucose' },
      { type: 'trend', icon: '💊', title: 'Αρτηριακή Πίεση υπό Έλεγχο', description: 'Μετά την προσθήκη Indapamide, η πίεση βελτιώθηκε (μ.ο. 148/92 mmHg). Στόχος <140/90. Συνεχίστε ημερήσιο έλεγχο.', severity: 'info', metric: 'bloodPressure' },
      { type: 'recommendation', icon: '🦵', title: 'Φυσιοθεραπεία Γόνατος', description: 'Η τακτική φυσιοθεραπεία μπορεί να αναβάλει την ανάγκη αρθροπλαστικής. Στοχεύστε 2 συνεδρίες/εβδομάδα και ασκήσεις ενδυνάμωσης quadriceps στο σπίτι.', severity: 'info', metric: null },
    ],
  };
  for (const [email, insights] of Object.entries(insightsByEmail)) {
    const patId = patientMap.get(email);
    if (!patId) continue;
    await Patient.findByIdAndUpdate(patId, {
      cachedInsights: { data: insights, generatedAt: daysAgo(2) }
    });
  }
  console.log('Pre-seeded cachedInsights for all patients');

  // ─── ASSISTANT SESSIONS ─────────────────────────────────────────────────────
  const p1Id = patientMap.get('patient@test.com')!;
  const p2Id = patientMap.get('patient2@test.com')!;
  const p3Id = patientMap.get('patient3@test.com')!;
  const drCardio = doctorMap.get('doctor@test.com')!;
  const drEndo = doctorMap.get('endo@medplatform.gr')!;
  const drGyn = doctorMap.get('gyn@medplatform.gr')!;
  const drNeuro = doctorMap.get('neuro@medplatform.gr')!;
  const drPsych = doctorMap.get('psych@medplatform.gr')!;
  const qnaSource = qnas[0];

  const sessionDocs = [
    // ── patient1: session 1 (hypertension + diet)
    {
      patientId: p1Id,
      sessionSummary: 'Συζήτηση για διατροφή prediabetes, σωστή ώρα λήψης Amlodipine και αερόβια άσκηση.',
      bookingTriggered: false,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
      messages: [
        { role: 'user', content: 'Πότε πρέπει να παίρνω το Amlodipine;', timestamp: daysAgo(30) },
        {
          role: 'assistant',
          content: 'Το Amlodipine μπορεί να ληφθεί οποιαδήποτε ώρα της ημέρας, αλλά είναι σημαντικό να το παίρνετε **πάντα την ίδια ώρα** για σταθερά επίπεδα στο αίμα. Πολλοί ασθενείς το προτιμούν το πρωί για να μην το ξεχνούν. Αποφύγετε τον χυμό γκρέιπφρουτ κατά τη λήψη καθώς επηρεάζει τον μεταβολισμό.',
          timestamp: daysAgo(30),
          sources: [{ doctorId: drCardio, doctorName: 'Δρ. Παπαδόπουλος', qnaId: qnaSource._id, answerSnippet: 'Ανταπόκριση σε ερώτηση για αντιυπερτασικά φάρμακα' }],
          confidenceScore: 0.91,
          intent: 'medication_query',
          urgencyLevel: 'low'
        },
        { role: 'user', content: 'Τι να τρώω για να βελτιώσω το prediabetes;', timestamp: new Date(daysAgo(30).getTime() + 5 * 60000) },
        {
          role: 'assistant',
          content: 'Για το prediabetes συστήνεται η **Mediterranean diet**:\n\n• **Δημητριακά ολικής άλεσης** (καστανό ρύζι, πλιγούρι, ψωμί σίκαλης)\n• **Λαχανικά αμυλούχα με μέτρο** — προτιμήστε σαλάτες, μπρόκολο, σπανάκι\n• **Όσπρια** 3-4 φορές/εβδομάδα (φακές, ρεβίθια)\n• **Ψάρι** 2-3 φορές/εβδομάδα\n• **Αποφυγή επεξεργασμένης ζάχαρης** και αναψυκτικών\n\nΕπίσης, 150 λεπτά αερόβιας άσκησης/εβδομάδα βελτιώνουν σημαντικά την ευαισθησία στην ινσουλίνη.',
          timestamp: new Date(daysAgo(30).getTime() + 6 * 60000),
          sources: [{ doctorId: drEndo, doctorName: 'Δρ. Οικονόμου', qnaId: qnas[1]?._id, answerSnippet: 'Διατροφικές οδηγίες για prediabetes' }],
          confidenceScore: 0.88,
          intent: 'nutrition_query',
          urgencyLevel: 'low'
        },
      ],
    },
    // ── patient1: session 2 (iron deficiency concern)
    {
      patientId: p1Id,
      sessionSummary: 'Ο ασθενής ρώτησε για συμπτώματα αναιμίας και αν πρέπει να συνεχίσει το σίδηρο.',
      bookingTriggered: false,
      createdAt: daysAgo(10),
      updatedAt: daysAgo(10),
      messages: [
        { role: 'user', content: 'Νιώθω ακόμα κούραση. Πρέπει να συνεχίσω να παίρνω σίδηρο;', timestamp: daysAgo(10) },
        {
          role: 'assistant',
          content: 'Βάσει του ιστορικού σας, είχατε σιδηροπενική αναιμία (φερριτίνη 8 ng/mL) που αντιμετωπίστηκε με Ferrous sulfate. Η κόπωση μπορεί να παραμένει για **4-6 εβδομάδες** μετά την κανονικοποίηση της αιμοσφαιρίνης. Προτείνω:\n\n1. Να κάνετε **γενική αίματος** για έλεγχο φερριτίνης πριν σταματήσετε τον σίδηρο\n2. Εάν η φερριτίνη είναι >30 ng/mL, μπορείτε να σταματήσετε\n3. Παρόλα αυτά, εάν η κόπωση επιμένει, αξίζει επίσκεψη στον παθολόγο',
          timestamp: daysAgo(10),
          confidenceScore: 0.85,
          intent: 'symptom_query',
          urgencyLevel: 'medium'
        },
        { role: 'user', content: 'Εντάξει, θα κάνω εξετάσεις. Πού να απευθυνθώ;', timestamp: new Date(daysAgo(10).getTime() + 3 * 60000) },
        {
          role: 'assistant',
          content: 'Μπορείτε να κλείσετε ραντεβού με τον **παθολόγο** σας για αίτηση γενικής αίματος με φερριτίνη. Εναλλακτικά, πολλά διαγνωστικά κέντρα δέχονται απευθείας χωρίς παραπεμπτικό για βασικές εξετάσεις αίματος.',
          timestamp: new Date(daysAgo(10).getTime() + 4 * 60000),
          confidenceScore: 0.82,
          intent: 'booking_suggestion',
          urgencyLevel: 'low',
        },
      ],
    },
    // ── patient2: session 1 (PCOS + anxiety link)
    {
      patientId: p2Id,
      sessionSummary: 'Συζήτηση για τη σχέση PCOS και άγχους, και ασφαλή αναλγητικά για ημικρανία.',
      bookingTriggered: false,
      createdAt: daysAgo(20),
      updatedAt: daysAgo(20),
      messages: [
        { role: 'user', content: 'Υπάρχει σχέση μεταξύ PCOS και άγχους;', timestamp: daysAgo(20) },
        {
          role: 'assistant',
          content: 'Ναι, υπάρχει **αμφίδρομη σχέση** μεταξύ PCOS και ΓΑΔ. Έρευνες δείχνουν ότι:\n\n• Γυναίκες με PCOS έχουν **3-4 φορές υψηλότερο κίνδυνο** ανάπτυξης άγχους\n• Οι ορμονικές διακυμάνσεις (ανδρογόνα, ινσουλίνη) επηρεάζουν τον νευροδιαβιβαστή σεροτονίνη\n• Το χρόνιο στρες αυξάνει την κορτιζόλη, που επιδεινώνει την ινσουλινοαντίσταση του PCOS\n\nΗ αντιμετώπιση και των δύο παράλληλα (CBT + lifestyle) έχει τα καλύτερα αποτελέσματα.',
          timestamp: daysAgo(20),
          sources: [{ doctorId: drGyn, doctorName: 'Δρ. Σταματίου', qnaId: qnaSource._id, answerSnippet: 'Ορμονικές διαταραχές και ψυχική υγεία' }],
          confidenceScore: 0.89,
          intent: 'condition_query',
          urgencyLevel: 'low'
        },
        { role: 'user', content: 'Ποια αναλγητικά είναι ασφαλή για μένα κατά την ημικρανία;', timestamp: new Date(daysAgo(20).getTime() + 8 * 60000) },
        {
          role: 'assistant',
          content: 'Δεδομένης της αλλεργίας σας στην ιβουπροφαίνη (γαστρεντερική ανοχή), οι επιλογές σας για οξεία κρίση ημικρανίας είναι:\n\n**Πρώτης γραμμής:**\n• **Παρακεταμόλη 1g** — ασφαλής, χωρίς γαστρεντερικά προβλήματα\n• **Sumatriptan 50mg** (triptan) — συνταγογραφημένο από τον νευρολόγο σας\n\n**Αποφύγετε:**\n• Ιβουπροφαίνη, Ναπροξένη (NSAIDs με GI παρενέργειες)\n• Ασπιρίνη εάν έχετε ευαισθησία\n\n⚠️ Για ημικρανία με αύρα: αποφύγετε triptans εάν έχετε καρδιαγγειακούς παράγοντες κινδύνου.',
          timestamp: new Date(daysAgo(20).getTime() + 9 * 60000),
          sources: [{ doctorId: drNeuro, doctorName: 'Δρ. Κωνσταντίνου', qnaId: qnas[2]?._id, answerSnippet: 'Αντιμετώπιση οξείας ημικρανίας' }],
          confidenceScore: 0.93,
          intent: 'medication_query',
          urgencyLevel: 'low'
        },
      ],
    },
    // ── patient2: session 2 (migraine prevention)
    {
      patientId: p2Id,
      sessionSummary: 'Ερωτήσεις για το Topiramate και παρενέργειες, τεχνικές χαλάρωσης για άγχος.',
      bookingTriggered: false,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
      messages: [
        { role: 'user', content: 'Ξεκίνησα Topiramate. Τι παρενέργειες να περιμένω;', timestamp: daysAgo(5) },
        {
          role: 'assistant',
          content: 'Το Topiramate για πρόληψη ημικρανίας μπορεί να προκαλέσει:\n\n**Συχνές (εμφανίζονται στην αρχή):**\n• Μυρμηγκιάσματα στα χέρια/πόδια (παραισθησία) — συνήθως παροδικά\n• Γνωστική επιβράδυνση («brain fog») — ειδικά με υψηλότερες δόσεις\n• Μειωμένη όρεξη\n\n**Σπανιότερες αλλά σημαντικές:**\n• Πέτρες νεφρών (πιείτε >2L νερό/ημέρα)\n• Στένωση γωνίας γλαύκωμα — αναφέρετε αμέσως αν έχετε πόνο στα μάτια\n\nΑρχίζετε με 25mg και αυξάνετε αργά για να ελαχιστοποιήσετε τις παρενέργειες.',
          timestamp: daysAgo(5),
          confidenceScore: 0.90,
          intent: 'medication_query',
          urgencyLevel: 'low'
        },
        { role: 'user', content: 'Έχεις κάποια τεχνική χαλάρωσης για το άγχος;', timestamp: new Date(daysAgo(5).getTime() + 10 * 60000) },
        {
          role: 'assistant',
          content: 'Μερικές αποδεδειγμένες τεχνικές για το άγχος:\n\n**Αναπνοή 4-7-8:**\n1. Εισπνοή 4 δευτερόλεπτα\n2. Κρατήστε 7 δευτερόλεπτα\n3. Εκπνοή 8 δευτερόλεπτα\n→ Επαναλάβετε 4 φορές\n\n**Progressive Muscle Relaxation:**\nΣφίξτε και χαλαρώστε κάθε μυϊκή ομάδα από τα πόδια ως το κεφάλι (15 λεπτά/ημέρα)\n\n**Mindfulness:**\nΕφαρμογές: Insight Timer (δωρεάν), Headspace — 10 λεπτά το πρωί\n\nΣε συνδυασμό με την CBT θεραπεία, αυτές οι τεχνικές δίνουν εξαιρετικά αποτελέσματα.',
          timestamp: new Date(daysAgo(5).getTime() + 11 * 60000),
          sources: [{ doctorId: drPsych, doctorName: 'Δρ. Αναγνώστου', qnaId: qnaSource._id, answerSnippet: 'Τεχνικές διαχείρισης άγχους' }],
          confidenceScore: 0.87,
          intent: 'wellness_query',
          urgencyLevel: 'low'
        },
      ],
    },
    // ── patient3: session 1 (diabetes + knee pain)
    {
      patientId: p3Id,
      sessionSummary: 'Συζήτηση για διαχείριση πόνου γονάτου χωρίς NSAIDs, σχέση βάρους και γλυκόζης.',
      bookingTriggered: true,
      createdAt: daysAgo(15),
      updatedAt: daysAgo(15),
      messages: [
        { role: 'user', content: 'Μπορώ να πάρω ιβουπροφαίνη για τον πόνο στο γόνατο;', timestamp: daysAgo(15) },
        {
          role: 'assistant',
          content: 'Δεδομένης της αλλεργίας/δυσανεξίας σας στην **ασπιρίνη**, πρέπει να είστε προσεκτικοί με τα NSAIDs γενικά. Για τον πόνο γόνατος λόγω οστεοαρθρίτιδας, υπάρχουν ασφαλέστερες επιλογές:\n\n**Εναλλακτικά αναλγητικά:**\n• **Παρακεταμόλη 1g** — πρώτης γραμμής για OA, ασφαλής\n• **Τοπικά NSAIDs** (gel διclofenac) — ελάχιστη συστηματική απορρόφηση\n• **Duloxetine 30-60mg** — επιλογή για χρόνιο πόνο OA\n\n⚠️ Αποφύγετε ιβουπροφαίνη και ναπροξένη από του στόματος.\n\nΕπίσης, η φυσιοθεραπεία 2x/εβδ και ενδυνάμωση quadriceps μειώνουν σημαντικά τον πόνο μακροπρόθεσμα.',
          timestamp: daysAgo(15),
          confidenceScore: 0.92,
          intent: 'medication_query',
          urgencyLevel: 'medium'
        },
        { role: 'user', content: 'Πώς επηρεάζει το βάρος τη γλυκόζη μου;', timestamp: new Date(daysAgo(15).getTime() + 7 * 60000) },
        {
          role: 'assistant',
          content: 'Υπάρχει άμεση σχέση μεταξύ βάρους και γλυκόζης στον ΣΔ2:\n\n• **Κάθε 1kg απώλεια** βάρους βελτιώνει την ευαισθησία στην ινσουλίνη κατά ~3-5%\n• Με BMI 29 (βάρος 92kg), μια **απώλεια 5-10%** (4-9kg) μπορεί να μειώσει HbA1c κατά 0.5-1%\n• Λιπαρές κυτταρικές αποθήκες (ιδιαίτερα κοιλιακό λίπος) παράγουν φλεγμονώδεις κυτοκίνες που αυξάνουν ινσουλινοαντίσταση\n\nΣτόχος: 5% μείωση σε 6 μήνες μέσω διατροφής και αερόβιας άσκησης χαμηλής επιβάρυνσης (κολύμβηση, ποδήλατο — εναλλακτικά λόγω γόνατος).',
          timestamp: new Date(daysAgo(15).getTime() + 8 * 60000),
          confidenceScore: 0.91,
          intent: 'condition_query',
          urgencyLevel: 'low'
        },
      ],
    },
    // ── patient3: session 2 (drug interactions)
    {
      patientId: p3Id,
      sessionSummary: 'Ελέγχθηκαν αλληλεπιδράσεις μεταξύ Metformin, Sitagliptin και Ramipril. Σύσταση επανελέγχου GFR.',
      bookingTriggered: false,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
      messages: [
        { role: 'user', content: 'Υπάρχουν αλληλεπιδράσεις μεταξύ Metformin, Sitagliptin και Ramipril;', timestamp: daysAgo(3) },
        {
          role: 'assistant',
          content: 'Καλή ερώτηση — είναι σημαντικό να ελέγχετε τις αλληλεπιδράσεις. Σχετικά με τα φάρμακά σας:\n\n**Metformin + Ramipril:**\n• Γενικά ασφαλής συνδυασμός\n• Το Ramipril μπορεί να μειώσει ελαφρά τα επίπεδα γλυκόζης — καλό σε ΣΔ2\n• ⚠️ Σε περίπτωση αφυδάτωσης/ιώσεων, προσωρινή διακοπή Metformin (risk lactic acidosis)\n\n**Sitagliptin + Ramipril:**\n• Χαμηλός κίνδυνος αγγιοοιδήματος (σπάνιο αλλά αναφέρετε αμέσως αν έχετε οίδημα προσώπου/λαιμού)\n\n**Σημαντικό:** Με GFR 68 mL/min, το Metformin είναι ασφαλές ακόμη, αλλά **επανέλεγχος νεφρικής λειτουργίας** σε 3 μήνες είναι απαραίτητος.',
          timestamp: daysAgo(3),
          confidenceScore: 0.94,
          intent: 'medication_query',
          urgencyLevel: 'medium'
        },
      ],
    },
  ];

  const sessions = await AssistantSession.insertMany(sessionDocs);
  console.log(`Seeded ${sessions.length} assistant sessions`);

  // ─── REMINDERS ───────────────────────────────────────────────────────────────
  const tomorrowAt8 = new Date(); tomorrowAt8.setDate(tomorrowAt8.getDate() + 1); tomorrowAt8.setHours(8, 0, 0, 0);
  const tomorrowAt20 = new Date(tomorrowAt8); tomorrowAt20.setHours(20, 0, 0, 0);
  const tomorrowAt9 = new Date(tomorrowAt8); tomorrowAt9.setHours(9, 0, 0, 0);

  const reminderDocs = [
    // patient1 — morning Amlodipine
    {
      patientId: p1Id, type: 'medication', title: 'Amlodipine 5mg',
      description: 'Λήψη πρωινής δόσης Amlodipine για υπέρταση',
      remindAt: tomorrowAt8,
      recurring: { enabled: true, days: [0,1,2,3,4,5,6], time: '08:00' },
      acknowledged: false,
    },
    // patient1 — upcoming appointment reminder
    {
      patientId: p1Id, type: 'appointment', title: 'Καρδιολογικός Έλεγχος — Δρ. Παπαδόπουλος',
      description: 'Ραντεβού παρακολούθησης υπέρτασης σε 4 ημέρες',
      remindAt: daysFromNow(3),
      recurring: { enabled: false, days: [], time: '' },
      acknowledged: false,
    },
    // patient1 — blood test reminder
    {
      patientId: p1Id, type: 'examination', title: 'Εξετάσεις Αίματος — HbA1c & Φερριτίνη',
      description: 'Έλεγχος HbA1c για prediabetes και φερριτίνη για αναιμία πριν το ραντεβού με παθολόγο',
      remindAt: daysFromNow(40),
      recurring: { enabled: false, days: [], time: '' },
      acknowledged: false,
    },
    // patient2 — evening Topiramate
    {
      patientId: p2Id, type: 'medication', title: 'Topiramate 25mg',
      description: 'Βραδινή λήψη Topiramate για πρόληψη ημικρανίας',
      remindAt: tomorrowAt20,
      recurring: { enabled: true, days: [0,1,2,3,4,5,6], time: '20:00' },
      acknowledged: false,
    },
    // patient2 — upcoming gynecology appointment
    {
      patientId: p2Id, type: 'appointment', title: 'Γυναικολογικός Έλεγχος — PCOS Παρακολούθηση',
      description: 'Ραντεβού γυναικολόγου σε 7 ημέρες',
      remindAt: daysFromNow(6),
      recurring: { enabled: false, days: [], time: '' },
      acknowledged: false,
    },
    // patient2 — weekly psychiatry session
    {
      patientId: p2Id, type: 'appointment', title: 'Ψυχιατρική Συνεδρία CBT',
      description: 'Εβδομαδιαία συνεδρία CBT για ΓΑΔ',
      remindAt: daysFromNow(13),
      recurring: { enabled: false, days: [], time: '' },
      acknowledged: false,
    },
    // patient3 — morning Metformin
    {
      patientId: p3Id, type: 'medication', title: 'Metformin 1000mg (πρωί)',
      description: 'Πρωινή λήψη Metformin με γεύμα για ΣΔ2',
      remindAt: tomorrowAt8,
      recurring: { enabled: true, days: [0,1,2,3,4,5,6], time: '08:00' },
      acknowledged: false,
    },
    // patient3 — evening Metformin
    {
      patientId: p3Id, type: 'medication', title: 'Metformin 1000mg (βράδυ)',
      description: 'Βραδινή λήψη Metformin με γεύμα για ΣΔ2',
      remindAt: tomorrowAt20,
      recurring: { enabled: true, days: [0,1,2,3,4,5,6], time: '20:00' },
      acknowledged: false,
    },
    // patient3 — Sitagliptin
    {
      patientId: p3Id, type: 'medication', title: 'Sitagliptin 100mg',
      description: 'Ημερήσια λήψη Sitagliptin για ΣΔ2',
      remindAt: tomorrowAt9,
      recurring: { enabled: true, days: [0,1,2,3,4,5,6], time: '09:00' },
      acknowledged: false,
    },
    // patient3 — endocrinology appointment
    {
      patientId: p3Id, type: 'appointment', title: 'Ενδοκρινολογία — Έλεγχος ΣΔ2',
      description: 'Τακτικός έλεγχος ΣΔ2 και HbA1c σε 5 ημέρες',
      remindAt: daysFromNow(4),
      recurring: { enabled: false, days: [], time: '' },
      acknowledged: false,
    },
  ];

  await Reminder.insertMany(reminderDocs);
  console.log(`Seeded ${reminderDocs.length} reminders`);

  // ─── MED DOCUMENTS ──────────────────────────────────────────────────────────
  const medDocDocs = [
    {
      patientId: p1Id,
      fileName: 'Εξετάσεις_Αίματος_Μάρτιος_2026.pdf',
      fileUrl: '/uploads/patient1/blood_test_march_2026.pdf',
      mimeType: 'application/pdf',
      category: 'lab_result',
      tags: ['αιματολογικές εξετάσεις', 'HbA1c', 'φερριτίνη', 'CBC'],
      extractedText: 'Γενική Αίματος: Hgb 13.2 g/dL, WBC 7.2, PLT 245. HbA1c: 5.9%. Φερριτίνη: 42 ng/mL. Γλυκόζη νηστείας: 108 mg/dL.',
      aiSummary: 'Γενική αίματος εντός φυσιολογικών ορίων. HbA1c 5.9% (prediabetes — παρακολούθηση). Φερριτίνη 42 ng/mL (βελτιώθηκε από 8 ng/mL). Γλυκόζη οριακή.',
      sharedWith: [{ doctorId: drCardio, sharedAt: daysAgo(12), expiresAt: daysFromNow(180) }],
      uploadedAt: daysAgo(14),
    },
    {
      patientId: p1Id,
      fileName: 'Υπερηχοκαρδιογράφημα_2026.pdf',
      fileUrl: '/uploads/patient1/echo_2026.pdf',
      mimeType: 'application/pdf',
      category: 'imaging',
      tags: ['καρδιολογία', 'echo', 'υπερηχοκαρδιογράφημα'],
      extractedText: 'Υπερηχοκαρδιογράφημα 2D: EF 62%, φυσιολογική λειτουργία αριστερής κοιλίας. Χωρίς βαλβιδική νόσο. Diastolic function grade I.',
      aiSummary: 'Φυσιολογικό υπερηχοκαρδιογράφημα. EF 62%, χωρίς ενδείξεις καρδιακής ανεπάρκειας ή βαλβιδικής νόσου. Ήπια διαστολική δυσλειτουργία grade I.',
      sharedWith: [{ doctorId: drCardio, sharedAt: daysAgo(44), expiresAt: daysFromNow(365) }],
      uploadedAt: daysAgo(45),
    },
    {
      patientId: p2Id,
      fileName: 'Ορμονολογικές_Εξετάσεις_PCOS_2026.pdf',
      fileUrl: '/uploads/patient2/hormones_pcos_2026.pdf',
      mimeType: 'application/pdf',
      category: 'lab_result',
      tags: ['ορμόνες', 'PCOS', 'τεστοστερόνη', 'AMH', 'LH/FSH'],
      extractedText: 'Τεστοστερόνη ολική: 1.2 ng/mL (N: 0.15-0.70 — αυξημένη). AMH: 8.4 ng/mL (αυξημένη). LH/FSH ratio: 2.8 (>2 συμβατό με PCOS). Προγεστερόνη: 0.8 ng/mL (ωοθηλακική φάση).',
      aiSummary: 'Ορμονολογικό προφίλ συμβατό με PCOS: αυξημένη τεστοστερόνη, υψηλή AMH, LH/FSH ratio >2. Επιβεβαιώνει κλινική διάγνωση.',
      sharedWith: [{ doctorId: drGyn, sharedAt: daysAgo(58), expiresAt: daysFromNow(365) }],
      uploadedAt: daysAgo(60),
    },
    {
      patientId: p2Id,
      fileName: 'MRI_Εγκεφάλου_Ημικρανία_2025.pdf',
      fileUrl: '/uploads/patient2/brain_mri_2025.pdf',
      mimeType: 'application/pdf',
      category: 'imaging',
      tags: ['νευρολογία', 'MRI', 'εγκέφαλος', 'ημικρανία'],
      extractedText: 'MRI εγκεφάλου χωρίς και μετά σκιαγραφικό: Φυσιολογική απεικόνιση. Χωρίς ισχαιμικές εστίες, χωρίς δομικές ανωμαλίες. Μικρές FLAIR υπεριντάσεις παρεγκεφαλιδικά — συμβατές με ημικρανία.',
      aiSummary: 'Φυσιολογικό MRI εγκεφάλου. Μικρές παρεγκεφαλιδικές αλλοιώσεις FLAIR χαρακτηριστικές ημικρανίας. Αποκλείστηκαν δομικές αιτίες πονοκεφάλου.',
      sharedWith: [{ doctorId: drNeuro, sharedAt: daysAgo(9), expiresAt: daysFromNow(365) }],
      uploadedAt: daysAgo(10),
    },
    {
      patientId: p3Id,
      fileName: 'HbA1c_Εξετάσεις_Απρίλιος_2026.pdf',
      fileUrl: '/uploads/patient3/hba1c_april_2026.pdf',
      mimeType: 'application/pdf',
      category: 'lab_result',
      tags: ['ΣΔ2', 'HbA1c', 'γλυκόζη', 'νεφρά', 'GFR'],
      extractedText: 'HbA1c: 7.2% (στόχος <7%). Γλυκόζη νηστείας: 142 mg/dL. Κρεατινίνη: 1.18 mg/dL. eGFR: 68 mL/min/1.73m². Μικρολευκωματινουρία: 45 mg/g (αυξημένη). LDL: 145 mg/dL.',
      aiSummary: 'HbA1c 7.2% — άνω στόχου, τροποποίηση θεραπείας εφαρμόστηκε. Νεφρική λειτουργία μέτρια (GFR 68, stage 2 ΧΝΝ). Μικρολευκωματινουρία θετική — παρακολούθηση. Δυσλιπιδαιμία υπό αξιολόγηση.',
      sharedWith: [
        { doctorId: drEndo, sharedAt: daysAgo(53), expiresAt: daysFromNow(180) },
        { doctorId: drCardio, sharedAt: daysAgo(53), expiresAt: daysFromNow(180) },
      ],
      uploadedAt: daysAgo(55),
    },
    {
      patientId: p3Id,
      fileName: 'MRI_Γόνατα_2025.pdf',
      fileUrl: '/uploads/patient3/knee_mri_2025.pdf',
      mimeType: 'application/pdf',
      category: 'imaging',
      tags: ['ορθοπεδικά', 'MRI', 'γόνατα', 'οστεοαρθρίτιδα'],
      extractedText: 'MRI αριστερού γόνατος: Εκφυλισμός χόνδρου grade III κατά ICRS έσω μηροκνημιαίο. Ρήξη μηνίσκου εσωτερικού οριζόντια. Οστεόφυτα ±6mm. MRI δεξιού γόνατος: grade II εκφυλισμός χόνδρου.',
      aiSummary: 'Σοβαρή οστεοαρθρίτιδα αριστερού γόνατος (grade III) με μηνισκοπάθεια. Μέτρια ΟΑ δεξιού. Αριστερό: πιθανή ένδειξη αρθροπλαστικής εφόσον αποτύχει συντηρητική αγωγή.',
      sharedWith: [],
      uploadedAt: daysAgo(178),
    },
  ];

  await MedDocument.insertMany(medDocDocs);
  console.log(`Seeded ${medDocDocs.length} medical documents`);

  // ─── SUMMARY ────────────────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log('SEED COMPLETE — BuildathonDB');
  console.log('========================================');
  console.log(`Doctors:           ${doctors.length}`);
  console.log(`Q&A entries:       ${qnas.length}`);
  console.log(`Patients:          ${patients.length}`);
  console.log(`Appointments:      ${apptDocs.length} (${doctorNotesCount} with doctor notes)`);
  console.log(`Medications:       ${medDocs.length}`);
  console.log(`Test Results:      ${resultDocs.length}`);
  console.log(`Assistant Sessions:${sessions.length}`);
  console.log(`Reminders:         ${reminderDocs.length}`);
  console.log(`Med Documents:     ${medDocDocs.length}`);
  console.log('----------------------------------------');
  console.log('Test logins (password: Test1234!):');
  console.log('  patient@test.com   (Γιώργος — Hypertension/Prediabetes)');
  console.log('  patient2@test.com  (Ελένη — PCOS/Anxiety/Migraine)');
  console.log('  patient3@test.com  (Νίκος — T2DM/HTN/Knee OA)');
  console.log('  doctor@test.com    (Παπαδόπουλος — Cardiology)');
  console.log('========================================\n');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
