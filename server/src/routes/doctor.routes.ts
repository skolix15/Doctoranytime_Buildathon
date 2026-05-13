import { Router, Request, Response } from 'express';
import Doctor from '../models/Doctor';
import QnA from '../models/QnA';
import Appointment from '../models/Appointment';

const router = Router();

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const doctor = await Doctor.findById(req.params.id).select('-passwordHash -embeddingVector');
    if (!doctor) return res.status(404).json({ success: false, error: { message: 'Doctor not found', code: 'NOT_FOUND' } });
    res.json({ success: true, data: doctor });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.get('/:id/qna', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 10;
    const qnas = await QnA.find({ 'answers.doctorId': req.params.id })
      .skip((page - 1) * limit).limit(limit).sort({ viewCount: -1 });
    res.json({ success: true, data: qnas });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.get('/:id/slots', async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    if (!date || typeof date !== 'string') {
      return res.status(400).json({ success: false, error: { message: 'date query param required (YYYY-MM-DD)', code: 'VALIDATION_ERROR' } });
    }

    const doctor = await Doctor.findById(req.params.id).select('availability');
    if (!doctor) return res.status(404).json({ success: false, error: { message: 'Doctor not found', code: 'NOT_FOUND' } });

    // Determine day of week for the given date
    const targetDate = new Date(date + 'T00:00:00');
    const dayOfWeek = targetDate.getDay(); // 0=Sun...6=Sat

    const dayAvail = doctor.availability.find(a => a.dayOfWeek === dayOfWeek);
    if (!dayAvail || !dayAvail.slots || dayAvail.slots.length === 0) {
      return res.json({ success: true, data: { slots: [] } });
    }

    // Get all booked appointments for this doctor on this date
    const startOfDay = new Date(date + 'T00:00:00.000Z');
    const endOfDay = new Date(date + 'T23:59:59.999Z');
    const bookedAppointments = await Appointment.find({
      doctorId: req.params.id,
      dateTime: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'confirmed'] }
    }).select('dateTime');

    const bookedTimes = new Set(
      bookedAppointments.map(a => {
        const dt = new Date(a.dateTime);
        const hh = dt.getUTCHours().toString().padStart(2, '0');
        const mm = dt.getUTCMinutes().toString().padStart(2, '0');
        return `${hh}:${mm}`;
      })
    );

    // Return available slot start times (excluding booked ones)
    const availableSlots = dayAvail.slots
      .map(s => s.start)
      .filter(time => !bookedTimes.has(time));

    res.json({ success: true, data: { slots: availableSlots } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

router.get('/:id/availability', async (req: Request, res: Response) => {
  try {
    const doctor = await Doctor.findById(req.params.id).select('availability');
    if (!doctor) return res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });

    // Generate next 14 days of available slots
    const slots: { date: string; time: string; type: string }[] = [];
    const now = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      const dayAvail = doctor.availability.find(a => a.dayOfWeek === dow);
      if (dayAvail) {
        for (const slot of dayAvail.slots) {
          slots.push({ date: d.toISOString().split('T')[0], time: slot.start, type: dayAvail.appointmentType });
        }
      }
    }
    res.json({ success: true, data: slots });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
});

export default router;
