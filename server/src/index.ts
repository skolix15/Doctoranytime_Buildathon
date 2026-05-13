import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDB } from './config/db';
import authRoutes from './routes/auth.routes';
import patientRoutes from './routes/patient.routes';
import doctorRoutes from './routes/doctor.routes';
import searchRoutes from './routes/search.routes';
import assistantRoutes from './routes/assistant.routes';
import appointmentRoutes from './routes/appointments.routes';
import medicationRoutes from './routes/medications.routes';
import resultRoutes from './routes/results.routes';
import familyRoutes from './routes/family.routes';
import qnaRoutes from './routes/qna.routes';
import vaultRoutes from './routes/vault.routes';
import reminderRoutes from './routes/reminders.routes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '30mb' }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/patient', patientRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/assistant', assistantRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/medications', medicationRoutes);
app.use('/api/v1/results', resultRoutes);
app.use('/api/v1/family', familyRoutes);
app.use('/api/v1/qna', qnaRoutes);
app.use('/api/v1/vault', vaultRoutes);
app.use('/api/v1/reminders', reminderRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`MedPlatform Server running on port ${PORT}`);
    console.log(`API: http://localhost:${PORT}/api/v1`);
    console.log(`========================================\n`);
  });
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});
