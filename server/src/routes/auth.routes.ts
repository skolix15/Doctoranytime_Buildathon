import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Patient from '../models/Patient';
import Doctor from '../models/Doctor';

const router = Router();

function signTokens(userId: string, role: string) {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
  const accessToken = jwt.sign({ userId, role }, secret, { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any });
  const refreshToken = jwt.sign({ userId, role }, refreshSecret, { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any });
  return { accessToken, refreshToken };
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: { message: 'Email and password required', code: 'VALIDATION_ERROR' } });
    const existing = await Patient.findOne({ email });
    if (existing) return res.status(409).json({ success: false, error: { message: 'Email already in use', code: 'EMAIL_TAKEN' } });
    const passwordHash = await bcrypt.hash(password, 10);
    const patient = await Patient.create({ email, passwordHash, profile: { firstName, lastName, language: 'el' }, aiContext: { knownConditions: [], allergies: [], totalSessions: 0 }, preferences: { notificationChannels: ['email'] }, familyMembers: [], healthMetrics: [] });
    const { accessToken, refreshToken } = signTokens(patient._id.toString(), 'patient');
    res.json({ success: true, data: { accessToken, refreshToken, user: { id: patient._id, email, firstName, lastName, role: 'patient' } } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    // Check patient first
    let user: any = await Patient.findOne({ email });
    let role = 'patient';
    if (!user) {
      user = await Doctor.findOne({ email });
      role = 'doctor';
    }
    if (!user || !user.passwordHash) return res.status(401).json({ success: false, error: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' } });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ success: false, error: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' } });
    const { accessToken, refreshToken } = signTokens(user._id.toString(), role);
    res.json({
      success: true,
      data: {
        accessToken, refreshToken,
        user: {
          id: user._id,
          email,
          firstName: user.profile?.firstName,
          lastName: user.profile?.lastName,
          role,
          avatar: user.profile?.avatar
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, error: { message: 'Refresh token required', code: 'VALIDATION_ERROR' } });
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret') as any;
    const { accessToken, refreshToken: newRefresh } = signTokens(payload.userId, payload.role);
    res.json({ success: true, data: { accessToken, refreshToken: newRefresh } });
  } catch {
    res.status(401).json({ success: false, error: { message: 'Invalid refresh token', code: 'INVALID_TOKEN' } });
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  res.json({ success: true });
});

export default router;
