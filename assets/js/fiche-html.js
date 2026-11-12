// =========================================================
// CEAI — Affichage à l'écran de la fiche de clôture (style "bulletin")
// La feuille reste blanche quel que soit le thème de l'application,
// comme un vrai document. Le contenu est identique à celui du PDF.
// =========================================================

function echapper(texte) {
  return String(texte ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const ID_STYLE = "fiche-archive-style";

const CSS = `
.fiche-actions { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 14px; }
.fiche-actions .bouton { padding:10px 16px; font-size:14px; }
.fiche-papier {
  --fiche-marine:#14213d; --fiche-bleu:#1f3a93; --fiche-rouge:#cc1f1f; --fiche-gris:#6b7078; --fiche-trait:#9fa6b2; --fiche-fin:#d6dae1;
  position:relative; box-sizing:border-box; max-width:820px; margin:0 auto; padding:16px 14px 14px;
  background:#fff; color:#17181c; border:3px solid var(--fiche-marine); border-radius:4px;
  box-shadow:0 0 0 4px #fff, 0 0 0 5px var(--fiche-bleu), 0 10px 30px rgba(0,0,0,.35);
  font-family:Inter, system-ui, -apple-system, "Segoe UI", sans-serif; line-height:1.35;
}
.fiche-papier * { box-sizing:border-box; }
.fiche-entete { display:grid; grid-template-columns:64px 1fr 64px; gap:8px; align-items:start; }
.fiche-logo { width:60px; height:60px; object-fit:contain; display:block; }
.fiche-valeurs { margin:4px 0 0; font-size:8px; font-weight:700; color:var(--fiche-marine); text-align:center; line-height:1.25; }
.fiche-centre { text-align:center; }
.fiche-marque { margin:0; font-size:26px; font-weight:800; color:var(--fiche-marine); letter-spacing:.5px; line-height:1.1; }
.fiche-nom-long { margin:2px 0 0; font-size:11px; font-weight:700; }
.fiche-activites { margin:2px 0 0; font-size:8.5px; color:var(--fiche-gris); }
.fiche-titre { margin:10px 0 2px; font-size:12.5px; font-weight:800; letter-spacing:3px; color:var(--fiche-rouge); }
.fiche-sujet { margin:0; font-size:11px; font-weight:700; color:var(--fiche-bleu); }
.fiche-periode { margin:2px 0 0; font-size:9px; color:var(--fiche-gris); }
.fiche-pastille { width:64px; padding:8px 4px; text-align:center; color:#fff; border:1px solid var(--fiche-marine); border-radius:4px; }
.fiche-pastille b { display:block; font-size:8px; letter-spacing:.5px; }
.fiche-pastille strong { display:block; font-size:19px; line-height:1.15; margin:2px 0; }
.fiche-pastille span { font-size:7px; font-weight:700; letter-spacing:.8px; }

.fiche-identite { margin:16px 0 14px; border:1.5px solid var(--fiche-marine); border-radius:6px; overflow:hidden; }
.fiche-identite-ligne { display:flex; }
.fiche-identite-ligne + .fiche-identite-ligne { border-top:1px solid var(--fiche-trait); }
.fiche-cellule { flex:1 1 0; min-width:0; padding:5px 8px 6px; }
.fiche-cellule + .fiche-cellule { border-left:1px solid var(--fiche-trait); }
.fiche-cellule small { display:block; font-size:7.5px; font-weight:700; letter-spacing:.4px; color:var(--fiche-gris); text-transform:uppercase; }
.fiche-cellule strong { display:block; font-size:12.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.fiche-defile { overflow-x:auto; -webkit-overflow-scrolling:touch; margin:0 -2px; padding:0 2px; }
.fiche-tableau { width:100%; min-width:560px; border-collapse:collapse; font-size:12px; }
.fiche-tableau th { background:var(--fiche-marine); color:#fff; font-size:9.5px; font-weight:700; padding:7px 6px; border-left:1px solid #4b5a80; }
.fiche-tableau th:first-child { border-left:0; }
.fiche-tableau td { padding:6px 6px; border-bottom:1px solid var(--fiche-fin); border-left:1px solid var(--fiche-fin); }
.fiche-tableau td:first-child { border-left:1px solid var(--fiche-trait); }
.fiche-tableau td:last-child { border-right:1px solid var(--fiche-trait); }
.fiche-tableau tbody tr:nth-child(even) td { background:#f6f8fb; }
.fiche-tableau .col-g { text-align:left; font-weight:700; }
.fiche-tableau .col-c { text-align:center; }
.fiche-tableau .col-d { text-align:right; white-space:nowrap; }
.fiche-tableau tfoot td { background:#e0e8f5; font-weight:800; border-bottom:1px solid var(--fiche-trait); }

.fiche-synthese { display:grid; grid-template-columns:repeat(auto-fit, minmax(118px, 1fr)); gap:8px; margin:14px 0 18px; }
.fiche-case { border:1.5px solid var(--fiche-marine); border-radius:4px; padding:7px 6px; text-align:center; }
.fiche-case small { display:block; font-size:8px; font-weight:700; letter-spacing:.3px; color:var(--fiche-gris); text-transform:uppercase; }
.fiche-case strong { display:block; margin-top:2px; font-size:15px; color:var(--fiche-marine); }

.fiche-bilan h3 { margin:0 0 8px; padding-bottom:4px; font-size:12px; letter-spacing:.5px; text-transform:uppercase; color:var(--fiche-marine); border-bottom:2px solid var(--fiche-marine); }
.fiche-bilan table { width:100%; border-collapse:collapse; font-size:12px; }
.fiche-bilan td { padding:7px 8px; vertical-align:top; border-bottom:1px solid var(--fiche-fin); border-left:1px solid var(--fiche-fin); }
.fiche-bilan td:first-child { width:34%; font-weight:700; color:var(--fiche-marine); border-left:1px solid var(--fiche-trait); }
.fiche-bilan td:nth-child(2) { width:24%; text-align:right; font-weight:700; white-space:nowrap; }
.fiche-bilan td:last-child { border-right:1px solid var(--fiche-trait); white-space:pre-line; }
.fiche-bilan tr:nth-child(even) td { background:#f6f8fb; }
.fiche-bilan tr.pied td { background:#e0e8f5; }

.fiche-pied { display:flex; flex-wrap:wrap; gap:14px; align-items:flex-end; justify-content:space-between; margin-top:20px; padding-top:12px; border-top:1px dashed var(--fiche-trait); }
.fiche-qr { text-align:center; font-size:8px; color:var(--fiche-gris); }
.fiche-qr svg { display:block; width:92px; height:92px; padding:4px; border:1px solid var(--fiche-fin); background:#fff; }
.fiche-reference { flex:1 1 180px; min-width:0; }
.fiche-reference small { display:block; font-size:8px; font-weight:700; color:var(--fiche-gris); letter-spacing:.4px; }
.fiche-reference b { display:block; font-size:14px; color:var(--fiche-marine); word-break:break-all; }
.fiche-reference p { margin:6px 0 0; font-size:9.5px; font-style:italic; color:var(--fiche-gris); }
.fiche-reference p.fiche-merci { font-size:14px; font-style:normal; font-weight:700; color:var(--fiche-marine); }
.fiche-signature { text-align:right; font-size:11px; }
.fiche-signature small { display:block; font-size:9.5px; font-weight:700; }
.fiche-signature b { display:block; margin-top:3px; color:var(--fiche-marine); font-size:12px; }
.fiche-signature span { display:block; font-size:9.5px; color:var(--fiche-gris); }
.fiche-bas { margin:12px 0 0; text-align:center; font-size:8.5px; color:var(--fiche-gris); }

@media (max-width: 520px) {
  .fiche-papier { padding:12px 10px; }
  .fiche-entete { grid-template-columns:50px 1fr 52px; }
  .fiche-logo { width:48px; height:48px; }
  .fiche-pastille { width:52px; }
  .fiche-marque { font-size:21px; }
  .fiche-titre { letter-spacing:1.8px; font-size:11px; }
  .fiche-identite-ligne { flex-wrap:wrap; }
  .fiche-cellule { flex:1 1 45%; }
  .fiche-cellule:first-child { flex-basis:100%; }
  .fiche-cellule + .fiche-cellule { border-left:0; }
  .fiche-cellule:nth-child(3) { border-left:1px solid var(--fiche-trait); }
}

/* Petits écrans : chaque ligne du bilan passe sur deux lignes (rubrique + montant, puis détail) */
@media (max-width: 520px) {
  .fiche-bilan table, .fiche-bilan tbody { display:block; }
  .fiche-bilan tr { display:grid; grid-template-columns:1fr auto; border-left:1px solid var(--fiche-trait); border-right:1px solid var(--fiche-trait); }
  .fiche-bilan td { width:auto !important; border-left:0 !important; border-right:0 !important; }
  .fiche-bilan td:nth-child(3) { grid-column:1 / -1; padding-top:0; font-size:11.5px; color:var(--fiche-gris); }
}
`;

export function injecterStyleFiche() {
  if (document.getElementById(ID_STYLE)) return;
  const style = document.createElement("style");
  style.id = ID_STYLE;
  style.textContent = CSS;
  document.head.appendChild(style);
}

// Code QR en SVG (un seul tracé)
export function qrEnSvg(modules) {
  if (!modules || !modules.length) return "";
  const n = modules.length;
  let tracé = "";
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!modules[y][x]) {
        x++;
        continue;
      }
      let fin = x;
      while (fin < n && modules[y][fin]) fin++;
      tracé += `M${x} ${y}h${fin - x}v1h-${fin - x}z`;
      x = fin;
    }
  }
  return `<svg viewBox="0 0 ${n} ${n}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" aria-label="Code QR de vérification"><path d="${tracé}" fill="#000"/></svg>`;
}

export function rendreFicheHtml(fiche, { qrModules = null, logoUrl = "assets/icons/icon-192.png" } = {}) {
  const identite = fiche.identite
    .map(
      (ligne) => `
      <div class="fiche-identite-ligne">
        ${ligne
          .map(
            (c) => `<div class="fiche-cellule" style="flex-grow:${c.poids || 1}">
              <small>${echapper(c.label)}</small><strong title="${echapper(c.valeur)}">${echapper(c.valeur || "—")}</strong>
            </div>`
          )
          .join("")}
      </div>`
    )
    .join("");

  const { colonnes, lignes, total } = fiche.tableau || { colonnes: [], lignes: [], total: null };
  const classeAlign = { left: "col-g", center: "col-c", right: "col-d" };

  const cellule = (valeur, i, balise = "td") => {
    const objet = typeof valeur === "object" && valeur !== null ? valeur : { t: valeur };
    const style = objet.couleur ? ` style="color:${echapper(objet.couleur)};font-weight:${objet.gras ? 700 : 400}"` : "";
    return `<${balise} class="${classeAlign[colonnes[i].align] || ""}"${style}>${echapper(objet.t ?? "")}</${balise}>`;
  };

  const tableau = !fiche.tableau ? "" : `
    <div class="fiche-defile">
      <table class="fiche-tableau">
        <thead><tr>${colonnes.map((c) => `<th>${echapper(c.titre)}</th>`).join("")}</tr></thead>
        <tbody>${lignes.map((l) => `<tr>${l.map((v, i) => cellule(v, i)).join("")}</tr>`).join("")}</tbody>
        ${total ? `<tfoot><tr>${total.map((v, i) => cellule(v, i)).join("")}</tr></tfoot>` : ""}
      </table>
    </div>`;

  const synthese = `<div class="fiche-synthese">${fiche.synthese
    .map((c) => `<div class="fiche-case"><small>${echapper(c.label)}</small><strong>${echapper(c.valeur)}</strong></div>`)
    .join("")}</div>`;

  let bilan = "";
  if (fiche.bilan) {
    const toutes = [...fiche.bilan.lignes, ...(fiche.bilan.pied ? [{ ...fiche.bilan.pied, pied: true }] : [])];
    bilan = `
      <section class="fiche-bilan">
        <h3>${echapper(fiche.bilan.titre)}</h3>
        <table><tbody>${toutes
          .map((l) => `<tr class="${l.pied ? "pied" : ""}"><td>${echapper(l.rubrique)}</td><td>${echapper(l.montant || "")}</td><td>${echapper(l.detail || "")}</td></tr>`)
          .join("")}</tbody></table>
      </section>`;
  }

  const signature = fiche.etabliPar
    ? `<div class="fiche-signature">
         <small>${echapper(fiche.etabliPar.libelle || "Bilan établi par")} ${echapper(fiche.etabliPar.fonction)}</small>
         <b>${echapper(fiche.etabliPar.nom)}</b>
         ${fiche.etabliPar.date ? `<span>le ${echapper(fiche.etabliPar.date)}</span>` : ""}
       </div>`
    : "";

  return `
    <article class="fiche-papier" aria-label="${echapper(fiche.titreDocument)} ${echapper(fiche.nom)}">
      <header class="fiche-entete">
        <div>
          <img class="fiche-logo" src="${echapper(logoUrl)}" alt="CEAI" />
          <p class="fiche-valeurs">Engagement<br />Rigueur · Amitié</p>
        </div>
        <div class="fiche-centre">
          <p class="fiche-marque">CEAI</p>
          <p class="fiche-nom-long">Connaissance Entre Amis Intimes</p>
          <p class="fiche-activites">Cotisation · Tontine · Épargne · Service de prêt</p>
          <p class="fiche-titre">— ${echapper(fiche.titreDocument)} —</p>
          <p class="fiche-sujet">${echapper(fiche.etiquetteType)} &nbsp;|&nbsp; ${echapper(fiche.nom)}</p>
          ${fiche.sousTitre ? `<p class="fiche-periode">${echapper(fiche.sousTitre)}</p>` : ""}
        </div>
        <div class="fiche-pastille" style="background:${echapper(fiche.couleur)}">
          <b>${echapper(fiche.etiquetteType)}</b><strong>${echapper(fiche.annee)}</strong><span>${echapper(fiche.pastilleBas || "ARCHIVE")}</span>
        </div>
      </header>

      <section class="fiche-identite">${identite}</section>
      ${tableau}
      ${synthese}
      ${bilan}

      <footer class="fiche-pied">
        <div class="fiche-qr">${qrEnSvg(qrModules)}${qrModules ? "<span>Scanner pour vérifier</span>" : ""}</div>
        <div class="fiche-reference">
          <small>RÉFÉRENCE DU DOCUMENT</small>
          <b>${echapper(fiche.reference)}</b>
          <p${fiche.mention ? ' class="fiche-merci"' : ""}>${echapper(fiche.mention || "Document établi à partir des données enregistrées par l'association. Pour en vérifier l'authenticité, scannez le code QR et comparez avec la fiche en ligne.")}</p>
        </div>
        ${signature}
      </footer>
      <p class="fiche-bas">Fiche produite par CEAI · édité le ${echapper(fiche.edite)}</p>
    </article>`;
}
