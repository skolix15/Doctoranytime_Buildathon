import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import Doctor from '../models/Doctor';
import QnA from '../models/QnA';

const router = Router();

function cosineSim(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

const SPECIALTY_KEYWORDS: Record<string, string[]> = {
  'Cardiology': ['καρδ', 'πίεση', 'heart', 'cardiac', 'cardio', 'παλμ', 'αρτηριακή', 'αίμα', 'cholesterol', 'χοληστερ'],
  'Dermatology': ['δέρμα', 'ακμή', 'ψωριά', 'έκζεμ', 'acne', 'skin', 'derm', 'ελιά', 'mole', 'rash', 'εξάνθημα'],
  'Neurology': ['κεφαλ', 'ημικρανία', 'headache', 'migraine', 'neuro', 'νευρ', 'τρεμ', 'εγκεφ', 'brain', 'stroke'],
  'Paediatrics': ['παιδ', 'βρέφ', 'νήπ', 'child', 'baby', 'πυρετ', 'fever', 'εμβόλ', 'vaccin'],
  'Orthopaedics': ['γόνατ', 'ισχ', 'πόνο', 'knee', 'hip', 'back', 'spine', 'σπονδυλ', 'οστ', 'μύ'],
  'General Practice': ['γενικ', 'εξεταση', 'checkup', 'κόπωση', 'fatigue', 'αίμα', 'blood', 'general'],
  'Endocrinology': ['διαβήτ', 'diabetes', 'θυροειδ', 'thyroid', 'γλυκόζ', 'glucose', 'ινσουλίν', 'insulin', 'ορμόν'],
  'Psychiatry': ['κατάθλ', 'άγχ', 'depression', 'anxiety', 'panic', 'ύπνος', 'sleep', 'ψυχ', 'psych'],
  'Gynaecology': ['γυναικ', 'γυναίκα', 'εμμην', 'ωοθ', 'pcos', 'μαστ', 'breast', 'gynae', 'pregnancy', 'κύηση'],
  'Ophthalmology': ['μάτ', 'eye', 'οφθ', 'ophthal', 'όραση', 'vision', 'γλαύκ', 'glaucoma', 'μυωπ']
};

function extractSpecialties(query: string): string[] {
  const q = query.toLowerCase();
  const found: string[] = [];
  for (const [spec, keywords] of Object.entries(SPECIALTY_KEYWORDS)) {
    if (keywords.some(kw => q.includes(kw))) found.push(spec);
  }
  return found.length > 0 ? found : [];
}

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { query, filters } = req.body;
    if (!query) return res.status(400).json({ success: false, error: { message: 'Query required', code: 'VALIDATION_ERROR' } });

    const specialties = extractSpecialties(query);
    const q = query.toLowerCase();

    // Search QnA by text similarity
    const allQnA = await QnA.find({}).populate('answers.doctorId', 'profile specialties');
    const qnaResults = allQnA
      .map(qna => {
        const questionWords = qna.question.toLowerCase().split(/\s+/);
        const queryWords = q.split(/\s+/);
        const overlap = queryWords.filter(w => w.length > 3 && questionWords.some(qw => qw.includes(w) || w.includes(qw))).length;
        const score = overlap / Math.max(queryWords.length, 1);
        return { qna, score };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(r => ({
        ...r.qna.toObject(),
        confidenceScore: Math.min(0.95, 0.5 + r.score * 0.5)
      }));

    // Find doctors
    let doctorQuery: any = { isActive: true };
    if (specialties.length > 0) doctorQuery.specialties = { $in: specialties };
    const doctors = await Doctor.find(doctorQuery).limit(20).select('-passwordHash -embeddingVector');

    const scoredDoctors = doctors.map(doctor => {
      const specialtyScore = specialties.some(s => doctor.specialties.includes(s)) ? 1 : 0.5;
      const ratingScore = (doctor.stats?.avgRating || 3) / 5;
      const totalScore = specialtyScore * 0.6 + ratingScore * 0.4;

      const matchReasons = [];
      if (specialties.length > 0) {
        const matched = specialties.filter(s => doctor.specialties.includes(s));
        if (matched.length > 0) matchReasons.push(`Ειδικός σε ${matched.join(', ')}`);
      }
      if ((doctor.stats?.avgRating || 0) >= 4.8) matchReasons.push('Εξαιρετικά αξιολογημένος');
      if ((doctor.stats?.totalPatients || 0) > 1000) matchReasons.push(`${doctor.stats.totalPatients}+ ασθενείς`);

      const relevantQnA = qnaResults.find(q => q.answers?.some((a: any) => a.doctorId?.toString() === doctor._id.toString()));

      return {
        doctor,
        matchScore: Math.round(totalScore * 100),
        matchReason: matchReasons[0] || 'Διαθέσιμος ιατρός',
        relevantQnA: relevantQnA ? {
          question: relevantQnA.question,
          answerSnippet: relevantQnA.answers?.[0]?.text?.slice(0, 150) + '...' || ''
        } : null
      };
    }).sort((a, b) => b.matchScore - a.matchScore).slice(0, 6);

    res.json({ success: true, data: { doctors: scoredDoctors, qna: qnaResults } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.get('/suggestions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string || '').toLowerCase();
    if (!q || q.length < 2) return res.json({ success: true, data: [] });
    const qnas = await QnA.find({ question: { $regex: q, $options: 'i' } }).limit(5).select('question specialty');
    res.json({ success: true, data: qnas.map(q => q.question) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

export default router;
