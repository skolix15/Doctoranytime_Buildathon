import { Router, Response } from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import MedDocument from '../models/MedDocument';

const router = Router();
router.use(authMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// GET /vault — list documents
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const filter: any = { patientId: req.userId };
    if (req.query.familyMemberId) filter.familyMemberId = req.query.familyMemberId;
    if (req.query.category && req.query.category !== 'all') filter.category = req.query.category;
    const docs = await MedDocument.find(filter).sort({ uploadedAt: -1 });
    res.json({ success: true, data: docs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

// GET /vault/:id — single document
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const doc = await MedDocument.findOne({ _id: req.params.id, patientId: req.userId });
    if (!doc) return res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
    res.json({ success: true, data: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

// POST /vault/upload — upload file
router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file provided', code: 'VALIDATION_ERROR' } });
    }

    const { category, familyMemberId } = req.body;
    const { originalname, mimetype, buffer } = req.file;

    // Convert to base64 data URL
    const base64 = buffer.toString('base64');
    const fileUrl = `data:${mimetype};base64,${base64}`;

    // Generate AI summary if possible
    let aiSummary: string | undefined;
    if (process.env.ANTHROPIC_API_KEY && (mimetype.startsWith('text/') || mimetype === 'application/pdf')) {
      try {
        const resp = await anthropic.messages.create({
          model: process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5',
          max_tokens: 150,
          messages: [{
            role: 'user',
            content: `Γράψε 1-2 προτάσεις σύνοψη για ένα ιατρικό έγγραφο με:\n- Όνομα αρχείου: ${originalname}\n- Κατηγορία: ${category || 'Άλλο'}\n\nΗ σύνοψη πρέπει να είναι στα ελληνικά και να περιγράφει σύντομα τι μπορεί να περιέχει το έγγραφο.`
          }]
        });
        if (resp.content[0]?.type === 'text') {
          aiSummary = resp.content[0].text;
        }
      } catch (aiErr) {
        console.error('AI summary generation failed:', aiErr);
      }
    }

    const doc = await MedDocument.create({
      patientId: req.userId,
      familyMemberId: familyMemberId || undefined,
      fileName: originalname,
      fileUrl,
      mimeType: mimetype,
      category: category || 'Άλλο',
      tags: [],
      aiSummary,
      sharedWith: []
    });

    res.json({ success: true, data: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

// DELETE /vault/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await MedDocument.findOneAndDelete({ _id: req.params.id, patientId: req.userId });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

export default router;
