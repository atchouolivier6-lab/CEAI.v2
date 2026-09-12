// =========================================================
// CEAI — Écran "Messagerie"
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";

let canalMessagerie = null;

function initiale(nom) {
  return (nom || "?").trim().charAt(0).toUpperCase();
}

function avatarHtml(profil, taille) {
  return profil.photo_url
    ? `<img src="${profil.photo_url}" alt="" style="width:100%;height:100%;object-fit:cover" />`
    : `<span style="font-family:var(--police-titre); font-size:${Math.round(taille * 0.4)}px; color:var(--or-texte)">${initiale(profil.nom)}</span>`;
}

function formaterHeure(dateIso) {
  const date = new Date(dateIso);
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function seDesabonner() {
  if (canalMessagerie) {
    supabase.removeChannel(canalMessagerie);
    canalMessagerie = null;
  }
}

export async function ecranMessagerie(conteneur) {
  seDesabonner();

  conteneur.innerHTML = `
    <h2 class="titre-section">Messagerie</h2>
    <hr class="trait-or" />
    <p class="chargement">Chargement…</p>
  `;

  const moiId = await idProfilCourant();

  const [{ data: membres }, { data: messages }] = await Promise.all([
    supabase.from("profils").select("id, nom, photo_url").neq("id", moiId).order("nom"),
    supabase
      .from("messages")
      .select("expediteur_id, destinataire_id, contenu, envoye_le")
      .or(`expediteur_id.eq.${moiId},destinataire_id.eq.${moiId}`)
      .order("envoye_le", { ascending: false }),
  ]);

  const dernierMessageParContact = {};
  (messages || []).forEach((m) => {
    const autreId = m.expediteur_id === moiId ? m.destinataire_id : m.expediteur_id;
    if (!dernierMessageParContact[autreId]) dernierMessageParContact[autreId] = m;
  });

  const contacts = (membres || []).sort((a, b) => {
    const dateA = dernierMessageParContact[a.id]?.envoye_le || "";
    const dateB = dernierMessageParContact[b.id]?.envoye_le || "";
    return dateB.localeCompare(dateA);
  });

  rendreListeConversations(conteneur, contacts, dernierMessageParContact, moiId);
}

function rendreListeConversations(conteneur, contacts, dernierMessageParContact, moiId) {
  const lignes = contacts
    .map((c) => {
      const dernier = dernierMessageParContact[c.id];
      return `
      <button class="ligne-conversation" data-id="${c.id}" data-nom="${c.nom}" data-photo="${c.photo_url || ""}"
              style="all:unset; cursor:pointer; width:100%; display:flex; align-items:center; gap:12px; padding:12px 4px;
              border-bottom:1px solid var(--bordure)">
        <div style="width:44px; height:44px; min-width:44px; border-radius:50%; background:var(--fond-carte-claire); overflow:hidden;
             display:flex; align-items:center; justify-content:center">
          ${avatarHtml(c, 44)}
        </div>
        <div style="flex:1; min-width:0; text-align:left">
          <p style="margin:0; font-size:14px; font-weight:500">${c.nom}</p>
          <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire); white-space:nowrap; overflow:hidden; text-overflow:ellipsis">
            ${dernier ? dernier.contenu : "Aucun message"}
          </p>
        </div>
        ${dernier ? `<span style="font-size:11px; color:var(--texte-secondaire)">${formaterHeure(dernier.envoye_le)}</span>` : ""}
      </button>
    `;
    })
    .join("");

  conteneur.innerHTML = `
    <h2 class="titre-section">Messagerie</h2>
    <hr class="trait-or" />
    ${contacts.length ? lignes : `<p style="color:var(--texte-secondaire)">Aucun autre membre pour le moment.</p>`}
  `;

  conteneur.querySelectorAll(".ligne-conversation").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      ouvrirConversation(conteneur, {
        id: bouton.dataset.id,
        nom: bouton.dataset.nom,
        photo_url: bouton.dataset.photo || null,
      }, moiId);
    });
  });
}

async function ouvrirConversation(conteneur, contact, moiId) {
  conteneur.innerHTML = `
    <button id="bouton-retour-messagerie" class="lien" style="margin-bottom:12px">← Retour</button>
    <div style="display:flex; align-items:center; gap:10px; padding-bottom:12px; border-bottom:1px solid var(--bordure); margin-bottom:12px">
      <div style="width:36px; height:36px; border-radius:50%; background:var(--fond-carte-claire); overflow:hidden;
           display:flex; align-items:center; justify-content:center">
        ${avatarHtml(contact, 36)}
      </div>
      <p style="margin:0; font-weight:500">${contact.nom}</p>
    </div>
    <div id="fil-messages" style="display:flex; flex-direction:column; gap:8px; min-height:200px; margin-bottom:12px"></div>
    <form id="formulaire-message" style="display:flex; gap:8px">
      <input type="text" name="contenu" placeholder="Écrire un message..." required
             style="flex:1; background:var(--fond-carte); border:1px solid var(--bordure); border-radius:999px;
             padding:11px 16px; color:var(--texte); font-family:inherit; font-size:15px" />
      <button type="submit" class="bouton bouton-or" style="border-radius:50%; width:44px; height:44px; padding:0">➤</button>
    </form>
  `;

  document.getElementById("bouton-retour-messagerie").addEventListener("click", () => {
    ecranMessagerie(conteneur);
  });

  const filMessages = document.getElementById("fil-messages");

  async function chargerFil() {
    const { data: messages } = await supabase
      .from("messages")
      .select("expediteur_id, contenu, envoye_le")
      .or(
        `and(expediteur_id.eq.${moiId},destinataire_id.eq.${contact.id}),and(expediteur_id.eq.${contact.id},destinataire_id.eq.${moiId})`
      )
      .order("envoye_le", { ascending: true });

    filMessages.innerHTML = (messages || [])
      .map((m) => {
        const estDeMoi = m.expediteur_id === moiId;
        return `
        <div style="align-self:${estDeMoi ? "flex-end" : "flex-start"}; max-width:75%;
             background:${estDeMoi ? "var(--or)" : "var(--fond-carte)"}; color:${estDeMoi ? "#3A2B0E" : "var(--texte)"};
             border:1px solid ${estDeMoi ? "transparent" : "var(--bordure)"}; border-radius:14px; padding:8px 12px">
          <p style="margin:0; font-size:14px">${m.contenu}</p>
          <p style="margin:2px 0 0; font-size:10px; opacity:0.7; text-align:right">${formaterHeure(m.envoye_le)}</p>
        </div>
      `;
      })
      .join("");

    filMessages.scrollIntoView({ block: "end" });
  }

  await chargerFil();

  seDesabonner();
  canalMessagerie = supabase
    .channel("messagerie-" + [moiId, contact.id].sort().join("-"))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
      const m = payload.new;
      const concerneCetteConversation =
        (m.expediteur_id === moiId && m.destinataire_id === contact.id) ||
        (m.expediteur_id === contact.id && m.destinataire_id === moiId);
      if (concerneCetteConversation) chargerFil();
    })
    .subscribe();

  document.getElementById("formulaire-message").addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const champ = evenement.target.elements.contenu;
    const contenu = champ.value.trim();
    if (!contenu) return;
    champ.value = "";

    await supabase.from("messages").insert({
      expediteur_id: moiId,
      destinataire_id: contact.id,
      contenu,
    });
  });
                            }
