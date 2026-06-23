import dotenv from "dotenv";
dotenv.config();
import { authMiddleware } from "./middleware/authMiddleware";
import express from "express";
import cors from "cors";
import { supabase } from "./supabase";
import { AuthRequest } from "./types/authRequest";
import productRoutes from "./products";
import salesRoutes from "./routes/sales";
import expensesRoutes from "./routes/expenses";



const app = express();

app.use(cors());
app.use(express.json());



app.use("/products", productRoutes);
app.use("/sales", salesRoutes);
app.use("/expenses", expensesRoutes);

/* =========================
   📅 APPOINTMENTS
========================= */




// GET all appointments (con paciente incluido)
app.get("/appointments", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

const { data: nutritionist, error: nutriError } = await supabase
  .from("nutritionists")
  .select("*")
  .eq("user_id", userId)
  .single();

if (nutriError || !nutritionist) {
  return res.status(403).json({ error: "Nutritionist not found" });
}

 const { data, error } = await supabase
  .from("appointments")
  .select(`
    *,
    patients (
      id,
      first_name,
      last_name,
      phone,
      email
    )
  `)
  .eq("nutritionist_id", nutritionist.id)
  .order("date", { ascending: true });

  if (error) return res.status(500).json(error);

  res.json(data);
});

//tipos de citas

app.get("/appointment-types", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { data: nutritionist, error } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !nutritionist) {
    return res.status(403).json({ error: "Nutritionist not found" });
  }

  const { data, error: fetchError } = await supabase
    .from("appointment_types")
    .select("*")
    .eq("nutritionist_id", nutritionist.id)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (fetchError) {
    return res.status(500).json(fetchError);
  }

  res.json(data);
});


app.post("/appointment-types", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { data: nutritionist, error } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !nutritionist) {
    return res.status(403).json({ error: "Nutritionist not found" });
  }

  const { name, description, price, duration_minutes } = req.body;

  const { data, error: insertError } = await supabase
    .from("appointment_types")
    .insert([
      {
        name,
        description,
        price,
        duration_minutes,
        nutritionist_id: nutritionist.id,
      },
    ])
    .select()
    .single();

  if (insertError) {
    return res.status(500).json(insertError);
  }

  res.json(data);
});

app.patch("/appointment-types/:id", authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("appointment_types")
    .update(req.body)
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json(error);

  res.json(data);
});

app.delete("/appointment-types/:id", authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("appointment_types")
    .update({ active: false })
    .eq("id", id);

  if (error) return res.status(500).json(error);

  res.json({ ok: true });
});

// CREATE appointment
app.post("/appointments", authMiddleware, async (req: AuthRequest, res) => {
const {
  patient_id,
  date,
  notes,
  status,
  duration_minutes,
  appointment_type_id,
  price,
  payment_method,
  is_clinical,
} = req.body;
  const userId = req.user!.id;
  const { data: nutritionist } = await supabase
  .from("nutritionists")
  .select("*")
  .eq("user_id", userId)
  .single();

  const start = new Date(date);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + (duration_minutes ?? 30));

  // 1. traemos todas las citas
  const { data: existing, error: fetchError } = await supabase
    .from("appointments")
    .select("date, duration_minutes")
    .eq("nutritionist_id", nutritionist.id);

  if (fetchError) return res.status(500).json(fetchError);

  // 2. comprobamos solapamientos
  const hasOverlap = existing.some((a) => {
    const aStart = new Date(a.date);
    const aEnd = new Date(aStart);
    aEnd.setMinutes(aEnd.getMinutes() + (a.duration_minutes ?? 30));

    return start < aEnd && end > aStart;
  });

  // 3. si hay choque → rechazamos
  if (hasOverlap) {
    return res.status(409).json({
      error: "❌ Ya existe una cita en ese horario",
    });
  }

  // 4. si está libre → insert
 const { data, error } = await supabase
  .from("appointments")
  .insert([
    {
      patient_id,
      nutritionist_id: nutritionist.id,
      date,
      notes,
      status: status ?? "pending",
      is_clinical,
      duration_minutes: duration_minutes ?? 30,
      appointment_type_id,
      price,
      payment_method,
    },
  ])
  .select()
  .single();

  if (error) return res.status(500).json(error);

  res.json(data);
});


app.get("/availability", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  const { date } = req.query;

  const startOfDay = new Date(date as string);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date as string);
  endOfDay.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("nutritionist_id", nutritionist.id)
    .gte("date", startOfDay.toISOString())
    .lte("date", endOfDay.toISOString());

  res.json(data);
});



// app.patch("/appointments/:id", async (req, res) => {
//   const { id } = req.params;

//   const { data, error } = await supabase
//     .from("appointments")
//     .update(req.body)
//     .eq("id", id)
//     .select()
//     .single();

//   if (error) return res.status(500).json(error);

//   res.json(data);
// });


// DELETE appointment
app.delete("/appointments/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json(error);

  res.json({ ok: true });
});


/* =========================
   👤 PATIENTS (NUEVO)
========================= */

// GET patients
app.get("/patients", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { data: nutritionist, error } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !nutritionist) {
    return res.status(403).json({ error: "Nutritionist not found" });
  }

  const { data, error: fetchError } = await supabase
    .from("patients")
    .select("*")
    .eq("nutritionist_id", nutritionist.id)
    .order("created_at", { ascending: false });

  if (fetchError) return res.status(500).json(fetchError);

  res.json(data);
});


// CREATE patient
app.post("/patients", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { data: nutritionist, error } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !nutritionist) {
    return res.status(403).json({ error: "Nutritionist not found" });
  }

  const { first_name, last_name, phone, email } = req.body;

  const { data, error: insertError } = await supabase
    .from("patients")
    .insert([
      {
        first_name,
        last_name,
        phone,
        email,
        nutritionist_id: nutritionist.id, // 🔥 CLAVE
      },
    ])
    .select()
    .single();

  if (insertError) return res.status(500).json(insertError);

  res.json(data);
});

// GET patient detail + citas
app.get("/patients/:id", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const { data: nutritionist, error: nutriError } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (nutriError || !nutritionist) {
    return res.status(403).json({ error: "Nutritionist not found" });
  }

  const { data: patient, error: err1 } = await supabase
    .from("patients")
    .select("*")
    .eq("nutritionist_id", nutritionist.id)
    .eq("id", id)
    .single();

  if (err1) return res.status(500).json(err1);

  res.json(patient);
});

app.patch("/patients/:id", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const { data: nutritionist, error: nutriError } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (nutriError || !nutritionist) {
    return res.status(403).json({ error: "Nutritionist not found" });
  }

  const { data, error } = await supabase
    .from("patients")
    .update(req.body)
    .eq("id", id)
    .eq("nutritionist_id", nutritionist.id)
    .select()
    .single();

  if (error) return res.status(500).json(error);

  res.json(data);
});

app.get("/patients/:id/appointments", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  const { id } = req.params;

 const { data, error } = await supabase
  .from("appointments")
  .select(`
    *,
    appointment_types (
      id,
      name,
      duration_minutes,
      price
    )
  `)
  .eq("nutritionist_id", nutritionist.id)
  .eq("patient_id", id)
  .order("date", { ascending: false });

  res.json(data);
});

app.patch(
  "/appointments/:id",
  authMiddleware,
  async (req: AuthRequest, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("appointments")
    .update(req.body)
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json(error);

  res.json(data);
});


//login

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return res.status(401).json(error);

  res.json({
    session: data.session,
    user: data.user,
  });
});


//register

app.post("/register", async (req, res) => {
  const { email, password, first_name, last_name } = req.body;

  const { data: authData, error: authError } =
    await supabase.auth.signUp({
      email,
      password,
    });

  if (authError) {
    return res.status(400).json(authError);
  }

  const userId = authData.user?.id;

  if (!userId) {
    return res.status(500).json({ error: "No user created" });
  }

  const { data, error } = await supabase
    .from("nutritionists")
    .insert([
      {
        first_name,
        last_name,
        email,
        user_id: userId,
      },
    ])
    .select()
    .single();

  if (error) {
    return res.status(500).json(error);
  }

  res.json({
    user: authData.user,
    nutritionist: data,
  });
});



/* =========================
   START SERVER
========================= */

app.listen(3001, () => {
  console.log("🚀 API running on http://localhost:3001");
});