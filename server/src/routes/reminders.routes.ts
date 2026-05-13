import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import Reminder from '../models/Reminder';

const router = Router();
router.use(authMiddleware);

// GET /reminders — list active (non-acknowledged) reminders, or all with ?all=1
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const filter: any = { patientId: req.userId };
    if (!req.query.all) filter.acknowledged = false;
    const reminders = await Reminder.find(filter).sort({ remindAt: 1 });
    res.json({ success: true, data: reminders });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

// POST /reminders — create a reminder
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { type, title, description, referenceId, remindAt, recurring, familyMemberId } = req.body;
    if (!type || !title || !remindAt) {
      return res.status(400).json({ success: false, error: { message: 'type, title, remindAt required', code: 'VALIDATION_ERROR' } });
    }
    const reminder = await Reminder.create({
      patientId: req.userId,
      familyMemberId,
      type,
      title,
      description,
      referenceId,
      remindAt: new Date(remindAt),
      recurring,
      acknowledged: false
    });
    res.json({ success: true, data: reminder });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

// PUT /reminders/:id — update (acknowledge, change time, etc.)
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, patientId: req.userId },
      req.body,
      { new: true }
    );
    if (!reminder) return res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
    res.json({ success: true, data: reminder });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

// DELETE /reminders/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await Reminder.findOneAndDelete({ _id: req.params.id, patientId: req.userId });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

export default router;
