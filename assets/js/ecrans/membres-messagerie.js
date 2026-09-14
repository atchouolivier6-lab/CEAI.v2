// =========================================================
// CEAI — Écran "Messagerie"
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";

let canalMessagerie = null;
let enregistreurAudio = null;
let morceauxAudio = [];

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

function apercuDernierMessage(m) {
  if (m.type === "image") return "📷 Photo";
  if (m.type === "audio") return "🎤 Message vocal";
  return m.contenu;
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
      .select("expediteur_id, destinataire_id, contenu, type, envoye_le")
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
            ${dernier ? apercuDernierMessage(dernier) : "Aucun message"}
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
    <p id="erreur-media" style="color:var(--danger); font-size:13px; margin:0 0 8px" hidden></p>
    <form id="formulaire-message" style="display:flex; gap:6px; align-items:center">
      <button type="button" id="bouton-piece-jointe" class="bouton-icone" aria-label="Envoyer une photo">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M21 11.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8"/>
          <circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-4.5-4.5-6 6"/>
        </svg>
      </button>
      <input type="file" id="entree-image" accept="image/*" hidden />
      <button type="button" id="bouton-vocal" class="bouton-icone" aria-label="Enregistrer un message vocal">
        <svg id="icone-micro" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>
        </svg>
      </button>
      <input type="text" name="contenu" placeholder="Écrire un message..."
             style="flex:1; background:var(--fond-carte); border:1px solid var(--bordure); border-radius:999px;
             padding:11px 16px; color:var(--texte); font-family:inherit; font-size:15px" />
      <button type="submit" class="bouton bouton-or" style="border-radius:50%; width:44px; height:44px; padding:0; flex-shrink:0">➤</button>
    </form>
  `;

  document.getElementById("bouton-retour-messagerie").addEventListener("click", () => {
    arreterEnregistrementSiActif();
    ecranMessagerie(conteneur);
  });

  const filMessages = document.getElementById("fil-messages");
  const erreurMedia = document.getElementById("erreur-media");

  function afficherErreurMedia(texte) {
    erreurMedia.textContent = texte;
    erreurMedia.hidden = false;
  }

  async function chargerFil() {
    const { data: messages } = await supabase
      .from("messages")
      .select("expediteur_id, contenu, type, media_url, envoye_le")
      .or(
        `and(expediteur_id.eq.${moiId},destinataire_id.eq.${contact.id}),and(expediteur_id.eq.${contact.id},destinataire_id.eq.${moiId})`
      )
      .order("envoye_le", { ascending: true });

    filMessages.innerHTML = (messages || [])
      .map((m) => {
        const estDeMoi = m.expediteur_id === moiId;
        let contenuBulle;
        if (m.type === "image") {
          contenuBulle = `<img src="${m.media_url}" alt="" style="max-width:100%; border-radius:10px; display:block" />`;
        } else if (m.type === "audio") {
          contenuBulle = `<audio src="${m.media_url}" controls style="width:220px; max-width:100%"></audio>`;
        } else {
          contenuBulle = `<p style="margin:0; font-size:14px">${m.contenu}</p>`;
        }
        return `
        <div style="align-self:${estDeMoi ? "flex-end" : "flex-start"}; max-width:75%;
             background:${estDeMoi ? "var(--or)" : "var(--fond-carte)"}; color:${estDeMoi ? "#3A2B0E" : "var(--texte)"};
             border:1px solid ${estDeMoi ? "transparent" : "var(--bordure)"}; border-radius:14px; padding:8px 12px">
          ${contenuBulle}
          <p style="margin:2px 0 0; font-size:10px; opacity:0.7; text-align:right">${formaterHeure(m.envoye_le)}</p>
        </div>
      `;
      })
      .join("");

    filMessages.scrollIntoView({ block: "end" });
  }

  async function marquerCommeLu() {
    await supabase
      .from("messages")
      .update({ lu: true })
      .eq("expediteur_id", contact.id)
      .eq("destinataire_id", moiId)
      .eq("lu", false);
  }

  await chargerFil();
  await marquerCommeLu();

  seDesabonner();
  canalMessagerie = supabase
    .channel("messagerie-" + [moiId, contact.id].sort().join("-"))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
      const m = payload.new;
      const concerneCetteConversation =
        (m.expediteur_id === moiId && m.destinataire_id === contact.id) ||
        (m.expediteur_id === contact.id && m.destinataire_id === moiId);
      if (concerneCetteConversation) {
        chargerFil();
        marquerCommeLu();
      }
    })
    .subscribe();

  // --- Envoi d'un message texte -------------------------------------------
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
      type: "texte",
    });

    await chargerFil();
  });

  // --- Envoi d'une image ----------------------------------------------------
  document.getElementById("bouton-piece-jointe").addEventListener("click", () => {
    document.getElementById("entree-image").click();
  });

  document.getElementById("entree-image").addEventListener("change", async (evenement) => {
    const fichier = evenement.target.files[0];
    evenement.target.value = "";
    if (!fichier) return;
    erreurMedia.hidden = true;

    const chemin = `${moiId}/${Date.now()}-${fichier.name}`;
    const { error: erreurUpload } = await supabase.storage.from("messagerie-medias").upload(chemin, fichier);
    if (erreurUpload) {
      afficherErreurMedia("Erreur envoi image : " + erreurUpload.message);
      return;
    }
    const { data: urlPublique } = supabase.storage.from("messagerie-medias").getPublicUrl(chemin);

    await supabase.from("messages").insert({
      expediteur_id: moiId,
      destinataire_id: contact.id,
      type: "image",
      media_url: urlPublique.publicUrl,
    });

    await chargerFil();
  });

  // --- Enregistrement et envoi d'un message vocal --------------------------
  const boutonVocal = document.getElementById("bouton-vocal");
  const iconeMicro = document.getElementById("icone-micro");

  boutonVocal.addEventListener("click", async () => {
    if (enregistreurAudio && enregistreurAudio.state === "recording") {
      enregistreurAudio.stop();
      return;
    }

    erreurMedia.hidden = true;
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
      morceauxAudio = [];
      enregistreurAudio = new MediaRecorder(flux);

      enregistreurAudio.ondataavailable = (e) => morceauxAudio.push(e.data);

      enregistreurAudio.onstop = async () => {
        flux.getTracks().forEach((piste) => piste.stop());
        boutonVocal.style.color = "";
        iconeMicro.style.color = "";

        const blobAudio = new Blob(morceauxAudio, { type: "audio/webm" });
        const chemin = `${moiId}/${Date.now()}.webm`;
        const { error: erreurUpload } = await supabase.storage.from("messagerie-medias").upload(chemin, blobAudio);
        if (erreurUpload) {
          afficherErreurMedia("Erreur envoi vocal : " + erreurUpload.message);
          return;
        }
        const { data: urlPublique } = supabase.storage.from("messagerie-medias").getPublicUrl(chemin);

        await supabase.from("messages").insert({
          expediteur_id: moiId,
          destinataire_id: contact.id,
          type: "audio",
          media_url: urlPublique.publicUrl,
        });

        await chargerFil();
      };

      enregistreurAudio.start();
      boutonVocal.style.color = "var(--danger)";
    } catch (e) {
      afficherErreurMedia("Micro indisponible : autorisez l'accès au microphone dans votre navigateur.");
    }
  });

  function arreterEnregistrementSiActif() {
    if (enregistreurAudio && enregistreurAudio.state === "recording") {
      enregistreurAudio.stop();
    }
  }
      }
