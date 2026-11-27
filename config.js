// Réglages du prototype : tout se change ici, sans toucher au reste du code.
export const CONFIG = {
  seuil: { sys: 140, dia: 90 }, // NOTE: seuil par défaut ; le médecin peut le modifier pour chaque patient (page du patient, interface médecin) ; les cases diabète / prédispositions des croquis sont ignorées pour l’instant
  tensionPulsee: 60, tensionPulseeMin: 20, // anormale si ≥ 60 ou ≤ 20            // NOTE: valeur provisoire, à vérifier avec M. Tematio
  variation: { sys: 20, dia: 10, maxH: 8 }, // NOTE: « grande variation » provisoire (écart entre 2 mesures proches), à vérifier avec M. Tematio
  rappels: ['08:00', '14:00', '18:00'],     // NOTE: 3 par jour pour le prototype, modifiable ici
  // NOTE COMPTE À REBOURS : il remplace les notifications de rappel. Une PWA ne peut pas, de façon fiable,
  // afficher une notification programmée quand elle est fermée sans serveur. Ce choix évite le coût et la
  // complexité d'un serveur pour le prototype. Pour de vrais rappels : serveur Web Push ou application native.
  conservationAns: 10,          // NOTE: durée standard à confirmer (pas encore appliquée)
  joursDemo: 30,
  joursNiveau: 7, // NOTE: niveau du patient (critique / moyen / bon) calculé sur les 7 derniers jours
  mesuresHautes: 2, // NOTE: 2 mesures au-dessus du seuil dans la fenêtre de 2 h déclenchent aussi le pop-up d’alerte (sans symptômes) ; sujet à changement
  comptes: { patient: { user: 'Test' }, medecin: { id: '12345678' } }, // NOTE: v8.0 : identifiants de test seulement (les mots de passe ne sont plus dans le code : ils sont dans Supabase) ; chacun est converti en courriel (voir supabase.connexions)
  contactConfidentialite: '', // NOTE: courriel affiché dans la politique de confidentialité ; laisser vide tant qu'il n'y en a pas (la phrase de contact est alors omise)
  supabase: {
    url: 'https://qwzvglcreksfvlcevgha.supabase.co',
    key: 'sb_publishable_qhrDVR8rmiHZYKUlCLM3Dg_B6ug5K3D', // clé publique (publishable) : sans danger dans le code ; ne jamais mettre ici la clé « secret » / service_role
    connexions: { test: 'test@attension.com', 12345678: 'jlapierre@attension.com' }, // identifiant (minuscules) → courriel du compte Supabase ; tout autre compte se connecte avec son courriel
    courrielPatientTest: 'test@attension.com', courrielMedecinTest: 'jlapierre@attension.com',
    sondageSec: 6, // NOTE: la messagerie interroge la base toutes les 6 s (sans « temps réel » WebSocket) ; à remplacer par Supabase Realtime plus tard
  },
  plages: { sys: [70, 260], dia: [40, 150], pul: [30, 220], spo2: [70, 100] }, // plages habituelles : une valeur hors de ces plages (mais entre 1 et 1000) demande une confirmation
  combinaison: { leger: 5, modere: 2, severe: 1 }, // NOTE: tension au-dessus du seuil + (5 symptômes légers, ou 2 modérés, ou 1 sévère ; décomptes cumulatifs) ; sujet à changement
  fenetreSymptomesH: 2, // fenêtre d’analyse tension + symptôme (heures avant et après)
  symptomes: [['saignement', '🩸'], ['cephalee', '🤕'], ['vertiges', '😵‍💫'], ['essoufflement', '😮‍💨'], ['vision', '👁️'], ['faiblesse', '💪'], ['confusion', '😕'], ['equilibre', '🚶']], // NOTE: du plus au moins important ; liste modifiée par l’équipe (saignement du nez et essoufflement remplacent fourmillements et troubles de la parole), à confirmer plus tard
  nomMedecin: { fr: 'Dr. Lapierre', en: 'Dr. Lapierre' }, // NOTE: nom d’utilisateur du médecin de test (Jean Lapierre) ; les nouveaux médecins s’affichent « Dr. Nom »
  medecinProfil: { prenom: 'Jean', nom: 'Lapierre', code: 'ABC-123', specialite: 'Médecine générale', etablissement: 'Clinique fictive' }, // NOTE: spécialité et établissement fictifs (provisoires) pour le profil du médecin de test ; code médecin ABC-123 (accepté aussi sans tiret)
  motDePasseMin: 8, // NOTE: longueur minimale des mots de passe des comptes créés (les comptes de test gardent les leurs)
  // NOTE MESSAGERIE (v8.0) : réelle, entre le patient et son médecin, stockée dans Supabase (table messages).
  nomUtilisateur: { fr: 'Nom d’utilisateur', en: 'Username' }, // NOTE: temporaire, à remplacer par le nom du profil (connexion à venir)
  // NOTE: v8.0 : comptes et données dans Supabase (authentification, règles de sécurité par ligne) ; vérification de licence simulée : le champ license_verified se change à la main dans Supabase (le médecin de test est « vérifié »)
};
