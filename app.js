// Écrans et navigation. Un écran = une fonction qui retourne du HTML.
if (window.top !== window.self) document.documentElement.style.display = 'none'; // anti-clickjacking : jamais affichée dans le cadre d'un autre site
import { CONFIG as C } from './config.js';
import { I, t } from './i18n.js';
import { FAQ } from './aide.js';
import { makePdf, makeXlsx, download, fileName } from './export.js';
import { state, save, addReading, addSymptoms, addMessage, combo, inPeriod, stats, nextSlot, high, jumps, ppAbn, sig, twoHigh, patients, thr, thrOf, setThr, rappels, normCode, findAcc, findCode, accName, initials, ageOf, addMsgFor, clearUserData, useData } from './data.js';
import * as Sy from './sync.js';
import { privacyHtml } from './privacy.js';

const $ = s => document.querySelector(s);
const TABS = [['home', '🏠'], ['symptoms', '📝'], ['graph', '📈'], ['messages', '💬'], ['help', '❓'], ['profile', '👤']]; // NOTE: emojis provisoires, à remplacer par les icônes du croquis
let period = 72, timer;
const fmt = ms => new Date(ms).toLocaleString(state.lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const banner = () => state.demo ? `<p class="demo">${t('demo')}</p>` : '';

const REG = [];
// Courbe SVG : axes gradués, zone rouge au-dessus du seuil, valeurs au toucher ou au survol
function chart(a, k, thr, t0, t1, H = 190, lw) {
  const head = `<small>${t(k === 'pp' ? 'ppH' : k)} (mmHg)</small>`;
  if (!a.length) return `${head}<p class="mut">${t('noData')}</p>`;
  const W = 340, L = 38, R = 10, T = 12, B = 40, v = a.map(x => x[k]).concat(thr, lw ?? []);
  const ys = [10, 20, 25, 50].find(s => (Math.max(...v) - Math.min(...v) + 10) / s <= 5) || 50;
  const lo = Math.floor((Math.min(...v) - 5) / ys) * ys, hi = Math.ceil((Math.max(...v) + 5) / ys) * ys;
  const X = ms => +(L + (ms - t0) / (t1 - t0) * (W - L - R)).toFixed(1), Y = n => +(T + (hi - n) / (hi - lo) * (H - T - B)).toFixed(1);
  let g = '', xt = '';
  for (let n = lo; n <= hi; n += ys) g += `<line x1="${L}" x2="${W - R}" y1="${Y(n)}" y2="${Y(n)}" class="gr"/><text x="${L - 5}" y="${Y(n) + 4}" text-anchor="end">${n}</text>`;
  const span = t1 - t0, sh = [6, 12, 24, 48, 120, 240].find(s => span / (s * 36e5) <= 4.5) || 240, d = new Date(t0);
  d.setMinutes(0, 0, 0);
  for (; +d <= t1; d.setHours(d.getHours() + 1)) { // repères de temps : heures, jours ou 5 jours selon la période
    const h = d.getHours();
    if (+d < t0 || (sh < 24 ? h % sh : h || Math.round(d / 864e5) % (sh / 24))) continue;
    const x = X(+d), tx = Math.min(Math.max(x, L + 14), W - R - 14), dl = d.toLocaleDateString(state.lang, sh >= 120 ? { month: 'short' } : { weekday: 'short' });
    xt += `<line x1="${x}" x2="${x}" y1="${T}" y2="${H - B + 5}" class="gr"/>` + (h ? `<text x="${tx}" y="${H - 13}" text-anchor="middle" class="xl">${String(h).padStart(2, '0')}:00</text>` : `<text text-anchor="middle" class="xl"><tspan x="${tx}" y="${H - 20}">${dl}</tspan><tspan x="${tx}" y="${H - 5}">${d.getDate()}</tspan></text>`);
  }
  const yt = Y(thr), pts = a.map(x => [X(x.t), Y(x[k])]);
  return `${head}<div class="ch" data-i="${REG.push({ a, k, X, Y, W }) - 1}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t(k)}">
${g}<rect x="${L}" y="${T}" width="${W - L - R}" height="${yt - T}" class="bd"/>
<line x1="${L}" x2="${W - R}" y1="${yt}" y2="${yt}" class="th"/><text x="${W - R - 4}" y="${yt - 5}" text-anchor="end" class="tl">${t('above')} (${thr})</text>${lw != null ? `<rect x="${L}" y="${Y(lw)}" width="${W - L - R}" height="${(H - B - Y(lw)).toFixed(1)}" class="bd"/><line x1="${L}" x2="${W - R}" y1="${Y(lw)}" y2="${Y(lw)}" class="th"/><text x="${W - R - 4}" y="${Y(lw) + 14}" text-anchor="end" class="tl">${t('below')} (${lw})</text>` : ''}
<line x1="${L}" x2="${L}" y1="${T}" y2="${H - B}" class="ax"/><line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="ax"/>${xt}
<polyline points="${pts.join(' ')}" class="ln"/>${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${a.length > 40 ? 2 : 3.5}" class="pt"/>`).join('')}
<line class="mk" y1="${T}" y2="${H - B}"/><circle class="hl" r="6"/></svg><div class="tip"></div></div>`;
}

// Au toucher ou au survol : affiche la mesure la plus proche (date, valeurs, pouls)
function wire() {
  document.querySelectorAll('.ch').forEach(el => {
    const c = REG[+el.dataset.i], svg = el.querySelector('svg'), tip = el.querySelector('.tip'), mk = el.querySelector('.mk'), hl = el.querySelector('.hl');
    const show = e => {
      const r = svg.getBoundingClientRect(), s = r.width / c.W, px = (e.clientX - r.left) / s;
      const p = c.a.reduce((b, x) => Math.abs(c.X(x.t) - px) < Math.abs(c.X(b.t) - px) ? x : b), x = c.X(p.t);
      mk.setAttribute('x1', x); mk.setAttribute('x2', x); hl.setAttribute('cx', x); hl.setAttribute('cy', c.Y(p[c.k]));
      tip.innerHTML = `<b>${fmt(p.t)}</b><br>${p.sys}/${p.dia} mmHg<br>${t('pp')} ${p.sys - p.dia}<br>${t('pulse')} ${p.pul}${p.spo2 ? `<br>SpO₂ ${p.spo2}` : ''}${high(p) ? `<br><span class="hi">${t('above')}</span>` : ''}`;
      tip.style.left = Math.min(Math.max(x * s, 70), r.width - 70) + 'px';
      el.classList.add('on');
    };
    el.addEventListener('pointerdown', show);
    el.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) show(e); });
    el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') el.classList.remove('on'); });
  });
}

// NOTE: au premier enregistrement réel, le début de l’axe est la date de la première mesure ; ensuite la fenêtre suit le temps.
const win = h => { const n = Date.now(), f = !state.demo && state.readings[0] ? state.readings[0].t : 0, t0 = Math.max(n - h * 36e5, f); return [t0, Math.max(n, t0 + h * 36e5)]; };
// NOTE: la carte « Nouveau message » et l’onglet Messagerie font double emploi : à confirmer par l’équipe.
const home = () => {
  const a = inPeriod(168), [t0, t1] = win(168), l = state.readings.at(-1), lm = state.messages.filter(m => m.from === 'd').at(-1), un = lm && lm.t > state.lu;
  return `${banner()}<h1>${t('hello')} ${esc(nm())}</h1>
<div class="row"><div class="card"><small>${t('next')}</small><b id="cd" class="big"></b></div>
<a class="card" href="#messages"><small>${t('newMsg')}${un ? ' ●' : ''}</small>${lm ? (lm.k ? t(lm.k) : esc(lm.x || '')).slice(0, 50) : t('noMsg')}</a></div>
<a class="btn" href="#entry">${t('enterBP')}</a><a class="btn" href="#symptoms">${t('enterSym')}</a>
<div class="card">${chart(a, 'sys', thr().sys, t0, t1, 140)}${chart(a, 'dia', thr().dia, t0, t1, 140)}<p class="mut">${t('hint')}</p></div>
<div class="card"><small>${t('recent')}</small>${l ? `<span class="big">${l.sys}/${l.dia}</span>
<div class="g3"><span>${t('pulse')} <b>${l.pul}</b></span><span>SpO₂ <b>${l.spo2 ?? '–'}</b></span><span>${t('pp')} <b>${l.sys - l.dia}</b></span></div>` : t('noData')}</div>`;
};

const graph = () => {
  const a = inPeriod(period), [t0, t1] = win(period);
  const s = stats(a, 'sys'), d = stats(a, 'dia'), f = (p, q, n = 0) => `${p.toFixed(n)}/${q.toFixed(n)}`;
  const wide = a.filter(ppAbn).length;
  return `${banner()}<h1>${t('graph')}</h1>
<div class="card">${chart(a, 'sys', thr().sys, t0, t1)}${chart(a, 'dia', thr().dia, t0, t1)}${chart(a.map(x => ({ ...x, pp: x.sys - x.dia })), 'pp', C.tensionPulsee, t0, t1, 190, C.tensionPulseeMin)}<p class="mut">${t('hint')}</p></div>
<div class="seg">${[24, 48, 72, 168, 720].map(h => `<button data-p="${h}" aria-pressed="${h === period}">${h < 100 ? h + 'h' : h / 24 + t('d')}</button>`).join('')}</div>
${s ? `<div class="card g2"><div><small>${t('min')}</small><b>${f(s.min, d.min)}</b></div><div><small>${t('max')}</small><b>${f(s.max, d.max)}</b></div>
<div><small>${t('avg')}</small><b>${f(s.m, d.m)}</b></div><div><small>${t('ppm')}</small><b>${(s.m - d.m).toFixed(0)}</b></div></div>
<div class="card"><b>${t('explain')}</b><p>${t('exp', a.length, a.filter(x => high(x)).length, thr().sys, thr().dia, jumps(a), wide)}</p></div>` : ''}`;
};

const inp = (id, lo, hi, req = 1) => `<label>${t(id)}${req ? '' : ' (' + t('opt') + ')'}<input id="${id}" type="number" inputmode="numeric" min="${lo}" max="${hi}"></label>`;
const entry = () => `${banner()}<h1>${t('enterBP')}</h1><div id="msg"></div>
<form class="card" id="f" novalidate>${inp('sys', 1, 1000)}${inp('dia', 1, 1000)}${inp('pul', 1, 1000)}${inp('spo2', 1, 1000, 0)}
<label>${t('when')}<input id="when" type="datetime-local" value="${new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16)}"></label>
<button class="btn">${t('save')}</button></form>`;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nm = () => accName(who()) || C.nomUtilisateur[state.lang];
const symTxt = e => C.symptomes.filter(([id]) => e.n[id] > 0).map(([id]) => `${t(id)} (${t('l' + e.n[id])})`).concat(e.o ? [e.o] : []).join(', ') || t('none');
let pend = {};

// Questionnaire de symptômes : un curseur à 4 niveaux par symptôme (nul, léger, modéré, sévère)
// NOTE: le choix « avant / après la tension » a été retiré (redondant avec la fenêtre de 2 h).
const symptoms = () => `${banner()}<h1>${t('symptoms')}</h1><div id="msg"></div>
<form class="card" id="sf" novalidate><p>${t('hello')} ${esc(nm())}, ${t('how')}</p><small>${fmt(Date.now())}</small>
${C.symptomes.map(([id, em]) => `<div class="sl"><label for="s-${id}"><span class="em">${em}</span>${t(id)}</label><input id="s-${id}" type="range" min="0" max="3" step="1" value="0"><div class="lv">${[0, 1, 2, 3].map(i => `<span>${t('l' + i)}</span>`).join('')}</div></div>`).join('')}
<label>${t('other')}<textarea id="oth" rows="2" maxlength="200" placeholder="${t('otherPh')}"></textarea></label>
<button class="btn">${t('save')}</button><button type="button" class="btn alt" id="exp">${t('export')}</button></form>`;

function saveSym(f) {
  const n = {}; C.symptomes.forEach(([id]) => n[id] = +$('#s-' + id).value);
  const e = { t: Date.now(), n, o: $('#oth').value.trim() };
  addSymptoms(e); f.reset();
  const c = combo(e.t);
  $('#msg').innerHTML = `<p class="${c ? 'warn' : 'good'}">${c ? t('combo') : t('symSaved')}</p>`;
  if (c) alertModal(c);
  scrollTo(0, 0);
}

// Messagerie (v8.0) : réelle, entre le patient et son médecin (Supabase) ; pièces jointes (tension, symptômes, photo), envoi en alerte
// NOTE: les pièces jointes viennent d’un autre utilisateur : une photo n’est affichée que si c’est bien une image (data:image), tout le reste est échappé
const okImg = d => /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(d || '');
const bubs = (list, me = 'p') => list.length ? list.map(m => `<div class="bub ${m.from === me ? 'me' : 'dr'}${m.al ? ' al' : ''}">${m.al ? `<b class="tag">${t('alertTag')}</b>` : ''}${esc(m.x || '')}${[].concat(m.a || []).map(a => a.k === 'ph' ? (okImg(a.d) ? `<img src="${esc(a.d)}" alt="">` : '') : `<div class="at">${esc(a.d)}</div>`).join('')}<small>${fmt(m.t)}</small></div>`).join('') : `<p class="mut">${t('noMsg')}</p>`;
const messages = () => {
  const k = who(), dr = state.draft || ''; state.draft = null; state.lu = Date.now(); (state.luMap = state.luMap || {})[k.id] = state.lu; save();
  return `<h1>${drName(k)}</h1>${k.docId ? '' : `<p class="warn">${t('noDocLinked')}</p>`}<div class="chat" id="chat">${bubs(state.messages)}</div>
<form class="card" id="mf"><div class="att"><button type="button" data-a="t" aria-label="${t('attT')}">📈</button><button type="button" data-a="s" aria-label="${t('attS')}">📋</button><label class="ab" aria-label="${t('attP')}">📷<input type="file" id="ph" accept="image/*" capture="environment" hidden></label></div>
<p id="chip" class="mut"></p><textarea id="mx" rows="2" placeholder="${t('msgPh')}">${esc(dr)}</textarea>
<div class="row"><button type="button" class="btn alt" id="sa">⚠️ ${t('sendAlert')}</button><button class="btn">${t('send')}</button></div></form>`;
};

// Pièces jointes : au plus une de chaque type (tension, symptômes, photo), retirables d’un toucher
// NOTE: confirmation d’alerte : fenêtre de 2 h (celle de l’analyse), à confirmer par l’équipe
const worry = () => { const w = Date.now() - C.fenetreSymptomesH * 36e5; return state.readings.some(x => x.t >= w && high(x)) || state.symptoms.some(e => e.t >= w && sig(e)); };
const chips = () => { $('#chip').innerHTML = Object.entries(pend).map(([k, a]) => `<button type="button" class="chip" data-rm="${k}">✕ ${k === 'ph' ? '📷 ' + t('attP') : (k === 't' ? '📈 ' : '📋 ') + esc(a.d)}</button>`).join(''); };
function post(x, a, al) { // envoie un message du patient à son médecin (la réponse vient du médecin, par la base)
  addMessage({ t: Date.now(), from: 'p', x, a, al });
}
function send(al) {
  if (!who()?.docId) return void alert(t('noDocLinked'));
  const x = $('#mx').value.trim();
  if (!x && !Object.keys(pend).length) return;
  if (al && !worry() && !confirm(t('alertSure'))) return;
  post(x, Object.values(pend), al);
  render();
}

document.addEventListener('change', e => {
  if (e.target.id !== 'ph' || !e.target.files[0]) return;
  const img = new Image(); // photo réduite pour tenir dans le stockage local
  img.onload = () => {
    const s = Math.min(1, 640 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    pend.ph = { k: 'ph', d: c.toDataURL('image/jpeg', .6) }; chips(); URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(e.target.files[0]); e.target.value = '';
});

const AUTH = ['welcome', 'login', 'medlogin', 'signup', 'sprofile', 'sprivacy', 'legal'];
const user = () => state.user || sessionStorage.getItem('attension.u');
const who = () => findAcc(user());
const lgBtns = () => `<div class="lgp">${['fr', 'en'].map(l => `<button data-l="${l}" aria-pressed="${l === state.lang}">${l.toUpperCase()}</button>`).join('')}</div>`;
const logo = '<svg class="lg2" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.00 7.30 L12.01 7.20 L12.05 6.92 L12.17 6.48 L12.40 5.92 L12.75 5.29 L13.25 4.64 L13.89 4.04 L14.66 3.54 L15.54 3.18 L16.50 3.00 L17.50 3.02 L18.50 3.25 L19.44 3.67 L20.30 4.28 L21.01 5.05 L21.55 5.93 L21.89 6.90 L22.00 7.92 L21.89 8.96 L21.55 9.99 L21.01 11.00 L20.30 11.98 L19.44 12.93 L18.50 13.84 L17.50 14.72 L16.50 15.57 L15.54 16.39 L14.66 17.19 L13.89 17.95 L13.25 18.67 L12.75 19.32 L12.40 19.89 L12.17 20.36 L12.05 20.71 L12.01 20.93 L12.00 21.00 L11.99 20.93 L11.95 20.71 L11.83 20.36 L11.60 19.89 L11.25 19.32 L10.75 18.67 L10.11 17.95 L9.34 17.19 L8.46 16.39 L7.50 15.57 L6.50 14.72 L5.50 13.84 L4.56 12.93 L3.70 11.98 L2.99 11.00 L2.45 9.99 L2.11 8.96 L2.00 7.92 L2.11 6.90 L2.45 5.93 L2.99 5.05 L3.70 4.28 L4.56 3.67 L5.50 3.25 L6.50 3.02 L7.50 3.00 L8.46 3.18 L9.34 3.54 L10.11 4.04 L10.75 4.64 L11.25 5.29 L11.60 5.92 L11.83 6.48 L11.95 6.92 L11.99 7.20Z"/><polyline points="5,12 9,12 11,8.5 13,15.5 15,12 19,12" fill="none" stroke="var(--bg)" stroke-width="1.2" stroke-linejoin="round"/></svg>';
const welcome = () => `${lgBtns()}<div class="au"><h1>${t('bienvenue')}</h1>${logo}<a class="btn" href="#login">${t('patient')}</a><a class="btn" href="#medlogin">${t('doctor')}</a><a class="lk" href="#legal">${t('p_privFull')}</a></div>`;
const loginPage = med => `${lgBtns()}<div class="au"><a class="bk" href="#welcome" aria-label="${t('back')}">←</a>${logo}<div id="msg">${takeFlash()}</div>
<form id="${med ? 'lm' : 'lp'}" class="aform" novalidate><label>${t(med ? 'p_idOrMail' : 'p_userOrMail')}<input id="lu" autocomplete="username" autocapitalize="none"></label>
<label>${t('password')}<input id="lw" type="password" autocomplete="current-password"></label>
<label class="rm"><input id="lr" type="checkbox"> ${t('remember')}</label><button class="btn">${t('login')}</button></form>
<p>${t('noAcc')} <button type="button" class="lk" id="su" data-r="${med ? 'd' : 'p'}">${t('signup')}</button></p></div>`;
// NOTE: v8.0 : connexion par Supabase ; « Se souvenir de moi » garde la session sur l’appareil ; un identifiant de test (Test, 12345678) est converti en courriel (config.js)
async function doLogin(med) {
  const u = $('#lu').value.trim(), w = $('#lw').value, rem = $('#lr').checked, show = (k, c = 'warn') => void ($('#msg').innerHTML = `<p class="${c}">${t(k)}</p>`);
  show('loading', 'mut');
  const r = await Sy.login(u, w, rem, med ? 'doctor' : 'patient');
  if (r.err) return show(r.err);
  if (rem) { state.user = r.acc.id; save(); } else sessionStorage.setItem('attension.u', r.acc.id);
  location.hash = med ? '#dhome' : '#home';
}

// Pop-up d'alerte : aperçu du message, tension et symptômes joints, envoi direct en alerte
function alertModal(c) {
  const x = c.s ? t('draft', c.r.sys, c.r.dia, symTxt(c.s)) : t('draft2', c.ys.length, C.fenetreSymptomesH);
  const a = c.s ? [{ k: 't', d: `${c.r.sys}/${c.r.dia} mmHg, ${t('pulse')} ${c.r.pul} (${fmt(c.r.t)})` }, { k: 's', d: `${symTxt(c.s)} (${fmt(c.s.t)})` }] : [{ k: 't', d: c.ys.map(y => `${y.sys}/${y.dia} (${fmt(y.t)})`).join(' ; ') + ' mmHg' }];
  const el = document.createElement('div');
  el.id = 'mo'; el.className = 'mo'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<div class="md"><button class="x" data-x aria-label="${t('close')}">✕</button><p class="mt">${t(c.s ? 'alertTitle' : 'alertTitle2')}</p><div class="bub me al"><b class="tag">${t('alertTag')}</b>${esc(x)}${a.map(z => `<div class="at">${z.k === 't' ? '📈 ' : '📋 '}${esc(z.d)}</div>`).join('')}</div><button class="btn" id="go">${t('alertBtn')}</button></div>`;
  $('#mo')?.remove(); document.body.appendChild(el);
  $('#go').onclick = () => { if (!who()?.docId) return void alert(t('noDocLinked')); post(x, a, true); el.querySelector('.md').innerHTML = `<p class="good">${t('sent')}</p><button class="btn alt" data-x>OK</button>`; };
  $('#go').focus();
}

// ---------- Interface médecin (ordinateur) : menu à gauche, barre du haut, cartes ----------
const DOC = ['dhome', 'dpat', 'dmsg', 'dsoon'];
let ARG = '';
const role = () => who()?.role === 'doctor' ? 'doctor' : 'patient';
const mq = matchMedia('(prefers-color-scheme: dark)');
const theme = () => state.theme || (mq.matches ? 'dark' : 'light'); // NOTE: v7.0 : le bouton clair/sombre a été retiré de l’interface médecin ; le thème se change seulement dans Paramètres, Apparence
mq.addEventListener('change', () => render());
const LV = { crit: ['▲', 'lvCrit'], moy: ['◆', 'lvMoy'], bon: ['●', 'lvBon'] }; // NOTE: niveaux affichés avec une forme et un texte, sans rouge (réservé aux seuils)
const lv = p => `<span class="lv lv-${p.lv}">${LV[p.lv][0]} ${t(LV[p.lv][1])}</span>`;
const bars = (v, lab) => {
  const W = 320, H = 150, B = 28, m = Math.max(...v, 1), bw = W / v.length;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('critByMonth')}">${v.map((n, i) => { const h = n / m * (H - B - 20); return `<rect class="bar" x="${i * bw + 10}" y="${H - B - h}" width="${bw - 20}" height="${h}" rx="3"/><text x="${i * bw + bw / 2}" y="${H - B - h - 4}" text-anchor="middle">${n}</text><text class="xl" x="${i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${lab[i]}</text>`; }).join('')}<line class="ax" x1="0" x2="${W}" y1="${H - B}" y2="${H - B}"/></svg>`;
};
// Graphique à deux axes : systolique à gauche, diastolique à droite
function dual(a, t0, t1, th) {
  if (!a.length) return `<p class="mut">${t('noData')}</p>`;
  const W = 560, H = 250, L = 48, R = 48, T = 24, B = 44, S1 = a.map(x => x.sys), D1 = a.map(x => x.dia);
  const rg = (v, th) => [Math.floor((Math.min(...v, th) - 5) / 10) * 10, Math.ceil((Math.max(...v, th) + 5) / 10) * 10];
  const [sl, sh] = rg(S1, th.sys), [dl, dh] = rg(D1, th.dia);
  const X = ms => +(L + (ms - t0) / (t1 - t0) * (W - L - R)).toFixed(1), Ys = n => +(T + (sh - n) / (sh - sl) * (H - T - B)).toFixed(1), Yd = n => +(T + (dh - n) / (dh - dl) * (H - T - B)).toFixed(1);
  const ax = [0, 1, 2, 3, 4].map(i => { const y = +(T + i * (H - T - B) / 4).toFixed(1); return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="gr"/><text class="ta" x="${L - 6}" y="${y + 4}" text-anchor="end">${Math.round(sh - i * (sh - sl) / 4)}</text><text class="tb2" x="${W - R + 6}" y="${y + 4}">${Math.round(dh - i * (dh - dl) / 4)}</text>`; }).join('');
  const xl = [0, 1, 2, 3, 4].map(i => { const ms = t0 + i * (t1 - t0) / 4, d = new Date(ms); return `<text class="xl" x="${X(ms)}" y="${H - 20}" text-anchor="middle">${t1 - t0 <= 72 * 36e5 ? d.toLocaleString(state.lang, { day: 'numeric', hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(state.lang, { day: 'numeric', month: 'short' })}</text>`; }).join('');
  const pl = (Y, k) => a.map(x => `${X(x.t)},${Y(x[k])}`).join(' ');
  return `<div class="leg"><span class="k1">▬</span> ${t('legS')} &nbsp; <span class="k2">▬</span> ${t('legD')}</div><div class="ch" data-i="${REG.push({ a, k: 'sys', X, Y: Ys, W }) - 1}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('axS')} / ${t('axD')}">
${ax}${xl}<line x1="${L}" x2="${L}" y1="${T}" y2="${H - B}" class="ax"/><line x1="${W - R}" x2="${W - R}" y1="${T}" y2="${H - B}" class="ax"/><line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="ax"/>
<line x1="${L}" x2="${W - R}" y1="${Ys(th.sys)}" y2="${Ys(th.sys)}" class="th"/><text class="tl" x="${L + 4}" y="${Ys(th.sys) - 4}">${t('axS')} ${th.sys}</text>
<line x1="${L}" x2="${W - R}" y1="${Yd(th.dia)}" y2="${Yd(th.dia)}" class="th"/><text class="tl" x="${W - R - 4}" y="${Yd(th.dia) - 4}" text-anchor="end">${t('axD')} ${th.dia}</text>
<polyline points="${pl(Ys, 'sys')}" class="ln"/><polyline points="${pl(Yd, 'dia')}" class="ln2"/>
<line class="mk" y1="${T}" y2="${H - B}"/><circle class="hl" r="6"/></svg><div class="tip"></div></div>`;
}
const ORD = ['crit', 'moy', 'bon'];
const shell = inner => {
  const P = pts().sort((a, b) => ORD.indexOf(a.lv) - ORD.indexOf(b.lv) || a.nom.localeCompare(b.nom));
  const li = (p, href) => `<li data-n="${esc((p.nom + ' ' + p.id).toLowerCase())}"><a href="${href}"${href === '#' + location.hash.slice(1).split(':')[0] + ':' + ARG ? ' aria-current="page"' : ''}>${LV[p.lv][0]} ${esc(p.nom)}</a></li>`;
  const h = location.hash.slice(1).split(':')[0], cur = x => x.includes(h) ? ' aria-current="page"' : '';
  return `<div class="dw"><aside class="sb" id="sb"><div class="sbh">❤ atTension</div>
<a class="sbt" href="#dhome"${cur(['dhome'])}>🏠 ${t('home')}</a>
<div class="sbm"><details open><summary>👥 ${t('patients')}</summary><ul>${P.map(p => li(p, '#dpat:' + p.id)).join('')}</ul></details>
<details><summary>🗓️ ${t('appts')}</summary><ul><li><a href="#dsoon">${t('calendar')}</a></li></ul></details>
<details open><summary>💬 ${t('messages')}</summary><ul>${P.map(p => li(p, '#dmsg:' + p.id)).join('')}</ul></details></div>
<div class="sbf"><a class="sbt" href="#profile"${cur(['profile', 'pedit'])}>👤 ${esc(accName(who()))}</a><a class="sbt" href="#settings"${cur(['settings', 'slang', 'sappear', 'sremind', 'spass'])}>⚙ ${t('settings')}</a></div></aside>
<div class="dm"><div class="tb"><button id="mn" aria-label="${t('menu')}">☰</button><input id="srch" type="search" placeholder="${t('search')}" aria-label="${t('search')}"><button id="out" aria-label="${t('logout')}" title="${t('logout')}">⎋</button></div>
<p class="demo">${t('fakeData')}</p>${inner}</div></div>`;
};
// NOTE: v7.0 : le bouton ⚙ de la carte « Patients récents » fait double emploi avec « Paramètres » en bas du menu : conservé, à confirmer par l’équipe
const dhome = () => {
  const P = pts(), n = k => P.filter(p => p.lv === k).length, al = P.reduce((s, p) => s + p.al.length, 0);
  const mo = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return d.toLocaleDateString(state.lang, { month: 'short' }); });
  const rec = [...P].sort((a, b) => b.ajout - a.ajout).slice(0, 5);
  return shell(`<div class="g-top"><div class="card kpi"><div class="ico">👥</div><div><small>${t('totalP')}</small><span class="big">${P.length}</span></div></div>
<div class="card kpi"><div class="ico">🔔</div><div><small>${t('alerts7')}</small><span class="big">${al}</span></div></div></div>
<div class="g-mid"><div class="card"><b>${t('statsP')}</b><small>${t('critByMonth')}</small>${bars([2, 3, 1, 3, 2, n('crit')], mo)}</div>
<div class="card"><b>${t('wordsStats')}</b><p>${ORD.map(k => `<span class="lv lv-${k}">${LV[k][0]} ${t(LV[k][1])}</span> : <b>${n(k)}</b>`).join('<br>')}</p></div></div>
<div class="card"><b>${t('recentP')}</b><button class="gear" id="gear" aria-label="${t('settings')}" title="${t('settings')}">⚙</button><div id="dmsg"></div>
<div class="tw"><table class="dt"><thead><tr><th>${t('colNo')}</th><th>${t('colDate')}</th><th>${t('colId')}</th><th>${t('colName')}</th><th>${t('colAge')}</th><th>${t('colLvl')}</th></tr></thead><tbody>${rec.map((p, i) => `<tr data-go="#dpat:${p.id}" data-n="${esc((p.nom + ' ' + p.id).toLowerCase())}"><td>${i + 1}</td><td>${new Date(p.ajout).toLocaleDateString(state.lang)}</td><td>${p.id}</td><td>${esc(p.nom)}</td><td>${p.age}</td><td>${lv(p)}</td></tr>`).join('')}</tbody></table></div></div>`);
};
const dpat = () => {
  const P = pts(), p = P.find(x => x.id === ARG) || P[0], t1 = Date.now(), t0 = t1 - period * 36e5;
  const a = p.readings.filter(x => x.t >= t0), s = stats(a, 'sys'), d = stats(a, 'dia'), f = (x, y) => `${Math.round(x)}/${Math.round(y)}`;
  const al = p.al.at(-1), sm = p.symptoms.slice(-5).reverse(), msg = p.msgs ? p.msgs.filter(m => m.from === 'p' && m.al).at(-1) : null;
  return shell(`<h1 class="ph">${esc(p.nom)} <small class="pid">${p.id}</small> – ${t('riskProfile')} : ${lv(p)}</h1>
<div class="g-mid"><div class="card">${dual(a, t0, t1, p.th)}<div class="seg">${[24, 48, 72, 168, 720].map(h => `<button data-p="${h}" aria-pressed="${h === period}">${h < 100 ? h + 'h' : h / 24 + t('d')}</button>`).join('')}</div></div>
<div class="card"><b>${t('wordsStats')}</b>${s ? `<p>${t('avgBP')} : <b>${f(s.m, d.m)}</b><br>${t('max')} : <b>${s.max}/${d.max}</b><br>${t('min')} : <b>${s.min}/${d.min}</b><br>${t('nMeas')} : <b>${a.length}</b></p>` : `<p class="mut">${t('noData')}</p>`}</div></div>
<div class="g-mid"><div class="card"><b>${t('recentSym')}</b>${sm.length ? `<ul class="ls">${sm.map(e => `<li><small>${fmt(e.t)}</small> ${esc(symTxt(e))}</li>`).join('')}</ul>` : `<p class="mut">${t('noSym')}</p>`}</div>
<div class="card"><b>${t('alertBox')}</b>${al ? `<p><small>${fmt(al.t)}, ${t(al.k === 'sym' ? 'altSym' : 'altBp')}</small><br>${t('data')} : ${al.r.sys}/${al.r.dia} mmHg${al.e ? ', ' + esc(symTxt(al.e)) : ''}</p>` : `<p class="mut">${t('noAlert')}</p>`}${msg ? `<p><small>${t('sentAlert')} : ${fmt(msg.t)}</small></p>` : ''}</div></div>
<div class="card"><b>${t('p_thrTitle')}</b><form id="thf" data-id="${p.id}" class="aform" novalidate><label>${t('sys')}<input id="ts" type="number" inputmode="numeric" min="80" max="250" value="${p.th.sys}"></label><label>${t('dia')}<input id="td" type="number" inputmode="numeric" min="40" max="150" value="${p.th.dia}"></label><button class="btn">${t('save')}</button></form><div id="tmsg">${takeT()}</div></div>
<div class="card"><b>${t('dMsgTitle')}</b><div class="chat" id="dchat">${bubs(p.msgs || [], 'd')}</div>${p.real ? `<form id="dmf" data-id="${p.id}" class="aform" novalidate><textarea id="dmx" rows="2" placeholder="${t('dMsgPh')}"></textarea><button class="btn">${t('send')}</button></form>` : ''}</div>
<div class="card"><label><b>${t('notes')}</b><textarea id="dnotes" data-id="${p.id}" rows="3">${esc((state.notes || {})[p.id] || '')}</textarea></label></div>`);
};
// Messagerie du médecin (v8.1) : conversation avec un patient, depuis le menu de gauche
const dmsg = () => {
  const P = pts(), p = P.find(x => x.id === ARG) || P[0]; if (!p) return dsoon();
  return shell(`<h1 class="ph">${t('messages')} – ${esc(p.nom)} <small class="pid">${p.id}</small></h1>
<div class="card"><div class="chat" id="dchat">${bubs(p.msgs || [], 'd')}</div>${p.real ? `<form id="dmf" data-id="${p.id}" class="aform" novalidate><textarea id="dmx" rows="2" placeholder="${t('dMsgPh')}"></textarea><button class="btn">${t('send')}</button></form>` : `<p class="mut">${t('dMsgFake')}</p>`}</div>`);
};
const dsoon = () => shell(`<p class="card">${t('soon')}</p><a class="btn alt" href="#dhome">← ${t('back')}</a>`);

// ---------- Comptes, profil et paramètres (v0.6) ----------
// NOTE: comptes stockés sur l’appareil seulement, mots de passe en clair : aucune sécurité (prototype) ; croquis : profil patient/médecin, paramètres (langue, apparence, rappels), création de compte
const SHARED = ['profile', 'settings', 'slang', 'sappear', 'sremind', 'spass', 'pedit', 'privacy'], SU = ['signup', 'sprofile', 'sprivacy'];
let su = {}, flash = '', tmsg = '';
const takeFlash = () => { const m = flash; flash = ''; return m ? `<p class="good">${m}</p>` : ''; };
const takeT = () => { const m = tmsg; tmsg = ''; return m; };
const pts = () => patients(who()?.code);
const wrap = x => role() === 'doctor' ? shell(x.replace('class="pgw"', 'class="pgw dsk"')) : x; // NOTE: v7.0 : côté médecin, profil et paramètres ont une vue ordinateur (classe dsk)
const row = (h, x) => `<a class="rw" href="${h}"><span>${x}</span><i>›</i></a>`;
const back = (h, k = 'settings') => `<a class="bk2" href="${h}">‹ ${t(k)}</a>`;
const opt = (k, v, cur, x) => `<button type="button" class="opt rw" role="radio" aria-checked="${v === cur}" data-${k}="${v}"><span>${x}</span><i>${v === cur ? '◉' : '○'}</i></button>`;
const docAl = k => ({ red: true, n3: true, ...(k.alr || {}) }); // NOTE: les deux alertes du profil médecin sont activées par défaut ; réglages enregistrés, sans effet sur les notifications pour l’instant
const sw = (k, n, x) => `<div class="swr"><span>${t(x)}</span><button type="button" class="sw" role="switch" aria-checked="${docAl(k)[n]}" aria-label="${t(x)}" data-sw="${n}"><i></i></button></div>`;
const drName = k => { const d = findCode(k.code); return d ? esc(accName(d)) : t('p_noDoc'); };

const profile = () => {
  const k = who(), d = k.role === 'doctor', th = thrOf(k.id);
  const head = `<div class="pf"><span class="av" aria-hidden="true">${esc(initials(k))}</span><div><b class="big">${esc(accName(k))}</b>${d ? `<small>${esc(k.spec || '')}</small><small>${esc(k.etab || '')}</small><span class="vf${k.verified ? '' : ' pend'}">${k.verified ? '✔ ' + t('p_verified') : '⏳ ' + t('p_pendingLic')}</span>` : ''}</div></div>`;
  const body = d
    ? `<div class="card"><b>${t('p_docCode')}</b><div class="cd2"><span class="big">${esc(k.code)}</span><button type="button" class="ab2" id="cpy" data-v="${esc(k.code)}">⧉ ${t('p_copy')}</button></div><small>${t('p_giveCode')}</small></div>
<div class="card cd2"><b>${t('p_myPat')}</b><span class="big">${pts().length}</span></div>
<div class="card"><b>${t('p_alerts')}</b>${sw(k, 'red', 'p_red')}${sw(k, 'n3', 'p_none3')}</div>`
    : `<div class="card"><b>${t('p_health')}</b><br><small>${t('p_dob')} : ${k.dob ? new Date(k.dob + 'T12:00').toLocaleDateString(state.lang) : '–'}</small><br>${t('p_thr')} : <b>${th.sys}/${th.dia} mmHg</b></div>
<div class="card"><b>${t('p_myDoc')}</b><br>${drName(k)}</div>`;
  return wrap(`<div class="pgw">${head}${body}<a class="btn alt" href="#pedit">${t('p_edit')}</a>
<div class="card rows">${row('#settings', '⚙ ' + t('settings'))}<button type="button" class="rw" id="exp"><span>⬇ ${t('p_export')}</span><i>›</i></button></div><div id="msg"></div><button class="btn alt" id="out">${t('logout')}</button></div>`);
};

const settings = () => wrap(`<div class="pgw">${back('#profile', 'profile')}<h1>${t('settings')}</h1>
<div class="card rows">${row('#slang', t('p_lang'))}${row('#sappear', t('p_appear'))}${role() === 'doctor' ? '' : row('#sremind', t('p_remind'))}${row('#spass', t('p_chpw'))}${row('#privacy', t('p_privFull'))}</div>
<div class="card rows"><small>${t('p_data')}</small><button type="button" class="rw" id="exp"><span>${t('p_export')}</span><i>›</i></button></div>
<div id="msg"></div><button class="btn alt" id="del">${t('p_delete')}</button></div>`);

const slang = () => { const p = state.langPref || state.lang; return wrap(`<div class="pgw">${back('#settings')}<h1>${t('p_lang')}</h1><div class="card rows" role="radiogroup">${opt('lang', 'auto', p, t('p_devLang'))}${opt('lang', 'fr', p, 'Français')}${opt('lang', 'en', p, 'English')}</div><p class="mut">${t('p_langNote')}</p></div>`); };

const sappear = () => { const p = state.theme || 'auto'; return wrap(`<div class="pgw">${back('#settings')}<h1>${t('p_appear')}</h1><div class="card rows" role="radiogroup">${opt('thm', 'auto', p, t('p_auto'))}${opt('thm', 'light', p, t('p_light'))}${opt('thm', 'dark', p, t('p_dark'))}</div>
<div class="pv"><div><div class="pvb pvl">${t('p_visL')}</div><small>${t('p_light')}</small></div><div><div class="pvb pvd">${t('p_visD')}</div><small>${t('p_dark')}</small></div></div><p class="mut">${t('p_autoNote')}</p></div>`); };

// NOTE: les heures du croquis (08:00, 12:00, 20:00) montrent seulement que les rappels sont personnalisables ; valeurs par défaut de l’app : 08:00, 14:00, 18:00 (config.js)
const sremind = () => { const r = rappels(); return wrap(`<div class="pgw">${back('#settings')}<h1>${t('p_remind')}</h1><form id="rf" class="card" novalidate><b>${t('p_remTimes')}</b>${[['p_morning', 0], ['p_noon', 1], ['p_eve', 2]].map(([n, i]) => `<label>${t(n)}<input id="r${i}" type="time" value="${esc(r[i])}"></label>`).join('')}<button class="btn">${t('save')}</button></form><div id="msg"></div></div>`); };
function saveRem() {
  const v = [0, 1, 2].map(i => $('#r' + i).value);
  if (v.some(x => !x) || !(v[0] < v[1] && v[1] < v[2])) return void ($('#msg').innerHTML = `<p class="warn">${t('p_remOrder')}</p>`);
  state.rappels = v; save(); Sy.saveReminders(v); $('#msg').innerHTML = `<p class="good">${t('p_remSaved')}</p>`;
}

const spass = () => wrap(`<div class="pgw">${back('#settings')}<h1>${t('p_chpw')}</h1><form id="pw2" class="card" novalidate><label>${t('p_oldPw')}<input id="o_pw" type="password" autocomplete="current-password"></label><label>${t('p_newPw')}<input id="n_pw" type="password" autocomplete="new-password"></label><small>${t('p_pw8')}</small><label>${t('p_confirm')}<input id="c_pw" type="password" autocomplete="new-password"></label><button class="btn">${t('save')}</button></form><div id="msg"></div></div>`);
async function savePw(f) {
  const o = $('#o_pw').value, n = $('#n_pw').value, c = $('#c_pw').value, w = x => void ($('#msg').innerHTML = `<p class="${x === 'p_pwDone' ? 'good' : 'warn'}">${t(x)}</p>`);
  if (!o) return w('p_pwBad');
  if (n.length < C.motDePasseMin) return w('p_pwShort');
  if (n !== c) return w('p_pwMis');
  const r = await Sy.changePassword(o, n); if (r === 'p_pwDone') f.reset(); w(r);
}

const fld = (id, lab, v = '', type = 'text', ac = 'off') => `<label>${lab}<input id="${id}" type="${type}" value="${esc(v)}" autocomplete="${ac}"></label>`;
const pedit = () => {
  const k = who(), d = k.role === 'doctor';
  return wrap(`<div class="pgw">${back('#profile', 'profile')}<h1>${t('p_edit')}</h1><form id="ef" class="card" novalidate><div id="msg"></div>${fld('e_fn', t('p_first'), k.first)}${fld('e_ln', t('p_last'), k.last)}${fld('e_ph', t('p_phone'), k.phone, 'tel', 'tel')}
${d ? fld('e_sp', t('p_spec'), k.spec) + fld('e_et', t('p_etab'), k.etab) : fld('e_dob', t('p_dob'), k.dob, 'date') + fld('e_code', t('p_codeOpt'), k.code)}<button class="btn">${t('save')}</button></form></div>`);
};
async function saveEdit() {
  const k = who(), d = k.role === 'doctor', v = id => $('#' + id).value.trim(), er = x => void ($('#msg').innerHTML = `<p class="warn">${t(x)}</p>`);
  const x = { first: v('e_fn'), last: v('e_ln'), phone: v('e_ph') };
  if (!x.first || (!x.last && !k.test)) return er('p_fill');
  if (d) { x.spec = v('e_sp'); x.etab = v('e_et'); if (!x.spec || !x.etab) return er('p_fill'); }
  else {
    x.dob = v('e_dob'); x.code = v('e_code');
    if (x.dob && (new Date(x.dob) > new Date() || new Date(x.dob).getFullYear() < 1900)) return er('p_badDob');
  }
  try { await Sy.saveProfile(k, x); } catch (e) { return er(e.status === 0 ? 'netErr' : /invalide|code/i.test(e.message) ? 'p_badCode' : 'syncErr'); }
  location.hash = '#profile';
}

// Création de compte : 1) Créer un compte, 2) profil de santé (patient) ou professionnel (médecin), 3) Confidentialité
const suErr = x => void ($('#msg').innerHTML = `<p class="warn">${t(x)}</p>`);
const suHead = (b, ti) => `${lgBtns()}<div class="au"><a class="bk" href="${b}" aria-label="${t('back')}">←</a>${logo}<h1>${ti}</h1><div id="msg"></div>`;
const signup1 = () => `${suHead('#' + (su.role === 'doctor' ? 'medlogin' : 'login'), t('p_create'))}<form id="su1" class="aform" novalidate>${fld('s_fn', t('p_first'), su.fn, 'text', 'given-name')}${fld('s_ln', t('p_last'), su.ln, 'text', 'family-name')}${fld('s_em', t('p_email'), su.em, 'email', 'email')}${fld('s_ph', t('p_phone'), su.ph, 'tel', 'tel')}${fld('s_pw', t('password'), su.pw, 'password', 'new-password')}<small>${t('p_pw8')}</small>${fld('s_pc', t('p_confirm'), su.pc, 'password', 'new-password')}<button class="btn">${t('p_nextBtn')}</button></form></div>`;
function su1() {
  const v = id => $('#' + id).value.trim();
  Object.assign(su, { fn: v('s_fn'), ln: v('s_ln'), em: v('s_em'), ph: v('s_ph'), pw: $('#s_pw').value, pc: $('#s_pc').value });
  if (!su.fn || !su.ln || !su.em || !su.ph || !su.pw || !su.pc) return suErr('p_fill');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(su.em)) return suErr('p_badMail');
  if (su.pw.length < C.motDePasseMin) return suErr('p_pwShort');
  if (su.pw !== su.pc) return suErr('p_pwMis');
  location.hash = '#sprofile';
}
// NOTE: profil de santé : les cases diabète / maladie du cœur / AVC du croquis sont ignorées pour l’instant ; le seuil reste 140/90 (le médecin peut le modifier)
const signup2 = () => su.role === 'doctor'
  ? `${suHead('#signup', t('p_pro'))}<form id="su2" class="aform" novalidate>${fld('s_sp', t('p_spec'), su.sp)}${fld('s_et', t('p_etab'), su.et)}${fld('s_li', t('p_lic'), su.li)}<p class="card">🛡️ ${t('p_licNote')}</p><button class="btn">${t('p_nextBtn')}</button></form></div>`
  : `${suHead('#signup', t('p_health'))}<form id="su2" class="aform" novalidate>${fld('s_dob', t('p_dob'), su.dob, 'date')}<p class="card"><b>${t('p_thrApplied')} : ${C.seuil.sys}/${C.seuil.dia} mmHg</b><br><small>${t('p_thrNote')}</small></p>${fld('s_code', t('p_codeOpt'), su.code)}<button class="btn">${t('p_nextBtn')}</button></form></div>`;
function su2() {
  const v = id => $('#' + id).value.trim();
  if (su.role === 'doctor') {
    Object.assign(su, { sp: v('s_sp'), et: v('s_et'), li: v('s_li') });
    if (!su.sp || !su.et || !su.li) return suErr('p_fill');
  } else {
    Object.assign(su, { dob: v('s_dob'), code: v('s_code') });
    if (!su.dob) return suErr('p_fill');
    if (new Date(su.dob) > new Date() || new Date(su.dob).getFullYear() < 1900) return suErr('p_badDob');
  } // NOTE: le code du médecin est vérifié par la base à la création du compte
  location.hash = '#sprivacy';
}
const signup3 = () => `${suHead('#sprofile', t('p_priv'))}<form id="su3" class="aform" novalidate><label class="rm"><input id="s_ok" type="checkbox"> ${t('p_accept')}</label><p class="card">🔒 ${t(su.role === 'doctor' ? 'p_privDoc' : 'p_privPat')}</p><p><a class="lk" href="#legal">${t('p_privFull')}</a></p><button class="btn">${t('p_createBtn')}</button></form></div>`;
async function su3() {
  if (!$('#s_ok').checked) return suErr('p_mustAcc');
  const d = su; $('#msg').innerHTML = `<p class="mut">${t('loading')}</p>`;
  const r = await Sy.register({ ...d, code: (d.code || '').trim() });
  if (r.err) return suErr(r.err);
  su = {};
  if (r.confirm) { flash = t('p_confirmMail'); location.hash = d.role === 'doctor' ? '#medlogin' : '#login'; return; }
  if (r.pending) { flash = t('p_created'); location.hash = '#medlogin'; return; } // NOTE: vérification de licence : à la main dans Supabase (license_verified)
  sessionStorage.setItem('attension.u', r.acc.id);
  if (r.codeBad) alert(t('p_badCodeLater'));
  location.hash = '#home';
}

// Seuil d’un patient modifié par le médecin (page du patient)
async function saveThr(f) {
  const s = Math.round(+$('#ts').value), d = Math.round(+$('#td').value);
  if (!(s >= 80 && s <= 250 && d >= 40 && d <= 150 && s > d)) return void ($('#tmsg').innerHTML = `<p class="warn">${t('p_thrBad')}</p>`);
  try { await Sy.setThreshold(f.dataset.id, s, d); } catch (e) { tmsg = `<p class="warn">${t(e.status === 0 ? 'netErr' : 'syncErr')}</p>`; return render(); }
  setThr(f.dataset.id, { sys: s, dia: d }); tmsg = `<p class="good">${t('p_thrSaved')}</p>`; render();
}

function dsend(f) { // message du médecin à un patient
  const x = $('#dmx').value.trim(); if (!x) return;
  addMsgFor(f.dataset.id, { t: Date.now(), from: 'd', x }); render();
}

// Page Aide (v7.0) : recherche, questions dépliables, puis aide en cas d’absence de résultat
const fold = x => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const faqTxt = f => [f.q[state.lang], [].concat(f.a[state.lang]).join(' ')].join(' ');
const faqItem = f => { const a = [].concat(f.a[state.lang]), body = a.length > 1 ? `<ol>${a.map(x => `<li>${x}</li>`).join('')}</ol>` : `<p>${a[0]}</p>`;
  return `<details class="hq" data-k="${esc(fold(faqTxt(f)))}"><summary><span>${f.q[state.lang]}</span><i>›</i></summary><div class="ha">${body}${f.n ? `<p class="mut"><i>${f.n[state.lang]}</i></p>` : ''}</div></details>`; };
const help = () => `${banner()}<h1>${t('help')}</h1>
<input id="hs" type="search" placeholder="${t('h_search')}" aria-label="${t('h_search')}" autocomplete="off"><div id="hl" class="card rows">${FAQ.map(faqItem).join('')}</div>
<div id="hn" hidden><div class="card hno"><b>${t('h_none')}</b><br><span>${t('h_noneSub')}</span></div><p class="hwh"><b>${t('h_what')}</b></p>
<div class="hbt"><button type="button" class="btn" id="hask">${t('h_ask')}</button><small>${t('h_askSub')}</small></div>
<div class="hbt"><button type="button" class="btn alt" id="htech">${t('h_tech')}</button></div>
<form id="hrf" class="card" hidden novalidate><textarea id="hrx" rows="3" maxlength="500" placeholder="${t('h_techPh')}" aria-label="${t('h_techPh')}"></textarea><button class="btn">${t('h_sendRep')}</button></form>
<button type="button" class="lk hsg" id="hsug">${t('h_sugg')} ›</button><div id="hm"></div><small class="mut">${t('h_note')}</small></div>`;
function helpFilter(v) {
  const q = fold(v.trim()); let n = 0;
  document.querySelectorAll('#hl .hq').forEach(d => { const ok = !q || d.dataset.k.includes(q); d.hidden = !ok; if (ok) n++; });
  $('#hl').hidden = !n; $('#hn').hidden = !(q && !n);
}
const soon = k => () => `<h1>${t(k)}</h1><p class="card">${t('soon')}</p>`; // Phase 2 : symptômes, messagerie, profil
// Politique de confidentialité (v8.3) : page publique (avant la connexion) et page des paramètres (après)
const legal = () => `${lgBtns()}<div class="au"><a class="bk" href="#welcome" data-back="1" aria-label="${t('back')}">←</a>${privacyHtml(state.lang, C.contactConfidentialite)}</div>`;
const privacy = () => wrap(`<div class="pgw">${back('#settings')}${privacyHtml(state.lang, C.contactConfidentialite)}</div>`);
const S = { legal, privacy, home, entry, graph, symptoms, messages, help, profile, settings, slang, sappear, sremind, spass, pedit, signup: signup1, sprofile: signup2, sprivacy: signup3, welcome, login: () => loginPage(false), medlogin: () => loginPage(true), dhome, dpat, dmsg, dsoon };

function render() {
  clearInterval(timer); pend = {};
  if (user() && !who()) { state.user = null; sessionStorage.removeItem('attension.u'); } // compte supprimé
  if (state.langPref === 'auto') state.lang = /^fr/i.test(navigator.language || '') ? 'fr' : 'en';
  I.lang = state.lang; document.documentElement.lang = state.lang;
  const doc = role() === 'doctor';
  let [r, arg] = location.hash.slice(1).split(':');
  if (r === 'excel') {
  if (!user() && arg && findAcc(arg)) sessionStorage.setItem('attension.u', arg);
  const d = role() === 'doctor';
  if (user() && !d) setTimeout(() => exportExcel(true), 0);
  r = !user() ? 'welcome' : d ? 'dhome' : 'profile';
  }
  if (!user() && !AUTH.includes(r)) r = 'welcome'; else if (user() && AUTH.includes(r)) r = doc ? 'dhome' : 'home'; else if (doc && !DOC.includes(r) && !SHARED.includes(r)) r = 'dhome'; else if (user() && !doc && DOC.includes(r)) r = 'home';
  if (!user() && SU.includes(r) && !su.role) r = 'welcome';
  if (r !== location.hash.slice(1).split(':')[0]) { history.replaceState(null, '', '#' + r); arg = ''; }
  ARG = arg || '';
  const k = S[r] ? r : (user() ? (doc ? 'dhome' : 'home') : 'welcome');
  document.body.classList.toggle('auth', AUTH.includes(k));
  document.body.classList.toggle('doc', DOC.includes(k) || (doc && SHARED.includes(k)));
  document.documentElement.dataset.theme = theme();
  REG.length = 0;
  $('#app').innerHTML = S[k]();
  wire();
  // Les six icônes restent visibles en tout temps ; la page active est mise en évidence
  $('#nav').innerHTML = TABS.map(([n, i]) => `<a href="#${n}"${n === k || (n === 'profile' && SHARED.includes(k)) ? ' aria-current="page"' : ''}><i>${i}</i>${t(n)}</a>`).join('');
  $('#lg').innerHTML = ['fr', 'en'].map(l => `<button data-l="${l}" aria-pressed="${l === state.lang}">${l.toUpperCase()}</button>`).join('');
  if (k === 'home') { // Compte à rebours (voir la note dans config.js)
    const tick = () => { const d = nextSlot(); $('#cd').textContent = `${Math.floor(d / 36e5)} h ${String(Math.floor(d % 36e5 / 6e4)).padStart(2, '0')} min`; };
    tick(); timer = setInterval(tick, 3e4);
  }
  ['#chat', '#dchat'].forEach(q => { const c = $(q); if (c) c.scrollTop = c.scrollHeight; });
}

// Exportation (v7.0) : un PDF de 2 pages, puis un fichier Excel avec tout l’historique (croquis « Export »)
const docName = k => { const d = findCode(k.code); return d ? accName(d) : t('p_noDoc'); };
const pdfLink = () => location.href.split('#')[0].split('?')[0] + '#excel:' + (user() || '');
function exportPdf() {
  const k = who(), box = $('#msg');
  if (!k || role() === 'doctor') return void (box.innerHTML = `<p class="warn">${t('exportDoc')}</p>`);
  try { download(makePdf(k, docName(k), pdfLink()), fileName(k, 'pdf'), 'application/pdf'); }
  catch (err) { console.error(err); return void (box.innerHTML = `<p class="warn">${t('exportErr')}</p>`); }
  box.innerHTML = `<p class="good">${t('exportOk')}</p><button type="button" class="btn alt" id="xl">${t('exportMore')}</button>`; scrollTo(0, 0);
}
function exportExcel(msg) {
  const k = who(); if (!k || role() === 'doctor') return;
  try { download(makeXlsx(k, docName(k)), fileName(k, 'xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }
  catch (err) { console.error(err); if (msg) $('#msg').innerHTML = `<p class="warn">${t('exportErr')}</p>`; return; }
  if (msg) $('#msg').innerHTML = `<p class="good">${t('exportXl')}</p><button type="button" class="btn alt" id="xl">${t('exportMore')}</button>`;
}

document.addEventListener('click', e => {
  const l = e.target.closest('[data-l]'), p = e.target.closest('[data-p]');
  if (l) { state.lang = state.langPref = l.dataset.l; save(); render(); }
  if (p) { period = +p.dataset.p; render(); }
  const a = e.target.closest('[data-a]');
  if (a) {
    const k = a.dataset.a, l = k === 't' ? state.readings.at(-1) : state.symptoms.at(-1);
    if (pend[k]) delete pend[k]; else if (l) pend[k] = { k, d: k === 't' ? `${l.sys}/${l.dia} mmHg, ${t('pulse')} ${l.pul} (${fmt(l.t)})` : `${symTxt(l)} (${fmt(l.t)})` };
    chips(); if (!l && !pend[k]) $('#chip').innerHTML += `<small>${t(k === 't' ? 'noReadAtt' : 'noSymAtt')}</small>`;
  }
  const rm = e.target.closest('[data-rm]');
  if (rm) { delete pend[rm.dataset.rm]; chips(); }
  if (e.target.closest('#sa')) send(true);
  if (e.target.closest('[data-x]')) $('#mo')?.remove();
  const sb = e.target.closest('#su'); if (sb) { su = { role: sb.dataset.r === 'd' ? 'doctor' : 'patient' }; location.hash = '#signup'; }
  if (e.target.closest('#mn')) $('#sb')?.classList.toggle('off');
  if (e.target.closest('#gear')) location.hash = '#settings';
  const go = e.target.closest('[data-go]'); if (go) location.hash = go.dataset.go;
  const bk = e.target.closest('[data-back]'); if (bk && history.length > 1) { e.preventDefault(); history.back(); return; }
  if (e.target.closest('#out')) Sy.logout().then(() => { location.hash = '#welcome'; render(); });
  // NOTE: v7.0 : le bouton « Exporter » reste dans Profil, Paramètres et Symptômes (le déplacer vers l’accueil reste à décider)
  const lg = e.target.closest('[data-lang]'); if (lg) { state.langPref = lg.dataset.lang; if (lg.dataset.lang !== 'auto') state.lang = lg.dataset.lang; save(); render(); }
  const th = e.target.closest('[data-thm]'); if (th) { state.theme = th.dataset.thm === 'auto' ? null : th.dataset.thm; save(); render(); }
  const sv = e.target.closest('[data-sw]'); if (sv) { const k = who(), n = sv.dataset.sw; k.alr = { ...docAl(k), [n]: !docAl(k)[n] }; save(); render(); }
  const cp = e.target.closest('#cpy');
  if (cp) { const v = cp.dataset.v, ok = () => { cp.textContent = '✔ ' + t('p_copied'); }, fb = () => { const x = document.createElement('textarea'); x.value = v; document.body.append(x); x.select(); try { document.execCommand('copy') && ok(); } catch {} x.remove(); }; navigator.clipboard ? navigator.clipboard.writeText(v).then(ok, fb) : fb(); }
  if (e.target.closest('#del') && confirm(t('p_delConf'))) Sy.deleteMe().then(() => { location.hash = '#welcome'; render(); }).catch(err => { $('#msg').innerHTML = `<p class="warn">${t(err.status === 0 ? 'netErr' : 'syncErr')}</p>`; });
  if (e.target.closest('#exp')) exportPdf();
  if (e.target.closest('#xl')) exportExcel(true);
  if (e.target.closest('#hask')) { const q = $('#hs').value.trim(); state.draft = q; save(); location.hash = '#messages'; }
  if (e.target.closest('#htech')) { $('#hrf').hidden = false; $('#hrx').focus(); }
  if (e.target.closest('#hsug')) { const q = $('#hs').value.trim(); if (!q) return void ($('#hm').innerHTML = `<p class="warn">${t('h_empty')}</p>`); (state.suggestions = state.suggestions || []).push({ t: Date.now(), q }); save(); $('#hm').innerHTML = `<p class="good">${t('h_suggDone')}</p>`; }
  if (!e.target.closest('.ch')) document.querySelectorAll('.ch.on').forEach(c => c.classList.remove('on'));
});

document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'hrf') { const x = $('#hrx').value.trim(); if (!x) return; (state.reports = state.reports || []).push({ t: Date.now(), x }); save(); e.target.hidden = true; $('#hrx').value = ''; $('#hm').innerHTML = `<p class="good">${t('h_repDone')}</p>`; return; }
  if (e.target.id === 'sf') return saveSym(e.target);
  if (e.target.id === 'mf') return send(false);
  if (e.target.id === 'lp') return doLogin(false);
  if (e.target.id === 'lm') return doLogin(true);
  if (e.target.id === 'su1') return su1();
  if (e.target.id === 'su2') return su2();
  if (e.target.id === 'su3') return su3();
  if (e.target.id === 'ef') return saveEdit();
  if (e.target.id === 'pw2') return savePw(e.target);
  if (e.target.id === 'rf') return saveRem();
  if (e.target.id === 'thf') return saveThr(e.target);
  if (e.target.id === 'dmf') return dsend(e.target);
  if (e.target.id !== 'f') return;
  const v = id => $('#' + id).value === '' ? null : +$('#' + id).value;
  const x = { t: +new Date($('#when').value), sys: v('sys'), dia: v('dia'), pul: v('pul'), spo2: v('spo2') };
  const v4 = [['sys', x.sys], ['dia', x.dia], ['pul', x.pul], ['spo2', x.spo2]]; // valeurs acceptées : 1 à 1000
  const ok = v4.every(([k, n]) => n === null ? k === 'spo2' : n >= 1 && n <= 1000) && x.sys > x.dia && x.t <= Date.now() + 6e4;
  if (!ok) return void ($('#msg').innerHTML = `<p class="warn">${t('invalid')}</p>`);
  const odd = v4.filter(([k, n]) => n !== null && (n < C.plages[k][0] || n > C.plages[k][1])).map(([k, n]) => `${t(k)} : ${n}`);
  if (odd.length && !confirm(t('odd') + '\n' + odd.join('\n'))) return;
  if (state.demo && !confirm(t('wipe'))) return;
  addReading(x);
  document.querySelector('.demo')?.remove();
  $('#msg').innerHTML = `<p class="${high(x) ? 'warn' : 'good'}">${high(x) ? t('hi', thr().sys, thr().dia) : t('ok')}${ppAbn(x) ? ' ' + t('wide') : ''}</p>`;
  const c = combo(x.t) || twoHigh(x);
  if (c) { $('#msg').innerHTML += `<p class="warn">${t(c.s ? 'combo' : 'combo2')}</p>`; alertModal(c); }
  e.target.reset(); scrollTo(0, 0);
});

document.addEventListener('change', e => { if (e.target.id === 'dnotes') { state.notes = state.notes || {}; state.notes[e.target.dataset.id] = e.target.value; save(); } });
document.addEventListener('input', e => { // recherche : filtre la liste des patients et le tableau
  if (e.target.id === 'hs') return helpFilter(e.target.value);
  if (e.target.id !== 'srch') return;
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('[data-n]').forEach(el => { el.hidden = !el.dataset.n.includes(q); });
});
addEventListener('hashchange', () => { render(); scrollTo(0, 0); });
if (user() && !Sy.hasSession()) clearUserData(); // session fermée ou expirée : retour à l’accueil
render();

// Synchronisation (v8.0) : au démarrage, au retour dans l’app et toutes les quelques secondes (messagerie par sondage)
const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') || $('#mx')?.value || $('#dmx')?.value;
async function sync(full) {
  if (!user()) return;
  const r = await Sy.tick(full);
  if (r.expired) { clearUserData(); return void render(); }
  if (!r.msgs && !r.data) return;
  const h = location.hash.slice(1).split(':')[0];
  if (r.msgs && $('#chat')) { state.lu = Date.now(); $('#chat').innerHTML = bubs(state.messages); $('#chat').scrollTop = $('#chat').scrollHeight; }
  else if (r.msgs && $('#dchat')) { const p = pts().find(x => x.id === ARG); $('#dchat').innerHTML = bubs(p?.msgs || [], 'd'); $('#dchat').scrollTop = $('#dchat').scrollHeight; }
  else if (!typing() && ['home', 'graph', 'dhome', 'dpat'].includes(h)) render();
}
sync(true);
setInterval(() => { if (!document.hidden) sync(); }, C.supabase.sondageSec * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
addEventListener('online', () => sync());
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
