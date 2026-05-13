import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import Anthropic from '@anthropic-ai/sdk';
import Patient from '../models/Patient';
import QnA from '../models/QnA';
import AssistantSession from '../models/AssistantSession';
import Appointment from '../models/Appointment';
import Medication from '../models/Medication';
import TestResult from '../models/TestResult';
import Doctor from '../models/Doctor';

const router = Router();
router.use(authMiddleware);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const URGENCY_KEYWORDS = ['εμφραγμα', 'εγκεφαλικό', 'stroke', 'heart attack', 'αναπνοή δεν μπορώ', 'σοβαρός', 'emergency', 'αιμορραγία', 'unconscious', 'αναίσθητος'];

function detectUrgency(msg: string): string {
  const lower = msg.toLowerCase();
  if (URGENCY_KEYWORDS.some(k => lower.includes(k))) return 'emergency';
  if (lower.includes('πόνος') || lower.includes('pain') || lower.includes('πυρετ')) return 'medium';
  return 'low';
}

function detectLanguageFromHistory(messages: Array<{ role: string; content: string }>): 'el' | 'en' {
  const userMessages = messages.filter(m => m.role === 'user').slice(-10);
  let greekChars = 0;
  let totalChars = 0;
  for (const m of userMessages) {
    for (const ch of m.content) {
      if (/[Ͱ-Ͽἀ-῿]/.test(ch)) greekChars++;
      if (/[a-zA-ZͰ-Ͽἀ-῿]/.test(ch)) totalChars++;
    }
  }
  return totalChars > 0 && greekChars / totalChars > 0.3 ? 'el' : 'en';
}

function inferCommunicationStyle(messages: Array<{ role: string; content: string }>): string {
  const userMessages = messages.filter(m => m.role === 'user').slice(-10);
  if (userMessages.length === 0) return 'plain';
  const medicalTerms = ['διάγνωση', 'συμπτώματα', 'παθολογία', 'diagnosis', 'prognosis', 'etiology', 'hypertension', 'υπέρταση', 'μεταβολισμός', 'metabolism'];
  const avgLen = userMessages.reduce((s, m) => s + m.content.length, 0) / userMessages.length;
  const hasMedTerms = userMessages.some(m => medicalTerms.some(t => m.content.toLowerCase().includes(t)));
  if (hasMedTerms) return 'technical';
  if (avgLen > 200) return 'detailed';
  if (avgLen < 40) return 'brief';
  return 'plain';
}

function buildSystemPrompt(
  patient: any,
  appointments: any[],
  medications: any[],
  testResults: any[],
  healthMetrics: any[],
  historyMessages: Array<{ role: string; content: string }> = [],
  activeFamilyMemberId?: string | null,
  todayDate: string = new Date().toISOString().split('T')[0]
): string {
  const lang = detectLanguageFromHistory(historyMessages);
  const style = patient?.aiContext?.communicationStyle || inferCommunicationStyle(historyMessages);
  const lastSessionSummary = patient?.aiContext?.lastSessionSummary
    ? `\nSummary of last session: ${patient.aiContext.lastSessionSummary}`
    : '';
  const healthMemory = patient?.aiContext?.healthSummary
    ? `\n\n== HEALTH MEMORY (facts learned across all previous conversations) ==\n${patient.aiContext.healthSummary}`
    : '';

  const now = new Date();
  const pastAppts = appointments.filter(a => new Date(a.dateTime) < now);
  const upcomingAppts = appointments.filter(a => new Date(a.dateTime) >= now);

  const formatAppointment = (a: any) => {
    const doc = a.doctorId as any;
    const docName = doc ? `${doc.profile?.firstName || ''} ${doc.profile?.lastName || ''}`.trim() : 'Άγνωστος';
    const specialties = doc?.specialties?.join(', ') || '';
    let line = `- ${new Date(a.dateTime).toLocaleDateString('el-GR')} με ${docName}${specialties ? ` (${specialties})` : ''}, αιτία: ${a.service || a.appointmentType || 'Γενική εξέταση'}`;
    if (a.diagnosis?.length > 0) {
      line += `\n  Διάγνωση: ${a.diagnosis.map((d: any) => d.description || d.code).join(', ')}`;
    }
    if (a.prescriptions?.length > 0) {
      line += `\n  Συνταγογράφηση: ${a.prescriptions.map((p: any) => `${p.medication} ${p.dosage}`).join(', ')}`;
    }
    if (a.notes) line += `\n  Σημειώσεις γιατρού: ${a.notes}`;
    return line;
  };

  const pastApptText = pastAppts.length > 0
    ? pastAppts.map(formatAppointment).join('\n')
    : 'Δεν υπάρχουν προηγούμενα ραντεβού';

  const upcomingApptText = upcomingAppts.length > 0
    ? upcomingAppts.map(a => {
        const doc = a.doctorId as any;
        const docName = doc ? `${doc.profile?.firstName || ''} ${doc.profile?.lastName || ''}`.trim() : 'Άγνωστος';
        return `- ${new Date(a.dateTime).toLocaleDateString('el-GR')} ${new Date(a.dateTime).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })} με ${docName} — ${a.service || 'Εξέταση'}`;
      }).join('\n')
    : 'Δεν υπάρχουν προγραμματισμένα ραντεβού';

  const medicationsText = medications.length > 0
    ? medications.map((m: any) => `- ${m.name} ${m.dosage} (${m.frequency})${m.prescribedBy ? ` — συνταγογραφήθηκε από γιατρό` : ''}`).join('\n')
    : 'Δεν υπάρχουν ενεργά φάρμακα';

  const testResultsText = testResults.length > 0
    ? testResults.map((t: any) => {
        let line = `- ${t.testType} (${new Date(t.testDate).toLocaleDateString('el-GR')})`;
        if (t.aiSummary) line += `: ${t.aiSummary}`;
        const abnormal = (t.values || []).filter((v: any) => v.status === 'high' || v.status === 'low' || v.status === 'critical');
        if (abnormal.length > 0) {
          line += `\n  Μη φυσιολογικές τιμές: ${abnormal.map((v: any) => `${v.name} ${v.value}${v.unit} (${v.status})`).join(', ')}`;
        }
        return line;
      }).join('\n')
    : 'Δεν υπάρχουν πρόσφατα αποτελέσματα';

  // Build metric trends: last 5 readings per type
  const byType: Record<string, any[]> = {};
  for (const metric of healthMetrics) {
    const key = metric.metricType;
    if (!byType[key]) byType[key] = [];
    byType[key].push(metric);
  }
  for (const key of Object.keys(byType)) {
    byType[key].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }
  const metricsText = Object.keys(byType).length > 0
    ? Object.entries(byType).map(([type, readings]) => {
        const last5 = readings.slice(0, 5);
        const trend = last5.map((m: any) => `${m.value} ${m.unit} (${new Date(m.recordedAt).toLocaleDateString('el-GR')})`).join(', ');
        return `- ${type}: ${trend}`;
      }).join('\n')
    : 'Δεν υπάρχουν μετρήσεις';

  // All family members with IDs (for appointment booking tool)
  const allFamilyText = patient?.familyMembers?.length > 0
    ? patient.familyMembers.map((fm: any) => {
        let line = `- ID: ${fm.id}, Όνομα: ${fm.name}, Σχέση: ${fm.relation}`;
        if (fm.dateOfBirth) {
          const age = Math.floor((Date.now() - new Date(fm.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          line += `, Ηλικία: ${age} ετών`;
        }
        if (fm.gender) line += `, Φύλο: ${fm.gender}`;
        if (fm.conditions?.length) line += `, Παθήσεις: ${fm.conditions.join(', ')}`;
        if (fm.allergies?.length) line += `, Αλλεργίες: ${fm.allergies.join(', ')}`;
        if (fm.medications?.length) line += `, Φάρμακα: ${fm.medications.join(', ')}`;
        return line;
      }).join('\n')
    : 'Κανένα καταχωρημένο μέλος';

  // Active family member context (when user is viewing as a family member)
  let familyContext = '';
  if (activeFamilyMemberId && patient?.familyMembers?.length > 0) {
    const member = patient.familyMembers.find((fm: any) => fm.id === activeFamilyMemberId);
    if (member) {
      familyContext = `\n⚠️ ΣΗΜΑΝΤΙΚΟ: Η τρέχουσα συνομιλία αφορά το μέλος οικογένειας: ${member.name} (${member.relation})
- Ηλικία/ΗΓ: ${member.dateOfBirth ? new Date(member.dateOfBirth).toLocaleDateString('el-GR') : 'Άγνωστη'}
- Παθήσεις: ${member.conditions?.join(', ') || 'Καμία'}
- Αλλεργίες: ${member.allergies?.join(', ') || 'Καμία'}
- Φάρμακα: ${member.medications?.join(', ') || 'Κανένα'}
- Σημειώσεις: ${member.notes || 'Καμία'}
Απαντάς για αυτό το άτομο, όχι για τον κύριο χρήστη.`;
    }
  }

  const allergiesWarning = patient?.aiContext?.allergies?.length > 0
    ? `\n⚠️ ΑΛΛΕΡΓΙΕΣ (ΚΡΙΣΙΜΟ): ${patient.aiContext.allergies.join(', ')} — ΠΟΤΕ μην προτείνεις αυτές τις ουσίες`
    : '';

  const langInstruction = lang === 'el'
    ? 'ALWAYS respond in Greek (Ελληνικά) unless the user switches to English.'
    : 'The patient writes in English. Respond in English unless they switch to Greek.';

  const styleInstruction = style === 'technical'
    ? 'The patient uses medical terminology — you may use clinical terms with brief explanations.'
    : style === 'brief'
    ? 'The patient prefers short messages — keep responses concise, 1-2 paragraphs max.'
    : style === 'detailed'
    ? 'The patient writes detailed messages — match their depth in responses.'
    : 'Use simple, plain language avoiding medical jargon.';

  return `You are MedAssist, an AI health assistant for MedPlatform — a Greek healthcare platform.

LANGUAGE: ${langInstruction}
STYLE: ${styleInstruction}
TODAY: ${todayDate} (use this as "today" when the user says "σήμερα" or "today")

== PATIENT PROFILE ==
Name: ${patient?.profile?.firstName || 'Patient'} ${patient?.profile?.lastName || ''}
Known conditions: ${patient?.aiContext?.knownConditions?.join(', ') || 'None recorded'}${allergiesWarning}${familyContext}${lastSessionSummary}${healthMemory}

== FAMILY MEMBERS (use these IDs when booking appointments for family members) ==
${allFamilyText}

== UPCOMING APPOINTMENTS ==
${upcomingApptText}

== PAST APPOINTMENTS (with diagnoses & prescriptions) ==
${pastApptText}

== ACTIVE MEDICATIONS ==
${medicationsText}

== RECENT TEST RESULTS (last 5, with abnormal values) ==
${testResultsText}

== HEALTH METRICS (last 5 readings per type, newest first) ==
${metricsText}

== GUIDELINES ==
1. ${langInstruction}
2. ${styleInstruction}
3. Be empathetic. If symptoms suggest emergency, immediately advise calling 166 — this takes priority over everything.
4. Never diagnose — provide information and guidance only.
5. Reference specific past appointments, diagnoses, medications, or metrics when directly relevant.
6. When the patient asks about a drug or substance, check against ACTIVE MEDICATIONS for interactions.
7. Reference facts from HEALTH MEMORY when relevant.

== MEDICATION & HEALTH RECORD QUESTIONS ==
When the user asks to explain a medication, test result, or anything from their profile ("εξήγησέ μου για το φάρμακο X", "explain my test result", etc.):
- NEVER call suggest_appointment for these — just answer directly.
- For medications: in 3-5 short bullet points, state (1) what this medication treats/why the patient takes it, (2) the exact dosage and frequency from their ACTIVE MEDICATIONS, (3) how/when to take it (with food? morning?), (4) key side effects to watch for, (5) the prescribing doctor if known. Keep it simple — no medical jargon.
- For test results: briefly explain what the values mean and whether anything needs attention.
- Match the response length to the question — medication explanations should be concise, not essays.

== APPOINTMENT BOOKING — ACT IMMEDIATELY ==
ONLY call suggest_appointment when the user clearly wants to book/schedule a visit (e.g. "κλείσε μου ραντεβού", "θέλω να δω γιατρό", "book an appointment"). Do NOT call it for symptom questions, medication questions, or general health advice.
When booking IS requested:
- TODAY is ${todayDate}. If the user says "σήμερα"/"today", set preferredDate to ${todayDate}.
- If the user says "απόγευμα"/"afternoon", use preferredTime "14:00". If they give a range like "14:00-18:00", use the start: "14:00".
- If the user mentions a family member by name or relation (σύζυγος/γυναίκα/wife → spouse, κόρη → child, γιος → child, μαμά → parent), look up the EXACT ID from == FAMILY MEMBERS == and set forFamilyMemberId.
- Always populate "notes" with the key symptoms, duration, and any urgency context from the conversation.
- Pick the most appropriate specialty from the symptoms (πονοκέφαλος/headache → Neurology; στήθος/chest → Cardiology; etc.).
- After calling the tool, write a SHORT (1-2 sentence) confirmation message. Do NOT ask the user to confirm details you already know.`;
}

const SUGGEST_APPOINTMENT_TOOL: Anthropic.Tool = {
  name: 'suggest_appointment',
  description: 'Call this tool ONLY when the user explicitly wants to book or schedule a doctor appointment. Do NOT call it for: medication questions, test result explanations, symptom information, or general health advice — answer those directly instead.',
  input_schema: {
    type: 'object' as const,
    properties: {
      doctorId: {
        type: 'string',
        description: 'MongoDB ID of a specific doctor if explicitly named, else empty string'
      },
      doctorName: {
        type: 'string',
        description: 'Name of the doctor if specifically requested, else empty string'
      },
      specialty: {
        type: 'string',
        description: 'Medical specialty inferred from symptoms (e.g. "Neurology" for headache, "Cardiology" for chest pain, "Pathology" for general/fever). Always populate this.'
      },
      service: {
        type: 'string',
        description: 'Reason for visit — summarize from symptoms mentioned. e.g. "Εξέταση για πονοκέφαλο 2 ημερών"'
      },
      preferredDate: {
        type: 'string',
        description: 'Date in YYYY-MM-DD. If user says "σήμερα"/"today" use TODAY from system prompt. If specific date mentioned, convert it. Else empty string.'
      },
      preferredTime: {
        type: 'string',
        description: 'Time in HH:MM. "απόγευμα"/"afternoon" = "14:00". "πρωί"/"morning" = "09:00". If a range is given (e.g. 14:00-18:00), use the start time. Else empty string.'
      },
      forFamilyMemberId: {
        type: 'string',
        description: 'Exact ID from == FAMILY MEMBERS == if the appointment is for a family member. Match: "σύζυγος"/"γυναίκα"/"wife" → spouse relation, "κόρη" → child (female), "γιος" → child (male), "μαμά"/"μητέρα" → parent. Empty string if for the main patient.'
      },
      notes: {
        type: 'string',
        description: 'ALWAYS populate with key clinical context: symptoms mentioned, duration, intensity, any red flags from conversation. e.g. "Έντονος ξαφνικός πονοκέφαλος, διάρκεια 2 ημέρες"'
      }
    },
    required: ['doctorId', 'doctorName', 'specialty', 'service', 'preferredDate', 'preferredTime', 'forFamilyMemberId', 'notes']
  }
};

router.post('/message', async (req: AuthRequest, res: Response) => {
  try {
    const { message, sessionId, familyMemberId } = req.body;
    if (!message) return res.status(400).json({ success: false, error: { message: 'Message required', code: 'VALIDATION_ERROR' } });

    const patient = await Patient.findById(req.userId);
    const urgency = detectUrgency(message);

    // Load health context
    const [appointments, medications, testResults, metricsPatient] = await Promise.all([
      Appointment.find({ patientId: req.userId }).sort({ dateTime: -1 }).limit(8).populate('doctorId', 'profile specialties'),
      Medication.find({ patientId: req.userId, isActive: true }).limit(20),
      TestResult.find({ patientId: req.userId }).sort({ testDate: -1 }).limit(5),
      Patient.findById(req.userId).select('healthMetrics')
    ]);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (urgency === 'emergency') {
      res.write(`data: ${JSON.stringify({ type: 'urgency', data: 'emergency' })}\n\n`);
    }

    // Find or create session
    let session = sessionId ? await AssistantSession.findOne({ _id: sessionId, patientId: req.userId }) : null;
    if (!session) {
      session = await AssistantSession.create({
        patientId: req.userId,
        activeFamilyMemberId: familyMemberId || null,
        messages: []
      });
    }

    // Load last 3 previous sessions for persistent memory (not including current)
    const previousSessions = await AssistantSession.find({
      patientId: req.userId,
      _id: { $ne: session._id }
    }).sort({ updatedAt: -1 }).limit(3);

    // Find relevant Q&A
    const q = message.toLowerCase();
    const allQnA = await QnA.find({}).populate('answers.doctorId', 'profile specialties').limit(100);
    const relevant = allQnA
      .map(qna => {
        const words = q.split(/\s+/).filter((w: string) => w.length > 3);
        const qWords = qna.question.toLowerCase().split(/\s+/);
        const overlap = words.filter((w: string) => qWords.some((qw: string) => qw.includes(w) || w.includes(qw))).length;
        return { qna, score: overlap };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    // Build context from Q&A
    let qnaContext = '';
    if (relevant.length > 0) {
      qnaContext = '\n\nRelevant Q&A from platform doctors:\n';
      for (const { qna } of relevant) {
        const bestAnswer = qna.answers[0];
        if (bestAnswer) {
          const doc = bestAnswer.doctorId as any;
          qnaContext += `Q: ${qna.question}\nA (${doc?.profile?.firstName} ${doc?.profile?.lastName}, ${qna.specialty}): ${bestAnswer.text.slice(0, 300)}\n\n`;
        }
      }
    }

    // Build history: collect messages from previous sessions (capped at 20 total)
    const prevMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const prevSession of previousSessions.reverse()) {
      for (const m of prevSession.messages) {
        prevMessages.push({ role: m.role as 'user' | 'assistant', content: m.content });
      }
    }
    // Add current session history
    const currentHistory = session.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));

    // Combine and cap at 20 messages
    const allHistory = [...prevMessages, ...currentHistory];
    const cappedHistory = allHistory.slice(-20);

    // Add the new user message
    cappedHistory.push({
      role: 'user',
      content: message + (qnaContext ? `\n\n[Context for assistant: ${qnaContext}]` : '')
    });

    let fullResponse = '';
    let bookingIntentData: Record<string, string> | null = null;

    // Stream from Claude with tool use
    const stream = anthropic.messages.stream({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: buildSystemPrompt(patient, appointments, medications, testResults, metricsPatient?.healthMetrics || [], cappedHistory, familyMemberId),
      tools: [SUGGEST_APPOINTMENT_TOOL],
      messages: cappedHistory
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const token = event.delta.text;
        fullResponse += token;
        res.write(`data: ${JSON.stringify({ type: 'token', data: token })}\n\n`);
      }
    }

    // Check for tool use in final message
    const finalMessage = await stream.finalMessage();
    for (const block of finalMessage.content) {
      if (block.type === 'tool_use' && block.name === 'suggest_appointment') {
        bookingIntentData = block.input as Record<string, string>;
        res.write(`data: ${JSON.stringify({ type: 'booking_intent', data: bookingIntentData })}\n\n`);

        // Find matching doctors by specialty and emit as bookable cards
        if (bookingIntentData?.specialty) {
          try {
            const specialtyTerm = (bookingIntentData.specialty as string).split('/')[0].trim();
            const suggestedDoctors = await Doctor.find({
              specialties: { $elemMatch: { $regex: specialtyTerm, $options: 'i' } }
            }).limit(3).select('_id profile specialties stats');
            if (suggestedDoctors.length > 0) {
              res.write(`data: ${JSON.stringify({ type: 'suggested_doctors', data: suggestedDoctors })}\n\n`);
            }
          } catch {}
        }
      }
    }

    // Only emit sources + confidence for general Q&A, not for booking/symptom-action conversations
    const isBookingInteraction = !!bookingIntentData;
    const sources = isBookingInteraction ? [] : relevant.map(({ qna }) => {
      const doc = qna.answers[0]?.doctorId as any;
      return {
        doctorId: doc?._id,
        doctorName: doc ? `${doc.profile?.firstName} ${doc.profile?.lastName}` : 'Unknown',
        qnaId: qna._id,
        answerSnippet: qna.answers[0]?.text?.slice(0, 120) + '...' || ''
      };
    });

    const confidence = (!isBookingInteraction && relevant.length > 0) ? Math.min(0.95, 0.6 + relevant[0].score * 0.1) : null;

    if (sources.length > 0) res.write(`data: ${JSON.stringify({ type: 'sources', data: sources })}\n\n`);
    if (confidence !== null) res.write(`data: ${JSON.stringify({ type: 'confidence', data: confidence })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'sessionId', data: session._id })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

    // Save to session
    session.messages.push({ role: 'user', content: message, timestamp: new Date() });
    session.messages.push({ role: 'assistant', content: fullResponse, timestamp: new Date(), sources, confidenceScore: confidence, urgencyLevel: urgency });
    await session.save();

    // After session: generate summary + extract new health facts (single Haiku call)
    try {
      if (process.env.ANTHROPIC_API_KEY && session.messages.length >= 2) {
        const summaryMessages = session.messages.slice(-10)
          .map(m => `${m.role === 'user' ? 'Ασθενής' : 'Βοηθός'}: ${m.content.slice(0, 400)}`).join('\n');
        const currentHealthSummary = patient?.aiContext?.healthSummary || '';

        const combinedResp = await anthropic.messages.create({
          model: process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `Analyze this medical assistant conversation and return ONLY valid JSON with two fields:
1. "sessionSummary": 2-3 sentence summary of what health topics were discussed
2. "healthFacts": A 2-4 sentence update paragraph with any NEW health facts the patient disclosed (symptoms, concerns, lifestyle, medication effects, preferences). If no new facts beyond what's already in the current health memory, return empty string.

Current health memory: ${currentHealthSummary || 'None yet'}

Conversation:
${summaryMessages}

Return ONLY JSON: {"sessionSummary": "...", "healthFacts": "..."}`
          }]
        });

        const rawText = combinedResp.content[0].type === 'text' ? combinedResp.content[0].text : '{}';
        try {
          const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
          const updates: Record<string, any> = {};
          if (parsed.sessionSummary) updates['aiContext.lastSessionSummary'] = parsed.sessionSummary;
          if (parsed.healthFacts && parsed.healthFacts.trim()) {
            updates['aiContext.healthSummary'] = parsed.healthFacts;
          }
          if (Object.keys(updates).length > 0) {
            await Patient.findByIdAndUpdate(req.userId, { $set: updates });
          }
          if (parsed.sessionSummary) {
            session.sessionSummary = parsed.sessionSummary;
            await session.save();
          }
        } catch {
          // JSON parse failed — non-fatal
        }
      }
    } catch (summaryErr) {
      console.error('Post-session update failed:', summaryErr);
    }

  } catch (err: any) {
    console.error('Assistant error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', data: err.message })}\n\n`);
      res.end();
    }
  }
});

router.get('/sessions', async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await AssistantSession.find({ patientId: req.userId })
      .sort({ updatedAt: -1 }).limit(20).select('sessionSummary messages createdAt updatedAt');
    res.json({ success: true, data: sessions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.get('/sessions/:id', async (req: AuthRequest, res: Response) => {
  try {
    const session = await AssistantSession.findOne({ _id: req.params.id, patientId: req.userId });
    if (!session) return res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
    res.json({ success: true, data: session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.get('/context', async (req: AuthRequest, res: Response) => {
  try {
    const [patient, appointments, medications] = await Promise.all([
      Patient.findById(req.userId).select('profile familyMembers aiContext'),
      Appointment.find({ patientId: req.userId }).sort({ dateTime: -1 }).limit(5).populate('doctorId', 'profile specialties'),
      Medication.find({ patientId: req.userId, isActive: true }).limit(20)
    ]);

    res.json({
      success: true,
      data: {
        patient: {
          name: `${patient?.profile?.firstName || ''} ${patient?.profile?.lastName || ''}`.trim(),
          knownConditions: patient?.aiContext?.knownConditions || [],
          allergies: patient?.aiContext?.allergies || [],
          lastSessionSummary: patient?.aiContext?.lastSessionSummary || null
        },
        appointments: appointments.map((a: any) => ({
          _id: a._id,
          dateTime: a.dateTime,
          service: a.service,
          type: a.type,
          status: a.status,
          doctor: a.doctorId ? {
            _id: (a.doctorId as any)._id,
            name: `${(a.doctorId as any).profile?.firstName || ''} ${(a.doctorId as any).profile?.lastName || ''}`.trim(),
            specialties: (a.doctorId as any).specialties
          } : null
        })),
        medications: medications.map((m: any) => ({
          _id: m._id,
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          isActive: m.isActive
        })),
        familyMembers: patient?.familyMembers || []
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.post('/prefill', async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.body;
    const patient = await Patient.findById(req.userId);
    let historyBrief = '';

    if (sessionId) {
      const session = await AssistantSession.findById(sessionId);
      if (session) {
        const lastMsgs = session.messages.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n');
        historyBrief = lastMsgs.slice(0, 400);
      }
    }

    // Try AI prefill if API key is set
    let prefill: any = { service: '', forWhom: 'self', urgency: 'routine', historyBrief, suggestedSpecialty: '' };

    if (process.env.ANTHROPIC_API_KEY && sessionId) {
      try {
        const resp = await anthropic.messages.create({
          model: process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5',
          max_tokens: 256,
          messages: [{
            role: 'user',
            content: `Extract booking info from this conversation. Return ONLY JSON: {"service":"","forWhom":"self","urgency":"routine","historyBrief":"","suggestedSpecialty":""}\n\nConversation:\n${historyBrief}`
          }]
        });
        const text = resp.content[0].type === 'text' ? resp.content[0].text : '{}';
        prefill = { ...prefill, ...JSON.parse(text.replace(/```json|```/g, '').trim()) };
      } catch {}
    }

    res.json({ success: true, data: { ...prefill, familyMembers: patient?.familyMembers || [] } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

export default router;
