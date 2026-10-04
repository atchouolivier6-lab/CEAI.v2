// =========================================================
// CEAI — Écran "Accueil" (version moderne)
// Cartes de statistiques colorées, prochain bénéficiaire de la
// tontine, activités récentes et dernières publications.
// Chaque carte renvoie vers l'écran correspondant.
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import {
  carteStat,
  grilleStats,
  activerCartesCliquables,
  panneauActivites,
  panneauBeneficiaire,
  chargerProchainsBeneficiaires,
  echapper,
  formaterMontant,
  tempsRelatif,
} from "./composants-tableau.js";

// Total de mon épargne (versements validés de mes comptes non retirés)
async function chargerMonEpargne(moiId) {
  const { data: comptes } = await supabase
    .from("epargne_comptes")
    .select("id")
    .eq("membre_id", moiId)
    .neq("statut", "retire");

  const ids = (comptes || []).map((c) => c.id);
  if (!ids.length) return { total: 0, nombre: 0 };

  const { data: versements } = await supabase
    .from("epargne_versements")
    .select("montant")
    .in("compte_id", ids)
    .eq("statut", "valide");

  const total = (versements || []).reduce((somme, v) => somme + Number(v.montant), 0);
  return { total, nombre: ids.length };
}

export async function ecranAccueil(conteneur) {
  const { data: session } = await supabase.auth.getUser();
  const nom = session?.user?.user_metadata?.nom || "";

  const enTete = `
    <h2 class="titre-section">Accueil</h2>
    <hr class="trait-or" />
    <p class="accueil-salut">Bienvenue${nom ? ", " + echapper(nom) : ""}</p>
    <p class="accueil-sous-titre">Voici l'essentiel de votre association.</p>
  `;

  conteneur.innerHTML = enTete + `<p class="chargement">Chargement…</p>`;

  const moiId = await idProfilCourant();

  const [
    { data: capital },
    tontine,
    { count: membresActifs },
    { data: dernieresPublications },
    { data: notifications },
    epargne,
  ] = await Promise.all([
    supabase.from("capital_cotisation").select("total").maybeSingle(),
    chargerProchainsBeneficiaires(),
    supabase.from("profils").select("id", { count: "exact", head: true }).eq("actif", true),
    supabase.from("publications").select("id, texte, cree_le").order("cree_le", { ascending: false }).limit(3),
    supabase.from("notifications").select("texte, cree_le").order("cree_le", { ascending: false }).limit(5),
    chargerMonEpargne(moiId),
  ]);

  const cycles = tontine.cycles;
  const noteTontine = !cycles.length
    ? "Aucun cycle en cours"
    : cycles.length === 1
      ? cycles[0].nom
      : "Plusieurs cycles ouverts";

  const noteEpargne = !epargne.nombre
    ? "Aucun compte ouvert"
    : `${epargne.nombre} compte${epargne.nombre > 1 ? "s" : ""} d'épargne`;

  const cartes = grilleStats([
    carteStat({
      libelle: "Membres actifs",
      valeur: String(membresActifs || 0),
      note: "Dans l'association",
      icone: "membres",
      couleur: "bleu",
      aller: "membres/annuaire",
    }),
    carteStat({
      libelle: "Capital cotisation",
      valeur: formaterMontant(capital?.total),
      note: "Fonds commun",
      icone: "cotisation",
      couleur: "vert",
      aller: "cotisation/suivi",
    }),
    carteStat({
      libelle: "Mon épargne",
      valeur: formaterMontant(epargne.total),
      note: noteEpargne,
      icone: "epargne",
      couleur: "or",
      aller: "epargne/comptes",
    }),
    carteStat({
      libelle: "Tontine",
      valeur: cycles.length ? `${cycles.length} en cours` : "Aucun cycle",
      note: noteTontine,
      icone: "tontine",
      couleur: "violet",
      aller: "tontine/suivi",
    }),
  ]);

  const publications =
    dernieresPublications && dernieresPublications.length
      ? dernieresPublications
          .map((p) => {
            const texte = p.texte ? p.texte.slice(0, 120) + (p.texte.length > 120 ? "…" : "") : "(média)";
            return `
        <div class="activite">
          <span class="activite-point"></span>
          <div>
            <p class="activite-texte">${echapper(texte)}</p>
            <p class="activite-date">${tempsRelatif(p.cree_le)}</p>
          </div>
        </div>`;
          })
          .join("")
      : `<p class="panneau-vide">Aucune publication pour le moment</p>`;

  conteneur.innerHTML = `
    ${enTete}
    ${cartes}
    <div class="grille-panneaux">
      ${panneauBeneficiaire(tontine)}
      ${panneauActivites("Activités récentes", notifications || [])}
      <div class="panneau-tableau panneau-large">
        <p class="panneau-tableau-titre">Dernières publications</p>
        ${publications}
      </div>
    </div>
  `;

  activerCartesCliquables(conteneur);
}
