// Données : stockage local (sur le téléphone), données fictives, statistiques.
import { CONFIG as C } from './config.js';
const KEY = 'attension.v1', H = 36e5;
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
// Pour revoir les données de démonstration pendant le développement : ouvrir l'adresse avec ?reset
if (new URLSearchParams(location.search).has('reset')) { try { localStorage.removeItem(KEY); } catch {} history.replaceState(null, '', location.pathname + location.hash); }
export const state = { lang: 'fr', profile: null, readings: null, demo: false, symptoms: [], messages: [], lu: 0, draft: null, ...load() };
export const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

// Personne à risque fictive (valeurs proches de celles d'une population hypertendue)
function demo() {
  let s = 42; const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const g = () => r() + r() + r() - 1.5, out = [], now = Date.now();
  for (let d = C.joursDemo - 1; d >= 0; d--) C.rappels.forEach((hm, i) => {
    const [h, m] = hm.split(':').map(Number), x = new Date();
    x.setDate(x.getDate() - d); x.setHours(h, m, 0, 0);
    if (x > now) return;
    out.push({ t: +x, sys: Math.round(143 + [4, 0, -2][i % 3] + g() * 14), dia: Math.round(89 + g() * 9),
      pul: Math.round(75 + g() * 10), spo2: 96 + Math.round(r() * 2) });
  });
  return out;
}
if (!state.readings) { state.readings = demo(); state.demo = true; save(); }

// ---------- Comptes (v8.0 : Supabase) ----------
// NOTE: les comptes viennent de Supabase (sync.js) ; ici, seulement une copie locale pour l'affichage. Plus aucun mot de passe n'est stocké dans l'appareil.
export const normCode = s => String(s || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
state.accounts = (state.accounts || []).filter(a => UUID.test(a.id)); // anciens comptes locaux (avant v8.0) retirés
const MP = C.medecinProfil;
// Points d'accroche : sync.js y branche l'envoi vers Supabase (évite une importation circulaire)
export const hooks = {};
export const findAcc = id => state.accounts.find(a => a.id === id);
export const findCode = c => c ? state.accounts.find(a => a.role === 'doctor' && normCode(a.code) === normCode(c)) : null;
export const accName = a => !a ? '' : a.role === 'doctor' ? 'Dr. ' + a.last : [a.first, a.last].filter(Boolean).join(' ');
export const initials = a => ((a.first || '?')[0] + (a.last ? a.last[0] : (a.first || '')[1] || '')).toUpperCase();
export const ageOf = dob => dob ? Math.floor((Date.now() - new Date(dob)) / 31557600000) : '–';
// Données par patient : les champs du dessus (mesures, symptômes, messages) appartiennent au patient « courant » ; les autres sont rangés dans state.buckets
const FIELDS = ['readings', 'demo', 'symptoms', 'messages', 'lu', 'draft'];
const EMPTY = () => ({ readings: [], demo: false, symptoms: [], messages: [], lu: 0, draft: null });
export const CUR = () => state.cur || 'P-001';
export function useData(id) {
  if (CUR() === id) return;
  state.buckets = state.buckets || {};
  if (CUR() !== '-') state.buckets[CUR()] = Object.fromEntries(FIELDS.map(k => [k, state[k]]));
  Object.assign(state, state.buckets[id] || EMPTY());
  delete state.buckets[id]; state.cur = id; save();
}
export const dataOf = id => CUR() === id ? state : (state.buckets?.[id] || EMPTY());
// Efface les données de l'utilisateur sur cet appareil (déconnexion, suppression de compte) ; la liste d'envoi (outbox) est gardée
export function clearUserData() {
  Object.assign(state, EMPTY(), { accounts: [], buckets: {}, seuils: {}, notes: {}, cur: '-', user: null, msgCur: '' });
  try { sessionStorage.removeItem('attension.u'); } catch {}
  save();
}
// Seuil de tension par patient (modifiable par le médecin) ; 140/90 par défaut
export const thrOf = id => state.seuils?.[id] || C.seuil;
export const thr = () => thrOf(CUR());
export const setThr = (id, s) => { state.seuils = state.seuils || {}; state.seuils[id] = s; save(); };
export const rappels = () => state.rappels || C.rappels;

// Première vraie mesure : les données de démonstration sont effacées
export const addReading = x => {
  if (state.demo) { state.readings = []; state.demo = false; }
  state.readings.push(x); state.readings.sort((a, b) => a.t - b.t); hooks.reading?.(x); save();
};
export const inPeriod = h => state.readings.filter(x => x.t >= Date.now() - h * H);
export const high = (x, th = thr()) => x.sys >= th.sys || x.dia >= th.dia;
export const jumps = a => a.filter((x, i) => i && x.t - a[i - 1].t <= C.variation.maxH * H &&
  (Math.abs(x.sys - a[i - 1].sys) >= C.variation.sys || Math.abs(x.dia - a[i - 1].dia) >= C.variation.dia)).length;
export const stats = (a, k) => {
  const v = a.map(x => x[k]); if (!v.length) return null;
  const m = v.reduce((p, c) => p + c, 0) / v.length;
  const sd = v.length > 1 ? Math.sqrt(v.reduce((p, c) => p + (c - m) ** 2, 0) / (v.length - 1)) : 0; // écart-type d'échantillon
  return { min: Math.min(...v), max: Math.max(...v), m, sd };
};
// Temps (ms) avant le prochain rappel
export const nextSlot = () => {
  const n = new Date();
  for (let d = 0; d < 2; d++) for (const hm of rappels()) {
    const [h, m] = hm.split(':').map(Number), x = new Date(n);
    x.setDate(n.getDate() + d); x.setHours(h, m, 0, 0);
    if (x > n) return x - n;
  }
};

// Symptômes et messages
export const addSymptoms = e => { state.symptoms.push(e); state.symptoms.sort((a, b) => a.t - b.t); hooks.symptoms?.(e); save(); };
export const addMessage = m => { state.messages.push(m); hooks.message?.(m, null); save(); };
// Message du médecin vers un patient (rangé dans les données de ce patient)
export const addMsgFor = (pid, m) => {
  state.buckets = state.buckets || {};
  const x = CUR() === pid ? state : (state.buckets[pid] = state.buckets[pid] || EMPTY());
  x.messages.push(m); hooks.message?.(m, pid); save();
};
export const sig = e => { const v = C.symptomes.map(([id]) => e.n[id] || 0), n = k => v.filter(x => x >= k).length; return n(3) >= C.combinaison.severe || n(2) >= C.combinaison.modere || n(1) >= C.combinaison.leger; };
export const ppAbn = x => { const p = x.sys - x.dia; return p >= C.tensionPulsee || p <= C.tensionPulseeMin; };
// Mesure au-dessus du seuil + symptôme significatif dans la fenêtre autour de l’instant t (voir config.js)
export const combo = t => {
  const w = C.fenetreSymptomesH * H, r = state.readings.filter(x => Math.abs(x.t - t) <= w && high(x)), s = state.symptoms.filter(e => Math.abs(e.t - t) <= w && sig(e));
  return r.length && s.length ? { r: r.at(-1), s: s.at(-1) } : null;
};
// Deux mesures (ou plus) au-dessus du seuil dans la fenêtre de 2 h autour de la nouvelle mesure x
export const twoHigh = x => {
  const w = C.fenetreSymptomesH * H, ys = state.readings.filter(y => Math.abs(y.t - x.t) <= w && high(y));
  return high(x) && ys.length >= C.mesuresHautes ? { r: x, ys } : null;
};

// Alertes d'un patient depuis l'instant « since » : mesures élevées rapprochées, ou symptômes préoccupants + mesure élevée
export const alertsOf = (R, S, since, th = thr()) => {
  const w = C.fenetreSymptomesH * H, out = [];
  R.forEach(x => { if (x.t >= since && high(x, th) && R.filter(y => y.t <= x.t && x.t - y.t <= w && high(y, th)).length >= C.mesuresHautes) out.push({ t: x.t, k: 'bp', r: x }); });
  S.forEach(e => { if (e.t >= since && sig(e)) { const r = R.filter(x => Math.abs(x.t - e.t) <= w && high(x, th)).at(-1); if (r) out.push({ t: e.t, k: 'sym', r, e }); } });
  return out.sort((a, b) => a.t - b.t);
};

// NOTE: patients fictifs générés pour l'interface médecin (niveau visé : critique, moyen ou bon) ; le patient Test utilise les données de cet appareil
const FK = [['Amina K.', 58, 'crit', 150, 94], ['Paul N.', 66, 'crit', 146, 92], ['Grace T.', 49, 'moy', 138, 88], ['Jean M.', 72, 'moy', 136, 86], ['Sarah B.', 55, 'moy', 139, 87], ['David O.', 44, 'bon', 122, 78], ['Léa F.', 61, 'bon', 126, 80], ['Marc D.', 70, 'bon', 124, 79]];
const fake = ([nom, age, cl, ms, md], i) => {
  let s = 100 + i * 17; const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296, g = () => r() + r() + r() - 1.5, R = [], S = [], now = Date.now();
  const z = () => Object.fromEntries(C.symptomes.map(([id]) => [id, 0]));
  for (let d = 29; d >= 0; d--) C.rappels.forEach(hm => {
    const [h, m] = hm.split(':').map(Number), x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, m, 0, 0);
    if (x > now) return;
    let sys = Math.round(ms + g() * 14), dia = Math.round(md + g() * 9);
    if (cl === 'bon') { sys = Math.min(sys, 136); dia = Math.min(dia, 86); }
    R.push({ t: +x, sys, dia, pul: Math.round(74 + g() * 10), spo2: 96 + Math.round(r() * 2) });
  });
  if (cl === 'crit') { const b = R.filter(x => x.t > now - 3 * 864e5 && high(x)).at(-1) || R.at(-1); R.push({ t: b.t + H, sys: b.sys + 4, dia: b.dia + 2, pul: b.pul + 5, spo2: 96 }); S.push({ t: b.t + H, n: { ...z(), saignement: 3, cephalee: 2 }, o: '' }); }
  if (cl === 'moy') S.push({ t: now - 2 * 864e5, n: { ...z(), cephalee: 1 }, o: '' });
  R.sort((a, b) => a.t - b.t);
  return { id: 'P-' + String(i + 2).padStart(3, '0'), nom, age, ajout: now - (3 + i * 6) * 864e5, readings: R, symptoms: S };
};
let FAKE;
// Patients d'un médecin (code) : patient Test + patients réels liés au code ; les patients fictifs disparaissent dès qu'un vrai patient est lié (niveau : critique = alerte dans les 7 derniers jours ; moyen = mesure au-dessus du seuil ; bon = aucune)
export const patients = (code = MP.code) => {
  FAKE = FAKE || FK.map(fake);
  const since = Date.now() - C.joursNiveau * 864e5, mine = normCode(code) === normCode(MP.code);
  const mk = a => { const x = dataOf(a.id); return { id: a.id, nom: accName(a), age: ageOf(a.dob), ajout: a.created, readings: x.readings || [], symptoms: x.symptoms || [], msgs: x.messages || [], real: 1 }; };
  const lnk = state.accounts.filter(a => a.role === 'patient' && a.code && normCode(a.code) === normCode(code));
  const real = lnk.filter(a => !a.test).map(mk), tst = lnk.filter(a => a.test).map(mk);
  const all = [...tst, ...real, ...(mine && !real.length ? FAKE : [])];
  all.forEach(p => { p.th = thrOf(p.id); p.al = alertsOf(p.readings, p.symptoms, since, p.th); p.lv = p.al.length ? 'crit' : p.readings.some(x => x.t >= since && high(x, p.th)) ? 'moy' : 'bon'; });
  return all;
};
