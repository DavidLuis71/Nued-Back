import { Request } from "express";
import { User } from "@supabase/supabase-js";

export interface AuthRequest extends Request {
  user?: User;
}