// =========================================================
// CEAI — Écran admin "Gestion des membres"
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import { notifier } from "../notifier.js";

function initiale(nom) {
  return (nom || "?").trim().charAt(0).toUpperCase();
}

export async function ecranAdminMembres(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Gestion des membres</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const moiId = await idProfilCourant();

  const [{ data: membres }, { data: votesEnCours }, { data: toutesLesVoix }] = await Promise.all([
    supabase.from("profils").select("id, nom, role, a_un_compte, telephone").order("nom"),
    supabase.from("votes_admin").select("id, candidat_id, propose_par, cree_le").eq("statut", "en_cours"),
    supabase.from("votes_admin_voix").select("vote_id, admin_id, voix"),
  ]);

  const nomParId = Object.fromEntries((membres || []).map((m) => [m.id, m.nom]));
  const nombreAdmins = (membres || []).filter((m) => m.role === "admin").length;

  conteneur.innerHTML = `
    <h2 class="titre-section">Gestion des membres</h2>
    <hr class="trait-or" />

    <p style="font-weight:500; margin:0 0 8px">Créer une fiche sans compte</p>
    <form id="formulaire-nouveau-membre" class="carte" style="display:flex; flex-direction:column; gap:12px">
      <label class="champ">
        <span>Nom complet</span>
        <input type="text" name="nom" required />
      </label>
      <label class="champ">
        <span>Téléphone</span>
        <input type="tel" name="telephone" />
      </label>
      <p id="erreur-nouveau-membre" style="color:var(--danger); font-size:13px; margin:0" hidden></p>
      <button type="submit" class="bouton bouton-or">Créer la fiche</button>
    </form>

    ${
      (votesEnCours || []).length
        ? `<p style="font-weight:500; margin:24px 0 8px">Votes de nomination en cours</p>` +
          votesEnCours
            .map((v) => gabaritVote(v, toutesLesVoix || [], nomParId, nombreAdmins, moiId))
            .join("")
        : ""
    }

    <p style="font-weight:500; margin:24px 0 8px">Tous les membres (${(membres || []).length})</p>
    <div id="liste-membres"></div>
  `;

  rendreListeMembres(membres || [], moiId, nombreAdmins);

  document.getElementById("formulaire-nouveau-membre").addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const donnees = new FormData(evenement.target);
    const erreur = document.getElementById("erreur-nouveau-membre");

    const { error } = await supabase.from("profils").insert({
      nom: donnees.get("nom").trim(),
      telephone: donnees.get("telephone")?.trim() || null,
      a_un_compte: false,
      cree_par: moiId,
    });

    if (error) {
      erreur.textContent = "Erreur : " + error.message;
      erreur.hidden = false;
      return;
    }

    ecranAdminMembres(conteneur);
  });

  conteneur.querySelectorAll("[data-proposer]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      const { error } = await supabase.from("votes_admin").insert({
        candidat_id: bouton.dataset.proposer,
        propose_par: moiId,
      });
      if (!error) {
        notifier(`Un vote de nomination a été lancé pour ${bouton.dataset.nom}.`);
        ecranAdminMembres(conteneur);
      }
    });
  });

  conteneur.querySelectorAll("[data-voter]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      const [voteId, valeur] = bouton.dataset.voter.split("|");
      await supabase.from("votes_admin_voix").insert({
        vote_id: voteId,
        admin_id: moiId,
        voix: valeur === "pour",
      });
      await evaluerVote(voteId, nombreAdmins);
      ecranAdminMembres(conteneur);
    });
  });
}

function gabaritVote(vote, toutesLesVoix, nomParId, nombreAdmins, moiId) {
  const voixDuVote = toutesLesVoix.filter((v) => v.vote_id === vote.id);
  const pour = voixDuVote.filter((v) => v.voix).length;
  const contre = voixDuVote.filter((v) => !v.voix).length;
  const jaiDejaVote = voixDuVote.some((v) => v.admin_id === moiId);

  return `
    <div class="carte">
      <p style="margin:0; font-weight:500">${nomParId[vote.candidat_id] || "—"}</p>
      <p style="margin:4px 0 12px; font-size:12px; color:var(--texte-secondaire)">
        Proposé par ${nomParId[vote.propose_par] || "—"} · ${pour} pour / ${contre} contre (sur ${nombreAdmins} admins)
      </p>
      ${
        jaiDejaVote
          ? `<p style="margin:0; font-size:13px; color:var(--texte-secondaire)">Vous avez déjà voté.</p>`
          : `<div style="display:flex; gap:8px">
              <button data-voter="${vote.id}|pour" class="bouton" style="background:#4C9A6A; color:#fff; padding:8px 14px; font-size:13px">Voter pour</button>
              <button data-voter="${vote.id}|contre" class="bouton" style="background:var(--danger); color:#fff; padding:8px 14px; font-size:13px">Voter contre</button>
            </div>`
      }
    </div>
  `;
}

async function evaluerVote(voteId, nombreAdmins) {
  const { data: voix } = await supabase.from("votes_admin_voix").select("voix").eq("vote_id", voteId);
  const pour = (voix || []).filter((v) => v.voix).length;
  const contre = (voix || []).filter((v) => !v.voix).length;
  const majorite = Math.floor(nombreAdmins / 2) + 1;

  if (pour >= majorite) {
    const { data: vote } = await supabase.from("votes_admin").select("candidat_id").eq("id", voteId).single();
    await supabase.from("votes_admin").update({ statut: "valide" }).eq("id", voteId);
    await supabase.from("profils").update({ role: "admin" }).eq("id", vote.candidat_id);
    notifier("Un nouvel administrateur a été nommé par vote.");
  } else if (pour + contre >= nombreAdmins) {
    await supabase.from("votes_admin").update({ statut: "rejete" }).eq("id", voteId);
  }
}

function rendreListeMembres(membres, moiId, nombreAdmins) {
  const conteneurListe = document.getElementById("liste-membres");
  conteneurListe.innerHTML = membres
    .map(
      (m) => `
    <div class="carte" style="display:flex; align-items:center; gap:10px">
      <div style="width:36px; height:36px; min-width:36px; border-radius:50%; background:var(--fond-carte-claire);
           display:flex; align-items:center; justify-content:center; font-size:14px; color:var(--or-texte)">
        ${initiale(m.nom)}
      </div>
      <div style="flex:1">
        <p style="margin:0; font-size:14px; font-weight:500">${m.nom} ${m.id === moiId ? "(vous)" : ""}</p>
        <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">
          ${m.telephone || "—"} ${!m.a_un_compte ? "· Sans compte" : ""}
        </p>
      </div>
      <span style="font-size:11px; color:var(--or-texte); background:var(--fond-carte-claire); padding:2px 8px;
            border-radius:999px; text-transform:capitalize">${m.role}</span>
      ${
        m.role !== "admin"
          ? `<button data-proposer="${m.id}" data-nom="${m.nom}" class="bouton" style="background:var(--fond-carte-claire);
               color:var(--texte); padding:6px 10px; font-size:12px; white-space:nowrap">Proposer admin</button>`
          : ""
      }
    </div>
  `
    )
    .join("");
                                                            }
