import express from "express";
import { supabase } from "../supabase";
import { authMiddleware } from "../middleware/authMiddleware";
import { AuthRequest } from "../types/authRequest";

const router = express.Router();


router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { patient_id, items, payment_method } = req.body;
    const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!nutritionist) {
    return res.status(403).json({ error: "Nutritionist not found" });
  }
    const productIds = items.map((i: any) => i.product_id);

  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .in("id", productIds);

  if (error) return res.status(500).json(error);

    let totalNet = 0;
  let totalVat = 0;

  const saleItems = items.map((item: any) => {
    const product = products.find(p => p.id === item.product_id);

    const unitPrice = product.price;
    const vat = product.vat_percent;

    const lineNet = unitPrice * item.quantity;
    const lineVat = lineNet * (vat / 100);
    const lineTotal = lineNet + lineVat;

    totalNet += lineNet;
    totalVat += lineVat;

    return {
      product_id: product.id,
      quantity: item.quantity,
      unit_price: unitPrice,
      vat_percent: vat,
      line_total: lineTotal,
    };
  });

    const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert([
      {
        nutritionist_id: nutritionist.id,
        patient_id: patient_id || null,
        payment_method,
        total_net: totalNet,
        total_vat: totalVat,
        total_amount: totalNet + totalVat,
      },
    ])
    .select()
    .single();

  if (saleError) return res.status(500).json(saleError);

    const itemsToInsert = saleItems.map((i: any) => ({
    ...i,
    sale_id: sale.id,
  }));

  const { error: itemsError } = await supabase
    .from("sale_items")
    .insert(itemsToInsert);

  if (itemsError) return res.status(500).json(itemsError);

    for (const item of items) {
    const product = products.find(p => p.id === item.product_id);

    await supabase
      .from("products")
      .update({
        stock: product.stock - item.quantity,
      })
      .eq("id", product.id);
  }

    res.json({
    sale,
    items: itemsToInsert,
  });
});

// GET SALES (historial)

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  const { data, error } = await supabase
    .from("sales")
    .select(`
      *,
      patients (
        id,
        first_name,
        last_name
      )
    `)
    .eq("nutritionist_id", nutritionist.id)
    .order("sale_date", { ascending: false });

  if (error) return res.status(500).json(error);

  res.json(data);
});


router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("user_id", userId)
    .single();

  const { data, error } = await supabase
    .from("sales")
    .select(`
      *,
      patients (*),
      sale_items (
        id,
        quantity,
        unit_price,
        vat_percent,
        line_total,
        products (
          name
        )
      )
    `)
    .eq("id", id)
    .eq("nutritionist_id", nutritionist.id)
    .single();

  if (error) return res.status(500).json(error);

  res.json(data);
});

export default router;