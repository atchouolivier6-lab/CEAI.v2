// =========================================================
// CEAI — Modèles de messages et statuts des agents
// Le message WhatsApp n'est plus une phrase vague : le membre choisit
// d'abord son sujet, et le message est préparé avec la bonne formule de
// politesse (bonjour / bonsoir), son nom, son sujet et un endroit pour
// écrire sa demande.
// =========================================================

export const SUJETS = [
  { cle: "cotisation", libelle: "Cotisation", detail: "adhésion à une session, versement ou validation" },
  { cle: "tontine", libelle: "Tontine", detail: "participation à un cycle, versement ou tour de réception" },
  { cle: "epargne", libelle: "Épargne", detail: "ouverture de compte, versement ou retrait" },
  { cle: "pret", libelle: "Prêt", detail: "demande de prêt" },
  { cle: "compte", libelle: "Mon compte", detail: "connexion, profil ou accès à la plateforme" },
  { cle: "autre", libelle: "Autre question", detail: "question générale" },
];

// heure : 0 à 23 (par défaut, l'heure de l'appareil du membre)
export function messageWhatsapp({ agentNom, membreNom, sujet, heure = new Date().getHours() }) {
  const salut = heure >= 18 ? "Bonsoir" : "Bonjour";
  return [
    `${salut} ${agentNom},`,
    "",
    `Je suis ${membreNom}, membre de CEAI (Connaissance Entre Amis Intimes).`,
    `Sujet : ${sujet.libelle} (${sujet.detail}).`,
    "",
    "Ma demande : ",
    "",
    "Merci d'avance pour votre aide.",
  ].join("\n");
}

// Statut affiché à côté du nom d'un agent
export function statutAgent(agent) {
  if (agent.absent) return { cle: "absent", libelle: "Absent" };
  if (agent.en_ligne) return { cle: "en-ligne", libelle: "En ligne" };
  return { cle: "hors-ligne", libelle: "Hors ligne" };
                                 }
