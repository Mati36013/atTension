// Client Supabase minimal, sans bibliothèque : connexion, tables (REST) et fonctions (rpc).
// La clé « publishable » est publique (elle peut être dans le code) ; les règles de sécurité (RLS) de la base protègent les données.
import { CONFIG as C } from './config.js';
const U = C.supabase.url, K = C.supabase.key, SK = 'attension.sb';

export class SbError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

let sess = null, local = true, refreshing = null;
for (const [s, l] of [[sessionStorage, false], [localStorage, true]]) { try { const v = JSON.parse(s.getItem(SK)); if (v?.access_token) { sess = v; local = l; } } catch {} }
const put = (v, remember) => {
  if (remember !== undefined) local = remember;
  try { localStorage.removeItem(SK); sessionStorage.removeItem(SK); } catch {}
  sess = v;
  if (v) try { (local ? localStorage : sessionStorage).setItem(SK, JSON.stringify(v)); } catch {}
};
export const session = () => sess;
export const remembered = () => local;
export const myId = () => sess?.user?.id || null;
export const myEmail = () => sess?.user?.email || '';
export const uuid = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });

const norm = j => ({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600), user: j.user });

async function call(path, { method = 'GET', body, headers = {}, token = true } = {}) {
  const h = { apikey: K, 'Content-Type': 'application/json', ...headers };
  if (token && sess) h.Authorization = 'Bearer ' + sess.access_token;
  let r;
  try { r = await fetch(U + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch { throw new SbError(0, 'network'); }
  const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch {}
  if (!r.ok) throw new SbError(r.status, j?.msg || j?.message || j?.error_description || j?.error || r.statusText);
  return j;
}

// Renouvelle le jeton avant son expiration (une seule demande à la fois : les jetons de renouvellement sont à usage unique)
async function fresh() {
  if (!sess || sess.expires_at * 1000 - Date.now() > 60e3) return;
  refreshing = refreshing || call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: sess.refresh_token }, token: false })
    .then(j => put(norm(j))).catch(e => { if (e.status >= 400 && e.status < 500) put(null); throw e; }).finally(() => { refreshing = null; });
  await refreshing;
}
const api = async (path, o) => { await fresh(); return call(path, o); };

// ---------- Authentification ----------
export async function signIn(email, password, remember) {
  const j = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, token: false });
  put(norm(j), remember); return sess.user;
}
export async function signUp(email, password, data, remember) {
  const j = await call('/auth/v1/signup', { method: 'POST', body: { email, password, data }, token: false });
  if (j?.access_token) { put(norm(j), remember); return true; }
  return false; // courriel à confirmer avant la connexion
}
export async function signOut() { try { if (sess) await call('/auth/v1/logout', { method: 'POST' }); } catch {} put(null); }
export const setPassword = password => api('/auth/v1/user', { method: 'PUT', body: { password } });

// ---------- Tables ----------
export const get = (table, query) => api(`/rest/v1/${table}?${query}`);
// Lecture complète par pages de 1000 lignes (limite par défaut de Supabase)
export async function getAll(table, query) {
  const out = []; for (let o = 0; ; o += 1000) { const p = await get(table, `${query}&limit=1000&offset=${o}`); out.push(...p); if (p.length < 1000) return out; }
}
export const insert = (table, rows) => api(`/rest/v1/${table}`, { method: 'POST', body: rows, headers: { Prefer: 'return=minimal' } });
export const update = (table, query, patch) => api(`/rest/v1/${table}?${query}`, { method: 'PATCH', body: patch, headers: { Prefer: 'return=minimal' } });
export const rpc = (fn, args = {}) => api(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args });
