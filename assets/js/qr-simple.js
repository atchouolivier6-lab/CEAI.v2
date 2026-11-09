// =========================================================
// CEAI — Générateur de code QR (sans dépendance)
// Mode "octets" (texte UTF-8), niveau de correction M, versions 1 à 10.
// genererQr("https://...") -> tableau de lignes de booléens (true = module noir)
// =========================================================

// Nombre de blocs de correction et d'octets de correction par bloc (niveau M), index = version
const BLOCS_M = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const OCTETS_EC_M = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const VERSION_MAX = 10;

// --- Calcul dans le corps de Galois GF(256) ---
const EXP = new Array(512);
const LOG = new Array(256);
(function initialiserGalois() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function multiplier(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function polynomeGenerateur(degre) {
  let poly = [1];
  for (let i = 0; i < degre; i++) {
    const suivant = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      suivant[j] ^= poly[j];
      suivant[j + 1] ^= multiplier(poly[j], EXP[i]);
    }
    poly = suivant;
  }
  return poly; // coefficients du plus haut degré au plus bas
}

function octetsCorrection(donnees, nbEc) {
  const generateur = polynomeGenerateur(nbEc);
  const reste = new Array(nbEc).fill(0);
  for (const octet of donnees) {
    const facteur = octet ^ reste.shift();
    reste.push(0);
    for (let i = 0; i < nbEc; i++) reste[i] ^= multiplier(generateur[i + 1], facteur);
  }
  return reste;
}

// --- Capacité ---
function nombreModulesDonnees(version) {
  let resultat = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const nbAlign = Math.floor(version / 7) + 2;
    resultat -= (25 * nbAlign - 10) * nbAlign - 55;
    if (version >= 7) resultat -= 36;
  }
  return resultat;
}

function nombreOctetsDonnees(version) {
  return Math.floor(nombreModulesDonnees(version) / 8) - OCTETS_EC_M[version] * BLOCS_M[version];
}

function positionsAlignement(version) {
  if (version === 1) return [];
  const nb = Math.floor(version / 7) + 2;
  const pas = Math.ceil((version * 4 + 4) / (nb * 2 - 2)) * 2;
  const positions = [6];
  for (let pos = version * 4 + 10; positions.length < nb; pos -= pas) positions.splice(1, 0, pos);
  return positions;
}

// --- Construction de la matrice ---
function creerMatrice(version) {
  const taille = version * 4 + 17;
  const modules = Array.from({ length: taille }, () => new Array(taille).fill(false));
  const reserve = Array.from({ length: taille }, () => new Array(taille).fill(false));

  const poser = (x, y, noir) => {
    if (x < 0 || y < 0 || x >= taille || y >= taille) return;
    modules[y][x] = noir;
    reserve[y][x] = true;
  };

  // Lignes de synchronisation
  for (let i = 0; i < taille; i++) {
    poser(6, i, i % 2 === 0);
    poser(i, 6, i % 2 === 0);
  }

  // Motifs de repérage et séparateurs
  const repere = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        poser(cx + dx, cy + dy, dist !== 2 && dist !== 4);
      }
    }
  };
  repere(3, 3);
  repere(taille - 4, 3);
  repere(3, taille - 4);

  // Motifs d'alignement
  const alignements = positionsAlignement(version);
  const nbAlign = alignements.length;
  for (let i = 0; i < nbAlign; i++) {
    for (let j = 0; j < nbAlign; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === nbAlign - 1) || (i === nbAlign - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          poser(alignements[i] + dx, alignements[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  // Zones réservées au format, et module noir fixe
  dessinerFormat(modules, reserve, taille, 0, true);
  poser(8, taille - 8, true);

  // Informations de version (à partir de la version 7)
  if (version >= 7) {
    let reste = version;
    for (let i = 0; i < 12; i++) reste = (reste << 1) ^ ((reste >>> 11) * 0x1f25);
    const bits = (version << 12) | reste;
    for (let i = 0; i < 18; i++) {
      const noir = ((bits >>> i) & 1) !== 0;
      const a = taille - 11 + (i % 3);
      const b = Math.floor(i / 3);
      poser(a, b, noir);
      poser(b, a, noir);
    }
  }

  return { taille, modules, reserve };
}

function dessinerFormat(modules, reserve, taille, masque, reserverSeulement = false) {
  // niveau M = 0 ; bits de format = (niveau << 3) | masque, protégés par un code BCH
  const donnees = (0 << 3) | masque;
  let reste = donnees;
  for (let i = 0; i < 10; i++) reste = (reste << 1) ^ ((reste >>> 9) * 0x537);
  const bits = ((donnees << 10) | reste) ^ 0x5412;

  const poser = (x, y, noir) => {
    modules[y][x] = reserverSeulement ? false : noir;
    reserve[y][x] = true;
  };
  const bit = (i) => ((bits >>> i) & 1) !== 0;

  for (let i = 0; i <= 5; i++) poser(8, i, bit(i));
  poser(8, 7, bit(6));
  poser(8, 8, bit(7));
  poser(7, 8, bit(8));
  for (let i = 9; i < 15; i++) poser(14 - i, 8, bit(i));

  for (let i = 0; i < 8; i++) poser(taille - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) poser(8, taille - 15 + i, bit(i));
  modules[taille - 8][8] = true;
  reserve[taille - 8][8] = true;
}

function placerDonnees(matrice, octets) {
  const { taille, modules, reserve } = matrice;
  let index = 0;
  for (let droite = taille - 1; droite >= 1; droite -= 2) {
    if (droite === 6) droite = 5;
    for (let verticale = 0; verticale < taille; verticale++) {
      for (let j = 0; j < 2; j++) {
        const x = droite - j;
        const montant = ((droite + 1) & 2) === 0;
        const y = montant ? taille - 1 - verticale : verticale;
        if (!reserve[y][x] && index < octets.length * 8) {
          modules[y][x] = ((octets[index >>> 3] >>> (7 - (index & 7))) & 1) !== 0;
          index++;
        }
      }
    }
  }
}

function appliquerMasque(matrice, masque) {
  const { taille, modules, reserve } = matrice;
  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      let inverser;
      switch (masque) {
        case 0: inverser = (x + y) % 2 === 0; break;
        case 1: inverser = y % 2 === 0; break;
        case 2: inverser = x % 3 === 0; break;
        case 3: inverser = (x + y) % 3 === 0; break;
        case 4: inverser = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: inverser = ((x * y) % 2) + ((x * y) % 3) === 0; break;
        case 6: inverser = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        default: inverser = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
      }
      if (!reserve[y][x] && inverser) modules[y][x] = !modules[y][x];
    }
  }
}

// Pénalité simplifiée (séries de modules identiques, blocs 2x2, équilibre noir/blanc)
function penalite(modules, taille) {
  let total = 0;
  for (let sens = 0; sens < 2; sens++) {
    for (let a = 0; a < taille; a++) {
      let serie = 1;
      for (let b = 1; b < taille; b++) {
        const courant = sens === 0 ? modules[a][b] : modules[b][a];
        const precedent = sens === 0 ? modules[a][b - 1] : modules[b - 1][a];
        if (courant === precedent) {
          serie++;
          if (serie === 5) total += 3;
          else if (serie > 5) total += 1;
        } else {
          serie = 1;
        }
      }
    }
  }
  for (let y = 0; y < taille - 1; y++) {
    for (let x = 0; x < taille - 1; x++) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) total += 3;
    }
  }
  let noirs = 0;
  for (const ligne of modules) for (const m of ligne) if (m) noirs++;
  const ecart = Math.abs((noirs * 100) / (taille * taille) - 50);
  total += Math.floor(ecart / 5) * 10;
  return total;
}

function encoderTexte(texte) {
  const octets = Array.from(new TextEncoder().encode(texte));
  let version = 1;
  while (version <= VERSION_MAX) {
    const bitsCompteur = version <= 9 ? 8 : 16;
    if (4 + bitsCompteur + octets.length * 8 <= nombreOctetsDonnees(version) * 8) break;
    version++;
  }
  if (version > VERSION_MAX) throw new Error("Texte trop long pour le code QR");

  const bits = [];
  const ajouter = (valeur, nb) => {
    for (let i = nb - 1; i >= 0; i--) bits.push((valeur >>> i) & 1);
  };
  ajouter(0b0100, 4);
  ajouter(octets.length, version <= 9 ? 8 : 16);
  octets.forEach((o) => ajouter(o, 8));

  const capaciteBits = nombreOctetsDonnees(version) * 8;
  ajouter(0, Math.min(4, capaciteBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const mots = [];
  for (let i = 0; i < bits.length; i += 8) {
    let o = 0;
    for (let j = 0; j < 8; j++) o = (o << 1) | bits[i + j];
    mots.push(o);
  }
  for (let pad = 0xec; mots.length < nombreOctetsDonnees(version); pad ^= 0xec ^ 0x11) mots.push(pad);

  return { version, mots };
}

function entrelacer(version, mots) {
  const nbBlocs = BLOCS_M[version];
  const nbEc = OCTETS_EC_M[version];
  const totalMots = Math.floor(nombreModulesDonnees(version) / 8);
  const nbBlocsCourts = nbBlocs - (totalMots % nbBlocs);
  const longueurCourt = Math.floor(totalMots / nbBlocs);

  const blocs = [];
  let debut = 0;
  for (let i = 0; i < nbBlocs; i++) {
    const longueurDonnees = longueurCourt - nbEc + (i < nbBlocsCourts ? 0 : 1);
    const donnees = mots.slice(debut, debut + longueurDonnees);
    debut += longueurDonnees;
    blocs.push({ donnees, ec: octetsCorrection(donnees, nbEc) });
  }

  const resultat = [];
  const maxDonnees = Math.max(...blocs.map((b) => b.donnees.length));
  for (let i = 0; i < maxDonnees; i++) blocs.forEach((b) => i < b.donnees.length && resultat.push(b.donnees[i]));
  for (let i = 0; i < nbEc; i++) blocs.forEach((b) => resultat.push(b.ec[i]));
  return resultat;
}

export function genererQr(texte) {
  const { version, mots } = encoderTexte(texte);
  const octets = entrelacer(version, mots);

  let meilleur = null;
  let meilleurScore = Infinity;
  for (let masque = 0; masque < 8; masque++) {
    const matrice = creerMatrice(version);
    placerDonnees(matrice, octets);
    appliquerMasque(matrice, masque);
    dessinerFormat(matrice.modules, matrice.reserve, matrice.taille, masque);
    const score = penalite(matrice.modules, matrice.taille);
    if (score < meilleurScore) {
      meilleurScore = score;
      meilleur = matrice;
    }
  }
  return meilleur.modules;
}
