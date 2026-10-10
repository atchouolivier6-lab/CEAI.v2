// =========================================================
// CEAI — Discussion avec un agent (dans la feuille "agents")
// Un fil = un client + un agent. Les messages arrivent en direct.
// =========================================================
import { supabase } from "./supabase-client.js";
import { echapper } from "./ecrans/composants-tableau.js";

function initiale(nom) {
  return (nom || "?").trim().charAt(0).toUpperCase();
}

function horodatage(dateIso) {
  const date = new Date(dateIso);
  const heure = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const aujourdhui = new Date().toDateString() === date.toDateString();
  return aujourdhui ? heure : `${date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · ${heure}`;
}

// Renvoie { fermer } : à appeler pour arrêter l'écoute en direct
export function ouvrirDiscussion({ conteneur, moiId, clientId, agentId, titre, sousTitre, photo, retour }) {
  conteneur.innerHTML = `
    <div class="discussion">
      <div class="discussion-entete">
        <button type="button" class="discussion-retour" aria-label="Retour à la liste">‹</button>
        <div class="agent-avatar">${photo ? `<img src="${echapper(photo)}" alt="" />` : echapper(initiale(titre))}</div>
        <div>
          <p class="agent-nom">${echapper(titre)}</p>
          <p class="agent-role">${echapper(sousTitre || "")}</p>
        </div>
      </div>
      <div class="discussion-fil" aria-live="polite"><p class="panneau-vide">Chargement…</p></div>
      <p class="discussion-erreur" hidden></p>
      <form class="discussion-saisie">
        <textarea rows="1" maxlength="2000" placeholder="Écrivez votre message…" aria-label="Votre message" required></textarea>
        <button type="submit" class="bouton bouton-or">Envoyer</button>
      </form>
    </div>
  `;

  const fil = conteneur.querySelector(".discussion-fil");
  const zoneErreur = conteneur.querySelector(".discussion-erreur");
  const formulaire = conteneur.querySelector(".discussion-saisie");
  const champ = formulaire.querySelector("textarea");
  const dejaAffiches = new Set();

  const afficherErreur = (texte) => {
    zoneErreur.textContent = texte;
    zoneErreur.hidden = !texte;
  };

  function ajouter(message) {
    if (dejaAffiches.has(message.id)) return;
    dejaAffiches.add(message.id);
    fil.querySelector(".panneau-vide")?.remove();

    const bulle = document.createElement("div");
    bulle.className = `bulle ${message.expediteur_id === moiId ? "bulle-moi" : "bulle-autre"}`;
    bulle.innerHTML = `<p class="bulle-texte">${echapper(message.texte)}</p><p class="bulle-heure">${horodatage(message.cree_le)}</p>`;
    fil.appendChild(bulle);
    fil.scrollTop = fil.scrollHeight;
  }

  async function marquerLus() {
    await supabase.rpc("agents_marquer_lus", { p_client: clientId, p_agent: agentId });
    window.dispatchEvent(new Event("ceai:agents-maj"));
  }

  // --- Chargement de l'historique
  (async () => {
    const { data, error } = await supabase
      .from("agents_messages")
      .select("id, expediteur_id, texte, cree_le")
      .eq("client_id", clientId)
      .eq("agent_id", agentId)
      .order("cree_le")
      .limit(300);

    if (error) {
      fil.innerHTML = `<p class="panneau-vide">La messagerie des agents n'est pas encore activée.</p>`;
      return;
    }
    fil.innerHTML = data.length ? "" : `<p class="panneau-vide">Aucun message pour le moment. Dites bonjour !</p>`;
    data.forEach(ajouter);
    marquerLus();
  })();

  // --- Messages reçus en direct
  const canal = supabase
    .channel(`agents-fil-${clientId}-${agentId}-${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "agents_messages", filter: `client_id=eq.${clientId}` },
      ({ new: message }) => {
        if (message.agent_id !== agentId) return;
        ajouter(message);
        if (message.expediteur_id !== moiId) marquerLus();
      }
    )
    .subscribe();

  // --- Envoi
  async function envoyer() {
    const texte = champ.value.trim();
    if (!texte) return;
    afficherErreur("");

    const bouton = formulaire.querySelector("button");
    bouton.disabled = true;
    const { data, error } = await supabase
      .from("agents_messages")
      .insert({ client_id: clientId, agent_id: agentId, expediteur_id: moiId, texte })
      .select("id, expediteur_id, texte, cree_le")
      .single();
    bouton.disabled = false;

    if (error) {
      afficherErreur("Le message n'a pas pu être envoyé. Réessayez.");
      return;
    }
    champ.value = "";
    ajouter(data);
    champ.focus();
  }

  formulaire.addEventListener("submit", (evenement) => {
    evenement.preventDefault();
    envoyer();
  });
  // Entrée envoie, Maj + Entrée passe à la ligne
  champ.addEventListener("keydown", (evenement) => {
    if (evenement.key === "Enter" && !evenement.shiftKey) {
      evenement.preventDefault();
      envoyer();
    }
  });

  const fermer = () => supabase.removeChannel(canal);
  conteneur.querySelector(".discussion-retour").addEventListener("click", () => {
    fermer();
    retour();
  });

  return { fermer };
}
