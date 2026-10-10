// =========================================================
// CEAI — Feuille "Discuter avec un agent"
// Les agents = tous les administrateurs et comptables actifs.
// La liste se recharge toute seule (en direct + toutes les 30 s)
// et à chaque ouverture. Pour chaque agent : discussion sur le site
// et, si son numéro est renseigné, discussion sur WhatsApp.
// Un agent voit aussi les discussions que les membres lui ont écrites.
// =========================================================
import { supabase } from "./supabase-client.js";
import { echapper, tempsRelatif } from "./ecrans/composants-tableau.js";
import { ouvrirDiscussion } from "./agents-discussion.js";

const ROLES = { admin: "Administrateur", comptable: "Comptable" };

function initiale(nom) {
  return (nom || "?").trim().charAt(0).toUpperCase();
}

function avatar(photo, nom) {
  return `<div class="agent-avatar">${photo ? `<img src="${echapper(photo)}" alt="" />` : echapper(initiale(nom))}</div>`;
}

// Numéro saisi avec "+" ou "00" : utilisé tel quel. Sans indicatif (10 chiffres ou moins) : indicatif du Bénin (229).
export function lienWhatsapp(numero, message) {
  const brut = String(numero || "").trim();
  const chiffres = brut.replace(/\D/g, "");
  if (chiffres.length < 8) return null;

  let complet = chiffres;
  if (!brut.startsWith("+")) {
    if (chiffres.startsWith("00")) complet = chiffres.slice(2);
    else if (chiffres.length <= 10) complet = "229" + chiffres;
  }
  return `https://wa.me/${complet}?text=${encodeURIComponent(message)}`;
}

async function charger() {
  const [{ data: agents, error }, { data: messages }] = await Promise.all([
    supabase.rpc("agents_liste"),
    supabase
      .from("agents_messages")
      .select("client_id, agent_id, expediteur_id, texte, lu, cree_le")
      .order("cree_le", { ascending: false })
      .limit(300),
  ]);
  return { agents: agents || [], messages: messages || [], erreur: error };
}

export async function ouvrirFeuilleAgents({ moiId }) {
  if (document.querySelector(".agents-voile")) return;

  const voile = document.createElement("div");
  voile.className = "agents-voile";
  voile.setAttribute("role", "dialog");
  voile.setAttribute("aria-modal", "true");
  voile.setAttribute("aria-label", "Discuter avec un agent");
  voile.innerHTML = `
    <div class="agents-feuille">
      <div class="agents-entete">
        <p class="agents-titre">Discuter avec un agent</p>
        <button type="button" class="agents-fermer" aria-label="Fermer">✕</button>
      </div>
      <div class="agents-corps"></div>
    </div>
  `;
  document.body.appendChild(voile);
  document.body.classList.add("agents-ouvert");

  const corps = voile.querySelector(".agents-corps");
  let discussion = null;

  // ---------- Liste des agents et des messages reçus ----------
  async function afficherListe() {
    const { agents, messages, erreur } = await charger();
    if (discussion) return; // une discussion s'est ouverte pendant le chargement

    if (erreur) {
      corps.innerHTML = `<p class="panneau-vide">La liste des agents n'est pas encore activée.</p>`;
      return;
    }

    const suisAgent = agents.some((a) => a.id === moiId);
    const autres = agents.filter((a) => a.id !== moiId);

    // Messages non lus que j'ai reçus d'un agent (je suis le client)
    const nonLusDe = (agentId) =>
      messages.filter((m) => m.client_id === moiId && m.agent_id === agentId && m.expediteur_id !== moiId && !m.lu).length;

    const lignesAgents = autres.length
      ? autres
          .map((a) => {
            const wa = lienWhatsapp(a.whatsapp, "Bonjour, j'ai besoin d'aide sur CEAI.");
            const nonLus = nonLusDe(a.id);
            return `
          <div class="agent-ligne">
            ${avatar(a.photo_url, a.nom)}
            <div class="agent-infos">
              <p class="agent-nom">${echapper(a.nom)}</p>
              <p class="agent-role">${ROLES[a.role] || "Agent"}</p>
            </div>
            <div class="agent-actions">
              <button type="button" class="bouton bouton-or agent-bouton" data-discuter="${a.id}">
                Discuter ici${nonLus ? `<span class="agent-badge">${nonLus}</span>` : ""}
              </button>
              ${wa ? `<a class="bouton agent-bouton agent-wa" href="${echapper(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
            </div>
          </div>`;
          })
          .join("")
      : `<p class="panneau-vide">Aucun autre agent disponible pour le moment.</p>`;

    // Discussions reçues (si je suis moi-même agent), regroupées par membre
    let blocRecus = "";
    let clients = [];
    if (suisAgent) {
      const parClient = new Map();
      messages
        .filter((m) => m.agent_id === moiId)
        .forEach((m) => {
          const fil = parClient.get(m.client_id) || { dernier: m, nonLus: 0 };
          if (m.expediteur_id !== moiId && !m.lu) fil.nonLus += 1;
          parClient.set(m.client_id, fil);
        });

      if (parClient.size) {
        const { data: profils } = await supabase
          .from("profils")
          .select("id, nom, photo_url")
          .in("id", [...parClient.keys()]);
        clients = profils || [];
        const par = Object.fromEntries(clients.map((p) => [p.id, p]));

        blocRecus = `
          <p class="agents-section">Messages reçus</p>
          ${[...parClient.entries()]
            .map(([clientId, fil]) => {
              const profil = par[clientId];
              return `
            <div class="agent-ligne agent-ligne-cliquable" data-recu="${clientId}" role="button" tabindex="0">
              ${avatar(profil?.photo_url, profil?.nom)}
              <div class="agent-infos">
                <p class="agent-nom">${echapper(profil?.nom || "Membre")}</p>
                <p class="agent-role">${echapper(fil.dernier.texte.slice(0, 60))} · ${tempsRelatif(fil.dernier.cree_le)}</p>
              </div>
              ${fil.nonLus ? `<span class="agent-badge agent-badge-seul">${fil.nonLus}</span>` : ""}
            </div>`;
            })
            .join("")}`;
      }
    }

    corps.innerHTML = `
      ${blocRecus}
      <p class="agents-section">${suisAgent ? "Autres agents" : "Nos agents"}</p>
      <p class="agents-aide">Les administrateurs et le comptable de l'association sont là pour vous aider.</p>
      ${lignesAgents}
    `;

    corps.querySelectorAll("[data-discuter]").forEach((bouton) => {
      bouton.addEventListener("click", () => {
        const agent = agents.find((a) => a.id === bouton.dataset.discuter);
        ouvrirFil({
          clientId: moiId,
          agentId: agent.id,
          titre: agent.nom,
          sousTitre: ROLES[agent.role] || "Agent",
          photo: agent.photo_url,
        });
      });
    });

    const ouvrirRecu = (clientId) => {
      const profil = clients.find((p) => p.id === clientId);
      ouvrirFil({ clientId, agentId: moiId, titre: profil?.nom || "Membre", sousTitre: "Membre", photo: profil?.photo_url });
    };
    corps.querySelectorAll("[data-recu]").forEach((ligne) => {
      ligne.addEventListener("click", () => ouvrirRecu(ligne.dataset.recu));
      ligne.addEventListener("keydown", (evenement) => {
        if (evenement.key === "Enter") ouvrirRecu(ligne.dataset.recu);
      });
    });
  }

  function ouvrirFil(options) {
    discussion = ouvrirDiscussion({
      conteneur: corps,
      moiId,
      ...options,
      retour: () => {
        discussion = null;
        afficherListe();
        window.dispatchEvent(new Event("ceai:agents-maj"));
      },
    });
  }

  // ---------- Mise à jour automatique de la liste ----------
  corps.innerHTML = `<p class="panneau-vide">Chargement…</p>`;
  afficherListe();

  const minuteur = setInterval(() => {
    if (!discussion) afficherListe();
  }, 30000);

  const canal = supabase
    .channel(`agents-liste-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "profils" }, () => {
      if (!discussion) afficherListe();
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "agents_messages" }, () => {
      if (!discussion) afficherListe();
    })
    .subscribe();

  // ---------- Fermeture ----------
  const fermer = () => {
    clearInterval(minuteur);
    supabase.removeChannel(canal);
    discussion?.fermer();
    voile.remove();
    document.body.classList.remove("agents-ouvert");
    document.removeEventListener("keydown", surTouche);
    window.dispatchEvent(new Event("ceai:agents-maj"));
  };
  const surTouche = (evenement) => {
    if (evenement.key === "Escape") fermer();
  };
  document.addEventListener("keydown", surTouche);

  voile.addEventListener("click", (evenement) => {
    if (evenement.target === voile) fermer();
  });
  voile.querySelector(".agents-fermer").addEventListener("click", fermer);
      }
