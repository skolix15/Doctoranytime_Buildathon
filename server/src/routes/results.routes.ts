import { Router, Response } from 'express';
import multer from 'multer';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import TestResult from '../models/TestResult';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
router.use(authMiddleware);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const filter: any = { patientId: req.userId };
    if (req.query.familyMemberId) filter.familyMemberId = req.query.familyMemberId;
    const results = await TestResult.find(filter).sort({ testDate: -1 });
    res.json({ success: true, data: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await TestResult.findOne({ _id: req.params.id, patientId: req.userId });
    if (!result) return res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.post('/upload', async (req: AuthRequest, res: Response) => {
  try {
    const { testType, testDate, labName, aiSummary } = req.body;
    let values = req.body.values;
    if (typeof values === 'string') {
      try { values = JSON.parse(values); } catch { values = []; }
    }
    const result = await TestResult.create({
      patientId: req.userId,
      testType: testType || 'blood',
      testDate: testDate ? new Date(testDate) : new Date(),
      labName,
      values: values || [],
      aiSummary,
      uploadedFileUrl: null
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

// POST /results/analyze — AI analysis of values
router.post('/analyze', async (req: AuthRequest, res: Response) => {
  try {
    const { values, testType } = req.body;
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({ success: true, data: { aiSummary: '', values: values || [] } });
    }
    const valuesText = (values || []).map((v: any) => `${v.name}: ${v.value} ${v.unit || ''} (${v.referenceRange || 'N/A'}) - ${v.status}`).join('\n');
    const resp = await anthropic.messages.create({
      model: process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Είσαι ιατρικός βοηθός. Ανάλυσε τα παρακάτω αποτελέσματα εξετάσεων (${testType || 'γενικές'}) και γράψε:
1. Μια σύνοψη 2-3 προτάσεων στα ελληνικά
2. Για κάθε ανώμαλη τιμή (high/low/critical), μια σύντομη εξήγηση

Τιμές:
${valuesText}

Απάντησε σε JSON: {"aiSummary": "...", "explanations": {"ονομα_τιμης": "εξήγηση", ...}}`
      }]
    });
    let aiSummary = '';
    let explanations: Record<string, string> = {};
    if (resp.content[0]?.type === 'text') {
      try {
        const parsed = JSON.parse(resp.content[0].text.replace(/```json\n?|\n?```/g, '').trim());
        aiSummary = parsed.aiSummary || '';
        explanations = parsed.explanations || {};
      } catch {
        aiSummary = resp.content[0].text;
      }
    }
    const enrichedValues = (values || []).map((v: any) => ({
      ...v,
      aiExplanation: v.status !== 'normal' ? (explanations[v.name] || '') : undefined
    }));
    res.json({ success: true, data: { aiSummary, values: enrichedValues } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

// POST /results/:id/ask — SSE stream AI answer
router.post('/:id/ask', async (req: AuthRequest, res: Response) => {
  try {
    const result = await TestResult.findOne({ _id: req.params.id, patientId: req.userId });
    if (!result) return res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });

    const { question } = req.body;
    const userQuestion = question || 'Εξήγησε μου τα αποτελέσματα';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (!process.env.ANTHROPIC_API_KEY) {
      res.write(`data: ${JSON.stringify({ type: 'token', data: 'Δεν είναι διαθέσιμο το AI.' })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
      return;
    }

    const valuesText = result.values.map((v: any) => `- ${v.name}: ${v.value} ${v.unit || ''} (φυσιολογικό: ${v.referenceRange || 'N/A'}) - ${v.status}`).join('\n') || 'Δεν υπάρχουν αριθμητικές τιμές';
    const testDateStr = result.testDate ? new Date(result.testDate).toLocaleDateString('el-GR') : 'Άγνωστη ημερομηνία';
    const systemPrompt = `Είσαι ιατρικός βοηθός που βοηθάει ασθενείς να κατανοήσουν τα αποτελέσματα εξετάσεών τους.

Αποτελέσματα εξέτασης (${result.testType}) από ${result.labName || 'εργαστήριο'} (${testDateStr}):
${valuesText}

Απάντα στα ελληνικά με σαφήνεια. Εξήγησε τι σημαίνουν οι τιμές χωρίς να κάνεις ιατρική διάγνωση.`;

    const stream = await anthropic.messages.stream({
      model: process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userQuestion }]
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ type: 'token', data: event.delta.text })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', data: err.message })}\n\n`);
    res.end();
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await TestResult.findOneAndDelete({ _id: req.params.id, patientId: req.userId });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

// POST /results/:id/files — attach a file to a test result
router.post('/:id/files', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await TestResult.findOne({ _id: req.params.id, patientId: req.userId });
    if (!result) return res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
    if (!req.file) return res.status(400).json({ success: false, error: { message: 'No file provided', code: 'VALIDATION_ERROR' } });

    const { originalname, mimetype, buffer } = req.file;
    const fileUrl = `data:${mimetype};base64,${buffer.toString('base64')}`;

    if (!result.attachedFiles) result.attachedFiles = [];
    result.attachedFiles.push({ fileName: originalname, fileUrl, mimeType: mimetype, uploadedAt: new Date() });
    await result.save();

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

// DELETE /results/:id/files/:fileIndex — remove an attached file
router.delete('/:id/files/:fileIndex', async (req: AuthRequest, res: Response) => {
  try {
    const result = await TestResult.findOne({ _id: req.params.id, patientId: req.userId });
    if (!result) return res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });

    const idx = parseInt(req.params.fileIndex, 10);
    if (!result.attachedFiles || idx < 0 || idx >= result.attachedFiles.length) {
      return res.status(400).json({ success: false, error: { message: 'Invalid file index', code: 'VALIDATION_ERROR' } });
    }

    result.attachedFiles.splice(idx, 1);
    await result.save();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

export default router;
