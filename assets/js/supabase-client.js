// =========================================================
// CEAI — Client Supabase
// La clé "publishable" est publique par conception : c'est le RLS
// (voir schema_ceai.sql) qui protège réellement les données.
// =========================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL_SUPABASE = "https://jdkavcnxfwmodixinvpf.supabase.co";
const CLE_ANON_SUPABASE = "sb_publishable_G7ulg-UptUCv2LFFf3NIWA_ip1K3GS0";

export const supabase = createClient(URL_SUPABASE, CLE_ANON_SUPABASE);
