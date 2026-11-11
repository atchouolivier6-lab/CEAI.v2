// =========================================================
// CEAI — Prévenir l'équipe (administrateurs et comptables)
// Une notification privée est envoyée à chacun, pour qu'ils voient
// apparaître les demandes et remboursements à traiter.
// =========================================================
import { supabase } from "./supabase-client.js";
import { notifier } from "./notifier.js";

export async function notifierEquipe(texte, exclureId = null) {
  try {
    const { data } = await supabase.from("profils").select("id").in("role", ["admin", "comptable"]);
    await Promise.all(
      (data || []).filter((p) => p.id !== exclureId).map((p) => notifier(texte, { prive: true, destinataireId: p.id }))
    );
  } catch (erreur) {
    console.warn("Notification de l'équipe impossible :", erreur);
  }
}
