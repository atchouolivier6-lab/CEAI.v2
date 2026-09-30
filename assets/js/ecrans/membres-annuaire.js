// =========================================================
// CEAI — Écran "Annuaire des membres"
// Un profil retiré (actif = false) disparaît de l'annuaire
// pour tout le monde, mais reste visible et réversible pour
// l'admin. L'admin peut aussi proposer un autre admin comme
// comptable ; les autres admins votent (2 "contre" = rejeté,
// sinon accepté une fois que tous ont voté). L'admin garde
// toujours tous ses accès, quoi qu'il arrive.
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";

function initiale(nom) {
  return (nom || "?").trim().charAt(0).toUpperCase();
}

function avatarHtml(profil, taille) {
  return profil.photo_url
    ? `<img src="${profil.photo_url}" alt="" style="width:100%;height:100%;object-fit:cover" />`
    : `<span style="font-family:var(--police-titre); font-size:${Math.round(taille * 0.4)}px; color:var(--or-texte)">${initiale(profil.nom)}</span>`;
}

async function jeSuisAdmin() {
  const moiId = await idProfilCourant();
  const { data } = await supabase.from("profils").select("role").eq("id", moiId).single();
  return data?.role === "admin";
}

export async function ecranAnnuaire(conteneur) {
  conteneur.innerHTML = `
    <h2 class="titre-section">Annuaire des membres</h2>
    <hr class="trait-or" />
    <p class="chargement">Chargement…</p>
  `;

  const [{ data: membres, error }, estAdmin] = await Promise.all([
    supabase.from("profils").select("id, nom, photo_url, role, telephone, bio, actif").order("nom"),
    jeSuisAdmin(),
  ]);

  if (error) {
    conteneur.innerHTML = `
      <h2 class="titre-section">Annuaire des membres</h2>
      <hr class="trait-or" />
      <p style="color:var(--danger)">Impossible de charger l'annuaire pour le moment.</p>
    `;
    return;
  }

  const membresAffiches = estAdmin ? (membres || []) : (membres || []).filter((m) => m.actif !== false);
  rendreGrille(conteneur, membresAffiches, estAdmin);
}

function rendreGrille(conteneur, membres, estAdmin) {
  const cartes = membres
    .map((m, i) => {
      const retire = m.actif === false;
      return `
    <button class="carte-membre" data-index="${i}" style="all:unset; cursor:pointer; text-align:center; background:var(--fond-carte);
         border:1px solid var(--bordure); border-radius:var(--rayon); padding:16px 8px; display:flex; flex-direction:column; align-items:center; gap:8px;
         ${retire ? "opacity:0.5" : ""}">
      <div style="width:56px; height:56px; border-radius:50%; background:var(--fond-carte-claire); overflow:hidden;
           display:flex; align-items:center; justify-content:center">
        ${avatarHtml(m, 56)}
      </div>
      <p style="margin:0; font-size:13px; font-weight:500; line-height:1.3">${m.nom}</p>
      <span style="font-size:10px; color:var(--or-texte); background:var(--fond-carte-claire); padding:2px 8px;
            border-radius:999px; text-transform:capitalize">${m.role}</span>
      ${retire ? `<span style="font-size:9px; color:var(--danger)">Retiré de l'annuaire</span>` : ""}
    </button>
  `;
    })
    .join("");

  conteneur.innerHTML = `
    <h2 class="titre-section">Annuaire des membres</h2>
    <hr class="trait-or" />
    ${estAdmin ? `<p style="font-size:12px; color:var(--texte-secondaire); margin:0 0 12px">Vous voyez aussi les membres retirés de l'annuaire (visibles par vous seul).</p>` : ""}
    ${
      membres.length
        ? `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(100px, 1fr)); gap:12px">${cartes}</div>`
        : `<p style="color:var(--texte-secondaire)">Aucun membre pour le moment.</p>`
    }
  `;

  conteneur.querySelectorAll(".carte-membre").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      rendreDetail(conteneur, membres[Number(bouton.dataset.index)], estAdmin);
    });
  });
}

async function rendreDetail(conteneur, membre, estAdmin) {
  const retire = membre.actif === false;
  const moiId = estAdmin ? await idProfilCourant() : null;

  let zoneComptableHtml = "";
  if (estAdmin && membre.role === "admin") {
    const { data: voteEnCours } = await supabase
      .from("comptable_votes")
      .select("id, propose_par")
      .eq("candidat_id", membre.id)
      .eq("statut", "en_cours")
      .maybeSingle();

    if (voteEnCours) {
      const { data: reponses } = await supabase
        .from("comptable_votes_reponses")
        .select("admin_id, choix")
        .eq("vote_id", voteEnCours.id);

      const pour = (reponses || []).filter((r) => r.choix === "pour").length;
      const contre = (reponses || []).filter((r) => r.choix === "contre").length;
      const dejaVote = (reponses || []).some((r) => r.admin_id === moiId);

      zoneComptableHtml = `
        <div class="carte" style="background:var(--fond-carte-claire)">
          <p style="margin:0; font-weight:500">Vote en cours : ${membre.nom} comme comptable</p>
          <p style="margin:6px 0 0; font-size:13px; color:var(--texte-secondaire)">${pour} pour · ${contre} contre</p>
          ${
            dejaVote
              ? `<p style="margin:10px 0 0; font-size:13px; color:var(--texte-secondaire)">Vous avez déjà voté.</p>`
              : `<div style="display:flex; gap:8px; margin-top:12px">
                   <button data-voter="${voteEnCours.id}" data-choix="pour" class="bouton" style="background:#4C9A6A; color:#fff; flex:1">Voter Pour</button>
                   <button data-voter="${voteEnCours.id}" data-choix="contre" class="bouton" style="background:var(--danger); color:#fff; flex:1">Voter Contre</button>
                 </div>`
          }
        </div>
      `;
    } else {
      zoneComptableHtml = `
        <button id="bouton-proposer-comptable" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); margin-top:12px; width:100%">
          Proposer comme comptable
        </button>
      `;
    }
  } else if (membre.role === "comptable") {
    zoneComptableHtml = `<p style="margin:8px 0 0; font-size:12px; color:var(--texte-secondaire)">Comptable actuel — un seul comptable à la fois.</p>`;
  }

  conteneur.innerHTML = `
    <button id="bouton-retour-annuaire" class="lien" style="margin-bottom:16px">← Retour à l'annuaire</button>
    <div class="carte" style="text-align:center">
      <div style="width:88px; height:88px; border-radius:50%; background:var(--fond-carte-claire); overflow:hidden;
           display:flex; align-items:center; justify-content:center; margin:0 auto 12px">
        ${avatarHtml(membre, 88)}
      </div>
      <p style="font-family:var(--police-titre); font-size:18px; margin:0">${membre.nom}</p>
      <span style="display:inline-block; margin-top:8px; background:var(--fond-carte-claire); color:var(--or-texte);
            font-size:11px; padding:3px 10px; border-radius:999px; text-transform:capitalize">${membre.role}</span>
      ${retire ? `<p style="margin:8px 0 0; font-size:12px; color:var(--danger)">Ce membre est actuellement retiré de l'annuaire.</p>` : ""}
    </div>
    <div class="carte">
      <p style="color:var(--texte-secondaire); font-size:12px; margin:0">TÉLÉPHONE</p>
      <p style="margin:2px 0 12px">${membre.telephone || "—"}</p>
      <p style="color:var(--texte-secondaire); font-size:12px; margin:0">BIO</p>
      <p style="margin:2px 0 0">${membre.bio || "—"}</p>
    </div>
    ${zoneComptableHtml}
    ${
      estAdmin
        ? `<button id="bouton-toggle-actif" class="bouton" style="background:${retire ? "#4C9A6A" : "var(--danger)"}; color:#fff; margin-top:12px; width:100%">
             ${retire ? "Remettre dans l'annuaire" : "Retirer de l'annuaire"}
           </button>`
        : ""
    }
  `;

  document.getElementById("bouton-retour-annuaire").addEventListener("click", () => {
    ecranAnnuaire(conteneur);
  });

  const boutonToggle = document.getElementById("bouton-toggle-actif");
  if (boutonToggle) {
    boutonToggle.addEventListener("click", async () => {
      const nouvelActif = retire ? true : false;
      const message = nouvelActif
        ? `Remettre ${membre.nom} dans l'annuaire ?`
        : `Retirer ${membre.nom} de l'annuaire ? Son historique (versements, participations, prêts) est conservé et l'action est réversible.`;
      if (!window.confirm(message)) return;

      const { error } = await supabase.from("profils").update({ actif: nouvelActif }).eq("id", membre.id);
      if (error) {
        alert("Erreur : " + error.message);
        return;
      }
      ecranAnnuaire(conteneur);
    });
  }

  const boutonProposer = document.getElementById("bouton-proposer-comptable");
  if (boutonProposer) {
    boutonProposer.addEventListener("click", async () => {
      if (!window.confirm(`Proposer ${membre.nom} comme comptable ? Les autres admins vont voter.`)) return;

      const { data: nouveauVote, error: erreurVote } = await supabase
        .from("comptable_votes")
        .insert({ candidat_id: membre.id, propose_par: moiId })
        .select()
        .single();

      if (erreurVote) {
        alert("Erreur : " + erreurVote.message);
        return;
      }

      await supabase.from("comptable_votes_reponses").insert({
        vote_id: nouveauVote.id,
        admin_id: moiId,
        choix: "pour",
      });
      await supabase.rpc("verifier_vote_comptable", { p_vote_id: nouveauVote.id });

      rendreDetail(conteneur, membre, estAdmin);
    });
  }

  conteneur.querySelectorAll("[data-voter]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      const { error } = await supabase.from("comptable_votes_reponses").insert({
        vote_id: bouton.dataset.voter,
        admin_id: moiId,
        choix: bouton.dataset.choix,
      });
      if (error) {
        alert("Erreur : " + error.message);
        return;
      }
      await supabase.rpc("verifier_vote_comptable", { p_vote_id: bouton.dataset.voter });
      rendreDetail(conteneur, membre, estAdmin);
    });
  });
  }
