// Synchronisation avec Supabase (v8.0) : l'app garde une copie locale (rapide, fonctionne hors ligne) ;
// la base est la source de vérité. Envois en file d'attente (outbox), lecture au démarrage, messagerie par sondage.
import { CONFIG as C } from './config.js';
import * as Sb from './supa.js';
import { state, save, useData, hooks, normCode, clearUserData } from './data.js';

const E = C.supabase, MP = C.medecinProfil, CLIP = '\u{1F4CE}';
const iso = ms => new Date(ms).toISOString();

// Identifiant ou courriel saisi → courriel du compte
export const emailOf = u => { u = String(u || '').trim().toLowerCase(); return !u ? null : u.includes('@') ? u : (E.connexions[u] || null); };

// ---------- Correspondance base ↔ données locales ----------
// NOTE: tout ce qui vient de la base peut avoir été écrit par un autre utilisateur : on ne garde que des formes connues (sinon une pièce jointe piégée pourrait faire planter la page du médecin)
const str = (v, max = 4000) => typeof v === 'string' ? v.slice(0, max) : '';
const cleanAtt = a => Array.isArray(a) ? a.filter(x => x && typeof x === 'object' && ['ph', 't', 's'].includes(x.k) && typeof x.d === 'string').map(x => ({ k: x.k, d: x.k === 'ph' ? x.d.slice(0, 3e6) : x.d.slice(0, 500) })) : [];
const okTime = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const mR = r => ({ id: r.id, t: Date.parse(r.measured_at), sys: r.systolic, dia: r.diastolic, pul: r.pulse, spo2: r.spo2 });
const mS = r => { const v = r.symptoms && typeof r.symptoms === 'object' && !Array.isArray(r.symptoms) ? r.symptoms : {}; return { id: r.id, t: Date.parse(r.recorded_at), n: v.n && typeof v.n === 'object' && !Array.isArray(v.n) ? v.n : {}, o: str(v.o, 1000) }; };
const mM = (r, pid) => ({ id: r.id, t: Date.parse(r.created_at), from: r.sender_id === pid ? 'p' : 'd', x: r.body === CLIP && r.attachment ? '' : str(r.body), a: cleanAtt(r.attachment), al: r.kind === 'alert' || undefined, cur: r.created_at });

function accOf(p, email = '') {
  const d = p.details || {}, doc = p.role === 'doctor', em = String(email || d.email || '').toLowerCase();
  const isMed = doc && em === E.courrielMedecinTest;
  let first = d.first, last = d.last;
  if (first == null && last == null) {
    const n = String(p.full_name || '').replace(/^dr\.?\s+/i, '').trim(), i = n.indexOf(' ');
    first = i < 0 ? n : n.slice(0, i); last = i < 0 ? '' : n.slice(i + 1);
    if (doc && !last) { last = first; first = ''; }
    if (isMed) { first = MP.prenom; last = MP.nom; }
    if (!first && !last) first = em ? em.split('@')[0] : '';
  }
  return { id: p.id, role: p.role, first: first || '', last: last || '', login: '', email: em, phone: d.phone || '', dob: d.dob || '',
    spec: d.spec || (isMed ? MP.specialite : ''), etab: d.etab || (isMed ? MP.etablissement : ''), licence: d.licence || '', verified: !!p.license_verified,
    test: !!d.test || em === E.courrielPatientTest, det: d, created: Date.parse(p.created_at) || Date.now(), docId: p.doctor_id || null, code: doc ? (p.doctor_code || '') : '' };
}
const upsert = a => {
  const i = state.accounts.findIndex(x => x.id === a.id);
  if (i < 0) state.accounts.push(a); else state.accounts[i] = { ...state.accounts[i], ...a };
  return state.accounts.find(x => x.id === a.id);
};
const pending = (table, owner) => (state.outbox || []).filter(o => o.table === table && o.owner === owner).map(o => o.row);
const withPending = (remote, table, owner) => [...remote, ...pending(table, owner).filter(r => !remote.some(x => x.id === r.id))];
const emptyBucket = () => ({ readings: [], demo: false, symptoms: [], messages: [], lu: 0, draft: null });

// ---------- Lecture (connexion, démarrage, rafraîchissement) ----------
export async function pullSelf() {
  await flush();
  const id = Sb.myId(), [p] = await Sb.get('profiles', `select=*&id=eq.${id}`);
  if (!p) throw new Sb.SbError(404, 'profil');
  const me = upsert(accOf(p, Sb.myEmail()));
  if (p.role === 'doctor') await pullDoctor(me); else await pullPatient(me, p);
  save(); return me;
}

async function pullPatient(me, p) {
  me.code = ''; me.docId = p.doctor_id || null;
  if (p.doctor_id) { const [d] = await Sb.get('profiles', `select=*&id=eq.${p.doctor_id}`); if (d) { upsert({ ...accOf(d), code: d.doctor_code }); me.code = d.doctor_code; } }
  const [R, S, M] = await Promise.all([
    Sb.getAll('measurements', `select=*&patient_id=eq.${me.id}&order=measured_at.asc,id.asc`),
    Sb.getAll('symptom_entries', `select=*&patient_id=eq.${me.id}&order=recorded_at.asc,id.asc`),
    Sb.getAll('messages', 'select=*&order=created_at.asc,id.asc')]);
  useData(me.id);
  const msgs = withPending(M, 'messages', me.id).map(r => mM(r, me.id)).sort((a, b) => a.t - b.t);
  Object.assign(state, { readings: withPending(R, 'measurements', me.id).map(mR).sort((a, b) => a.t - b.t), demo: false,
    symptoms: withPending(S, 'symptom_entries', me.id).map(mS).sort((a, b) => a.t - b.t), messages: msgs, lu: (state.luMap || {})[me.id] || 0, msgCur: M.at(-1)?.created_at || '' });
  state.seuils = { ...(state.seuils || {}), [me.id]: { sys: p.threshold_sys, dia: p.threshold_dia } };
  if (Array.isArray(p.reminder_times) && p.reminder_times.length === 3 && p.reminder_times.every(okTime)) state.rappels = p.reminder_times;
}

async function pullDoctor(me) {
  const P = await Sb.getAll('profiles', `select=*&doctor_id=eq.${me.id}&order=created_at.asc,id.asc`), ids = P.map(x => x.id);
  state.accounts = state.accounts.filter(a => a.id === me.id || a.role === 'doctor' || ids.includes(a.id));
  P.forEach(x => upsert({ ...accOf(x), code: me.code }));
  state.seuils = {}; P.forEach(x => { state.seuils[x.id] = { sys: x.threshold_sys, dia: x.threshold_dia }; });
  let R = [], S = [];
  if (ids.length) {
    const q = `patient_id=in.(${ids.join(',')})`;
    [R, S] = await Promise.all([Sb.getAll('measurements', `select=*&${q}&order=measured_at.asc,id.asc`), Sb.getAll('symptom_entries', `select=*&${q}&order=recorded_at.asc,id.asc`)]);
  }
  const M = await Sb.getAll('messages', 'select=*&order=created_at.asc,id.asc'), pm = pending('messages', me.id);
  state.buckets = {};
  ids.forEach(pid => {
    const msgs = [...M.filter(m => m.sender_id === pid || m.recipient_id === pid), ...pm.filter(m => m.recipient_id === pid && !M.some(x => x.id === m.id))];
    state.buckets[pid] = { ...emptyBucket(), readings: R.filter(r => r.patient_id === pid).map(mR), symptoms: S.filter(r => r.patient_id === pid).map(mS), messages: msgs.map(m => mM(m, pid)).sort((a, b) => a.t - b.t) };
  });
  state.msgCur = M.at(-1)?.created_at || '';
}

// Nouveaux messages depuis le dernier reçu (sondage) ; retourne true s'il y en a
async function pullMsgs() {
  const me = Sb.myId(), acc = me && state.accounts.find(a => a.id === me); if (!acc) return false;
  const cur = state.msgCur ? `&created_at=gt.${encodeURIComponent(state.msgCur)}` : '';
  const M = await Sb.getAll('messages', `select=*${cur}&order=created_at.asc,id.asc`); let ch = false;
  M.forEach(r => {
    const doc = acc.role === 'doctor', pid = doc ? (r.sender_id === me ? r.recipient_id : r.sender_id) : me;
    const x = doc ? (state.buckets[pid] = state.buckets[pid] || emptyBucket()) : state;
    if (!x.messages.some(m => m.id === r.id)) { x.messages.push(mM(r, pid)); x.messages.sort((a, b) => a.t - b.t); ch = true; }
  });
  if (M.length) { state.msgCur = M.at(-1).created_at; save(); }
  return ch;
}

// ---------- Envoi (file d'attente : fonctionne hors ligne, sans doublons grâce aux identifiants) ----------
let busy = false;
const queue = (table, row) => { (state.outbox = state.outbox || []).push({ table, row, owner: Sb.myId() }); save(); flush(); };
export async function flush() {
  const me = Sb.myId(); if (busy || !me || !navigator.onLine) return; busy = true;
  try {
    for (;;) {
      const i = (state.outbox || []).findIndex(o => o.owner === me); if (i < 0) break;
      const op = state.outbox[i];
      try { await Sb.insert(op.table, op.row); }
      catch (e) {
        if (e.status === 0 || e.status === 401 || e.status === 408 || e.status === 429 || e.status >= 500) break; // on réessaiera
        if (e.status !== 409) console.error('Envoi refusé par la base :', op.table, e.message); // 409 = déjà reçu
      }
      state.outbox.splice(i, 1); save();
    }
  } finally { busy = false; }
}
hooks.reading = x => { x.id = x.id || Sb.uuid(); queue('measurements', { id: x.id, patient_id: Sb.myId(), systolic: x.sys, diastolic: x.dia, pulse: x.pul, spo2: x.spo2, measured_at: iso(x.t) }); };
hooks.symptoms = e => { e.id = e.id || Sb.uuid(); queue('symptom_entries', { id: e.id, patient_id: Sb.myId(), symptoms: { n: e.n, o: e.o || '' }, recorded_at: iso(e.t) }); };
hooks.message = (m, pid) => {
  m.id = m.id || Sb.uuid();
  const me = Sb.myId(), to = pid || state.accounts.find(a => a.id === me)?.docId; if (!to) return;
  queue('messages', { id: m.id, sender_id: me, recipient_id: to, body: m.x || CLIP, kind: m.al ? 'alert' : 'message', attachment: m.a?.length ? m.a : null, created_at: iso(m.t) });
};

// ---------- Comptes ----------
const bad = e => e.status === 0 ? 'netErr' : 'badLogin';
export async function login(u, w, remember, role) {
  const em = emailOf(u); if (!em || !w) return { err: 'badLogin' };
  try { await Sb.signIn(em, w, remember); } catch (e) { return { err: bad(e) }; }
  let k; try { k = await pullSelf(); } catch (e) { await Sb.signOut(); clearUserData(); return { err: e.status === 0 ? 'netErr' : 'syncErr' }; }
  if (k.role !== role) { await Sb.signOut(); clearUserData(); return { err: 'badLogin' }; }
  if (role === 'doctor' && !k.verified) { await Sb.signOut(); clearUserData(); return { err: 'p_pending' }; } // NOTE: licence vérifiée à la main dans Supabase (license_verified)
  return { acc: k };
}
export async function logout() {
  await Promise.race([flush(), new Promise(r => setTimeout(r, 2500))]);
  await Sb.signOut(); clearUserData();
}
export async function register(d) {
  const doc = d.role === 'doctor', full = [d.fn, d.ln].filter(Boolean).join(' '); let open;
  try { open = await Sb.signUp(d.em.toLowerCase(), d.pw, { role: d.role, full_name: full, language: state.lang }, false); }
  catch (e) { return { err: e.status === 0 ? 'netErr' : /regist|already|exist/i.test(e.message) ? 'p_mailUsed' : 'p_pwRefused' }; }
  if (!open) return { confirm: true };
  const det = { first: d.fn, last: d.ln, phone: d.ph, email: d.em.toLowerCase(), ...(doc ? { spec: d.sp, etab: d.et, licence: d.li } : { dob: d.dob }) };
  try { await Sb.update('profiles', `id=eq.${Sb.myId()}`, { full_name: full, details: det }); } catch { /* le profil sera complété à la modification */ }
  if (doc) { await Sb.signOut(); clearUserData(); return { pending: true }; }
  let codeBad = false;
  if (d.code) { try { await Sb.rpc('link_to_doctor', { p_code: d.code }); } catch { codeBad = true; } }
  try { return { acc: await pullSelf(), codeBad }; } catch { await Sb.signOut(); clearUserData(); return { err: 'syncErr' }; }
}
export async function saveProfile(k, x) { // x : first, last, phone + (dob, code) ou (spec, etab)
  const det = { ...(k.det || {}), first: x.first, last: x.last, phone: x.phone, email: k.email || k.det?.email };
  if (k.role === 'doctor') { det.spec = x.spec; det.etab = x.etab; } else det.dob = x.dob;
  await Sb.update('profiles', `id=eq.${k.id}`, { full_name: [x.first, x.last].filter(Boolean).join(' '), details: det });
  if (k.role === 'patient' && normCode(x.code) !== normCode(k.code)) { await (x.code ? Sb.rpc('link_to_doctor', { p_code: x.code }) : Sb.rpc('unlink_from_doctor')); }
  return pullSelf();
}
export async function changePassword(old, nw) {
  try { await Sb.signIn(Sb.myEmail(), old); } catch (e) { return e.status === 0 ? 'netErr' : 'p_pwBad'; }
  try { await Sb.setPassword(nw); } catch (e) { return e.status === 0 ? 'netErr' : 'p_pwRefused'; }
  return 'p_pwDone';
}
export async function deleteMe() { await Sb.rpc('delete_my_account'); await Sb.signOut(); clearUserData(); }
export const setThreshold = (pid, s, d) => Sb.rpc('set_patient_threshold', { p_patient: pid, p_sys: s, p_dia: d });
export const saveReminders = v => Sb.update('profiles', `id=eq.${Sb.myId()}`, { reminder_times: v }).catch(() => {});
export const hasSession = () => !!Sb.session();

// ---------- Sondage (messagerie et rafraîchissement) ----------
let n = 0;
const sig = () => JSON.stringify([state.readings?.length, state.symptoms?.length, state.seuils, state.accounts.map(a => a.id + (a.code || '') + a.verified), Object.values(state.buckets || {}).map(b => b.readings.length + b.symptoms.length)]);
export async function tick(full = false) {
  if (!Sb.myId() || !navigator.onLine) return {};
  const out = {};
  try {
    await flush();
    out.msgs = await pullMsgs();
    if (full || ++n % 10 === 0) { const a = sig(); await pullSelf(); out.data = a !== sig(); }
  } catch (e) { if (e.status === 401 || e.status === 403) out.expired = true; }
  return out;
}
