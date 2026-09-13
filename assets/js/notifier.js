// =========================================================
// CEAI — Créer une notification automatique
// =========================================================
import { supabase } from "./supabase-client.js";
import { idProfilCourant } from "./mon-profil.js";

export async function notifier(texte) {
  const moiId = await idProfilCourant();
  if (!moiId) return;
  await supabase.from("notifications").insert({ texte, cree_par: moiId });
}
