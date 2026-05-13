import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import Anthropic from '@anthropic-ai/sdk';
import Patient from '../models/Patient';
import Appointment from '../models/Appointment';
import Medication from '../models/Medication';
import Doctor from '../models/Doctor';
import TestResult from '../models/TestResult';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const router = Router();
router.use(authMiddleware);

router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const patient = await Patient.findById(req.userId);
    if (!patient) return res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
    res.json({ success: true, data: patient });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.put('/me', async (req: AuthRequest, res: Response) => {
  try {
    const patient = await Patient.findByIdAndUpdate(req.userId, { $set: req.body }, { new: true });
    res.json({ success: true, data: patient });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const [upcoming, medications, patient] = await Promise.all([
      Appointment.find({ patientId: req.userId, status: { $in: ['pending', 'confirmed'] }, dateTime: { $gte: new Date() } })
        .sort({ dateTime: 1 }).limit(3).populate('doctorId', 'profile specialties locations'),
      Medication.find({ patientId: req.userId, isActive: true }).limit(5),
      Patient.findById(req.userId)
    ]);
    res.json({ success: true, data: { upcoming, medications, patient } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.get('/timeline', async (req: AuthRequest, res: Response) => {
  try {
    const filter: any = { patientId: req.userId };
    if (req.query.familyMemberId) filter.familyMemberId = req.query.familyMemberId;
    const { from, to } = req.query;
    if (from) filter.dateTime = { $gte: new Date(from as string) };
    if (to) filter.dateTime = { ...filter.dateTime, $lte: new Date((to as string) + 'T23:59:59') };
    const appointments = await Appointment.find(filter)
      .sort({ dateTime: -1 }).populate('doctorId', 'profile specialties');
    res.json({ success: true, data: appointments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.post('/metrics', async (req: AuthRequest, res: Response) => {
  try {
    const { type, value, unit } = req.body;
    await Patient.findByIdAndUpdate(req.userId, {
      $push: { healthMetrics: { type, value, unit, recordedAt: new Date(), source: 'manual' } }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

// IMPORTANT: /metrics/all, /metrics/import, /metrics/analyze must come BEFORE /metrics/:type
// to prevent Express from matching the literal "all"/"import"/"analyze" as the :type parameter.

router.post('/metrics/import', async (req: AuthRequest, res: Response) => {
  try {
    const { metrics } = req.body;
    if (!Array.isArray(metrics) || metrics.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'metrics array required', code: 'VALIDATION_ERROR' } });
    }
    const mapped = metrics.map((m: any) => ({
      metricType: m.type || m.metricType,
      value: Number(m.value),
      unit: m.unit,
      recordedAt: m.date ? new Date(m.date) : new Date(),
      source: 'import',
      category: m.category || 'general'
    }));
    await Patient.findByIdAndUpdate(req.userId, { $push: { healthMetrics: { $each: mapped } } });
    res.json({ success: true, data: { imported: metrics.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.get('/metrics/all', async (req: AuthRequest, res: Response) => {
  try {
    const patient = await Patient.findById(req.userId).select('healthMetrics');
    const grouped: Record<string, any[]> = {};
    for (const metric of patient?.healthMetrics || []) {
      const key = metric.metricType;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(metric);
    }
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    }
    res.json({ success: true, data: grouped });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.get('/metrics/:type', async (req: AuthRequest, res: Response) => {
  try {
    const patient = await Patient.findById(req.userId);
    const metrics = patient?.healthMetrics.filter(m => m.metricType === req.params.type)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
      .slice(0, 30);
    res.json({ success: true, data: metrics });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.get('/insights', async (req: AuthRequest, res: Response) => {
  try {
    const patient = await Patient.findById(req.userId).select('profile aiContext healthMetrics cachedInsights');
    if (!patient) return res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });

    // Return cache if fresher than 6 hours
    const cacheAgeMs = patient.cachedInsights?.generatedAt
      ? Date.now() - new Date(patient.cachedInsights.generatedAt).getTime()
      : Infinity;
    if (cacheAgeMs < 6 * 60 * 60 * 1000 && (patient.cachedInsights?.data?.length ?? 0) > 0) {
      return res.json({ success: true, data: patient.cachedInsights!.data });
    }

    const [appointments, medications, testResults] = await Promise.all([
      Appointment.find({ patientId: req.userId }).sort({ dateTime: -1 }).limit(10).populate('doctorId', 'profile specialties'),
      Medication.find({ patientId: req.userId, isActive: true }).limit(10),
      TestResult.find({ patientId: req.userId }).sort({ testDate: -1 }).limit(5)
    ]);

    // Build context for Claude
    const abnormalValues = testResults.flatMap((t: any) =>
      (t.values || []).filter((v: any) => v.status !== 'normal')
        .map((v: any) => `${v.name}: ${v.value}${v.unit} (${v.status})`)
    );

    const upcomingAppts = appointments.filter((a: any) => new Date(a.dateTime) >= new Date());
    const latestMetrics = (() => {
      const byType: Record<string, any> = {};
      for (const m of patient.healthMetrics || []) {
        if (!byType[m.metricType] || new Date(m.recordedAt) > new Date(byType[m.metricType].recordedAt)) {
          byType[m.metricType] = m;
        }
      }
      return Object.entries(byType).map(([type, m]) => `${type}: ${m.value} ${m.unit}`).join(', ');
    })();

    const context = `Patient: ${patient.profile?.firstName} ${patient.profile?.lastName}
Known conditions: ${patient.aiContext?.knownConditions?.join(', ') || 'None'}
Active medications (${medications.length}): ${medications.map((m: any) => `${m.name} ${m.dosage}`).join(', ') || 'None'}
Upcoming appointments: ${upcomingAppts.length > 0 ? upcomingAppts.map((a: any) => {
  const d = a.doctorId as any;
  return `${new Date(a.dateTime).toLocaleDateString('el-GR')} with ${d?.profile?.firstName} ${d?.profile?.lastName} (${d?.specialties?.[0] || a.service})`;
}).join('; ') : 'None'}
Abnormal test values: ${abnormalValues.length > 0 ? abnormalValues.join(', ') : 'None'}
Latest health metrics: ${latestMetrics || 'None'}
Last session summary: ${patient.aiContext?.lastSessionSummary || 'None'}`;

    const fallbackInsights = [
      { type: 'preventive', title: 'Παρακολούθηση Υγείας', description: `Έχετε ${medications.length} ενεργά φάρμακα. Βεβαιωθείτε ότι τηρείτε τις οδηγίες δοσολογίας.`, urgency: 'info', suggestedAction: null },
      { type: 'followup', title: 'Τακτικός Έλεγχος', description: 'Ο τακτικός προληπτικός έλεγχος είναι σημαντικός για την υγεία σας.', urgency: 'attention', suggestedAction: 'Κλείστε ραντεβού για γενική εξέταση.' }
    ];

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({ success: true, data: fallbackInsights });
    }

    try {
      const resp = await anthropic.messages.create({
        model: process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `Based on this patient's health data, generate exactly 3 personalised health insight cards in Greek. Return ONLY a JSON array:
[{"type":"preventive|medication|followup|warning","title":"Short title (≤6 words)","description":"1-2 sentences specific to their data","urgency":"info|attention|important","suggestedAction":"One concrete action or null"}]

Rules:
- Be specific — reference their actual conditions, medications, or test values
- If abnormal test values exist, create a warning card for them
- If upcoming appointment exists, create a preparation reminder
- If no real data issues, give relevant preventive advice for their known conditions

Patient data:
${context}

Return ONLY the JSON array, no markdown.`
        }]
      });

      const text = resp.content[0].type === 'text' ? resp.content[0].text : '[]';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      if (Array.isArray(parsed) && parsed.length > 0) {
        await Patient.findByIdAndUpdate(req.userId, {
          $set: { cachedInsights: { data: parsed, generatedAt: new Date() } }
        });
        return res.json({ success: true, data: parsed });
      }
    } catch {
      // AI call failed — fall through to fallback
    }

    res.json({ success: true, data: fallbackInsights });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.get('/saved-doctors', async (req: AuthRequest, res: Response) => {
  try {
    const patient = await Patient.findById(req.userId);
    if (!patient) return res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
    const doctors = await Doctor.find({ _id: { $in: patient.savedDoctors } })
      .select('profile specialties stats locations');
    res.json({ success: true, data: doctors });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.post('/saved-doctors/:doctorId', async (req: AuthRequest, res: Response) => {
  try {
    await Patient.findByIdAndUpdate(req.userId, {
      $addToSet: { savedDoctors: req.params.doctorId }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.delete('/saved-doctors/:doctorId', async (req: AuthRequest, res: Response) => {
  try {
    await Patient.findByIdAndUpdate(req.userId, {
      $pull: { savedDoctors: req.params.doctorId }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});


router.post('/metrics/analyze', async (req: AuthRequest, res: Response) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const [patient, medications, testResults] = await Promise.all([
      Patient.findById(req.userId).select('profile aiContext healthMetrics'),
      Medication.find({ patientId: req.userId, isActive: true }).limit(20),
      TestResult.find({ patientId: req.userId }).sort({ testDate: -1 }).limit(5)
    ]);

    // Calculate age
    let age = '';
    if (patient?.profile?.dateOfBirth) {
      const ageDiff = Date.now() - new Date(patient.profile.dateOfBirth).getTime();
      age = `${Math.floor(ageDiff / (365.25 * 24 * 60 * 60 * 1000))} ετών`;
    }

    // Use inline metrics from body if provided (freshly parsed file), else fall back to DB
    const inlineMetrics: any[] | null = Array.isArray(req.body.inputMetrics) ? req.body.inputMetrics : null;

    const grouped: Record<string, any[]> = {};
    if (inlineMetrics) {
      for (const m of inlineMetrics) {
        const key = m.type || m.metricType || 'unknown';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({ ...m, recordedAt: m.date ? new Date(m.date) : new Date() });
      }
    } else {
      for (const metric of patient?.healthMetrics || []) {
        const key = metric.metricType;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(metric);
      }
      for (const key of Object.keys(grouped)) {
        grouped[key].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
      }
    }

    const metricsLines = Object.entries(grouped).map(([type, values]) => {
      const lines = values.map((v: any) => {
        const date = v.recordedAt ? new Date(v.recordedAt).toLocaleDateString('el-GR') : (v.date || '—');
        return `  ${date}: ${v.value} ${v.unit || ''}${v.category ? ` [${v.category}]` : ''}`;
      });
      return `${type}:\n${lines.join('\n')}`;
    }).join('\n\n');

    const medicationsText = medications.length > 0
      ? medications.map((m: any) => `- ${m.name} ${m.dosage} (${m.frequency})`).join('\n')
      : 'Κανένα';

    const testResultsText = testResults.length > 0
      ? testResults.map((t: any) => {
          let line = `- ${t.testType} (${new Date(t.testDate).toLocaleDateString('el-GR')})`;
          if (t.aiSummary) line += `: ${t.aiSummary}`;
          return line;
        }).join('\n')
      : 'Κανένα';

    const context = `Ασθενής: ${patient?.profile?.firstName || ''} ${patient?.profile?.lastName || ''}${age ? `, ${age}` : ''}
Παθήσεις: ${patient?.aiContext?.knownConditions?.join(', ') || 'Καμία'}
Αλλεργίες: ${patient?.aiContext?.allergies?.join(', ') || 'Καμία'}

Ενεργά φάρμακα:
${medicationsText}

Πρόσφατα αποτελέσματα εξετάσεων:
${testResultsText}

Μετρήσεις υγείας (όλες, από νεότερη σε παλαιότερη):
${metricsLines || 'Δεν υπάρχουν μετρήσεις'}`;

    const stream = anthropic.messages.stream({
      model: process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5',
      max_tokens: 1200,
      system: `Είσαι εξειδικευμένος AI αναλυτής υγείας για ελληνική ιατρική πλατφόρμα. Αναλύεις μετρήσεις υγείας και δίνεις ολοκληρωμένη αξιολόγηση στα ελληνικά.

Η ανάλυσή σου ΠΡΕΠΕΙ να περιλαμβάνει:
1. **Σύνοψη κατάστασης** — γενική εκτίμηση της φυσικής κατάστασης και υγείας
2. **Ανάλυση ανά μέτρηση** — για κάθε τύπο μέτρησης, σχολίασε αν είναι φυσιολογική, υψηλή ή χαμηλή και γιατί
3. **Τάσεις** — αν υπάρχουν πολλαπλές μετρήσεις, σχολίασε αν βελτιώνονται, επιδεινώνονται ή παραμένουν σταθερές
4. **Πιθανά ζητήματα** — οτιδήποτε χρήζει προσοχής ή αξιολόγησης από γιατρό
5. **Συστάσεις** — συγκεκριμένες, εφαρμόσιμες συμβουλές (διατροφή, άσκηση, ύπνος, ενυδάτωση κ.λπ.)
6. **Επόμενα βήματα** — αν χρειάζεται επίσκεψη σε γιατρό και σε ποια ειδικότητα

ΣΗΜΑΝΤΙΚΟ: Λαμβάνεις υπόψη τις γνωστές παθήσεις και φάρμακα για να δώσεις εξατομικευμένες παρατηρήσεις. Δεν κάνεις διάγνωση — παρέχεις πληροφορίες και κατευθύνσεις μόνο. Χρησιμοποίησε markdown για δομή.`,
      messages: [{
        role: 'user',
        content: `${context}\n\nΑνάλυσε τις παραπάνω μετρήσεις υγείας μου και δώσε μου πλήρη αξιολόγηση, συγκεκριμένες συστάσεις και γνώμη για τη φυσική μου κατάσταση.`
      }]
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ type: 'token', data: event.delta.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', data: err.message })}\n\n`);
      res.end();
    }
  }
});

router.post('/suggestions', async (req: AuthRequest, res: Response) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const [patient, recentAppointments, upcomingAppointments, medications, testResults] = await Promise.all([
      Patient.findById(req.userId).select('profile aiContext familyMembers healthMetrics'),
      Appointment.find({ patientId: req.userId, dateTime: { $gte: twoMonthsAgo, $lte: new Date() } })
        .sort({ dateTime: -1 }).limit(20).populate('doctorId', 'profile specialties'),
      Appointment.find({ patientId: req.userId, status: { $in: ['pending', 'confirmed'] }, dateTime: { $gte: new Date() } })
        .sort({ dateTime: 1 }).limit(5).populate('doctorId', 'profile specialties'),
      Medication.find({ patientId: req.userId, isActive: true }).limit(20),
      TestResult.find({ patientId: req.userId }).sort({ testDate: -1 }).limit(10)
    ]);

    let age = '';
    if (patient?.profile?.dateOfBirth) {
      const ageDiff = Date.now() - new Date(patient.profile.dateOfBirth).getTime();
      age = `${Math.floor(ageDiff / (365.25 * 24 * 60 * 60 * 1000))} ετών`;
    }

    const recentApptText = recentAppointments.length > 0
      ? recentAppointments.map((a: any) => {
          const doc = a.doctorId;
          const spec = doc?.specialties?.[0] || '';
          const diagStr = a.diagnosis?.map((d: any) => d.description || d).join(', ') || '';
          const presStr = a.prescriptions?.map((p: any) => p.medication || p.name || p).join(', ') || '';
          let line = `- ${new Date(a.dateTime).toLocaleDateString('el-GR')}: ${a.service}`;
          if (spec) line += ` (${spec})`;
          if (a.status === 'cancelled') line += ' [ΑΚΥΡΩΘΗΚΕ]';
          if (diagStr) line += ` — Διάγνωση: ${diagStr}`;
          if (presStr) line += ` — Συνταγή: ${presStr}`;
          if (a.notes) line += ` — Σημ.: ${a.notes}`;
          return line;
        }).join('\n')
      : 'Κανένα';

    const upcomingApptText = upcomingAppointments.length > 0
      ? upcomingAppointments.map((a: any) => `- ${new Date(a.dateTime).toLocaleDateString('el-GR')}: ${a.service}`).join('\n')
      : 'Κανένα';

    const medsText = medications.length > 0
      ? medications.map((m: any) => `- ${m.name} ${m.dosage} (${m.frequency})`).join('\n')
      : 'Κανένα';

    const testText = testResults.length > 0
      ? testResults.map((t: any) => {
          let line = `- ${t.testType} (${t.testDate ? new Date(t.testDate).toLocaleDateString('el-GR') : '—'})`;
          const abnormals = t.values?.filter((v: any) => v.isAbnormal).map((v: any) => `${v.name}: ${v.value} ${v.unit}`).join(', ');
          if (abnormals) line += ` — Ανώμαλα: ${abnormals}`;
          if (t.aiSummary) line += ` — ${t.aiSummary}`;
          return line;
        }).join('\n')
      : 'Κανένα';

    const metricsText = patient?.healthMetrics && patient.healthMetrics.length > 0
      ? (() => {
          const grouped: Record<string, any[]> = {};
          for (const m of patient.healthMetrics) {
            if (!grouped[m.metricType]) grouped[m.metricType] = [];
            grouped[m.metricType].push(m);
          }
          return Object.entries(grouped).map(([type, vals]) => {
            const sorted = vals.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
            const last = sorted[0];
            return `- ${type}: τελευταία ${last.value} ${last.unit} (${new Date(last.recordedAt).toLocaleDateString('el-GR')}), ${sorted.length} μετρήσεις`;
          }).join('\n');
        })()
      : 'Καμία';

    const familyText = patient?.familyMembers && patient.familyMembers.length > 0
      ? patient.familyMembers.map((m: any) => {
          let line = `- ${m.name} (${m.relation})`;
          if (m.conditions?.length) line += ` — Παθήσεις: ${m.conditions.join(', ')}`;
          if (m.medications?.length) line += ` — Φάρμακα: ${m.medications.join(', ')}`;
          return line;
        }).join('\n')
      : 'Κανένα';

    const context = `Ασθενής: ${patient?.profile?.firstName || ''} ${patient?.profile?.lastName || ''}${age ? `, ${age}` : ''}
Γνωστές παθήσεις: ${patient?.aiContext?.knownConditions?.join(', ') || 'Καμία'}
Αλλεργίες: ${patient?.aiContext?.allergies?.join(', ') || 'Καμία'}

Ενεργά φάρμακα:
${medsText}

Ιατρικές επισκέψεις (τελευταίοι 2 μήνες):
${recentApptText}

Επερχόμενες επισκέψεις:
${upcomingApptText}

Πρόσφατα αποτελέσματα εξετάσεων:
${testText}

Μετρήσεις υγείας (τελευταίες):
${metricsText}

Μέλη οικογένειας:
${familyText}`;

    const stream = anthropic.messages.stream({
      model: process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5',
      max_tokens: 1000,
      system: `Είσαι προσωπικός βοηθός υγείας για ελληνική ιατρική πλατφόρμα. Κάθε φορά που ο χρήστης συνδέεται, του παρέχεις εξατομικευμένες, πρακτικές προτάσεις για την υγεία του βάσει του πλήρους ιστορικού του.

Η ανάλυσή σου πρέπει να περιλαμβάνει:
1. **Γεια σου, [Όνομα]!** — Μικρό χαιρετισμό με ζεστή εισαγωγή
2. **Τι συνέβη τους τελευταίους 2 μήνες** — Σύντομη ανακεφαλαίωση επισκέψεων, παθήσεων, αλλαγών
3. **Προτάσεις για τις επόμενες εβδομάδες** — Συγκεκριμένες ενέργειες (επισκέψεις γιατρού, εξετάσεις, φάρμακα, διατροφή, άσκηση)
4. **Επερχόμενα ραντεβού** — Υπενθύμιση και τι να ετοιμαστεί
5. **Οικογένεια** — Αν υπάρχουν σχετικές παρατηρήσεις για τα μέλη

Να είσαι συγκεκριμένος, φιλικός και ουσιαστικός. Μη δίνεις γενικές συμβουλές — χρησιμοποίησε τα δεδομένα του χρήστη. Χρησιμοποίησε markdown.`,
      messages: [{
        role: 'user',
        content: `${context}\n\nΔώσε μου τις σημερινές προτάσεις για την υγεία μου.`
      }]
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ type: 'token', data: event.delta.text })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', data: err.message })}\n\n`);
      res.end();
    }
  }
});

export default router;
