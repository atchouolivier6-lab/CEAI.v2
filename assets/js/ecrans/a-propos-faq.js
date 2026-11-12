// =========================================================
// CEAI — Onglet "FAQ" de la page À propos
// Pour modifier une réponse, changer le texte ci-dessous.
// Pour ajouter une question : copier une ligne { categorie, question, reponse }.
// =========================================================

const FAQ = [
  // ----- Découvrir CEAI -----
  {
    categorie: "Découvrir CEAI",
    question: "Qu'est-ce que CEAI ?",
    reponse:
      "CEAI, Connaissance Entre Amis Intimes, est une association fondée par cinq amis. Elle propose quatre activités : la cotisation, la tontine, l'épargne et le service de prêt. Sa devise : Engagement, Rigueur, Amitié.",
  },
  {
    categorie: "Découvrir CEAI",
    question: "Comment créer mon compte ?",
    reponse:
      "Sur la page de connexion, touchez « S'inscrire », puis renseignez votre nom complet, votre email et un mot de passe d'au moins 8 caractères. Un email de confirmation vous est envoyé : cliquez sur le lien reçu avant de vous connecter.",
  },
  {
    categorie: "Découvrir CEAI",
    question: "Comment installer l'application sur mon téléphone ?",
    reponse:
      "Ouvrez le menu et touchez « Installer l'application » (ce lien existe aussi sur la page de connexion). Cela fonctionne sur téléphone et sur ordinateur, depuis la plupart des navigateurs. Sur iPhone, ouvrez le site dans Safari, touchez Partager, puis « Sur l'écran d'accueil ».",
  },
  {
    categorie: "Découvrir CEAI",
    question: "Comment passer du mode clair au mode sombre ?",
    reponse: "Touchez l'icône en forme de soleil, en haut de l'écran, à côté de la cloche. Votre choix est mémorisé sur cet appareil.",
  },
  {
    categorie: "Découvrir CEAI",
    question: "Qui peut voir mes informations ?",
    reponse:
      "Chacun ne voit que ce qui le concerne. Le capital de la cotisation n'apparaît qu'aux adhérents, le prochain bénéficiaire de la tontine qu'aux participants. Votre épargne et vos prêts ne sont visibles que de vous et des agents (administrateurs et comptable). Vos notes personnelles ne sont visibles que de vous.",
  },

  // ----- Cotisation -----
  {
    categorie: "Cotisation",
    question: "Comment fonctionne la cotisation ?",
    reponse:
      "Un administrateur ouvre une session de cotisation (plusieurs peuvent être ouvertes en même temps). Vous adhérez à la session de votre choix et vous versez avant la date limite annoncée. Un agent valide votre versement. À la fin, un bilan est renseigné et la session est clôturée, puis archivée.",
  },
  {
    categorie: "Cotisation",
    question: "Comment adhérer et faire mon versement ?",
    reponse:
      "Dans le menu Cotisation, touchez « Adhérer à la cotisation » et choisissez la session, puis « Faire mon versement ». Votre versement reste « en attente » jusqu'à sa validation par un agent. Vous suivez tout dans « Suivi de mes cotisations ».",
  },
  {
    categorie: "Cotisation",
    question: "Que se passe-t-il si je verse après la date limite ?",
    reponse:
      "Une pénalité de retard s'ajoute automatiquement à votre versement : actuellement 25 % du montant à verser pour la session. La date limite est affichée sur la carte de la session.",
  },
  {
    categorie: "Cotisation",
    question: "Où voir ce qui a été fait avec l'argent collecté ?",
    reponse:
      "Dans « Sessions clôturées » (menu Cotisation), réservé aux adhérents de la session. Chaque session clôturée présente son bilan : dépenses effectuées, remboursements de prêts, réalisations. Vous pouvez ouvrir la fiche de clôture et la télécharger en PDF.",
  },
  {
    categorie: "Cotisation",
    question: "À quoi sert le lien d'invitation d'une session ?",
    reponse:
      "Chaque session ouverte a son propre lien, que vous pouvez partager sur WhatsApp ou ailleurs. Une personne déjà inscrite arrive directement sur la session pour adhérer ; sans compte, elle doit d'abord s'inscrire.",
  },

  // ----- Tontine -----
  {
    categorie: "Tontine",
    question: "Comment fonctionne la tontine ?",
    reponse:
      "Un administrateur ouvre un cycle de tontine. Les participants versent chacun le montant mensuel du cycle, et reçoivent la cagnotte à tour de rôle, selon l'ordre de passage. À la fin, le bilan est renseigné et le cycle est clôturé, puis archivé.",
  },
  {
    categorie: "Tontine",
    question: "Comment est décidé l'ordre de passage ?",
    reponse:
      "Par un tirage au sort réalisé par un administrateur, une seule fois par cycle. Il est définitif : il reste valable jusqu'à la clôture du cycle, même si des participants sont ajoutés ensuite.",
  },
  {
    categorie: "Tontine",
    question: "Comment savoir qui est le prochain bénéficiaire ?",
    reponse:
      "Sur l'accueil, le bloc « Prochain bénéficiaire » l'indique, avec sa position dans le cycle. Il est visible des participants. Le détail de votre cycle est dans « Suivi de mon cycle ».",
  },
  {
    categorie: "Tontine",
    question: "Que se passe-t-il si je verse en retard à la tontine ?",
    reponse:
      "Comme pour la cotisation, une date limite des versements est annoncée sur la carte du cycle. Après cette date, une pénalité de retard (actuellement 25 % du montant à verser) s'ajoute à votre versement.",
  },

  // ----- Épargne -----
  {
    categorie: "Épargne",
    question: "Comment fonctionne l'épargne ?",
    reponse:
      "L'épargne est personnelle : vous ouvrez votre compte d'épargne, choisissez son type (journalière, mensuelle...) et votre montant de base, libre à partir de 100 F. Vos versements sont validés par l'équipe comptable, qui garde l'argent épargné pour vous.",
  },
  {
    categorie: "Épargne",
    question: "Quand puis-je retirer mon épargne ?",
    reponse:
      "Une fois le seuil atteint. Le seuil est égal à 11 fois votre montant de base : par exemple, avec une base de 500 F, le seuil est de 5 500 F. Avant d'atteindre ce seuil, le retrait n'est pas possible.",
  },
  {
    categorie: "Épargne",
    question: "Quelle part revient à l'association ?",
    reponse:
      "La onzième part de votre épargne revient à l'association : c'est son bénéfice et ses frais de réseau. Exemple : avec une base de 500 F et 5 500 F épargnés, vous retirez 5 000 F et 500 F reviennent à l'association. Si vous épargnez au-delà du seuil, cette part reste proportionnelle.",
  },
  {
    categorie: "Épargne",
    question: "Puis-je retirer seulement une partie ?",
    reponse:
      "Non, le retrait vide entièrement le compte. Ensuite, vous pouvez recommencer sur le même compte ou en ouvrir un autre.",
  },
  {
    categorie: "Épargne",
    question: "Comment demander un retrait ?",
    reponse:
      "Faites la demande depuis votre compte, dans « Mon épargne », et prévenez un agent avec le bouton « Discuter avec un agent » de l'accueil. L'équipe comptable valide ensuite le retrait.",
  },

  // ----- Service de prêt -----
  {
    categorie: "Service de prêt",
    question: "Comment demander un prêt ?",
    reponse:
      "Menu « Demande de prêt », puis « Nouvelle demande ». Indiquez le montant (minimum 5 000 FCFA), la date du prêt (aujourd'hui, ou une date passée si vous l'avez déjà reçu), et si vous le souhaitez le motif et la durée. Un agent accepte ou refuse. Vous suivez la réponse dans « Mes demandes ».",
  },
  {
    categorie: "Service de prêt",
    question: "Comment sont calculées les pénalités ?",
    reponse:
      "Actuellement 10 % par mois, comptés jour par jour à partir de la date du prêt (30 jours correspondent à 10 %). Le reste dû, avec la pénalité, est affiché sur chaque prêt en cours.",
  },
  {
    categorie: "Service de prêt",
    question: "Comment rembourser un prêt ?",
    reponse:
      "Dans « Mes demandes », sur le prêt concerné, indiquez le montant et la date de votre remboursement, puis touchez « Déclarer ». Un agent le valide. Quand tout est remboursé, un agent marque le prêt comme soldé.",
  },
  {
    categorie: "Service de prêt",
    question: "Quels documents puis-je obtenir ?",
    reponse:
      "Une fiche de prêt est disponible dès que votre demande est acceptée, et une fiche de remboursement quand le prêt est soldé. Vous les consultez et les téléchargez en PDF depuis « Mes demandes ».",
  },

  // ----- Espace membres -----
  {
    categorie: "Espace Membres",
    question: "Comment contacter un agent ?",
    reponse:
      "Sur l'accueil, touchez le bouton rond « Discuter avec un agent ». Les agents sont les administrateurs et le comptable : vous pouvez discuter sur le site ou les joindre sur WhatsApp.",
  },
  {
    categorie: "Espace Membres",
    question: "Qui sont les administrateurs et le comptable ?",
    reponse:
      "Les administrateurs gèrent le site et les membres. Le comptable, un seul à la fois, est choisi parmi les administrateurs par vote des autres : il gère l'argent (validation des versements, prêts, remboursements et bilans).",
  },
  {
    categorie: "Espace Membres",
    question: "Comment fonctionnent les notifications ?",
    reponse:
      "La cloche, en haut de l'écran, regroupe les annonces de l'association et les informations qui vous concernent. Les informations liées aux prêts et à l'épargne sont privées : seuls vous et les agents les voient.",
  },
  {
    categorie: "Espace Membres",
    question: "À quoi sert « Mes notes » ?",
    reponse:
      "C'est un bloc-notes personnel et privé, dans le menu Espace Membres. Vous seul y avez accès. Vos notes s'enregistrent automatiquement et vous pouvez en épingler en haut de la liste.",
  },
  {
    categorie: "Espace Membres",
    question: "Puis-je échanger avec les autres membres ?",
    reponse:
      "Oui. La messagerie permet d'écrire, d'envoyer des photos et des messages vocaux. Les publications permettent de réagir et de commenter. L'annuaire liste les membres de l'association.",
  },

  // ----- Aide et sécurité -----
  {
    categorie: "Aide et sécurité",
    question: "Le paiement en ligne est-il disponible ?",
    reponse:
      "Pas encore. Pour l'instant, vous déclarez votre versement sur le site, et un agent le valide après vérification. Le paiement en ligne sera ajouté plus tard.",
  },
  {
    categorie: "Aide et sécurité",
    question: "Pourquoi l'espace Administration demande-t-il un code ?",
    reponse:
      "C'est une protection supplémentaire pour les agents. Chacun crée son code personnel de 4 à 6 chiffres à sa première ouverture. Il est redemandé quand on quitte l'application ou qu'on éteint l'écran du téléphone. Après 5 erreurs, la saisie est bloquée 5 minutes.",
  },
  {
    categorie: "Aide et sécurité",
    question: "Le site ne s'affiche pas, que faire ?",
    reponse:
      "Vérifiez votre connexion internet, puis touchez « Réessayer » si le bouton apparaît. Sinon, fermez complètement l'application et rouvrez-la. Si le problème continue, contactez un agent.",
  },
];

// ---------------------------------------------------------
// Affichage
// ---------------------------------------------------------
function echapper(texte) {
  return String(texte ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Compare sans tenir compte des accents ni des majuscules
function simplifier(texte) {
  return String(texte).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const CSS = `
.faq-item summary::-webkit-details-marker { display:none; }
.faq-item summary { list-style:none; }
.faq-fleche { flex:none; color:var(--texte-secondaire); font-size:12px; transition:transform .25s ease; }
.faq-item[open] .faq-fleche { transform:rotate(180deg); }
.faq-item[open] > .faq-reponse { animation:faq-ouvre .3s ease-out; }
@keyframes faq-ouvre { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce) { .faq-item[open] > .faq-reponse { animation:none; } .faq-fleche { transition:none; } }
`;

function injecterStyle() {
  if (document.getElementById("faq-style")) return;
  const style = document.createElement("style");
  style.id = "faq-style";
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function afficherFaq(zone) {
  injecterStyle();

  zone.innerHTML = `
    <input id="faq-recherche" type="search" placeholder="Rechercher une question"
           style="width:100%; box-sizing:border-box; padding:11px 12px; margin-bottom:6px; font-size:14px; border-radius:10px;
                  border:1px solid var(--bordure); background:var(--fond-carte); color:var(--texte)" />
    <div id="faq-liste"></div>
    <div class="carte" style="margin-top:22px; text-align:center">
      <p style="margin:0; font-weight:500">Vous ne trouvez pas votre réponse ?</p>
      <p style="margin:6px 0 14px; font-size:13px; color:var(--texte-secondaire)">Un agent peut vous répondre : sur l'accueil, touchez le bouton rond « Discuter avec un agent ».</p>
      <button id="faq-agent" class="bouton bouton-or">Aller à l'accueil</button>
    </div>
  `;

  const liste = zone.querySelector("#faq-liste");

  const dessiner = (filtre = "") => {
    const terme = simplifier(filtre.trim());
    const visibles = FAQ.filter((q) => !terme || simplifier(q.question + " " + q.reponse).includes(terme));
    if (!visibles.length) {
      liste.innerHTML = `<p style="margin:16px 0; color:var(--texte-secondaire)">Aucun résultat. Essayez un autre mot, ou demandez à un agent.</p>`;
      return;
    }
    let categorieCourante = "";
    liste.innerHTML = visibles
      .map((q) => {
        const titre =
          q.categorie !== categorieCourante ? `<h3 class="acc-bloc-titre" style="margin:20px 0 10px">${echapper(q.categorie)}</h3>` : "";
        categorieCourante = q.categorie;
        return `${titre}
        <details class="carte faq-item" style="padding:0" ${terme ? "open" : ""}>
          <summary style="padding:15px 16px; cursor:pointer; font-weight:500; display:flex; justify-content:space-between; align-items:center; gap:12px">
            <span>${echapper(q.question)}</span>
            <span class="faq-fleche">▾</span>
          </summary>
          <p class="faq-reponse" style="padding:0 16px 16px; margin:0; color:var(--texte-secondaire); line-height:1.6">${echapper(q.reponse)}</p>
        </details>`;
      })
      .join("");
  };

  dessiner();
  zone.querySelector("#faq-recherche").addEventListener("input", (evenement) => dessiner(evenement.target.value));
  zone.querySelector("#faq-agent").addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("ceai:naviguer", { detail: "accueil" }));
  });
    }
