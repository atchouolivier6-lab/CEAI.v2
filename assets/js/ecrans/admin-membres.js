// =========================================================
// CEAI — Écran admin "Gestion des membres"
// Inclut la nomination d'admins (vote à la majorité) et,
// séparément, la proposition/vote pour élire un comptable
// parmi les admins. Les votes sont dans admin-membres-votes.js.
//
// Les admins et comptables sont les "agents" d'assistance : on ne peut
// proposer quelqu'un comme admin ou comptable que s'il a renseigné son
// numéro WhatsApp dans son profil.
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import { notifier } from "../notifier.js";
import { echapper } from "./composants-tableau.js";
import { gabaritVote, gabaritVoteComptable, evaluerVote } from "./admin-membres-votes.js";

const ICONE_CORBEILLE =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

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

// Charge les membres ; sans la colonne WhatsApp (script SQL pas lancé), on recharge sans elle
async function chargerMembres() {
  const colonnes = "id, nom, role, a_un_compte, telephone, actif";
  const complet = await supabase.from("profils").select(`${colonnes}, whatsapp`).order("nom");
  if (!complet.error) return { membres: complet.data, whatsappDisponible: true };
  const repli = await supabase.from("profils").select(colonnes).order("nom");
  return { membres: repli.data, whatsappDisponible: false };
}

export async function ecranAdminMembres(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Gestion des membres</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const moiId = await idProfilCourant();

  const [
    { membres, whatsappDisponible },
    { data: votesEnCours },
    { data: toutesLesVoix },
    { data: votesComptableEnCours },
    { data: voixComptable },
  ] = await Promise.all([
    chargerMembres(),
    supabase.from("votes_admin").select("id, candidat_id, propose_par, cree_le").eq("statut", "en_cours"),
    supabase.from("votes_admin_voix").select("vote_id, admin_id, voix"),
    supabase.from("comptable_votes").select("id, candidat_id, propose_par").eq("statut", "en_cours"),
    supabase.from("comptable_votes_reponses").select("vote_id, admin_id, choix"),
  ]);

  const nomParId = Object.fromEntries((membres || []).map((m) => [m.id, m.nom]));
  const membreParId = Object.fromEntries((membres || []).map((m) => [m.id, m]));
  const nombreAdmins = (membres || []).filter((m) => m.role === "admin").length;
  const idsAvecVoteComptableEnCours = new Set((votesComptableEnCours || []).map((v) => v.candidat_id));

  // Un candidat admin ou comptable doit avoir un numéro WhatsApp (si la colonne existe)
  const whatsappManquant = (candidatId) => whatsappDisponible && !membreParId[candidatId]?.whatsapp;
  const MESSAGE_WHATSAPP =
    "doit d'abord renseigner son numéro WhatsApp dans son profil : il est obligatoire pour les administrateurs et les comptables.";

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
        ? `<p style="font-weight:500; margin:24px 0 8px">Votes de nomination admin en cours</p>` +
          votesEnCours
            .map((v) => gabaritVote(v, toutesLesVoix || [], nomParId, nombreAdmins, moiId))
            .join("")
        : ""
    }

    ${
      (votesComptableEnCours || []).length
        ? `<p style="font-weight:500; margin:24px 0 8px">Votes de nomination comptable en cours</p>` +
          votesComptableEnCours
            .map((v) => gabaritVoteComptable(v, voixComptable || [], nomParId, nombreAdmins, moiId))
            .join("")
        : ""
    }

    <p style="font-weight:500; margin:24px 0 8px">Tous les membres (${(membres || []).length})</p>
    <div id="liste-membres"></div>
  `;

  rendreListeMembres(membres || [], moiId, idsAvecVoteComptableEnCours, conteneur, whatsappDisponible);

  // --- Détection de doublon de nom pendant la saisie -----------------------
  const champNom = document.querySelector("#formulaire-nouveau-membre input[name='nom']");
  const avertissementDoublon = document.getElementById("avertissement-doublon");
  champNom.addEventListener("blur", () => {
    const nomSaisi = champNom.value.trim().toLowerCase();
    const homonyme = nomSaisi && (membres || []).find((m) => m.nom.trim().toLowerCase() === nomSaisi);
    if (homonyme) {
      avertissementDoublon.textContent = `Attention : un membre nommé "${homonyme.nom}" existe déjà. Vérifiez qu'il ne s'agit pas d'un doublon avant de continuer.`;
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

  // --- Proposer un admin ---------------------------------------------------
  conteneur.querySelectorAll("[data-proposer]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      if (whatsappManquant(bouton.dataset.proposer)) {
        afficherMessage(`${bouton.dataset.nom} ${MESSAGE_WHATSAPP}`, true);
        return;
      }
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

  // --- Proposer un comptable -------------------------------------------------
  conteneur.querySelectorAll("[data-proposer-comptable]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      if (whatsappManquant(bouton.dataset.proposerComptable)) {
        afficherMessage(`${bouton.dataset.nom} ${MESSAGE_WHATSAPP}`, true);
        return;
      }
      if (!window.confirm(`Proposer ${bouton.dataset.nom} comme comptable ? Les autres admins vont voter.`)) return;

      const { data: nouveauVote, error } = await supabase
        .from("comptable_votes")
        .insert({ candidat_id: bouton.dataset.proposerComptable, propose_par: moiId })
        .select()
        .single();

      if (error) {
        afficherMessage("Erreur : " + error.message, true);
        return;
      }

      await supabase.from("comptable_votes_reponses").insert({
        vote_id: nouveauVote.id,
        admin_id: moiId,
        choix: "pour",
      });
      await supabase.rpc("verifier_vote_comptable", { p_vote_id: nouveauVote.id });

      notifier(`Une proposition de comptable a été lancée pour ${bouton.dataset.nom}.`);
      ecranAdminMembres(conteneur);
    });
  });

  // --- Voter pour un candidat comptable --------------------------------------
  conteneur.querySelectorAll("[data-voter-comptable]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      const [voteId, choix] = bouton.dataset.voterComptable.split("|");
      const { error } = await supabase.from("comptable_votes_reponses").insert({
        vote_id: voteId,
        admin_id: moiId,
        choix,
      });
      if (error) {
        afficherMessage("Erreur : " + error.message, true);
        return;
      }
      await supabase.rpc("verifier_vote_comptable", { p_vote_id: voteId });
      ecranAdminMembres(conteneur);
    });
  });
}

function rendreListeMembres(membres, moiId, idsAvecVoteComptableEnCours, conteneurParent, whatsappDisponible) {
  const conteneurListe = document.getElementById("liste-membres");
  conteneurListe.innerHTML = membres
    .map((m) => {
      const nom = echapper(m.nom);
      const agentSansWhatsapp = whatsappDisponible && ["admin", "comptable"].includes(m.role) && !m.whatsapp;
      return `
    <div class="carte" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; opacity:${m.actif ? "1" : "0.55"}">
      <div style="width:36px; height:36px; min-width:36px; border-radius:50%; background:var(--fond-carte-claire);
           display:flex; align-items:center; justify-content:center; font-size:14px; color:var(--or-texte)">
        ${echapper(initiale(m.nom))}
      </div>
      <div style="flex:1; min-width:120px">
        <p style="margin:0; font-size:14px; font-weight:500">${nom} ${m.id === moiId ? "(vous)" : ""} ${!m.actif ? "— Retiré" : ""}</p>
        <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">
          ${echapper(m.telephone || "—")} ${!m.a_un_compte ? "· Sans compte" : ""}
          ${agentSansWhatsapp ? `<span style="color:var(--or-texte)"> · WhatsApp manquant</span>` : ""}
        </p>
      </div>
      <span style="font-size:11px; color:var(--or-texte); background:var(--fond-carte-claire); padding:2px 8px;
            border-radius:999px; text-transform:capitalize">${echapper(m.role)}</span>
      ${
        m.role !== "admin"
          ? `<button data-proposer="${m.id}" data-nom="${nom}" class="bouton" style="background:var(--fond-carte-claire);
               color:var(--texte); padding:6px 10px; font-size:12px; white-space:nowrap">Proposer admin</button>`
          : ""
      }
      ${
        m.role === "admin" && !idsAvecVoteComptableEnCours.has(m.id)
          ? `<button data-proposer-comptable="${m.id}" data-nom="${nom}" class="bouton" style="background:var(--fond-carte-claire);
               color:var(--texte); padding:6px 10px; font-size:12px; white-space:nowrap">Proposer comptable</button>`
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
             <button data-supprimer-def="${m.id}" data-nom="${nom}" class="bouton-icone" aria-label="Supprimer définitivement" style="color:var(--danger)">${ICONE_CORBEILLE}</button>`
          : ""
      }
    </div>
  `;
    })
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
