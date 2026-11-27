// Politique de confidentialité (FR/EN). Pour la modifier : changer seulement les textes ci-dessous ; la page se met en forme toute seule.
// NOTE: texte rédigé pour un prototype de cours (données fictives) ; à faire relire (enseignant ou juriste) avant tout usage avec de vraies données.
// Chaque section : [titre, [paragraphes], [puces]]
export const PRIVACY = {
  fr: {
    title: 'Politique de confidentialité', updated: 'Dernière mise à jour : 26 novembre 2026',
    intro: 'atTension est un prototype réalisé dans le cadre du cours GNG1503 par l’équipe FB34. Il sert à des essais avec des données fictives : n’y saisissez pas de véritables renseignements de santé.',
    s: [
      ['Renseignements recueillis', ['Nous recueillons seulement ce que vous saisissez ou ce qui est nécessaire au fonctionnement :'], [
        'Compte : prénom, nom, courriel, téléphone et, pour un patient, la date de naissance ; pour un médecin, la spécialité, l’établissement et le numéro de permis.',
        'Santé (patient) : tension artérielle, pouls, SpO₂, symptômes, seuil de tension, messages au médecin et photos jointes.',
        'Sur votre appareil : votre session, vos préférences (langue, apparence, rappels) et une copie de vos données pour que l’application soit rapide et fonctionne hors ligne.']],
      ['Pourquoi nous les utilisons', ['Uniquement pour faire fonctionner l’application : suivre votre tension, calculer les alertes, permettre la messagerie entre un patient et son médecin. Nous ne vendons pas vos données, nous n’affichons aucune publicité et nous ne faisons aucun profilage.']],
      ['Qui peut voir vos données', [], [
        'Patient : vous, et le médecin que vous avez lié à votre compte avec son code.',
        'Médecin : vous, et vos patients liés (ils voient votre nom, votre spécialité et votre établissement).',
        'Les administrateurs du projet (équipe FB34) peuvent techniquement accéder à la base pour la maintenance, et s’engagent à ne l’utiliser qu’à cette fin.']],
      ['Hébergement et services tiers', ['Vos données sont hébergées par Supabase (base de données et authentification). Selon la région du serveur, elles peuvent être traitées hors de votre province ou du Canada. Les polices d’écriture sont chargées depuis Google Fonts, ce qui transmet l’adresse IP de votre appareil à Google. Nous n’utilisons aucun outil d’analyse ni témoin de suivi.']],
      ['Conservation', ['Vos données sont conservées tant que votre compte existe. « Supprimer mon compte » (Paramètres) efface définitivement votre compte et toutes vos données. Comme il s’agit d’un prototype, la base peut aussi être effacée à la fin du projet.']],
      ['Sécurité', ['Les échanges sont chiffrés (HTTPS) et la base applique des règles qui limitent l’accès de chacun à ses propres données. Les messages ne sont pas chiffrés de bout en bout. Aucun système n’est parfaitement sûr ; c’est une raison de plus de n’utiliser que des données fictives.']],
      ['Vos droits', ['Vous pouvez consulter, corriger, exporter et supprimer vos données, et retirer votre consentement, en tout temps :'], [
        'Corriger : Profil, Modifier le profil.',
        'Exporter : Paramètres, Exporter.',
        'Supprimer : Paramètres, Supprimer mon compte.',
        'Plainte : Commissariat à la protection de la vie privée du Canada (priv.gc.ca) ou Commissaire à l’information et à la protection de la vie privée de l’Ontario (ipc.on.ca).']],
      ['Avis important', ['atTension n’est pas un dispositif médical, ne pose aucun diagnostic et ne remplace ni un médecin ni un appel d’urgence. En cas de symptômes graves ou soudains, appelez le 911.']],
      ['Changements', ['Cette politique peut être modifiée ; la date de mise à jour ci-dessus indique la version en vigueur.']],
    ],
    contact: 'Pour toute question sur vos renseignements, écrivez à : atTension@fb34.ca'
  },
  en: {
    title: 'Privacy policy', updated: 'Last updated: November 26, 2026',
    intro: 'atTension is a prototype built for the GNG1503 course by team FB34. It is for testing with fictitious data: do not enter real health information.',
    s: [
      ['Information we collect', ['We only collect what you enter or what is needed for the app to work:'], [
        'Account: first name, last name, email, phone and, for a patient, date of birth; for a doctor, specialty, facility and licence number.',
        'Health (patient): blood pressure, pulse, SpO₂, symptoms, blood pressure threshold, messages to the doctor and attached photos.',
        'On your device: your session, your preferences (language, appearance, reminders) and a copy of your data so the app is fast and works offline.']],
      ['Why we use it', ['Only to run the app: track your blood pressure, calculate alerts, and allow messaging between a patient and their doctor. We do not sell your data, show any advertising or do any profiling.']],
      ['Who can see your data', [], [
        'Patient: you, and the doctor you linked to your account with their code.',
        'Doctor: you, and your linked patients (they see your name, specialty and facility).',
        'The project administrators (team FB34) can technically access the database for maintenance, and commit to using it only for that purpose.']],
      ['Hosting and third parties', ['Your data is hosted by Supabase (database and authentication). Depending on the server region, it may be processed outside your province or Canada. Fonts are loaded from Google Fonts, which sends your device’s IP address to Google. We use no analytics tools or tracking cookies.']],
      ['Retention', ['Your data is kept as long as your account exists. “Delete my account” (Settings) permanently erases your account and all your data. Because this is a prototype, the database may also be erased at the end of the project.']],
      ['Security', ['Traffic is encrypted (HTTPS) and the database enforces rules that limit everyone to their own data. Messages are not end-to-end encrypted. No system is perfectly secure; one more reason to use only fictitious data.']],
      ['Your rights', ['You can view, correct, export and delete your data, and withdraw your consent, at any time:'], [
        'Correct: Profile, Edit profile.',
        'Export: Settings, Export.',
        'Delete: Settings, Delete my account.',
        'Complaint: Office of the Privacy Commissioner of Canada (priv.gc.ca) or the Information and Privacy Commissioner of Ontario (ipc.on.ca).']],
      ['Important notice', ['atTension is not a medical device, does not provide any diagnosis and does not replace a doctor or an emergency call. In case of severe or sudden symptoms, call 911.']],
      ['Changes', ['This policy may change; the update date above shows the version in effect.']],
    ],
    contact: 'For any question about your information, write to: '
  }
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Retourne le HTML de la politique ; `contact` (courriel) est facultatif : s'il est vide, la phrase de contact n'est pas affichée
export const privacyHtml = (lang, contact = '') => {
  const L = PRIVACY[lang] || PRIVACY.fr;
  return `<div class="pv"><h1>${esc(L.title)}</h1><p class="mut">${esc(L.updated)}</p><p>${esc(L.intro)}</p>${L.s.map(([h, ps, ul]) => `<h2>${esc(h)}</h2>${(ps || []).map(p => `<p>${esc(p)}</p>`).join('')}${ul && ul.length ? `<ul>${ul.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`).join('')}${contact ? `<p>${esc(L.contact)}<b>${esc(contact)}</b></p>` : ''}</div>`;
};
