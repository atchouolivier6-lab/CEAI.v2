// =========================================================
// CEAI — Créer une notification automatique
//
// notifier("texte")                                  -> notification publique
// notifier("texte", { prive: true, destinataireId })  -> notification privée :
//   visible seulement des agents (administrateur, comptable) et de
//   l'intéressé (destinataireId, facultatif).
// Les textes qui parlent de prêt, d'épargne, de remboursement ou de retrait
// sont de toute façon rendus privés automatiquement par la base de données.
// =========================================================
import { supabase } from "./supabase-client.js";
import { idProfilCourant } from "./mon-profil.js";

export async function notifier(texte, options = {}) {
  const moiId = await idProfilCourant();
  if (!moiId) return;

  const ligne = { texte, cree_par: moiId };
  if (options.prive) ligne.prive = true;
  if (options.destinataireId) ligne.destinataire_id = options.destinataireId;

  await supabase.from("notifications").insert(ligne);
}
