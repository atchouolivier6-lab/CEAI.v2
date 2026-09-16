// =========================================================
// CEAI — Écran admin "Gestion des membres"
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import { notifier } from "../notifier.js";

function initiale(nom) {
  return (nom || "?").trim().charAt(0).toUpperCase();
}

function afficherMessage(texte, estErreur) {
  const zone = document.getElementById("message-membres");
  if (!zone) return;
  zone.textContent = texte;
  zone.style.color = estErreur ? "var(--danger)" : "#4C9A6A";
  zone.hidden = false;
}

export async function ecranAdminMembres(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Gestion des membres</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const moiId = await idProfilCourant();

  const [{ data: membres }, { data: votesEnCours }, { data: toutesLesVoix }] = await Promise.all([
    supabase.from("profils").select("id, nom, role, a_un_compte, telephone, actif").order("nom"),
    supabase.from("votes_admin").select("id, candidat_id, propose_par, cree_le").eq("statut", "en_cours"),
    supabase.from("votes_admin_voix").select("vote_id, admin_id, voix"),
  ]);

  const nomParId = Object.fromEntries((membres || []).map((m) => [m.id, m.nom]));
  const nombreAdmins = (membres || []).filter((m) => m.role === "admin").length;

  conteneur.innerHTML = `
    <h2 class="titre-section">Gestion des membres</h2>
    <hr class="trait-or" />

    <p id="message-membres" style="font-size:13px; margin:0 0 12px; padding:10px; border-radius:var(--rayon-petit);
       background:var(--fond-carte-claire)" hidden></p>

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
      <p id="avertissement-doublon" style="color:var(--or-texte); font-size:13px; margin:0" hidden></p>
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

  rendreListeMembres(membres || [], moiId, nombreAdmins, conteneur);

  // --- Détection de doublon de nom pendant la saisie -----------------------
  const champNom = document.querySelector("#formulaire-nouveau-membre input[name='nom']");
  const avertissementDoublon = document.getElementById("avertissement-doublon");
  champNom.addEventListener("blur", () => {
    const nomSaisi = champNom.value.trim().toLowerCase();
    const homonyme = nomSaisi && (membres || []).find((m) => m.nom.trim().toLowerCase() === nomSaisi);
    if (homonyme) {
      avertissementDoublon.textContent = `⚠️ Un membre nommé "${homonyme.nom}" existe déjà. Vérifiez qu'il ne s'agit pas d'un doublon avant de continuer.`;
      avertissementDoublon.hidden = false;
    } else {
      avertissementDoublon.hidden = true;
    }
  });

  document.getElementById("formulaire-nouveau-membre").addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const donnees = new FormData(evenement.target);
    const nomSaisi = donnees.get("nom").trim();
    const erreur = document.getElementById("erreur-nouveau-membre");
    erreur.hidden = true;

    const homonyme = (membres || []).find((m) => m.nom.trim().toLowerCase() === nomSaisi.toLowerCase());
    if (homonyme && !window.confirm(`Un membre nommé "${homonyme.nom}" existe déjà. Créer quand même une nouvelle fiche pour "${nomSaisi}" ?`)) {
      return;
    }

    const { error } = await supabase.from("profils").insert({
      nom: nomSaisi,
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

function rendreListeMembres(membres, moiId, nombreAdmins, conteneurParent) {
  const conteneurListe = document.getElementById("liste-membres");
  conteneurListe.innerHTML = membres
    .map(
      (m) => `
    <div class="carte" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; opacity:${m.actif ? "1" : "0.55"}">
      <div style="width:36px; height:36px; min-width:36px; border-radius:50%; background:var(--fond-carte-claire);
           display:flex; align-items:center; justify-content:center; font-size:14px; color:var(--or-texte)">
        ${initiale(m.nom)}
      </div>
      <div style="flex:1; min-width:120px">
        <p style="margin:0; font-size:14px; font-weight:500">${m.nom} ${m.id === moiId ? "(vous)" : ""} ${!m.actif ? "— Retiré" : ""}</p>
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
      ${
        m.id !== moiId
          ? `<button data-basculer-actif="${m.id}" data-actif="${m.actif}" class="bouton"
               style="background:${m.actif ? "var(--danger)" : "#4C9A6A"}; color:#fff; padding:6px 10px; font-size:12px; white-space:nowrap">
               ${m.actif ? "Retirer" : "Réactiver"}
             </button>`
          : ""
      }
      ${
        !m.a_un_compte
          ? `<button data-adherer-pour="${m.id}" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte);
               padding:6px 10px; font-size:12px; white-space:nowrap">Adhérer cotisation</button>
             <button data-supprimer-def="${m.id}" data-nom="${m.nom}" class="bouton-icone" aria-label="Supprimer définitivement" style="color:var(--danger)">🗑</button>`
          : ""
      }
    </div>
  `
    )
    .join("");

  conteneurListe.querySelectorAll("[data-adherer-pour]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      const { error } = await supabase.from("cotisation_adhesions").insert({ membre_id: bouton.dataset.adhererPour });
      if (error) {
        afficherMessage(
          error.message.includes("duplicate") ? "Ce membre a déjà adhéré à la cotisation." : "Erreur : " + error.message,
          true
        );
        return;
      }
      afficherMessage("Membre adhéré à la cotisation avec succès.", false);
    });
  });

  conteneurListe.querySelectorAll("[data-supprimer-def]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      if (!window.confirm(`Supprimer DÉFINITIVEMENT la fiche de ${bouton.dataset.nom} ? Cette action est irréversible. Utile seulement si cette fiche a été créée par erreur.`)) return;

      const { error, count } = await supabase.from("profils").delete({ count: "exact" }).eq("id", bouton.dataset.supprimerDef);

      if (error) {
        afficherMessage(
          "Impossible de supprimer : ce membre a déjà des données liées (versements, messages...). Utilisez plutôt \"Retirer\" pour le désactiver sans perdre son historique. Détail : " + error.message,
          true
        );
        return;
      }
      if (!count) {
        afficherMessage("La suppression n'a rien changé — vérifiez que vous êtes bien connecté en tant qu'admin.", true);
        return;
      }

      afficherMessage(`Fiche de ${bouton.dataset.nom} supprimée.`, false);
      ecranAdminMembres(conteneurParent);
    });
  });

  conteneurListe.querySelectorAll("[data-basculer-actif]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      const estActif = bouton.dataset.actif === "true";
      if (estActif && !window.confirm("Retirer ce membre ? Son historique reste conservé, mais il n'apparaîtra plus dans l'annuaire ni la tontine.")) return;

      await supabase.from("profils").update({ actif: !estActif }).eq("id", bouton.dataset.basculerActif);
      ecranAdminMembres(conteneurParent);
    });
  });
}
