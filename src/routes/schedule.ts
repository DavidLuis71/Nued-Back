import express from "express";
import { supabase } from "../supabase";
import { authMiddleware } from "../middleware/authMiddleware";
import { AuthRequest } from "../types/authRequest";
import { ScheduleService } from "../schedule.service";

const scheduleService = new ScheduleService();

const router = express.Router();

/* =========================
   WORK SCHEDULES
========================= */

// GET
router.get("/work-schedules", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  const { data, error } = await supabase
    .from("work_schedules")
    .select("*")
    .eq("nutritionist_id", nutritionist.id)
    .order("day_of_week", { ascending: true });

  if (error) return res.status(500).json(error);

  res.json(data);
});

// CREATE
router.post("/work-schedules", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { day_of_week, start_time, end_time } = req.body;

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  const { data, error } = await supabase
    .from("work_schedules")
    .insert([
      {
        nutritionist_id: nutritionist.id,
        day_of_week,
        start_time,
        end_time,
      },
    ])
    .select()
    .single();

  if (error) return res.status(500).json(error);

  res.json(data);
});

// DELETE
router.delete("/work-schedules/:id", authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("work_schedules")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json(error);

  res.json({ ok: true });
});

/* =========================
   CLOSURES (VACACIONES)
========================= */

// GET
router.get("/closures", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  const { data, error } = await supabase
    .from("closures")
    .select("*")
    .eq("nutritionist_id", nutritionist.id)
    .order("start_date", { ascending: false });

  if (error) return res.status(500).json(error);

  res.json(data);
});

// CREATE
router.post("/closures", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { start_date, end_date, reason } = req.body;

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  const { data, error } = await supabase
    .from("closures")
    .insert([
      {
        nutritionist_id: nutritionist.id,
        start_date,
        end_date,
        reason,
      },
    ])
    .select()
    .single();

  if (error) return res.status(500).json(error);

  res.json(data);
});

// DELETE
router.delete("/closures/:id", authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("closures")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json(error);

  res.json({ ok: true });
});

/* =========================
   EXCEPTIONS (días especiales)
========================= */

// GET
router.get("/schedule-exceptions", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  const { data, error } = await supabase
    .from("schedule_exceptions")
    .select("*")
    .eq("nutritionist_id", nutritionist.id)
    .order("date", { ascending: false });

  if (error) return res.status(500).json(error);

  res.json(data);
});

// CREATE
router.post("/schedule-exceptions", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { date, start_time, end_time, closed } = req.body;

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  const { data, error } = await supabase
    .from("schedule_exceptions")
    .insert([
      {
        nutritionist_id: nutritionist.id,
        date,
        start_time,
        end_time,
        closed,
      },
    ])
    .select()
    .single();

  if (error) return res.status(500).json(error);

  res.json(data);
});

// DELETE
router.delete("/schedule-exceptions/:id", authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("schedule_exceptions")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json(error);

  res.json({ ok: true });
});


/* =========================
   AVAILABILITY (FRONT ENTRYPOINT)
========================= */

router.get("/availability", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { date, duration } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Missing date" });
    }

    const { data: nutritionist } = await supabase
      .from("nutritionists")
      .select("*")
      .eq("user_id", userId)
      .single();

    const slots = await scheduleService.getAvailableSlots(
      nutritionist.id,
      new Date(date as string),
      duration ? Number(duration) : 30
    );

    res.json(slots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching availability" });
  }
});

export default router;