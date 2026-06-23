import express from "express";
import { supabase } from "../supabase";
import { authMiddleware } from "../middleware/authMiddleware";
import { AuthRequest } from "../types/authRequest";

const router = express.Router();

/* =========================
   GET EXPENSES
========================= */
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const month = Number(req.query.month);
  const year = Number(req.query.year);

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!nutritionist) {
    return res.status(403).json({ error: "Nutritionist not found" });
  }

  let query = supabase
    .from("expenses")
    .select("*")
    .eq("nutritionist_id", nutritionist.id)
    .order("expense_date", { ascending: false });

  // 🔥 filtro por mes/año
  if (month && year) {
    const start = new Date(year, month - 1, 1).toISOString();
    const end = new Date(year, month, 1).toISOString();

    query = query
      .gte("expense_date", start)
      .lt("expense_date", end);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json(error);
  }

  res.json(data);
});

/* =========================
   CREATE EXPENSE
========================= */
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { data: nutritionist, error: nError } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (nError || !nutritionist) {
    return res.status(403).json({ error: "Nutritionist not found" });
  }

  const { title, amount, category, expense_date, notes } = req.body;

  const { data, error } = await supabase
    .from("expenses")
    .insert([
      {
        nutritionist_id: nutritionist.id,
        title,
        amount,
        category,
        expense_date: expense_date || new Date().toISOString(),
        notes,
      },
    ])
    .select()
    .single();

  if (error) {
    return res.status(500).json(error);
  }

  res.json(data);
});

/* =========================
   DELETE EXPENSE
========================= */
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const { data: nutritionist, error: nError } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (nError || !nutritionist) {
    return res.status(403).json({ error: "Nutritionist not found" });
  }

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("nutritionist_id", nutritionist.id);

  if (error) {
    return res.status(500).json(error);
  }

  res.json({ ok: true });
});


router.get("/finance/summary", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const month = Number(req.query.month);
  const year = Number(req.query.year);

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!nutritionist) {
    return res.status(403).json({ error: "Nutritionist not found" });
  }

  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 1).toISOString();

  const [salesRes, appointmentsRes, expensesRes] = await Promise.all([

    // 🔥 PRODUCTOS (VENTAS FILTRADAS POR MES)
    supabase
      .from("sales")
      .select("total_amount, sale_date")
      .eq("nutritionist_id", nutritionist.id)
      .gte("sale_date", start)
      .lt("sale_date", end),

    // CITAS
    supabase
      .from("appointments")
      .select("price, date")
      .eq("nutritionist_id", nutritionist.id)
      .gte("date", start)
      .lt("date", end),

    // GASTOS
    supabase
      .from("expenses")
      .select("amount, expense_date")
      .eq("nutritionist_id", nutritionist.id)
      .gte("expense_date", start)
      .lt("expense_date", end),
  ]);

  const productIncome =
    salesRes.data?.reduce((a, s) => a + Number(s.total_amount || 0), 0) ?? 0;

  const appointmentIncome =
    appointmentsRes.data?.reduce((a, a2) => a + Number(a2.price || 0), 0) ?? 0;

  const expenses =
    expensesRes.data?.reduce((a, e) => a + Number(e.amount || 0), 0) ?? 0;

  res.json({
    income: {
      products: productIncome,
      appointments: appointmentIncome,
      total: productIncome + appointmentIncome,
    },
    expenses,
    balance: productIncome + appointmentIncome - expenses,
  });
});

export default router;