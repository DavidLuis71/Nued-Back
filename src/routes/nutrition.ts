import express from "express";
import { supabase } from "../supabase";
import { authMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

router.get("/formulas", authMiddleware, async (_, res) => {
  const { data, error } = await supabase
    .from("nutrition_formulas")
    .select("*")
    .eq("active", true)
    .order("name");

  if (error) {
    return res.status(500).json(error);
  }

  res.json(data);
});

router.get("/activity-factors", authMiddleware, async (_, res) => {
  const { data, error } = await supabase
    .from("activity_factors")
    .select("*")
    .eq("active", true)
    .order("factor");

  if (error) {
    return res.status(500).json(error);
  }

  res.json(data);
});

router.post("/calculate", authMiddleware, async (req, res) => {
  const {
    formulaId,
    age,
    weightKg,
    heightCm,
    activityFactor,
    idealWeightKg,
    adjustedWeightKg,
  } = req.body;

  const { data: formula, error } = await supabase
    .from("nutrition_formulas")
    .select("*")
    .eq("id", formulaId)
    .single();

  if (error || !formula) {
    return res.status(404).json({
      error: "Formula not found",
    });
  }

  const weightToUse = formula.use_adjusted_weight
    ? adjustedWeightKg
    : weightKg;

  const ger =
    weightToUse * formula.coefficient_weight +
    heightCm * formula.coefficient_height +
    age * formula.coefficient_age +
    formula.constant_value;

  const get = ger * activityFactor;

  res.json({
    ger: Number(ger.toFixed(2)),
    get: Number(get.toFixed(2)),
  });
});



router.post("/save-calculation", authMiddleware, async (req, res) => {
  const {
    patient_id,
    formula_id,
    activity_factor_id,
    age,
    weight_kg,
    height_cm,
    ideal_weight_kg,
    adjusted_weight_kg,
    ger,
    get,
  } = req.body;

  const { data, error } = await supabase
    .from("patient_calculations")
.upsert(
  [
    {
      patient_id,
      formula_id,
      activity_factor_id,
      age,
      weight_kg,
      height_cm,
      ideal_weight_kg,
      adjusted_weight_kg,
      ger,
      get,
    },
  ],
  {
    onConflict: "patient_id",
  }
)
    .select()
    .single();

  if (error) return res.status(500).json(error);

  res.json(data);
});


router.post("/save-plan", authMiddleware, async (req, res) => {
  const {
    patient_id,
    calculation_id,
    goal,
    target_kcal,
    protein_g,
    carbs_g,
    fat_g,
    protein_kcal,
    carbs_kcal,
    fat_kcal,
    notes,
  } = req.body;

  const { data, error } = await supabase
    .from("patient_nutrition_plans")
    .upsert([
      {
        patient_id,
        calculation_id,
        goal,
        target_kcal,
        protein_g,
        carbs_g,
        fat_g,
        protein_kcal,
        carbs_kcal,
        fat_kcal,
        notes,
      },
    ],
  {
    onConflict: "patient_id",
  })
    .select()
    .single();

  if (error) return res.status(500).json(error);

  res.json(data);
});

router.get("/last-calculation/:patientId", authMiddleware, async (req, res) => {
  const { patientId } = req.params;

  const { data, error } = await supabase
    .from("patient_calculations")
    .select("*")
    .eq("patient_id", patientId)
    .single();

  if (error) return res.status(500).json(error);

  res.json(data);
});

router.get("/last-plan/:patientId", authMiddleware, async (req, res) => {
  const { patientId } = req.params;

  const { data, error } = await supabase
    .from("patient_nutrition_plans")
    .select(`
      *,
      patient_calculations (
        id,
        ger,
        get
      )
    `)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.log("🚀 error:", error);
    return res.status(500).json(error);
  }

  if (!data) {
    return res.status(404).json({
      error: "No nutrition plan found",
    });
  }

  res.json(data);
});


router.get("/foods/search", authMiddleware, async (req, res) => {
  const { q = "", group, category } = req.query;

  let query = supabase
    .from("food_products")
    .select(`
      id,
      name,
      food_group,
      category,
      food_nutrition (
        kcal,
        protein,
        carbs,
        fat
      )
    `)
    .limit(50);

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  if (group) {
    query = query.eq("food_group", group);
  }

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) return res.status(500).json(error);

  res.json(data);
});



// router.post("/save-diet", authMiddleware, async (req, res) => {
//   const {
//     patient_id,
//     calculation_id,
//     nutrition_plan_id,
//     start_date,
//     plan,
//   } = req.body;

//   const { data, error } = await supabase
//     .from("diet_plans")
//     .insert([
//       {
//         patient_id,
//         // calculation_id,
//         // nutrition_plan_id,
//         start_date,
//         plan, 
//       },
//     ])
//     .select()
//     .single();

//   if (error) return res.status(500).json(error);

//   res.json(data);
// });

router.post("/save-diet", async (req, res) => {
  const { patient_id, start_date, plan } = req.body;

  const { data: existing } = await supabase
    .from("diet_plans")
    .select("id")
    .eq("patient_id", patient_id)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("diet_plans")
      .update({ start_date, plan })
      .eq("patient_id", patient_id)
      .select()
      .single();

    if (error) return res.status(500).json(error);
    return res.json(data);
  }

  const { data, error } = await supabase
    .from("diet_plans")
    .insert([{ patient_id, start_date, plan }])
    .select()
    .single();

  if (error) return res.status(500).json(error);

  res.json(data);
});

router.get("/diet/:patientId", authMiddleware, async (req, res) => {
  const { patientId } = req.params;

  const { data, error } = await supabase
    .from("diet_plans")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) return res.status(500).json(error);

  res.json(data);
});

export default router;