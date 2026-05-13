import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import Patient from '../models/Patient';
import { v4 as uuid } from 'uuid';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const patient = await Patient.findById(req.userId).select('familyMembers');
    res.json({ success: true, data: patient?.familyMembers || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const member = { ...req.body, id: req.body.id || `fm-${Date.now()}` };
    const patient = await Patient.findByIdAndUpdate(
      req.userId,
      { $push: { familyMembers: member } },
      { new: true }
    );
    res.json({ success: true, data: patient?.familyMembers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const update: any = {};
    for (const key of Object.keys(req.body)) {
      update[`familyMembers.$.${key}`] = req.body[key];
    }
    const patient = await Patient.findOneAndUpdate(
      { _id: req.userId, 'familyMembers.id': req.params.id },
      { $set: update },
      { new: true }
    );
    res.json({ success: true, data: patient?.familyMembers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const patient = await Patient.findByIdAndUpdate(
      req.userId,
      { $pull: { familyMembers: { id: req.params.id } } },
      { new: true }
    );
    res.json({ success: true, data: patient?.familyMembers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

export default router;
