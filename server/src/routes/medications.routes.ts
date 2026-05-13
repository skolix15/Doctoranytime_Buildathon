import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import Medication from '../models/Medication';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const filter: any = { patientId: req.userId };
    if (req.query.familyMemberId) filter.familyMemberId = req.query.familyMemberId;
    const meds = await Medication.find(filter).populate('prescribedBy', 'profile specialties');
    res.json({ success: true, data: meds });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const med = await Medication.create({ ...req.body, patientId: req.userId });
    res.json({ success: true, data: med });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const med = await Medication.findOneAndUpdate({ _id: req.params.id, patientId: req.userId }, req.body, { new: true });
    if (!med) return res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
    res.json({ success: true, data: med });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await Medication.findOneAndDelete({ _id: req.params.id, patientId: req.userId });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

export default router;
