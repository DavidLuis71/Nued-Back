import express from "express";
import { supabase } from "../supabase";
import { authMiddleware } from "../middleware/authMiddleware";
import { AuthRequest } from "../types/authRequest";

const router = express.Router();

/* =========================
   🍏 FOOD PRODUCTS
========================= */

// GET all food products
router.get("/products", authMiddleware, async (req: AuthRequest, res) => {
  const { data, error } = await supabase
    .from("food_products")
    .select(`
      *,
      food_brands (
        id,
        name
      ),
      food_nutrition (*),
      food_product_units (*)
    `)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json(error);

  res.json(data);
});

// GET single product
router.get("/products/:id", authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("food_products")
    .select(`
      *,
      food_brands (*),
      food_nutrition (*),
      food_product_units (*)
    `)
    .eq("id", id)
    .single();

  if (error) return res.status(500).json(error);

  res.json(data);
});

// CREATE food product (con nutrición opcional)
router.post("/products", authMiddleware, async (req: AuthRequest, res) => {
  const {
    name,
    category,
    brand_id,
    base_quantity,
    base_unit,
    barcode,
    nutrition,
    units
  } = req.body;

  // 1. Crear producto
  const { data: product, error: productError } = await supabase
    .from("food_products")
    .insert([
      {
        name,
        category,
        brand_id,
        base_quantity,
        base_unit,
        barcode,
      },
    ])
    .select()
    .single();

  if (productError) return res.status(500).json(productError);

  // 2. Nutrición
  if (nutrition) {
    await supabase.from("food_nutrition").insert([
      {
        product_id: product.id,
        ...nutrition,
      },
    ]);
  }

  // 3. Units
  if (units?.length) {
    await supabase.from("food_product_units").insert(
      units.map((u: any) => ({
        product_id: product.id,
        label: u.label,
        grams_equivalent: u.grams_equivalent,
      }))
    );
  }

  res.json(product);
});

// UPDATE product
router.patch("/products/:id", authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("food_products")
    .update(req.body)
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json(error);

  res.json(data);
});

// DELETE product (soft delete opcional no existe aquí)
router.delete("/products/:id", authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("food_products")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json(error);

  res.json({ ok: true });
});


/* =========================
   🏷️ BRANDS
========================= */

router.get("/brands", authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from("food_brands")
    .select("*")
    .order("name");

  if (error) return res.status(500).json(error);

  res.json(data);
});

router.post("/brands", authMiddleware, async (req, res) => {
  const { name } = req.body;

  const { data, error } = await supabase
    .from("food_brands")
    .insert([{ name }])
    .select()
    .single();

  if (error) return res.status(500).json(error);

  res.json(data);
});

export default router;