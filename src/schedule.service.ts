import { supabase } from "./supabase";

type Slot = {
  start: Date;
  end: Date;
};

export class ScheduleService {
  /* =========================
     WORK SCHEDULE
  ========================= */
  async getWorkSchedules(nutritionistId: string) {
    const { data } = await supabase
      .from("work_schedules")
      .select("*")
      .eq("nutritionist_id", nutritionistId);

    return data || [];
  }

  /* =========================
     CLOSURES (VACACIONES)
  ========================= */
  async getClosures(nutritionistId: string, date: Date) {
    const day = date.toLocaleDateString("en-CA"); // YYYY-MM-DD local safe

    const { data } = await supabase
      .from("closures")
      .select("*")
      .eq("nutritionist_id", nutritionistId)
      .lte("start_date", day)
      .gte("end_date", day);

    return data || [];
  }

  async isDayClosed(nutritionistId: string, date: Date) {
    const closures = await this.getClosures(nutritionistId, date);
    return closures.length > 0;
  }

  /* =========================
     EXCEPTIONS
  ========================= */
  async getExceptions(nutritionistId: string, date: Date) {
    const day = date.toLocaleDateString("en-CA");

    const { data } = await supabase
      .from("schedule_exceptions")
      .select("*")
      .eq("nutritionist_id", nutritionistId)
      .eq("date", day);

    return data || [];
  }

  /* =========================
     WORK HOURS
  ========================= */
  async getWorkHoursForDay(nutritionistId: string, date: Date) {
    const dayOfWeek = date.getDay();

    const { data } = await supabase
      .from("work_schedules")
      .select("*")
      .eq("nutritionist_id", nutritionistId)
      .eq("day_of_week", dayOfWeek);

    return data || [];
  }

  /* =========================
     APPOINTMENTS
  ========================= */
  async getAppointments(nutritionistId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from("appointments")
      .select("date, duration_minutes")
      .eq("nutritionist_id", nutritionistId)
      .gte("date", startOfDay.toISOString())
      .lte("date", endOfDay.toISOString());

    return data || [];
  }

  /* =========================
     OVERLAP CHECK
  ========================= */
  hasOverlap(start: Date, end: Date, appointments: any[]) {
    return appointments.some((a) => {
      const aStart = new Date(a.date);
      const aEnd = new Date(aStart);
      aEnd.setMinutes(aEnd.getMinutes() + (a.duration_minutes ?? 30));

      return start < aEnd && end > aStart;
    });
  }

  /* =========================
     GENERATE SLOTS
  ========================= */
  generateSlots(
    startTime: string,
    endTime: string,
    duration: number,
    date: Date
  ): Slot[] {
    const slots: Slot[] = [];

    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);

    const current = new Date(date);
    current.setHours(startH, startM, 0, 0);

    const end = new Date(date);
    end.setHours(endH, endM, 0, 0);

    while (current < end) {
      const slotStart = new Date(current);
      const slotEnd = new Date(current);
      slotEnd.setMinutes(slotEnd.getMinutes() + duration);

      if (slotEnd <= end) {
        slots.push({
          start: slotStart,
          end: slotEnd,
        });
      }

      current.setMinutes(current.getMinutes() + duration);
    }

    return slots;
  }

  /* =========================
     MAIN: AVAILABLE SLOTS
  ========================= */
  async getAvailableSlots(
    nutritionistId: string,
    date: Date,
    duration: number
  ) {
    // 1. VACACIONES
    const closed = await this.isDayClosed(nutritionistId, date);
    if (closed)  
         return {
            slots: [],
            closed: true,
        };

    // 2. HORARIO BASE (optimizado)
    const workHours = await this.getWorkHoursForDay(nutritionistId, date);

    // 3. EXCEPCIONES
    const exceptions = await this.getExceptions(nutritionistId, date);

    // 4. CITAS
    const appointments = await this.getAppointments(nutritionistId, date);

    const allSlots: Slot[] = [];

    for (const w of workHours) {
      let start = w.start_time;
      let end = w.end_time;

      // EXCEPCIONES (solo aplicamos override si existe horario válido)
      const override = exceptions.find(
        (ex) => !ex.closed && ex.start_time && ex.end_time
      );

      if (override) {
        start = override.start_time;
        end = override.end_time;
      }

      const slots = this.generateSlots(start, end, duration, date);

      for (const slot of slots) {
        const hasConflict = this.hasOverlap(
          slot.start,
          slot.end,
          appointments
        );

        if (!hasConflict) {
          allSlots.push(slot);
        }
      }
    }

    return {
    slots: allSlots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
    })),
    closed: false,
  };
  }
}