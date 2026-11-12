// =========================================================
// CEAI — Écran "Accueil" (style classique, tons neutres)
// Salut et date, tuiles de chiffres, prochain bénéficiaire de la
// tontine, activités récentes et dernières publications.
// Chaque tuile renvoie vers l'écran correspondant.
//
// Confidentialité : la tuile "Capital cotisation" n'est visible que des
// adhérents d'une cotisation, et le bloc "Prochain bénéficiaire" que des
// participants d'une tontine. L'admin et le comptable voient toujours tout.
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import { activerCartesCliquables, chargerProchainsBeneficiaires, echapper, formaterMontant } from "./composants-tableau.js";
import { tuile, blocBeneficiaire, blocActivites, blocPublications, squeletteAccueil, animerCompteurs } from "./accueil-blocs.js";

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

// Mon rôle (admin, comptable, membre...)
async function chargerRole(moiId) {
  const { data } = await supabase.from("profils").select("role").eq("id", moiId).maybeSingle();
  return data?.role || "";
}

// Suis-je inscrit (au moins une ligne à mon nom) dans cette table ?
// Renvoie true / false, ou null si la vérification est impossible
// (dans ce cas on laisse l'affichage habituel plutôt que de cacher à tort).
async function suisInscritDans(table, moiId) {
  for (const colonne of ["membre_id", "profil_id"]) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(colonne, moiId);
    if (!error) return (count || 0) > 0;
  }
  return null;
}

// Rappel pour les admins et comptables qui n'ont pas encore renseigné leur numéro WhatsApp
async function rappelWhatsapp(moiId) {
  const { data } = await supabase.from("profils").select("role, whatsapp").eq("id", moiId).maybeSingle();
  if (!data || !["admin", "comptable"].includes(data.role) || data.whatsapp) return "";
  return `
    <div class="acc-alerte" data-aller="membres/profil" role="link" tabindex="0">
      <p class="acc-alerte-titre">Numéro WhatsApp à renseigner</p>
      <p class="acc-alerte-texte">
        En tant que ${data.role === "admin" ? "administrateur" : "comptable"}, vous êtes un agent d'assistance :
        les membres doivent pouvoir vous joindre sur WhatsApp. Touchez ici pour compléter votre profil.
      </p>
    </div>`;
}

function dateDuJourLongue() {
  const texte = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

export async function ecranAccueil(conteneur) {
  const { data: session } = await supabase.auth.getUser();
  const nom = session?.user?.user_metadata?.nom || "";

  const enTete = `
    <h2 class="titre-section">Bienvenue${nom ? ", " + echapper(nom) : ""}</h2>
    <hr class="trait-or" />
    <p class="acc-date">${dateDuJourLongue()}</p>
  `;

  conteneur.innerHTML = enTete + squeletteAccueil();

  const moiId = await idProfilCourant();

  const [
    { data: capital },
    tontine,
    { count: membresActifs },
    { data: dernieresPublications },
    { data: notifications },
    epargne,
    rappel,
    role,
    adherentCotisation,
    participantTontine,
  ] = await Promise.all([
    supabase.from("capital_cotisation").select("total").maybeSingle(),
    chargerProchainsBeneficiaires(),
    supabase.from("profils").select("id", { count: "exact", head: true }).eq("actif", true),
    supabase.from("publications").select("id, texte, cree_le").order("cree_le", { ascending: false }).limit(3),
    supabase.from("notifications").select("texte, cree_le").order("cree_le", { ascending: false }).limit(6),
    chargerMonEpargne(moiId),
    rappelWhatsapp(moiId),
    chargerRole(moiId),
    suisInscritDans("cotisation_adhesions", moiId),
    suisInscritDans("tontine_participants", moiId),
  ]);

  // L'admin et le comptable voient tout ; un membre ne voit le capital que s'il a adhéré
  // à une cotisation, et le prochain bénéficiaire que s'il participe à une tontine.
  const gereArgent = ["admin", "comptable"].includes(role);
  const voirCapital = gereArgent || adherentCotisation !== false;
  const voirBeneficiaire = gereArgent || participantTontine !== false;

  const cycles = tontine.cycles;
  const noteTontine = !cycles.length
    ? "Aucun cycle en cours"
    : cycles.length === 1
      ? cycles[0].nom
      : "Plusieurs cycles ouverts";

  const noteEpargne = !epargne.nombre
    ? "Aucun compte ouvert"
    : `${epargne.nombre} compte${epargne.nombre > 1 ? "s" : ""} d'épargne`;

  const tuiles = [
    {
      libelle: "Membres actifs",
      valeur: String(membresActifs || 0),
      compter: membresActifs || 0,
      note: "Dans l'association",
      icone: "membres",
      aller: "membres/annuaire",
    },
    ...(voirCapital
      ? [
          {
            libelle: "Capital cotisation",
            valeur: formaterMontant(capital?.total),
            compter: Number(capital?.total || 0),
            suffixe: " FCFA",
            note: "Fonds commun",
            icone: "cotisation",
            aller: "cotisation/suivi",
          },
        ]
      : []),
    {
      libelle: "Mon épargne",
      valeur: formaterMontant(epargne.total),
      compter: epargne.total,
      suffixe: " FCFA",
      note: noteEpargne,
      icone: "epargne",
      aller: "epargne/comptes",
    },
    {
      libelle: "Tontine",
      valeur: cycles.length ? `${cycles.length} en cours` : "Aucun cycle",
      note: noteTontine,
      icone: "tontine",
      aller: "tontine/suivi",
    },
  ];

  conteneur.innerHTML = `
    ${enTete}
    ${rappel}
    <div class="acc-tuiles">${tuiles.map((t, i) => tuile({ ...t, indice: i })).join("")}</div>
    <div class="acc-panneaux">
      ${voirBeneficiaire ? blocBeneficiaire(tontine) : ""}
      ${blocActivites(notifications || [])}
      ${blocPublications(dernieresPublications || [])}
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
  animerCompteurs(conteneur);
                                                }
