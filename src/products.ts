import express from "express";
import { supabase } from "./supabase";
import { authMiddleware } from "./middleware/authMiddleware";
import { AuthRequest } from "./types/authRequest";

const router = express.Router();

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { data: nutritionist, error } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !nutritionist) {
    return res.status(403).json({
      error: "Nutritionist not found",
    });
  }

  const { data, error: fetchError } = await supabase
    .from("products")
    .select("*")
    .eq("nutritionist_id", nutritionist.id)
    .eq("active", true)
    .order("name");

  if (fetchError) {
    return res.status(500).json(fetchError);
  }

  res.json(data);
});

router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  
  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  const {
    name,
    description,
    price,
    vat_percent,
    stock,
    minimum_stock,
  } = req.body;

  const { data, error } = await supabase
    .from("products")
    .insert([
      {
        nutritionist_id: nutritionist.id,
        name,
        description,
        price,
        vat_percent,
        stock,
        minimum_stock,
      },
    ])
    .select()
    .single();

  if (error) {
    return res.status(500).json(error);
  }

  res.json(data);
});

router.patch("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!nutritionist) {
    return res.status(403).json({ error: "Nutritionist not found" });
  }

  const { id } = req.params;

  const { data, error } = await supabase
    .from("products")
    .update(req.body)
    .eq("id", id)
    .eq("nutritionist_id", nutritionist.id) // 🔒 IMPORTANTE
    .select()
    .single();

  if (error) return res.status(500).json(error);

  res.json(data);
});

router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!nutritionist) {
    return res.status(403).json({ error: "Nutritionist not found" });
  }

  const { id } = req.params;

  const { error } = await supabase
    .from("products")
    .update({ active: false })
    .eq("id", id)
    .eq("nutritionist_id", nutritionist.id); // 🔒 clave

  if (error) return res.status(500).json(error);

  res.json({ ok: true });
});

export default router;