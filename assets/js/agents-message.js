// =========================================================
// CEAI — Message structuré vers un agent sur WhatsApp
// Le membre choisit un motif, puis sa demande, ajoute des précisions
// si besoin, vérifie le message prêt à l'envoi et ouvre WhatsApp.
// =========================================================
import { supabase } from "./supabase-client.js";
import { echapper } from "./ecrans/composants-tableau.js";
import { lierRetour } from "./retour-fenetre.js";

const MOTIFS = {
  "Cotisation": ["Adhérer à une session", "Vérifier un versement", "Problème de versement", "Autre question"],
  "Tontine": ["Rejoindre un cycle", "Rang ou tirage au sort", "Vérifier un versement", "Autre question"],
  "Épargne": ["Ouvrir un compte d'épargne", "Vérifier un versement", "Demander un retrait", "Autre question"],
  "Prêt": ["Faire une demande de prêt", "Suivre ma demande", "Remboursement ou pénalités", "Autre question"],
  "Mon compte": ["Problème de connexion", "Modifier mes informations", "Autre question"],
  "Autre": [],
};

export async function ouvrirMessageWhatsapp({ moiId, agent, role, construireLien }) {
  if (document.querySelector(".wa-voile")) return;

  let membreNom = "";
  try {
    const { data } = await supabase.from("profils").select("nom").eq("id", moiId).single();
    membreNom = (data?.nom || "").trim();
  } catch {
    membreNom = "";
  }
  if (document.querySelector(".wa-voile")) return; // double appui

  const prenomAgent = (agent.nom || "").trim().split(/\s+/)[0] || "";
  let motif = "";
  let nature = "";

  const voile = document.createElement("div");
  voile.className = "wa-voile";
  voile.setAttribute("role", "dialog");
  voile.setAttribute("aria-modal", "true");
  voile.setAttribute("aria-label", "Message WhatsApp");
  voile.innerHTML = `
    <div class="wa-feuille">
      <div class="wa-entete">
        <div>
          <p class="wa-titre">Écrire à ${echapper(agent.nom)}</p>
          <p class="wa-sous-titre">${echapper(role || "Agent")} · WhatsApp</p>
        </div>
        <button type="button" class="wa-fermer" aria-label="Fermer">✕</button>
      </div>

      <p class="wa-etiquette">1. Motif de votre message</p>
      <div class="wa-puces" data-zone="motifs"></div>

      <div data-zone="bloc-natures" hidden>
        <p class="wa-etiquette">2. Votre demande</p>
        <div class="wa-puces" data-zone="natures"></div>
      </div>

      <label class="wa-etiquette" for="wa-precisions">Précisions <span data-zone="facultatif">(facultatif)</span></label>
      <textarea id="wa-precisions" class="wa-champ" rows="3" maxlength="500" placeholder="Expliquez en quelques mots"></textarea>

      <p class="wa-etiquette">Message qui sera envoyé</p>
      <div class="wa-apercu" data-zone="apercu"></div>

      <p class="wa-erreur" data-zone="erreur" hidden></p>
      <button type="button" class="bouton bouton-or bouton-pleine-largeur" data-zone="envoyer">Ouvrir WhatsApp</button>
    </div>
  `;
  document.body.appendChild(voile);

  const zone = (nom) => voile.querySelector(`[data-zone="${nom}"]`);
  const champ = voile.querySelector("#wa-precisions");
  const naturesDuMotif = () => MOTIFS[motif] || [];
  const precisionsObligatoires = () => motif === "Autre" || nature === "Autre question";

  function construireMessage() {
    const lignes = [prenomAgent ? `Bonjour ${prenomAgent},` : "Bonjour,", ""];
    lignes.push(membreNom ? `Je suis ${membreNom}, membre de CEAI.` : "Je suis membre de CEAI.", "");
    lignes.push(`Motif : ${motif}`);
    if (nature) lignes.push(`Demande : ${nature}`);
    if (champ.value.trim()) lignes.push(`Précisions : ${champ.value.trim()}`);
    lignes.push("", "Merci de me répondre dès que possible.");
    return lignes.join("\n");
  }

  function dessinerPuces(conteneur, valeurs, choisie, surChoix) {
    conteneur.innerHTML = valeurs
      .map(
        (v) =>
          `<button type="button" class="wa-puce${v === choisie ? " actif" : ""}" data-v="${echapper(v)}" aria-pressed="${v === choisie}">${echapper(v)}</button>`
      )
      .join("");
    conteneur.querySelectorAll(".wa-puce").forEach((bouton) => {
      bouton.addEventListener("click", () => surChoix(bouton.dataset.v));
    });
  }

  function majApercu() {
    zone("apercu").textContent = motif ? construireMessage() : "Choisissez un motif pour voir le message.";
  }

  function mettreAJour() {
    dessinerPuces(zone("motifs"), Object.keys(MOTIFS), motif, (valeur) => {
      motif = valeur;
      nature = "";
      mettreAJour();
    });
    const natures = naturesDuMotif();
    zone("bloc-natures").hidden = natures.length === 0;
    dessinerPuces(zone("natures"), natures, nature, (valeur) => {
      nature = valeur;
      mettreAJour();
    });
    zone("facultatif").textContent = precisionsObligatoires() ? "(obligatoire)" : "(facultatif)";
    majApercu();
  }

  const montrerErreur = (texte) => {
    zone("erreur").textContent = texte;
    zone("erreur").hidden = !texte;
  };

  champ.addEventListener("input", majApercu);

  zone("envoyer").addEventListener("click", () => {
    montrerErreur("");
    let probleme = "";
    if (!motif) probleme = "Choisissez d'abord un motif.";
    else if (naturesDuMotif().length && !nature) probleme = "Choisissez votre demande.";
    else if (precisionsObligatoires() && champ.value.trim().length < 5) {
      probleme = "Écrivez quelques mots pour préciser votre demande.";
    }
    if (probleme) return montrerErreur(probleme);

    const lien = construireLien(construireMessage());
    if (!lien) return montrerErreur("Le numéro WhatsApp de cet agent n'est pas valide.");

    window.open(lien, "_blank", "noopener");
    fermer();
  });

  // --- Fermeture (bouton, touche Échap, retour du téléphone) ----------
  const surTouche = (evenement) => {
    if (evenement.key === "Escape") fermer();
  };
  const nettoyer = () => {
    voile.remove();
    document.removeEventListener("keydown", surTouche);
  };
  const detacher = lierRetour(nettoyer);
  const fermer = () => {
    detacher();
    nettoyer();
  };

  document.addEventListener("keydown", surTouche);
  voile.addEventListener("click", (evenement) => {
    if (evenement.target === voile) fermer();
  });
  voile.querySelector(".wa-fermer").addEventListener("click", fermer);

  mettreAJour();
           }
