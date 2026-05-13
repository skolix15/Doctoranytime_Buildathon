import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import Appointment from '../models/Appointment';
import Doctor from '../models/Doctor';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    let filter: any = { patientId: req.userId };
    const now = new Date();
    if (status === 'upcoming') filter = { ...filter, status: { $in: ['pending', 'confirmed'] }, dateTime: { $gte: now } };
    else if (status === 'past') filter = { ...filter, dateTime: { $lt: now } };
    const appointments = await Appointment.find(filter).sort({ dateTime: -1 }).populate('doctorId', 'profile specialties locations stats');
    res.json({ success: true, data: appointments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const appt = await Appointment.findOne({ _id: req.params.id, patientId: req.userId }).populate('doctorId', 'profile specialties locations');
    if (!appt) return res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
    res.json({ success: true, data: appt });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { doctorId, dateTime, type, service, familyMemberId, sourceContext, notes } = req.body;
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, error: { message: 'Doctor not found', code: 'NOT_FOUND' } });
    const appt = await Appointment.create({
      patientId: req.userId,
      doctorId,
      dateTime: new Date(dateTime),
      type: type || 'in-person',
      service: service || doctor.specialties[0] || 'Consultation',
      status: 'confirmed',
      familyMemberId,
      sourceContext,
      notes: notes || undefined,
      aiBrief: `Ραντεβού για ${service || 'ιατρική εξέταση'}`
    });
    const populated = await appt.populate('doctorId', 'profile specialties locations');
    res.json({ success: true, data: populated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.patch('/:id/doctor-notes', async (req: AuthRequest, res: Response) => {
  try {
    const { doctorNotes, diagnosis, prescriptions, followUpDate } = req.body;
    const update: Record<string, any> = {};
    if (doctorNotes !== undefined) update.doctorNotes = doctorNotes;
    if (diagnosis !== undefined) update.diagnosis = diagnosis;
    if (prescriptions !== undefined) update.prescriptions = prescriptions;
    if (followUpDate !== undefined) update.followUpDate = followUpDate;
    const appt = await Appointment.findOneAndUpdate(
      { _id: req.params.id },
      update,
      { new: true }
    ).populate('doctorId', 'profile specialties locations stats');
    if (!appt) return res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
    res.json({ success: true, data: appt });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.patch('/:id/notes', async (req: AuthRequest, res: Response) => {
  try {
    const { notes } = req.body;
    const appt = await Appointment.findOneAndUpdate(
      { _id: req.params.id, patientId: req.userId },
      { notes },
      { new: true }
    ).populate('doctorId', 'profile specialties locations stats');
    if (!appt) return res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
    res.json({ success: true, data: appt });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.put('/:id/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const appt = await Appointment.findOneAndUpdate(
      { _id: req.params.id, patientId: req.userId },
      { status: 'cancelled' },
      { new: true }
    );
    if (!appt) return res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
    res.json({ success: true, data: appt });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

export default router;
