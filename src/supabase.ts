import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://lcqtinnxwjqxomvzfsdj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjcXRpbm54d2pxeG9tdnpmc2RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTQ2MDMsImV4cCI6MjA5NzQzMDYwM30.Pi5IqSSV6Aj4Q8tXJTr-Vj67_YzIPVIRuKW1TXqRQVA";

export const supabase = createClient(supabaseUrl, supabaseKey);