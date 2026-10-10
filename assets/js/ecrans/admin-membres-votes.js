// =========================================================
// CEAI — Votes de nomination (admin et comptable)
// Partie de l'écran "Gestion des membres", séparée pour rester courte.
//  - nomination d'un admin : vote à la majorité des admins
//  - nomination d'un comptable : 2 "contre" = rejeté, sinon accepté
//    une fois que tous les admins concernés ont voté
// =========================================================
import { supabase } from "../supabase-client.js";
import { notifier } from "../notifier.js";
import { echapper } from "./composants-tableau.js";

export function gabaritVote(vote, toutesLesVoix, nomParId, nombreAdmins, moiId) {
  const voixDuVote = toutesLesVoix.filter((v) => v.vote_id === vote.id);
  const pour = voixDuVote.filter((v) => v.voix).length;
  const contre = voixDuVote.filter((v) => !v.voix).length;
  const jaiDejaVote = voixDuVote.some((v) => v.admin_id === moiId);

  return `
    <div class="carte">
      <p style="margin:0; font-weight:500">${echapper(nomParId[vote.candidat_id] || "—")}</p>
      <p style="margin:4px 0 12px; font-size:12px; color:var(--texte-secondaire)">
        Proposé par ${echapper(nomParId[vote.propose_par] || "—")} · ${pour} pour / ${contre} contre (sur ${nombreAdmins} admins)
      </p>
      ${
        jaiDejaVote
          ? `<p style="margin:0; font-size:13px; color:var(--texte-secondaire)">Vous avez déjà voté.</p>`
          : `<div style="display:flex; gap:8px">
              <button data-voter="${vote.id}|pour" class="bouton" style="background:#4C9A6A; color:#fff; padding:8px 14px; font-size:13px">Voter pour</button>
              <button data-voter="${vote.id}|contre" class="bouton" style="background:var(--danger); color:#fff; padding:8px 14px; font-size:13px">Voter contre</button>
            </div>`
      }
    </div>
  `;
}

export function gabaritVoteComptable(vote, toutesLesVoix, nomParId, nombreAdmins, moiId) {
  const voixDuVote = toutesLesVoix.filter((v) => v.vote_id === vote.id);
  const pour = voixDuVote.filter((v) => v.choix === "pour").length;
  const contre = voixDuVote.filter((v) => v.choix === "contre").length;
  const jaiDejaVote = voixDuVote.some((v) => v.admin_id === moiId);
  const totalAdminsConcernes = Math.max(nombreAdmins - 1, 0);

  return `
    <div class="carte" style="background:var(--fond-carte-claire)">
      <p style="margin:0; font-weight:500">${echapper(nomParId[vote.candidat_id] || "—")} comme comptable</p>
      <p style="margin:4px 0 12px; font-size:12px; color:var(--texte-secondaire)">
        Proposé par ${echapper(nomParId[vote.propose_par] || "—")} · ${pour} pour / ${contre} contre (sur ${totalAdminsConcernes} admins concernés)
      </p>
      ${
        jaiDejaVote
          ? `<p style="margin:0; font-size:13px; color:var(--texte-secondaire)">Vous avez déjà voté.</p>`
          : `<div style="display:flex; gap:8px">
              <button data-voter-comptable="${vote.id}|pour" class="bouton" style="background:#4C9A6A; color:#fff; padding:8px 14px; font-size:13px">Voter pour</button>
              <button data-voter-comptable="${vote.id}|contre" class="bouton" style="background:var(--danger); color:#fff; padding:8px 14px; font-size:13px">Voter contre</button>
            </div>`
      }
    </div>
  `;
}

export async function evaluerVote(voteId, nombreAdmins) {
  const { data: voix } = await supabase.from("votes_admin_voix").select("voix").eq("vote_id", voteId);
  const pour = (voix || []).filter((v) => v.voix).length;
  const contre = (voix || []).filter((v) => !v.voix).length;
  const majorite = Math.floor(nombreAdmins / 2) + 1;

  if (pour >= majorite) {
    const { data: vote } = await supabase.from("votes_admin").select("candidat_id").eq("id", voteId).single();
    await supabase.from("votes_admin").update({ statut: "valide" }).eq("id", voteId);
    await supabase.from("profils").update({ role: "admin" }).eq("id", vote.candidat_id);
    notifier("Un nouvel administrateur a été nommé par vote.");
  } else if (pour + contre >= nombreAdmins) {
    await supabase.from("votes_admin").update({ statut: "rejete" }).eq("id", voteId);
  }
                                    }
