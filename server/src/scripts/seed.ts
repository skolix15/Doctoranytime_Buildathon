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

  // ─── SUMMARY ────────────────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log('SEED COMPLETE — BuildathonDB');
  console.log('========================================');
  console.log(`Doctors:       ${doctors.length}`);
  console.log(`Q&A entries:   ${qnas.length}`);
  console.log(`Patients:      ${patients.length}`);
  console.log(`Appointments:  ${apptDocs.length}`);
  console.log(`Medications:   ${medDocs.length}`);
  console.log(`Test Results:  ${resultDocs.length}`);
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
