import { Router, Request, Response } from 'express';
import QnA from '../models/QnA';

const router = Router();

router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string || '';
    const qnas = await QnA.find({ question: { $regex: q, $options: 'i' } })
      .populate('answers.doctorId', 'profile specialties')
      .limit(10)
      .sort({ viewCount: -1 });
    res.json({ success: true, data: qnas });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const qna = await QnA.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } }, { new: true })
      .populate('answers.doctorId', 'profile specialties stats');
    if (!qna) return res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
    res.json({ success: true, data: qna });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

export default router;
