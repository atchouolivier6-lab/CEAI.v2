// =========================================================
// CEAI — Écran "Accueil" (version moderne)
// Cartes de statistiques colorées, prochain bénéficiaire de la
// tontine, activités récentes animées et dernières publications.
// Chaque carte renvoie vers l'écran correspondant.
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import {
  carteStat,
  grilleStats,
  activerCartesCliquables,
  panneauBeneficiaire,
  chargerProchainsBeneficiaires,
  echapper,
  formaterMontant,
} from "./composants-tableau.js";
import { panneauNotifications, panneauPublications } from "./notifications-accueil.js";

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

// Rappel pour les admins et comptables qui n'ont pas encore renseigné leur numéro WhatsApp
async function rappelWhatsapp(moiId) {
  const { data } = await supabase.from("profils").select("role, whatsapp").eq("id", moiId).maybeSingle();
  if (!data || !["admin", "comptable"].includes(data.role) || data.whatsapp) return "";
  return `
    <div class="alerte-agent" data-aller="membres/profil" role="link" tabindex="0">
      <p class="alerte-agent-titre">Numéro WhatsApp à renseigner</p>
      <p class="alerte-agent-texte">
        En tant que ${data.role === "admin" ? "administrateur" : "comptable"}, vous êtes un agent d'assistance :
        les membres doivent pouvoir vous joindre sur WhatsApp. Touchez ici pour compléter votre profil.
      </p>
    </div>`;
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
    rappel,
  ] = await Promise.all([
    supabase.from("capital_cotisation").select("total").maybeSingle(),
    chargerProchainsBeneficiaires(),
    supabase.from("profils").select("id", { count: "exact", head: true }).eq("actif", true),
    supabase.from("publications").select("id, texte, cree_le").order("cree_le", { ascending: false }).limit(3),
    supabase.from("notifications").select("texte, cree_le").order("cree_le", { ascending: false }).limit(6),
    chargerMonEpargne(moiId),
    rappelWhatsapp(moiId),
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

  conteneur.innerHTML = `
    ${enTete}
    ${rappel}
    ${cartes}
    <div class="grille-panneaux">
      ${panneauBeneficiaire(tontine)}
      ${panneauNotifications(notifications || [])}
      ${panneauPublications(dernieresPublications || [])}
    </div>
  `;

  // Le toucher d'une publication mène à l'espace Publications, directement sur celle-ci
  conteneur.querySelectorAll("[data-publication]").forEach((carte) => {
    const memoriser = () => {
      try {
        sessionStorage.setItem("ceai-publication-cible", carte.dataset.publication);
      } catch {
        // l'écran s'ouvrira simplement en haut de la liste
      }
    };
    carte.addEventListener("click", memoriser);
    carte.addEventListener("keydown", (evenement) => {
      if (evenement.key === "Enter") memoriser();
    });
  });

  activerCartesCliquables(conteneur);
    }
