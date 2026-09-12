// =========================================================
// CEAI — Retrouve l'identifiant "profils" de l'utilisateur connecté
// (différent de son identifiant de compte de connexion depuis la
// séparation profil / compte)
// =========================================================
import { supabase } from "./supabase-client.js";

let idEnCache = null;

export async function idProfilCourant() {
  if (idEnCache) return idEnCache;

  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return null;

  const { data: profil } = await supabase
    .from("profils")
    .select("id")
    .eq("id_auth", session.user.id)
    .single();

  idEnCache = profil?.id || null;
  return idEnCache;
}

export function reinitialiserCacheProfil() {
  idEnCache = null;
}
