// =========================================================
// CEAI — Données des fiches de clôture (cotisation et tontine)
// Transforme les données renvoyées par la base (fonctions fiche_cotisation_session
// et fiche_tontine_cycle) en une "fiche" prête à être affichée à l'écran
// et imprimée en PDF. Aucun accès à la base ici : tout est calculé à partir
// des données reçues.
// =========================================================

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

// 12500 -> "12 500 FCFA" (espaces ordinaires, compatibles avec le PDF)
export function fcfa(montant) {
  const entier = Math.round(Number(montant) || 0);
  return `${String(entier).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;
}

function pourcentage(valeur) {
  return `${(Math.round(valeur * 10) / 10).toString().replace(".", ",")} %`;
}

// "2026-12-05" ou date complète -> "5 déc. 2026"
export function jour(valeur) {
  if (!valeur) return "—";
  const chaine = String(valeur);
  let annee, mois, numero;
  if (/^\d{4}-\d{2}-\d{2}$/.test(chaine)) {
    [annee, mois, numero] = chaine.split("-").map(Number);
  } else {
    const date = new Date(chaine);
    if (Number.isNaN(date.getTime())) return "—";
    annee = date.getFullYear();
    mois = date.getMonth() + 1;
    numero = date.getDate();
  }
  return `${numero} ${MOIS[mois - 1]} ${annee}`;
}

export function anneeDe(valeur) {
  if (!valeur) return "";
  const chaine = String(valeur);
  if (/^\d{4}/.test(chaine)) return Number(chaine.slice(0, 4)) === 0 ? "" : chaine.slice(0, 4);
  const date = new Date(chaine);
  return Number.isNaN(date.getTime()) ? "" : String(date.getFullYear());
}

export function dateJourComplete(date = new Date()) {
  const deux = (n) => String(n).padStart(2, "0");
  return `${deux(date.getDate())}/${deux(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function fonctionDuRole(role) {
  return role === "admin" ? "Administrateur" : role === "comptable" ? "Comptable" : "Agent";
}

function somme(liste, cle) {
  return liste.reduce((total, element) => total + Number(element[cle] || 0), 0);
}

const VERT = "#1a7f37";
const ORANGE = "#c46a00";
const ROUGE = "#c0392b";

function situation(ligne) {
  if (Number(ligne.nb) === 0) return { t: "Aucun versement", couleur: ROUGE, gras: true };
  if (ligne.en_retard || Number(ligne.penalites) > 0) return { t: "En retard", couleur: ORANGE, gras: true };
  return { t: "À jour", couleur: VERT, gras: true };
}

function referenceDe(prefixe, annee, id) {
  return `CEAI-${prefixe}-${annee || "0000"}-${String(id || "").replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function bilanAbsent(titre, texte) {
  return { titre, lignes: [{ rubrique: "Bilan", montant: "", detail: texte }] };
}

// ---------------------------------------------------------
// Session de cotisation
// ---------------------------------------------------------
export function construireFicheCotisation(donnees, { couleur = "#13693f", lien = "", edite = dateJourComplete() } = {}) {
  const s = donnees.session;
  const lignes = donnees.lignes || [];
  const totalCollecte = somme(lignes, "total");
  const totalPenalites = somme(lignes, "penalites");
  const nbVersements = somme(lignes, "nb");
  const ayantVerse = lignes.filter((l) => Number(l.total) > 0);
  const totaux = ayantVerse.map((l) => Number(l.total));
  const annee = anneeDe(s.cloturee_le) || anneeDe(s.ouverte_le);
  const cloturee = s.statut === "cloturee";
  const b = donnees.bilan;

  const bilan = b
    ? {
        titre: "Bilan de la session",
        lignes: [
          { rubrique: "Dépenses effectuées", montant: fcfa(b.depenses_montant), detail: b.depenses_description || "" },
          {
            rubrique: "Remboursements de prêts effectués avec cette cotisation",
            montant: fcfa(b.remboursements_montant),
            detail: b.remboursements_description || "",
          },
          { rubrique: "Réalisations faites avec cette cotisation", montant: fcfa(b.realisations_montant), detail: b.realisations_description || "" },
        ],
        pied: {
          rubrique: "Solde restant",
          montant: fcfa(totalCollecte - Number(b.depenses_montant || 0) - Number(b.remboursements_montant || 0) - Number(b.realisations_montant || 0)),
          detail: "Total collecté, moins les dépenses, les remboursements et les réalisations ci-dessus.",
        },
      }
    : bilanAbsent("Bilan de la session", "Le bilan n'a pas été renseigné pour cette session.");

  return {
    type: "cotisation",
    id: s.id,
    titreDocument: "FICHE DE CLÔTURE",
    etiquetteType: "COTISATION",
    nom: s.nom,
    annee,
    sousTitre: `Session de cotisation · du ${jour(s.ouverte_le)} au ${cloturee ? jour(s.cloturee_le) : "présent"}`,
    couleur,
    identite: [
      [
        { label: "Session", valeur: s.nom, poids: 2 },
        { label: "Statut", valeur: cloturee ? "Clôturée" : "Ouverte" },
        { label: "Adhérents", valeur: String(lignes.length) },
      ],
      [
        { label: "Ouverte le", valeur: jour(s.ouverte_le) },
        { label: "Clôturée le", valeur: cloturee ? jour(s.cloturee_le) : "—" },
        { label: "Date limite des versements", valeur: s.date_limite_versement ? jour(s.date_limite_versement) : "Non définie" },
      ],
      [
        { label: "Montant indicatif", valeur: s.montant_indicatif ? fcfa(s.montant_indicatif) : "Libre" },
        { label: "Versements validés", valeur: String(nbVersements) },
        { label: "Pénalités de retard", valeur: fcfa(totalPenalites) },
      ],
    ],
    tableau: {
      colonnes: [
        { titre: "N°", poids: 26, align: "center" },
        { titre: "ADHÉRENT", poids: 150, align: "left" },
        { titre: "VERSEMENTS", poids: 62, align: "center" },
        { titre: "TOTAL VERSÉ", poids: 88, align: "right" },
        { titre: "DONT PÉNALITÉS", poids: 76, align: "right" },
        { titre: "PART", poids: 44, align: "center" },
        { titre: "SITUATION", poids: 69, align: "center" },
      ],
      lignes: lignes.map((l, i) => [
        String(i + 1),
        l.nom || "—",
        String(Number(l.nb) || 0),
        fcfa(l.total),
        fcfa(l.penalites),
        totalCollecte > 0 ? pourcentage((Number(l.total) / totalCollecte) * 100) : "—",
        situation(l),
      ]),
      total: ["", "Total général :", String(nbVersements), fcfa(totalCollecte), fcfa(totalPenalites), totalCollecte > 0 ? "100 %" : "", ""],
    },
    synthese: [
      { label: "Total collecté", valeur: fcfa(totalCollecte) },
      { label: "Adhérents ayant versé", valeur: `${ayantVerse.length} / ${lignes.length}` },
      { label: "Moyenne / adhérent", valeur: lignes.length ? fcfa(totalCollecte / lignes.length) : fcfa(0) },
      { label: "Plus forte contribution", valeur: totaux.length ? fcfa(Math.max(...totaux)) : "—" },
      { label: "Plus faible contribution", valeur: totaux.length ? fcfa(Math.min(...totaux)) : "—" },
    ],
    bilan,
    etabliPar: donnees.etabli_par
      ? { nom: donnees.etabli_par.nom || "—", fonction: fonctionDuRole(donnees.etabli_par.role), date: b ? jour(b.rempli_le) : "" }
      : null,
    edite,
    reference: referenceDe("COT", annee, s.id),
    lien,
  };
}

// ---------------------------------------------------------
// Cycle de tontine
// ---------------------------------------------------------
export function construireFicheTontine(donnees, { couleur = "#5b2f93", lien = "", edite = dateJourComplete() } = {}) {
  const c = donnees.cycle;
  const lignes = donnees.lignes || [];
  const totalCollecte = somme(lignes, "total");
  const totalPenalites = somme(lignes, "penalites");
  const nbVersements = somme(lignes, "nb");
  const toursServis = lignes.filter((l) => l.a_recu).length;
  const annee = anneeDe(c.cloture_le) || anneeDe(c.demarre_le);
  const cloture = c.statut === "cloture";
  const tirageFait = Boolean(c.tirage_effectue_le);
  const b = donnees.bilan;

  const bilan = b
    ? {
        titre: "Bilan du cycle",
        lignes: [
          { rubrique: "Bénéficiaire du tour", montant: "", detail: donnees.beneficiaire?.nom || "—" },
          { rubrique: "Montant reçu", montant: b.montant_recu != null ? fcfa(b.montant_recu) : "—", detail: "" },
          { rubrique: "Notes", montant: "", detail: b.notes || "Aucune note." },
        ],
      }
    : bilanAbsent("Bilan du cycle", "Le bilan n'a pas été renseigné pour ce cycle.");

  return {
    type: "tontine",
    id: c.id,
    titreDocument: "FICHE DE CLÔTURE",
    etiquetteType: "TONTINE",
    nom: c.nom,
    annee,
    sousTitre: `Cycle de tontine · du ${jour(c.demarre_le)} au ${cloture ? jour(c.cloture_le) : "présent"}`,
    couleur,
    identite: [
      [
        { label: "Cycle", valeur: c.nom, poids: 2 },
        { label: "Statut", valeur: cloture ? "Clôturé" : "Ouvert" },
        { label: "Versement mensuel", valeur: fcfa(c.montant_mensuel) },
      ],
      [
        { label: "Démarré le", valeur: jour(c.demarre_le) },
        { label: "Clôturé le", valeur: cloture ? jour(c.cloture_le) : "—" },
        { label: "Tirage au sort", valeur: tirageFait ? jour(c.tirage_effectue_le) : "Non effectué" },
      ],
      [
        { label: "Participants", valeur: String(lignes.length) },
        { label: "Versements validés", valeur: String(nbVersements) },
        { label: "Date limite des versements", valeur: c.date_limite_versement ? jour(c.date_limite_versement) : "Non définie" },
      ],
    ],
    tableau: {
      colonnes: [
        { titre: "TOUR", poids: 30, align: "center" },
        { titre: "PARTICIPANT", poids: 140, align: "left" },
        { titre: "VERSEMENTS", poids: 62, align: "center" },
        { titre: "TOTAL VERSÉ", poids: 86, align: "right" },
        { titre: "PÉNALITÉS", poids: 66, align: "right" },
        { titre: "A REÇU LE", poids: 68, align: "center" },
        { titre: "SITUATION", poids: 63, align: "center" },
      ],
      lignes: lignes.map((l) => [
        tirageFait ? String(l.ordre) : "—",
        l.nom || "—",
        String(Number(l.nb) || 0),
        fcfa(l.total),
        fcfa(l.penalites),
        l.a_recu ? jour(l.recu_le) : "—",
        situation(l),
      ]),
      total: ["", "Total général :", String(nbVersements), fcfa(totalCollecte), fcfa(totalPenalites), "", ""],
    },
    synthese: [
      { label: "Total collecté", valeur: fcfa(totalCollecte) },
      { label: "Participants", valeur: String(lignes.length) },
      { label: "Montant reçu", valeur: b && b.montant_recu != null ? fcfa(b.montant_recu) : "—" },
      { label: "Moyenne / participant", valeur: lignes.length ? fcfa(totalCollecte / lignes.length) : fcfa(0) },
      { label: "Tours servis", valeur: `${toursServis} / ${lignes.length}` },
    ],
    bilan,
    etabliPar: donnees.etabli_par
      ? { nom: donnees.etabli_par.nom || "—", fonction: fonctionDuRole(donnees.etabli_par.role), date: b ? jour(b.rempli_le) : "" }
      : null,
    edite,
    reference: referenceDe("TON", annee, c.id),
    lien,
  };
}
