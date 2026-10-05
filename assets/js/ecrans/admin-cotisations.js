// =========================================================
// CEAI — Écran admin "Gestion des cotisations"
// Accès : admin (tout) + comptable (versements en attente,
// remplissage du bilan). Seul l'admin ouvre une session ou la
// clôture, et la clôture n'est possible que si le bilan a déjà
// été rempli (par le comptable ou par l'admin lui-même).
//
// Chaque session ouverte est une carte à thème (choisi par l'admin
// à l'ouverture, modifiable ensuite). On touche la carte pour
// déplier ses actions.
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import { notifier } from "../notifier.js";
import {
  carteOuverture,
  selecteurTheme,
  activerSelecteurTheme,
  lireTheme,
  echapper,
} from "./composants-tableau.js";

// Sessions dont le corps est déplié (mémorisé pendant les rafraîchissements)
const sessionsDepliees = new Set();

function formaterDate(dateIso) {
  return dateIso ? new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

async function obtenirRole() {
  const moiId = await idProfilCourant();
  const { data } = await supabase.from("profils").select("role").eq("id", moiId).single();
  return data?.role || "membre";
}

export async function ecranAdminCotisations(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Gestion des cotisations</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;
  await rafraichir(conteneur);
}

async function rafraichir(conteneur) {
  const moiId = await idProfilCourant();
  const role = await obtenirRole();
  const estAdmin = role === "admin";
  const peutGererArgent = role === "admin" || role === "comptable";

  const [{ data: sessions }, { data: versements }, { data: adhesions }, { data: membres }] = await Promise.all([
    supabase
      .from("cotisation_sessions")
      .select("id, nom, statut, ouverte_le, cloturee_le, montant_indicatif, theme")
      .eq("statut", "ouverte")
      .order("ouverte_le", { ascending: false }),
    supabase.from("cotisation_versements").select("id, session_id, membre_id, montant, date_versement, statut"),
    supabase.from("cotisation_adhesions").select("session_id, membre_id").not("session_id", "is", null),
    supabase.from("profils").select("id, nom").eq("actif", true),
  ]);

  const idsSessions = (sessions || []).map((s) => s.id);
  const { data: bilans } = idsSessions.length
    ? await supabase.from("cotisation_bilans").select("*").in("session_id", idsSessions)
    : { data: [] };
  const bilanParSession = Object.fromEntries((bilans || []).map((b) => [b.session_id, b]));

  const nomParId = Object.fromEntries((membres || []).map((m) => [m.id, m.nom]));

  conteneur.innerHTML = `
    <h2 class="titre-section">Gestion des cotisations</h2>
    <hr class="trait-or" />
    ${estAdmin ? `<button id="bouton-nouvelle-session" class="bouton bouton-or" style="margin-bottom:16px">+ Ouvrir une nouvelle session</button>` : ""}
    <div id="formulaire-session-conteneur"></div>
    <div id="liste-sessions"></div>
  `;

  if (estAdmin) {
    document.getElementById("bouton-nouvelle-session").addEventListener("click", () => {
      const zone = document.getElementById("formulaire-session-conteneur");
      zone.innerHTML = `
        <form id="formulaire-ouverture-session" class="carte" style="display:flex; flex-direction:column; gap:14px">
          <label class="champ">
            <span>Nom de la session (ex: Janvier 2026)</span>
            <input type="text" name="nom" required />
          </label>
          <label class="champ">
            <span>Montant indicatif (FCFA, facultatif)</span>
            <input type="number" name="montant_indicatif" min="1" />
          </label>
          ${selecteurTheme()}
          <p id="erreur-ouverture" style="color:var(--danger); font-size:13px; margin:0" hidden></p>
          <button type="submit" class="bouton bouton-or">Ouvrir la session</button>
        </form>
      `;
      const formulaire = document.getElementById("formulaire-ouverture-session");
      activerSelecteurTheme(formulaire);

      formulaire.addEventListener("submit", async (evenement) => {
        evenement.preventDefault();
        const donnees = new FormData(evenement.target);
        const nom = donnees.get("nom").trim();
        const montantIndicatif = donnees.get("montant_indicatif");
        const erreur = document.getElementById("erreur-ouverture");

        const { error } = await supabase.from("cotisation_sessions").insert({
          nom,
          ouverte_par: moiId,
          montant_indicatif: montantIndicatif ? Number(montantIndicatif) : null,
          theme: lireTheme(formulaire),
        });
        if (error) {
          erreur.textContent = "Erreur : " + error.message;
          erreur.hidden = false;
          return;
        }
        notifier(`Nouvelle session de cotisation ouverte : ${nom}`);
        rafraichir(conteneur);
      });
    });
  }

  const listeSessions = document.getElementById("liste-sessions");
  if (!sessions || !sessions.length) {
    listeSessions.innerHTML = `<p style="color:var(--texte-secondaire)">Aucune session ouverte pour le moment. Les sessions clôturées se trouvent dans les Archives.</p>`;
    return;
  }

  listeSessions.innerHTML = sessions
    .map((s) => {
      const versementsSession = (versements || []).filter((v) => v.session_id === s.id);
      const totalValide = versementsSession.filter((v) => v.statut === "valide").reduce((sum, v) => sum + Number(v.montant), 0);
      const enAttente = versementsSession.filter((v) => v.statut === "en_attente");
      const adherentsSession = (adhesions || []).filter((a) => a.session_id === s.id);
      const bilan = bilanParSession[s.id];
      const deplie = sessionsDepliees.has(s.id) || sessions.length === 1;

      return `
      <div class="ouverture-admin">
        ${carteOuverture({
          nom: s.nom,
          theme: s.theme,
          badge: "Ouverte",
          details: [
            `Ouverte le ${formaterDate(s.ouverte_le)}${s.montant_indicatif ? " · Indicatif : " + Number(s.montant_indicatif).toLocaleString("fr-FR") + " FCFA" : ""}`,
            `${totalValide.toLocaleString("fr-FR")} FCFA validés · ${adherentsSession.length} adhérent(s) · ${enAttente.length} versement(s) en attente`,
          ],
          attributs: `data-basculer-corps="${s.id}" role="button" tabindex="0"`,
          classes: "ouverture-cliquable",
        })}

        <div class="ouverture-corps" data-corps="${s.id}" ${deplie ? "" : "hidden"}>
          <div style="display:flex; gap:8px; flex-wrap:wrap">
            <button data-basculer-adherents="${s.id}" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); padding:6px 12px; font-size:13px">
              Adhérents (${adherentsSession.length})
            </button>
            <button data-basculer-liste="${s.id}" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); padding:6px 12px; font-size:13px">
              Versements en attente (${enAttente.length})
            </button>
            ${
              peutGererArgent
                ? `<button data-ouvrir-bilan="${s.id}" class="bouton" style="background:var(--fond-carte-claire); color:var(--or-texte); padding:6px 12px; font-size:13px">
                     ${bilan ? "Modifier le bilan" : "Remplir le bilan"}
                   </button>`
                : ""
            }
            ${
              estAdmin
                ? `<button data-ouvrir-theme="${s.id}" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); padding:6px 12px; font-size:13px">Changer le thème</button>`
                : ""
            }
            ${
              estAdmin
                ? bilan
                  ? `<button data-cloturer="${s.id}" data-nom="${echapper(s.nom)}" class="bouton" style="background:var(--danger); color:#fff; padding:6px 12px; font-size:13px">Clôturer</button>`
                  : `<span style="font-size:12px; color:var(--texte-secondaire); align-self:center">En attente du bilan avant de pouvoir clôturer</span>`
                : ""
            }
            ${
              estAdmin
                ? `<button data-supprimer="${s.id}" data-nom="${echapper(s.nom)}" class="bouton" style="background:var(--fond-carte-claire); color:var(--danger); padding:6px 12px; font-size:13px">Supprimer</button>`
                : ""
            }
          </div>

          <div data-liste-adherents="${s.id}" hidden style="margin-top:12px; display:flex; flex-direction:column; gap:6px">
            ${
              adherentsSession.length
                ? adherentsSession.map((a) => `<p style="margin:0; font-size:13px; padding:6px 0; border-top:1px solid var(--bordure)">${echapper(nomParId[a.membre_id] || "—")}</p>`).join("")
                : `<p style="color:var(--texte-secondaire); font-size:13px">Aucun adhérent pour le moment.</p>`
            }
          </div>

          <div data-liste-versements="${s.id}" hidden style="margin-top:12px; display:flex; flex-direction:column; gap:8px">
            ${
              enAttente.length
                ? enAttente.map((v) => gabaritVersementEnAttente(v, nomParId)).join("")
                : `<p style="color:var(--texte-secondaire); font-size:13px">Aucun versement en attente.</p>`
            }
          </div>

          ${
            estAdmin
              ? `<div data-formulaire-theme="${s.id}" hidden style="margin-top:16px; padding-top:16px; border-top:1px solid var(--bordure)">
                   <form data-formulaire-theme-session="${s.id}" style="display:flex; flex-direction:column; gap:12px">
                     ${selecteurTheme(s.theme)}
                     <p class="erreur-theme" style="color:var(--danger); font-size:13px; margin:0" hidden></p>
                     <button type="submit" class="bouton bouton-or">Enregistrer le thème</button>
                   </form>
                 </div>`
              : ""
          }

          ${
            peutGererArgent
              ? `<div data-formulaire-bilan="${s.id}" hidden style="margin-top:16px; padding-top:16px; border-top:1px solid var(--bordure)">
                   ${gabaritFormulaireBilan(s.id, s.nom, bilan)}
                 </div>`
              : ""
          }
        </div>
      </div>
    `;
    })
    .join("");

  // --- Déplier / replier une session en touchant sa carte
  listeSessions.querySelectorAll("[data-basculer-corps]").forEach((carte) => {
    const basculer = () => {
      const id = carte.dataset.basculerCorps;
      const corps = listeSessions.querySelector(`[data-corps="${id}"]`);
      corps.hidden = !corps.hidden;
      if (corps.hidden) sessionsDepliees.delete(id);
      else sessionsDepliees.add(id);
    };
    carte.addEventListener("click", basculer);
    carte.addEventListener("keydown", (evenement) => {
      if (evenement.key === "Enter" || evenement.key === " ") {
        evenement.preventDefault();
        basculer();
      }
    });
  });

  listeSessions.querySelectorAll("[data-basculer-adherents]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const zone = listeSessions.querySelector(`[data-liste-adherents="${bouton.dataset.basculerAdherents}"]`);
      zone.hidden = !zone.hidden;
    });
  });

  listeSessions.querySelectorAll("[data-basculer-liste]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const zone = listeSessions.querySelector(`[data-liste-versements="${bouton.dataset.basculerListe}"]`);
      zone.hidden = !zone.hidden;
    });
  });

  listeSessions.querySelectorAll("[data-ouvrir-bilan]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const zone = listeSessions.querySelector(`[data-formulaire-bilan="${bouton.dataset.ouvrirBilan}"]`);
      zone.hidden = !zone.hidden;
      if (!zone.hidden) zone.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });

  listeSessions.querySelectorAll("[data-annuler-bilan]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      listeSessions.querySelector(`[data-formulaire-bilan="${bouton.dataset.annulerBilan}"]`).hidden = true;
    });
  });

  // --- Changer le thème d'une session (admin)
  listeSessions.querySelectorAll("[data-ouvrir-theme]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const zone = listeSessions.querySelector(`[data-formulaire-theme="${bouton.dataset.ouvrirTheme}"]`);
      zone.hidden = !zone.hidden;
    });
  });

  listeSessions.querySelectorAll("[data-formulaire-theme-session]").forEach((formulaire) => {
    activerSelecteurTheme(formulaire);
    formulaire.addEventListener("submit", async (evenement) => {
      evenement.preventDefault();
      const erreur = formulaire.querySelector(".erreur-theme");
      erreur.hidden = true;

      const { data: modifiee, error } = await supabase
        .from("cotisation_sessions")
        .update({ theme: lireTheme(formulaire) })
        .eq("id", formulaire.dataset.formulaireThemeSession)
        .select();

      if (error || !modifiee || !modifiee.length) {
        erreur.textContent = "Le thème n'a pas pu être enregistré : " + (error?.message || "droits insuffisants ?");
        erreur.hidden = false;
        return;
      }
      rafraichir(conteneur);
    });
  });

  listeSessions.querySelectorAll("[data-formulaire-bilan-cotisation]").forEach((formulaire) => {
    formulaire.addEventListener("submit", async (evenement) => {
      evenement.preventDefault();
      const sessionId = formulaire.dataset.formulaireBilanCotisation;
      const donnees = new FormData(evenement.target);
      const erreur = formulaire.querySelector(".erreur-bilan");
      erreur.hidden = true;

      const { error } = await supabase.from("cotisation_bilans").upsert(
        {
          session_id: sessionId,
          depenses_montant: Number(donnees.get("depenses_montant")) || 0,
          depenses_description: donnees.get("depenses_description")?.trim() || null,
          remboursements_montant: Number(donnees.get("remboursements_montant")) || 0,
          remboursements_description: donnees.get("remboursements_description")?.trim() || null,
          realisations_montant: Number(donnees.get("realisations_montant")) || 0,
          realisations_description: donnees.get("realisations_description")?.trim() || null,
          rempli_par: moiId,
          rempli_le: new Date().toISOString(),
        },
        { onConflict: "session_id" }
      );

      if (error) {
        erreur.textContent = "Erreur : " + error.message;
        erreur.hidden = false;
        return;
      }

      notifier(`Le bilan de la session a été enregistré.`);
      rafraichir(conteneur);
    });
  });

  listeSessions.querySelectorAll("[data-cloturer]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      if (!window.confirm(`Clôturer "${bouton.dataset.nom}" ? Cette action est définitive.`)) return;

      const { data: sessionCloturee, error: erreurCloture } = await supabase
        .from("cotisation_sessions")
        .update({ statut: "cloturee", cloturee_par: moiId, cloturee_le: new Date().toISOString() })
        .eq("id", bouton.dataset.cloturer)
        .select();

      if (erreurCloture || !sessionCloturee || !sessionCloturee.length) {
        alert("La clôture a échoué : " + (erreurCloture?.message || "aucune ligne modifiée (droits insuffisants ?)"));
        return;
      }

      notifier(`La session de cotisation "${bouton.dataset.nom}" a été clôturée.`);
      rafraichir(conteneur);
    });
  });

  listeSessions.querySelectorAll("[data-supprimer]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      if (!window.confirm(`Supprimer définitivement "${bouton.dataset.nom}" et tous ses versements ? Cette action est irréversible.`)) return;
      const { error } = await supabase.from("cotisation_sessions").delete().eq("id", bouton.dataset.supprimer);
      if (error) {
        alert("Erreur : " + error.message);
        return;
      }
      rafraichir(conteneur);
    });
  });

  listeSessions.querySelectorAll("[data-valider]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      await supabase
        .from("cotisation_versements")
        .update({ statut: "valide", valide_par: moiId, valide_le: new Date().toISOString() })
        .eq("id", bouton.dataset.valider);
      rafraichir(conteneur);
    });
  });

  listeSessions.querySelectorAll("[data-rejeter]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      await supabase
        .from("cotisation_versements")
        .update({ statut: "rejete", valide_par: moiId, valide_le: new Date().toISOString() })
        .eq("id", bouton.dataset.rejeter);
      rafraichir(conteneur);
    });
  });
}

function gabaritFormulaireBilan(sessionId, nomSession, bilan) {
  return `
    <form data-formulaire-bilan-cotisation="${sessionId}" style="display:flex; flex-direction:column; gap:14px">
      <p style="margin:0; font-weight:500">Bilan — ${echapper(nomSession)}</p>
      <p style="margin:0; font-size:12px; color:var(--texte-secondaire)">
        Ce bilan sera visible par tous les membres dans les Archives une fois la session clôturée. Laissez à 0 ce qui ne s'applique pas.
      </p>

      <div>
        <p style="margin:0 0 6px; font-size:13px; font-weight:500">Dépenses effectuées</p>
        <input type="number" name="depenses_montant" min="0" step="1" placeholder="Montant (FCFA)" value="${bilan?.depenses_montant || 0}"
               style="width:100%; background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit); padding:9px 10px; color:var(--texte); font-size:13px" />
        <textarea name="depenses_description" rows="2" placeholder="Détail des dépenses (facultatif)"
                  style="width:100%; margin-top:6px; background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit); padding:9px 10px; color:var(--texte); font-family:inherit; font-size:13px; resize:vertical">${echapper(bilan?.depenses_description || "")}</textarea>
      </div>

      <div>
        <p style="margin:0 0 6px; font-size:13px; font-weight:500">Remboursements de prêts effectués avec cette cotisation</p>
        <input type="number" name="remboursements_montant" min="0" step="1" placeholder="Montant (FCFA)" value="${bilan?.remboursements_montant || 0}"
               style="width:100%; background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit); padding:9px 10px; color:var(--texte); font-size:13px" />
        <textarea name="remboursements_description" rows="2" placeholder="Détail (facultatif)"
                  style="width:100%; margin-top:6px; background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit); padding:9px 10px; color:var(--texte); font-family:inherit; font-size:13px; resize:vertical">${echapper(bilan?.remboursements_description || "")}</textarea>
      </div>

      <div>
        <p style="margin:0 0 6px; font-size:13px; font-weight:500">Réalisations faites avec cette cotisation</p>
        <input type="number" name="realisations_montant" min="0" step="1" placeholder="Montant (FCFA)" value="${bilan?.realisations_montant || 0}"
               style="width:100%; background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit); padding:9px 10px; color:var(--texte); font-size:13px" />
        <textarea name="realisations_description" rows="2" placeholder="Détail (facultatif)"
                                  style="width:100%; margin-top:6px; background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit); padding:9px 10px; color:var(--texte); font-family:inherit; font-size:13px; resize:vertical">${echapper(bilan?.realisations_description || "")}</textarea>
      </div>
 
      <p class="erreur-bilan" style="color:var(--danger); font-size:13px; margin:0" hidden></p>
 
      <div style="display:flex; gap:8px">
        <button type="submit" class="bouton bouton-or" style="flex:1">Enregistrer le bilan</button>
        <button type="button" data-annuler-bilan="${sessionId}" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte)">Fermer</button>
        </div>
    </form>
  `;
}
 
function gabaritVersementEnAttente(v, nomParId) {
  return `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 0; border-top:1px solid var(--bordure)">
      <div>
        <p style="margin:0; font-weight:500; font-size:14px">${echapper(nomParId[v.membre_id] || "—")}</p>
        <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">
          ${Number(v.montant).toLocaleString("fr-FR")} FCFA · ${new Date(v.date_versement).toLocaleDateString("fr-FR")}
        </p>
        </div>
      <div style="display:flex; gap:6px">
        <button data-valider="${v.id}" class="bouton" style="background:#4C9A6A; color:#fff; padding:6px 10px; font-size:12px">Valider</button>
        <button data-rejeter="${v.id}" class="bouton" style="background:var(--danger); color:#fff; padding:6px 10px; font-size:12px">Rejeter</button>
      </div>
    </div>
  `;
}
