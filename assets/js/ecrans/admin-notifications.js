// =========================================================
// CEAI — Écran admin "Gestion des notifications"
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";

function formaterDate(dateIso) {
  return new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export async function ecranAdminNotifications(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Gestion des notifications</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  await rafraichir();

  async function rafraichir() {
    const { data: notifications } = await supabase
      .from("notifications")
      .select("id, texte, cree_le, profils(nom)")
      .order("cree_le", { ascending: false });

    conteneur.innerHTML = `
      <h2 class="titre-section">Gestion des notifications</h2>
      <hr class="trait-or" />
      <form id="formulaire-notification" class="carte" style="display:flex; flex-direction:column; gap:12px">
        <p style="margin:0; font-weight:500">Publier une annonce</p>
        <textarea name="texte" rows="3" placeholder="Ex : Rappel de la réunion mensuelle samedi à 18h"
                  style="background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit);
                  padding:11px 12px; color:var(--texte); font-family:inherit; font-size:14px; resize:vertical" required></textarea>
        <button type="submit" class="bouton bouton-or" style="align-self:flex-start">Publier</button>
      </form>

      <p style="font-weight:500; margin:20px 0 8px">Notifications publiées (${(notifications || []).length})</p>
      <div id="liste-notifs-admin"></div>
    `;

    const liste = document.getElementById("liste-notifs-admin");
    liste.innerHTML = (notifications && notifications.length)
      ? notifications
          .map(
            (n) => `
        <div class="carte" style="display:flex; justify-content:space-between; gap:10px">
          <div>
            <p style="margin:0; font-size:14px; white-space:pre-line">${n.texte}</p>
            <p style="margin:6px 0 0; font-size:11px; color:var(--texte-secondaire)">${n.profils?.nom || "—"} · ${formaterDate(n.cree_le)}</p>
          </div>
          <button data-supprimer="${n.id}" class="bouton-icone" aria-label="Supprimer" style="color:var(--danger)">✕</button>
        </div>
      `
          )
          .join("")
      : `<p style="color:var(--texte-secondaire)">Aucune notification pour le moment.</p>`;

    liste.querySelectorAll("[data-supprimer]").forEach((bouton) => {
      bouton.addEventListener("click", async () => {
        await supabase.from("notifications").delete().eq("id", bouton.dataset.supprimer);
        rafraichir();
      });
    });

    document.getElementById("formulaire-notification").addEventListener("submit", async (evenement) => {
      evenement.preventDefault();
      const texte = evenement.target.elements.texte.value.trim();
      if (!texte) return;
      const moiId = await idProfilCourant();
      await supabase.from("notifications").insert({ texte, cree_par: moiId });
      rafraichir();
    });
  }
                                                                                       }
