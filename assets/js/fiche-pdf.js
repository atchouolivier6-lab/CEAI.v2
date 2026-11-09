// =========================================================
// CEAI — Construction du PDF de la fiche de clôture
// (session de cotisation ou cycle de tontine), façon "bulletin" :
// en-tête officiel, cadre double, tableau, cases de synthèse,
// bilan, code QR de vérification et pied de page.
//
// La bibliothèque pdf-lib est passée en paramètre (PDFLib) : le même code
// sert dans le navigateur et pour les tests.
// =========================================================

const LARGEUR_PAGE = 595.28;
const HAUTEUR_PAGE = 841.89;
const MARGE_X = 40;
const LARGEUR_UTILE = LARGEUR_PAGE - 2 * MARGE_X;
const LIMITE_BAS = 54; // espace réservé au pied de page de chaque page

// --- Caractères acceptés par la police standard (WinAnsi) ---
const AUTRES_AUTORISES = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d,
  0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

export function nettoyerTexte(texte) {
  let resultat = "";
  const brut = String(texte ?? "")
    .replace(/[\u202f\u00a0\u2007]/g, " ")
    .replace(/[\r\t]/g, " ")
    .replace(/\u2212/g, "-")
    .replace(/\u2192/g, "->");
  for (const caractere of brut) {
    const code = caractere.codePointAt(0);
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa1 && code <= 0xff) || AUTRES_AUTORISES.has(code)) {
      resultat += caractere;
    } else if (caractere === "\n") {
      resultat += "\n";
    } else if (code === 0xa0) {
      resultat += " ";
    }
  }
  return resultat;
}

function hexVersRgb(PDFLib, hex, defaut = "#14213d") {
  const valeur = /^#[0-9a-fA-F]{6}$/.test(hex || "") ? hex : defaut;
  const n = parseInt(valeur.slice(1), 16);
  return PDFLib.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export async function construirePdf(PDFLib, fiche, { logoPng = null, qrModules = null } = {}) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  doc.setTitle(`${fiche.titreDocument} - ${fiche.nom}`);
  doc.setAuthor("CEAI");
  doc.setSubject(`${fiche.etiquetteType} - ${fiche.nom}`);
  doc.setCreator("CEAI");

  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const gras = await doc.embedFont(StandardFonts.HelveticaBold);
  const italique = await doc.embedFont(StandardFonts.HelveticaOblique);
  const logo = logoPng ? await doc.embedPng(logoPng).catch(() => null) : null;

  const C = {
    marine: rgb(0.078, 0.129, 0.239),
    bleu: rgb(0.12, 0.23, 0.58),
    rouge: rgb(0.8, 0.12, 0.12),
    vert: rgb(0.1, 0.5, 0.2),
    orange: rgb(0.8, 0.45, 0.05),
    texte: rgb(0.1, 0.1, 0.12),
    gris: rgb(0.42, 0.44, 0.48),
    bordure: rgb(0.62, 0.65, 0.7),
    ligneFine: rgb(0.8, 0.82, 0.86),
    fondLigne: rgb(0.965, 0.972, 0.985),
    fondTotal: rgb(0.88, 0.91, 0.96),
    filigrane: rgb(0.945, 0.955, 0.972),
    blanc: rgb(1, 1, 1),
    noir: rgb(0, 0, 0),
  };
  const couleurTheme = hexVersRgb(PDFLib, fiche.couleur);

  const largeur = (police, taille, t) => police.widthOfTextAtSize(nettoyerTexte(t), taille);

  // --- Outils de dessin ---
  function texte(page, t, x, haut, { police = normal, taille = 9, couleur = C.texte } = {}) {
    const propre = nettoyerTexte(t);
    if (!propre) return;
    page.drawText(propre, { x, y: HAUTEUR_PAGE - haut - taille * 0.78, size: taille, font: police, color: couleur });
  }

  function texteCentre(page, t, centreX, haut, options = {}) {
    const { police = normal, taille = 9 } = options;
    texte(page, t, centreX - largeur(police, taille, t) / 2, haut, options);
  }

  function texteDroite(page, t, droiteX, haut, options = {}) {
    const { police = normal, taille = 9 } = options;
    texte(page, t, droiteX - largeur(police, taille, t), haut, options);
  }

  // Texte avec espacement entre les lettres (titre rouge du bulletin)
  function texteEspace(page, t, centreX, haut, { police = gras, taille = 11, couleur = C.rouge, espacement = 2 } = {}) {
    const propre = nettoyerTexte(t);
    let total = 0;
    for (const c of propre) total += police.widthOfTextAtSize(c, taille) + espacement;
    total -= espacement;
    let x = centreX - total / 2;
    for (const c of propre) {
      page.drawText(c, { x, y: HAUTEUR_PAGE - haut - taille * 0.78, size: taille, font: police, color: couleur });
      x += police.widthOfTextAtSize(c, taille) + espacement;
    }
  }

  function rectangle(page, x, haut, l, h, { fond = null, bord = null, epaisseur = 0.6 } = {}) {
    page.drawRectangle({
      x,
      y: HAUTEUR_PAGE - haut - h,
      width: l,
      height: h,
      color: fond || undefined,
      borderColor: bord || undefined,
      borderWidth: bord ? epaisseur : 0,
    });
  }

  function ligne(page, x1, haut1, x2, haut2, { couleur = C.bordure, epaisseur = 0.6 } = {}) {
    page.drawLine({
      start: { x: x1, y: HAUTEUR_PAGE - haut1 },
      end: { x: x2, y: HAUTEUR_PAGE - haut2 },
      thickness: epaisseur,
      color: couleur,
    });
  }

  // Réduit la taille puis tronque pour qu'un texte tienne dans une largeur donnée
  function ajuster(t, police, taille, largeurMax, tailleMin = 6.2) {
    let propre = nettoyerTexte(t);
    let tailleCourante = taille;
    while (tailleCourante > tailleMin && police.widthOfTextAtSize(propre, tailleCourante) > largeurMax) tailleCourante -= 0.3;
    if (police.widthOfTextAtSize(propre, tailleCourante) > largeurMax) {
      while (propre.length > 1 && police.widthOfTextAtSize(propre + "…", tailleCourante) > largeurMax) propre = propre.slice(0, -1);
      propre += "…";
    }
    return { texte: propre, taille: tailleCourante };
  }

  function envelopper(t, police, taille, largeurMax) {
    const lignes = [];
    for (const paragraphe of nettoyerTexte(t).split("\n")) {
      const mots = paragraphe.split(/\s+/).filter(Boolean);
      let courante = "";
      for (let mot of mots) {
        while (police.widthOfTextAtSize(mot, taille) > largeurMax) {
          let morceau = mot;
          while (morceau.length > 1 && police.widthOfTextAtSize(morceau, taille) > largeurMax) morceau = morceau.slice(0, -1);
          if (courante) {
            lignes.push(courante);
            courante = "";
          }
          lignes.push(morceau);
          mot = mot.slice(morceau.length);
        }
        const essai = courante ? `${courante} ${mot}` : mot;
        if (police.widthOfTextAtSize(essai, taille) <= largeurMax) {
          courante = essai;
        } else {
          lignes.push(courante);
          courante = mot;
        }
      }
      lignes.push(courante);
    }
    return lignes.length ? lignes : [""];
  }

  // --- Pages ---
  const pages = [];

  function dessinerFiligrane(page) {
    // Quadrillage de losanges très discret, limité à l'intérieur du cadre
    const gauche = 24, droite = LARGEUR_PAGE - 24, haut = 24, bas = HAUTEUR_PAGE - 24;
    const pas = 34;
    const decouper = (x1, y1, x2, y2) => {
      // découpe d'un segment dans le rectangle intérieur (Liang-Barsky)
      let t0 = 0, t1 = 1;
      const dx = x2 - x1, dy = y2 - y1;
      const tests = [[-dx, x1 - gauche], [dx, droite - x1], [-dy, y1 - haut], [dy, bas - y1]];
      for (const [p, q] of tests) {
        if (p === 0) {
          if (q < 0) return null;
        } else {
          const r = q / p;
          if (p < 0) {
            if (r > t1) return null;
            if (r > t0) t0 = r;
          } else {
            if (r < t0) return null;
            if (r < t1) t1 = r;
          }
        }
      }
      return [x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy];
    };
    const total = LARGEUR_PAGE + HAUTEUR_PAGE;
    for (let c = -HAUTEUR_PAGE; c < LARGEUR_PAGE; c += pas) {
      const seg = decouper(c, 0, c + total, total);
      if (seg) ligne(page, seg[0], seg[1], seg[2], seg[3], { couleur: C.filigrane, epaisseur: 0.5 });
      const seg2 = decouper(c, total, c + total, 0);
      if (seg2) ligne(page, seg2[0], seg2[1], seg2[2], seg2[3], { couleur: C.filigrane, epaisseur: 0.5 });
    }
  }

  function nouvellePage() {
    const page = doc.addPage([LARGEUR_PAGE, HAUTEUR_PAGE]);
    pages.push(page);
    dessinerFiligrane(page);
    // Cadre double : trait épais puis trait fin
    rectangle(page, 14, 14, LARGEUR_PAGE - 28, HAUTEUR_PAGE - 28, { bord: C.marine, epaisseur: 2.6 });
    rectangle(page, 21, 21, LARGEUR_PAGE - 42, HAUTEUR_PAGE - 42, { bord: C.bleu, epaisseur: 0.7 });
    return page;
  }

  // --- En-tête ---
  function dessinerEntete(page) {
    const centre = LARGEUR_PAGE / 2;

    if (logo) {
      page.drawImage(logo, { x: MARGE_X + 6, y: HAUTEUR_PAGE - 40 - 54, width: 54, height: 54 });
    }
    texteCentre(page, "Engagement", MARGE_X + 33, 98, { police: gras, taille: 6.3, couleur: C.marine });
    texteCentre(page, "Rigueur · Amitié", MARGE_X + 33, 106, { police: gras, taille: 6.3, couleur: C.marine });

    texteCentre(page, "CEAI", centre, 38, { police: gras, taille: 24, couleur: C.marine });
    texteCentre(page, "Connaissance Entre Amis Intimes", centre, 66, { police: gras, taille: 9.5, couleur: C.texte });
    texteCentre(page, "Cotisation · Tontine · Épargne · Service de prêt", centre, 79, { taille: 7, couleur: C.gris });
    texteEspace(page, `— ${fiche.titreDocument} —`, centre, 96, { taille: 11.5, espacement: 2.2 });
    texteCentre(page, `${fiche.etiquetteType}  |  ${fiche.nom}`, centre, 112, { police: gras, taille: 8.5, couleur: C.bleu });
    if (fiche.sousTitre) texteCentre(page, fiche.sousTitre, centre, 124, { taille: 7.2, couleur: C.gris });

    // Pastille de type (couleur du thème de la session ou du cycle)
    const px = LARGEUR_PAGE - MARGE_X - 66;
    page.drawRectangle({ x: px, y: HAUTEUR_PAGE - 40 - 58, width: 62, height: 58, color: couleurTheme, borderColor: C.marine, borderWidth: 1 });
    texteCentre(page, fiche.etiquetteType, px + 31, 50, { police: gras, taille: 7.5, couleur: C.blanc });
    texteCentre(page, String(fiche.annee || ""), px + 31, 66, { police: gras, taille: 17, couleur: C.blanc });
    texteCentre(page, "ARCHIVE", px + 31, 88, { police: gras, taille: 6.5, couleur: C.blanc });

    return 142;
  }

  // --- Cadre d'identité ---
  function dessinerIdentite(page, haut) {
    const hauteurLigne = 25;
    const lignes = fiche.identite;
    const hauteurTotale = hauteurLigne * lignes.length;
    page.drawRectangle({
      x: MARGE_X,
      y: HAUTEUR_PAGE - haut - hauteurTotale,
      width: LARGEUR_UTILE,
      height: hauteurTotale,
      borderColor: C.marine,
      borderWidth: 1.1,
      color: C.blanc,
      opacity: 1,
    });
    lignes.forEach((cellules, i) => {
      const hautLigne = haut + i * hauteurLigne;
      if (i > 0) ligne(page, MARGE_X, hautLigne, MARGE_X + LARGEUR_UTILE, hautLigne, { couleur: C.bordure });
      const somme = cellules.reduce((s, c) => s + (c.poids || 1), 0);
      let x = MARGE_X;
      cellules.forEach((cellule, j) => {
        const l = (LARGEUR_UTILE * (cellule.poids || 1)) / somme;
        if (j > 0) ligne(page, x, hautLigne, x, hautLigne + hauteurLigne, { couleur: C.bordure });
        const etiquette = nettoyerTexte(cellule.label).toUpperCase();
        texte(page, etiquette, x + 7, hautLigne + 5.5, { taille: 5.8, couleur: C.gris, police: gras });
        const ajuste = ajuster(cellule.valeur || "—", gras, 9.2, l - 14);
        texte(page, ajuste.texte, x + 7, hautLigne + 13.5, { police: gras, taille: ajuste.taille });
        x += l;
      });
    });
    return haut + hauteurTotale + 12;
  }

  // --- Tableau principal (avec pagination) ---
  const HAUT_LIGNE_TABLEAU = 16;
  const HAUT_ENTETE_TABLEAU = 19;

  function dessinerEnteteTableau(page, haut, colonnes, largeurs) {
    let x = MARGE_X;
    rectangle(page, MARGE_X, haut, LARGEUR_UTILE, HAUT_ENTETE_TABLEAU, { fond: C.marine });
    colonnes.forEach((col, i) => {
      if (i > 0) ligne(page, x, haut, x, haut + HAUT_ENTETE_TABLEAU, { couleur: rgb(0.3, 0.36, 0.5), epaisseur: 0.5 });
      const ajuste = ajuster(col.titre, gras, 6.8, largeurs[i] - 6, 5.2);
      const cx = x + largeurs[i] / 2;
      texteCentre(page, ajuste.texte, cx, haut + 6.2, { police: gras, taille: ajuste.taille, couleur: C.blanc });
      x += largeurs[i];
    });
    return haut + HAUT_ENTETE_TABLEAU;
  }

  function dessinerTableau(page, haut, enteteRepetee) {
    const { colonnes, lignes, total } = fiche.tableau;
    const somme = colonnes.reduce((s, c) => s + c.poids, 0);
    const largeurs = colonnes.map((c) => (LARGEUR_UTILE * c.poids) / somme);

    let y = dessinerEnteteTableau(page, haut, colonnes, largeurs);
    let pageCourante = page;
    const debutBloc = (p, h) => h; // lisibilité

    const dessinerLigne = (p, cellules, hautLigne, index, estTotal) => {
      if (estTotal) rectangle(p, MARGE_X, hautLigne, LARGEUR_UTILE, HAUT_LIGNE_TABLEAU + 2, { fond: C.fondTotal });
      else if (index % 2 === 1) rectangle(p, MARGE_X, hautLigne, LARGEUR_UTILE, HAUT_LIGNE_TABLEAU, { fond: C.fondLigne });
      const hauteur = estTotal ? HAUT_LIGNE_TABLEAU + 2 : HAUT_LIGNE_TABLEAU;
      ligne(p, MARGE_X, hautLigne + hauteur, MARGE_X + LARGEUR_UTILE, hautLigne + hauteur, { couleur: C.ligneFine, epaisseur: 0.5 });
      let x = MARGE_X;
      cellules.forEach((cellule, i) => {
        const objet = typeof cellule === "object" && cellule !== null ? cellule : { t: cellule };
        const col = colonnes[i];
        const police = objet.gras || estTotal || i === 1 ? gras : normal;
        const couleur = objet.couleur ? hexVersRgb(PDFLib, objet.couleur) : C.texte;
        const ajuste = ajuster(objet.t ?? "", police, 8.2, largeurs[i] - 8);
        const baseHaut = hautLigne + (hauteur - ajuste.taille) / 2 - 0.4;
        if (col.align === "right") texteDroite(p, ajuste.texte, x + largeurs[i] - 5, baseHaut, { police, taille: ajuste.taille, couleur });
        else if (col.align === "center") texteCentre(p, ajuste.texte, x + largeurs[i] / 2, baseHaut, { police, taille: ajuste.taille, couleur });
        else texte(p, ajuste.texte, x + 5, baseHaut, { police, taille: ajuste.taille, couleur });
        if (i > 0) ligne(p, x, hautLigne, x, hautLigne + hauteur, { couleur: C.ligneFine, epaisseur: 0.5 });
        x += largeurs[i];
      });
      // bordures gauche et droite
      ligne(p, MARGE_X, hautLigne, MARGE_X, hautLigne + hauteur, { couleur: C.bordure });
      ligne(p, MARGE_X + LARGEUR_UTILE, hautLigne, MARGE_X + LARGEUR_UTILE, hautLigne + hauteur, { couleur: C.bordure });
    };

    lignes.forEach((cellules, index) => {
      if (y + HAUT_LIGNE_TABLEAU > HAUTEUR_PAGE - LIMITE_BAS) {
        pageCourante = nouvellePage();
        texteCentre(pageCourante, `${fiche.titreDocument} · ${fiche.etiquetteType} ${fiche.nom} (suite)`, LARGEUR_PAGE / 2, 36, {
          police: gras,
          taille: 8,
          couleur: C.bleu,
        });
        y = dessinerEnteteTableau(pageCourante, 54, colonnes, largeurs);
      }
      dessinerLigne(pageCourante, cellules, y, index, false);
      y += HAUT_LIGNE_TABLEAU;
    });

    if (total) {
      if (y + HAUT_LIGNE_TABLEAU + 2 > HAUTEUR_PAGE - LIMITE_BAS) {
        pageCourante = nouvellePage();
        y = 40;
      }
      dessinerLigne(pageCourante, total, y, 0, true);
      y += HAUT_LIGNE_TABLEAU + 2;
    }
    return { page: pageCourante, haut: y + 12 };
  }

  // --- Cases de synthèse ---
  function dessinerSynthese(page, haut) {
    const cases = fiche.synthese;
    const ecart = 6;
    const l = (LARGEUR_UTILE - ecart * (cases.length - 1)) / cases.length;
    cases.forEach((c, i) => {
      const x = MARGE_X + i * (l + ecart);
      rectangle(page, x, haut, l, 36, { bord: C.marine, epaisseur: 0.9, fond: C.blanc });
      const etiquette = ajuster(nettoyerTexte(c.label).toUpperCase(), gras, 5.8, l - 8, 4.8);
      texteCentre(page, etiquette.texte, x + l / 2, haut + 6, { police: gras, taille: etiquette.taille, couleur: C.gris });
      const valeur = ajuster(c.valeur, gras, 11, l - 8, 7);
      texteCentre(page, valeur.texte, x + l / 2, haut + 17, { police: gras, taille: valeur.taille, couleur: C.marine });
    });
    return haut + 36 + 16;
  }

  // --- Bilan ---
  function dessinerBilan(pageDepart, hautDepart) {
    const bilan = fiche.bilan;
    if (!bilan) return { page: pageDepart, haut: hautDepart };

    let page = pageDepart;
    let haut = hautDepart;
    const colRubrique = 150, colMontant = 90;
    const colDetail = LARGEUR_UTILE - colRubrique - colMontant;

    const titreBilan = () => {
      texte(page, nettoyerTexte(bilan.titre).toUpperCase(), MARGE_X, haut, { police: gras, taille: 9, couleur: C.marine });
      ligne(page, MARGE_X, haut + 13, MARGE_X + LARGEUR_UTILE, haut + 13, { couleur: C.marine, epaisseur: 1 });
      haut += 19;
    };

    const hauteurMinimale = 19 + 26;
    if (haut + hauteurMinimale > HAUTEUR_PAGE - LIMITE_BAS - 90) {
      page = nouvellePage();
      haut = 40;
    }
    titreBilan();

    const toutesLesLignes = [...bilan.lignes];
    if (bilan.pied) toutesLesLignes.push({ ...bilan.pied, estPied: true });

    toutesLesLignes.forEach((l, index) => {
      const lignesDetail = envelopper(l.detail || "", normal, 8, colDetail - 12);
      const lignesRubrique = envelopper(l.rubrique, gras, 8, colRubrique - 12);
      const hauteur = Math.max(20, 9 + Math.max(lignesDetail.length, lignesRubrique.length) * 10);
      if (haut + hauteur > HAUTEUR_PAGE - LIMITE_BAS - 8) {
        page = nouvellePage();
        haut = 40;
        titreBilan();
      }
      if (l.estPied) rectangle(page, MARGE_X, haut, LARGEUR_UTILE, hauteur, { fond: C.fondTotal });
      else if (index % 2 === 1) rectangle(page, MARGE_X, haut, LARGEUR_UTILE, hauteur, { fond: C.fondLigne });
      ligne(page, MARGE_X, haut + hauteur, MARGE_X + LARGEUR_UTILE, haut + hauteur, { couleur: C.ligneFine, epaisseur: 0.5 });
      ligne(page, MARGE_X, haut, MARGE_X, haut + hauteur, { couleur: C.bordure });
      ligne(page, MARGE_X + LARGEUR_UTILE, haut, MARGE_X + LARGEUR_UTILE, haut + hauteur, { couleur: C.bordure });
      ligne(page, MARGE_X + colRubrique, haut, MARGE_X + colRubrique, haut + hauteur, { couleur: C.ligneFine, epaisseur: 0.5 });
      ligne(page, MARGE_X + colRubrique + colMontant, haut, MARGE_X + colRubrique + colMontant, haut + hauteur, { couleur: C.ligneFine, epaisseur: 0.5 });

      lignesRubrique.forEach((t, k) => texte(page, t, MARGE_X + 6, haut + 6 + k * 10, { police: gras, taille: 8, couleur: C.marine }));
      if (l.montant) {
        texteDroite(page, l.montant, MARGE_X + colRubrique + colMontant - 6, haut + 6, { police: gras, taille: 8.4 });
      }
      lignesDetail.forEach((t, k) => texte(page, t, MARGE_X + colRubrique + colMontant + 6, haut + 6 + k * 10, { taille: 8, couleur: C.texte }));
      haut += hauteur;
    });
    return { page, haut: haut + 14 };
  }

  // --- Pied : code QR, vérification, signature ---
  function dessinerPied(pageDepart, hautDepart) {
    let page = pageDepart;
    const hauteurPied = 78;
    let haut = Math.max(hautDepart, HAUTEUR_PAGE - LIMITE_BAS - hauteurPied);
    if (haut + hauteurPied > HAUTEUR_PAGE - LIMITE_BAS + 4) {
      page = nouvellePage();
      haut = HAUTEUR_PAGE - LIMITE_BAS - hauteurPied;
    }

    // Code QR
    if (qrModules && qrModules.length) {
      const n = qrModules.length;
      const tailleQr = 64;
      const module = tailleQr / n;
      const x0 = MARGE_X + 4;
      rectangle(page, x0 - 3, haut - 3, tailleQr + 6, tailleQr + 6, { fond: C.blanc, bord: C.ligneFine, epaisseur: 0.5 });
      for (let y = 0; y < n; y++) {
        let x = 0;
        while (x < n) {
          if (!qrModules[y][x]) {
            x++;
            continue;
          }
          let fin = x;
          while (fin < n && qrModules[y][fin]) fin++;
          page.drawRectangle({
            x: x0 + x * module,
            y: HAUTEUR_PAGE - haut - (y + 1) * module,
            width: (fin - x) * module + 0.15,
            height: module + 0.15,
            color: C.noir,
          });
          x = fin;
        }
      }
      texteCentre(page, "Scanner pour vérifier", x0 + tailleQr / 2, haut + tailleQr + 6, { taille: 5.8, couleur: C.gris });
    }

    // Référence et mentions
    const xTexte = MARGE_X + 100;
    texte(page, "RÉFÉRENCE DU DOCUMENT", xTexte, haut + 2, { police: gras, taille: 6.2, couleur: C.gris });
    texte(page, fiche.reference, xTexte, haut + 11, { police: gras, taille: 10, couleur: C.marine });
    const mention = envelopper(
      "Document établi à partir des données enregistrées par l'association. Pour en vérifier l'authenticité, scannez le code QR et comparez avec la fiche en ligne.",
      italique,
      6.8,
      200
    );
    mention.forEach((t, k) => texte(page, t, xTexte, haut + 28 + k * 8.5, { police: italique, taille: 6.8, couleur: C.gris }));

    // Signature (à droite)
    const droite = LARGEUR_PAGE - MARGE_X - 6;
    texteDroite(page, `ÉDITÉ LE ${fiche.edite}`, droite, haut + 2, { police: gras, taille: 6.8 });
    if (fiche.etabliPar) {
      texteDroite(page, `Bilan établi par ${fiche.etabliPar.fonction}`, droite, haut + 30, { police: gras, taille: 8 });
      texteDroite(page, fiche.etabliPar.nom, droite, haut + 42, { police: gras, taille: 8.5, couleur: C.marine });
      if (fiche.etabliPar.date) texteDroite(page, `le ${fiche.etabliPar.date}`, droite, haut + 54, { taille: 7, couleur: C.gris });
    }
    return page;
  }

  // --- Assemblage ---
  let page = nouvellePage();
  let haut = dessinerEntete(page);
  haut = dessinerIdentite(page, haut);
  const apresTableau = dessinerTableau(page, haut);
  page = apresTableau.page;
  haut = apresTableau.haut;

  if (haut + 52 > HAUTEUR_PAGE - LIMITE_BAS) {
    page = nouvellePage();
    haut = 40;
  }
  haut = dessinerSynthese(page, haut);
  const apresBilan = dessinerBilan(page, haut);
  page = apresBilan.page;
  haut = apresBilan.haut;
  dessinerPied(page, haut);

  // Numéros de page
  pages.forEach((p, i) => {
    texteCentre(p, "Fiche produite par CEAI · Connaissance Entre Amis Intimes", LARGEUR_PAGE / 2, HAUTEUR_PAGE - 42, {
      taille: 6.5,
      couleur: C.gris,
    });
    texteCentre(p, `Page ${i + 1} / ${pages.length}`, LARGEUR_PAGE / 2, HAUTEUR_PAGE - 33, { taille: 6.5, couleur: C.gris });
  });

  return await doc.save();
}
