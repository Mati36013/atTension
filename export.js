// Exportation des données : PDF (résumé de 2 pages) et Excel (.xlsx, historique complet).
// Aucune bibliothèque externe : le prototype reste hors ligne. Le PDF et le fichier Excel sont écrits à la main ci-dessous.
import { CONFIG as C } from './config.js';
import { t, I } from './i18n.js';
import { state, thr, stats } from './data.js';

const DAY = 864e5, WIN = 30; // fenêtre du résumé : 30 jours
const CP = '#0B5D7A', CP2 = '#B26A00', TX = '#12232E', MUT = '#52656f', LN = '#cfdde4', BG = '#F3F8FA'; // mêmes couleurs que l’application (thème clair)

// ---------- Données ----------
const clean = s => String(s).replace(/[\u202f\u00a0]/g, ' ');
const dDate = ms => clean(new Date(ms).toLocaleDateString(I.lang, { day: 'numeric', month: 'short', year: 'numeric' }));
const dTime = ms => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const plain = s => String(s).replace(/₂/g, '2');

function model(acc, drName) {
  const now = Date.now(), th = thr(), R = (state.readings || []).slice().sort((a, b) => a.t - b.t), S = (state.symptoms || []).slice().sort((a, b) => a.t - b.t);
  const r30 = R.filter(x => x.t >= now - WIN * DAY), s30 = S.filter(x => x.t >= now - WIN * DAY);
  // Temps au-dessus du seuil : chaque mesure est « tenue » jusqu’à la suivante (24 h au plus)
  let above = 0, total = 0;
  r30.forEach((x, i) => { const d = Math.min((r30[i + 1] ? r30[i + 1].t : now) - x.t, DAY); total += d; if (x.sys >= th.sys || x.dia >= th.dia) above += d; });
  const ss = stats(r30, 'sys'), dd = stats(r30, 'dia');
  const cnt = {}; s30.forEach(e => C.symptomes.forEach(([id]) => { if (e.n[id] > 0) cnt[id] = (cnt[id] || 0) + 1; }));
  const common = C.symptomes.map(([id]) => [id, cnt[id] || 0]).filter(x => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const symRows = []; // une ligne par symptôme et par saisie, du plus récent au plus ancien
  S.slice().reverse().forEach(e => { C.symptomes.forEach(([id]) => { if (e.n[id] > 0) symRows.push({ t: e.t, s: t(id), v: t('l' + e.n[id]) }); }); if (e.o) symRows.push({ t: e.t, s: e.o, v: '' }); });
  const bpRows = R.slice().reverse().map(x => ({ t: x.t, sys: x.sys, dia: x.dia, pp: x.sys - x.dia, pul: x.pul, spo2: x.spo2 }));
  return { acc, drName, th, now, n30: r30.length, pctAbove: total ? above / total : null, hAbove: above / 36e5,
    avg: ss && dd ? [ss.m, dd.m] : null, avgPP: ss && dd ? ss.m - dd.m : null, common,
    symRows, bpRows, symRows30: symRows.filter(x => x.t >= now - WIN * DAY), bpRows30: bpRows.filter(x => x.t >= now - WIN * DAY) };
}

// ---------- PDF ----------
const W1 = '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584'.split(' ').map(Number);
const W2 = '278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 333 611 556 778 556 556 500 389 280 389 584'.split(' ').map(Number);
const WIN1252 = { '’': 0x92, '‘': 0x91, '“': 0x93, '”': 0x94, '–': 0x96, '—': 0x97, '•': 0x95, '…': 0x85, '€': 0x80, 'œ': 0x9c, 'Œ': 0x8c };
const bytes = s => Array.from(plain(clean(s))).map(c => WIN1252[c] ?? (c.charCodeAt(0) < 256 ? c.charCodeAt(0) : 63));
const esc = s => bytes(s).map(b => b === 40 || b === 41 || b === 92 ? '\\' + String.fromCharCode(b) : b < 32 || b > 126 ? '\\' + b.toString(8).padStart(3, '0') : String.fromCharCode(b)).join('');
const tw = (s, sz, bold) => Array.from(plain(clean(s))).reduce((w, c) => { const b = c.normalize('NFD')[0], i = b.charCodeAt(0) - 32; return w + ((bold ? W2 : W1)[i] ?? 556); }, 0) * sz / 1000;
const rgb = h => [1, 3, 5].map(i => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
const fit = (s, w, sz, bold) => { s = String(s); if (tw(s, sz, bold) <= w) return s; while (s.length > 1 && tw(s + '…', sz, bold) > w) s = s.slice(0, -1); return s + '…'; };

class Page {
  constructor() { this.o = []; this.links = []; }
  rect(x, y, w, h, fill, stroke) { this.o.push(`${fill ? rgb(fill) + ' rg ' : ''}${stroke ? rgb(stroke) + ' RG 0.8 w ' : ''}${x} ${y} ${w} ${h} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`); }
  line(x1, y1, x2, y2, col = LN, w = 0.8) { this.o.push(`${rgb(col)} RG ${w} w ${x1} ${y1} m ${x2} ${y2} l S`); }
  text(s, x, y, sz = 10, col = TX, bold = false, al = 'l') { const w = tw(s, sz, bold); if (al === 'r') x -= w; else if (al === 'c') x -= w / 2; this.o.push(`BT /${bold ? 'F2' : 'F1'} ${sz} Tf ${rgb(col)} rg ${x.toFixed(1)} ${y.toFixed(1)} Td (${esc(s)}) Tj ET`); return w; }
  arc(cx, cy, r, a0, a1, col, lw) { // arc de cercle (degrés, sens horaire depuis le haut), tracé épais = anneau
    const rad = d => (90 - d) * Math.PI / 180, n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 60)), step = (a1 - a0) / n;
    let p = `${rgb(col)} RG ${lw} w 0 J `;
    for (let i = 0; i < n; i++) {
      const s = rad(a0 + i * step), e = rad(a0 + (i + 1) * step), k = 4 / 3 * Math.tan((e - s) / 4);
      const P = a => [cx + r * Math.cos(a), cy + r * Math.sin(a)], A = P(s), B = P(e);
      if (!i) p += `${A[0].toFixed(2)} ${A[1].toFixed(2)} m `;
      p += `${(A[0] - k * r * Math.sin(s)).toFixed(2)} ${(A[1] + k * r * Math.cos(s)).toFixed(2)} ${(B[0] + k * r * Math.sin(e)).toFixed(2)} ${(B[1] - k * r * Math.cos(e)).toFixed(2)} ${B[0].toFixed(2)} ${B[1].toFixed(2)} c `;
    }
    this.o.push(p + 'S');
  }
  circle(cx, cy, r, col, lw) { this.arc(cx, cy, r, 0, 359.99, col, lw); }
  logo(x, y, s) { // cœur et tracé ECG, comme l’icône de l’application (viewBox 24 × 24)
    const X = v => (x + v * s).toFixed(2), Y = v => (y + (24 - v) * s).toFixed(2), c = (a, b, c2, d, e, f) => `${X(a)} ${Y(b)} ${X(c2)} ${Y(d)} ${X(e)} ${Y(f)} c `;
    this.o.push(`${rgb(CP)} rg ${X(12)} ${Y(21.35)} m ${X(10.55)} ${Y(20.03)} l ` + c(5.4, 15.36, 2, 12.28, 2, 8.5) + c(2, 5.42, 4.42, 3, 7.5, 3) + c(9.24, 3, 10.91, 3.81, 12, 5.09) + c(13.09, 3.81, 14.76, 3, 16.5, 3) + c(19.58, 3, 22, 5.42, 22, 8.5) + c(22, 12.28, 18.6, 15.36, 13.45, 20.04) + `${X(12)} ${Y(21.35)} l f`);
    this.o.push(`1 1 1 RG ${(1.2 * s).toFixed(2)} w 1 j ${[[5, 12], [9, 12], [11, 8.5], [13, 15.5], [15, 12], [19, 12]].map(([a, b], i) => `${X(a)} ${Y(b)} ${i ? 'l' : 'm'}`).join(' ')} S`);
  }
  link(x, y, w, h, url) { this.links.push([x, y, w, h, url]); }
}

function table(p, x, y, cols, rows, rh = 18) { // cols : [titre, largeur, alignement] ; retourne le y sous le tableau
  const tot = cols.reduce((s, c) => s + c[1], 0);
  p.rect(x, y - rh, tot, rh, CP);
  let cx = x; cols.forEach(([h, w, al]) => { p.text(fit(h, w - 12, 9, true), al === 'r' ? cx + w - 6 : cx + 6, y - rh + 6, 9, '#FFFFFF', true, al === 'r' ? 'r' : 'l'); cx += w; });
  rows.forEach((r, i) => {
    const ry = y - rh * (i + 2);
    p.rect(x, ry, tot, rh, i % 2 ? BG : '#FFFFFF');
    cx = x; cols.forEach(([, w, al], j) => { p.text(fit(r[j], w - 12, 9), al === 'r' ? cx + w - 6 : cx + 6, ry + 6, 9, TX, false, al === 'r' ? 'r' : 'l'); cx += w; });
  });
  const bot = y - rh * (rows.length + 1);
  p.rect(x, bot, tot, rh * (rows.length + 1), null, LN);
  return bot;
}

export function makePdf(acc, drName, url) {
  const m = model(acc, drName), PW = 612, PH = 792, M = 44, pages = [new Page(), new Page()], [a, b] = pages;
  const head = (p, n) => {
    p.logo(M, PH - 62, 1.55); p.text('atTension', M + 44, PH - 54, 22, CP, true);
    p.text(t('x_date'), PW - M, PH - 40, 9, MUT, false, 'r'); p.text(dDate(m.now), PW - M, PH - 54, 12, TX, true, 'r');
    p.line(M, PH - 74, PW - M, PH - 74, CP, 1.5);
    p.text(`${t('x_foot')} · ${n}/2`, PW / 2, 28, 8, MUT, false, 'c');
  };
  head(a, 1); head(b, 2);
  // Page 1 : identité
  let y = PH - 102;
  a.text(m.acc ? [m.acc.first, m.acc.last].filter(Boolean).join(' ') || t('x_unnamed') : t('x_unnamed'), M, y, 18, TX, true);
  y -= 20; a.text(`${t('p_myDoc')} : ${m.drName}`, M, y, 11, MUT);
  y -= 16; a.text(`${t('p_dob')} : ${m.acc?.dob ? dDate(new Date(m.acc.dob + 'T12:00').getTime()) : '–'}`, M, y, 11, MUT);
  y -= 16; a.text(`${t('p_thr')} : ${m.th.sys}/${m.th.dia} mmHg`, M, y, 11, MUT);
  if (state.demo) { y -= 16; a.text(t('x_demo'), M, y, 10, CP2, true); }
  // Page 1 : résumé 30 jours
  y = PH - 232; a.text(t('x_sum', WIN), M, y, 13, CP, true); a.line(M, y - 6, PW - M, y - 6);
  const cx = M + 100, cy = y - 130, R = 78, LW = 30;
  a.circle(cx, cy, R, LN, LW);
  if (m.pctAbove !== null) {
    const f = m.pctAbove, A = f * 360;
    if (f < 0.9995) a.arc(cx, cy, R, A, 360 - 0.01, CP, LW);
    if (f > 0.0005) f > 0.9995 ? a.circle(cx, cy, R, CP2, LW) : a.arc(cx, cy, R, 0, A, CP2, LW);
    a.text(Math.round(f * 100) + ' %', cx, cy - 2, 24, TX, true, 'c'); a.text(t('x_above'), cx, cy - 18, 8, MUT, false, 'c');
  } else a.text('–', cx, cy - 6, 24, MUT, true, 'c');
  a.rect(cx - 70, cy - R - 38, 9, 9, CP, null); a.text(t('x_below'), cx - 56, cy - R - 36, 9, MUT);
  a.rect(cx + 10, cy - R - 38, 9, 9, CP2, null); a.text(t('x_above'), cx + 24, cy - R - 36, 9, MUT);
  const mx = 280, kv = (lab, val, yy) => { a.text(lab, mx, yy, 10, MUT); a.text(val, mx, yy - 22, 17, TX, true); };
  kv(t('x_time'), m.pctAbove === null ? t('noData') : `${Math.round(m.pctAbove * 100)} % (${Math.round(m.hAbove)} h)`, cy + 62);
  kv(t('x_avgBP', WIN), m.avg ? `${Math.round(m.avg[0])}/${Math.round(m.avg[1])} mmHg` : t('noData'), cy + 6);
  kv(t('x_avgPP', WIN), m.avgPP !== null ? `${Math.round(m.avgPP)} mmHg` : t('noData'), cy - 50);
  a.text(t('x_nm', m.n30), mx, cy - 100, 9, MUT);
  // Page 1 : symptômes communs
  y = cy - R - 84; a.text(t('x_common'), M, y, 13, CP, true); a.line(M, y - 6, PW - M, y - 6);
  if (m.common.length) m.common.forEach(([id, n], i) => { const yy = y - 28 - i * 22; a.rect(M, yy - 3, 6, 6, CP, null); a.text(t(id), M + 16, yy - 3.5, 12, TX); a.text(t('x_times', n), PW - M, yy - 3.5, 11, MUT, false, 'r'); });
  else a.text(t('none'), M, y - 28, 12, MUT);
  // Page 2 : historiques
  const N = 12; y = PH - 102;
  b.text(t('x_symHist'), M, y, 13, CP, true);
  const sr = m.symRows30.slice(0, N), tr = m.bpRows30.slice(0, N), tw2 = PW - 2 * M;
  let bot = table(b, M, y - 12, [[t('colDate'), tw2 * .3], [t('x_symptom'), tw2 * .45], [t('x_sev'), tw2 * .25]], sr.length ? sr.map(r => [dDate(r.t), r.s, r.v]) : [['–', t('none'), '–']]);
  y = bot - 34; b.text(t('x_bpHist'), M, y, 13, CP, true);
  bot = table(b, M, y - 12, [[t('colDate'), tw2 * .27], [t('x_hour'), tw2 * .15], [t('x_bp'), tw2 * .28], [t('x_pp'), tw2 * .3]], tr.length ? tr.map(r => [dDate(r.t), dTime(r.t), `${r.sys}/${r.dia} mmHg`, `${r.pp} mmHg`]) : [['–', '–', t('noData'), '–']]);
  const more = Math.max(0, m.symRows30.length - sr.length) + Math.max(0, m.bpRows30.length - tr.length);
  y = bot - 22; b.text(t('x_last', N, WIN), M, y, 8.5, MUT);
  y -= 40; b.rect(M, y - 16, tw2, 52, BG, LN);
  const w1 = b.text(t('x_more') + ' ', M + 12, y + 14, 11, TX, true), lk = t('x_click');
  const w2 = b.text(lk, M + 12 + w1, y + 14, 11, CP, true); b.line(M + 12 + w1, y + 12, M + 12 + w1 + w2, y + 12, CP, 0.8);
  if (url) b.link(M + 12 + w1, y + 8, w2, 16, url);
  b.text(t('x_moreNote') + (more ? ` (+${more} ${t('x_entries')})` : ''), M + 12, y - 4, 9, MUT);
  return pdfFile(pages, PW, PH);
}

function pdfFile(pages, PW, PH) {
  const objs = []; const add = s => objs.push(s) && objs.length; // numéros d’objets à partir de 1
  add('<< /Type /Catalog /Pages 2 0 R >>'); add(''); // 2 = Pages (rempli plus bas)
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids = [];
  pages.forEach(p => {
    const body = p.o.join('\n'), c = add(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
    const an = p.links.map(([x, y, w, h, u]) => add(`<< /Type /Annot /Subtype /Link /Rect [${x} ${y} ${x + w} ${y + h}] /Border [0 0 0] /A << /S /URI /URI (${esc(u)}) >> >>`));
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${c} 0 R${an.length ? ` /Annots [${an.map(n => n + ' 0 R').join(' ')}]` : ''} >>`));
  });
  objs[1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
  const info = add(`<< /Title (atTension) /Producer (atTension) >>`);
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'; const off = [];
  objs.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xr = out.length; out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xr}\n%%EOF`;
  return Uint8Array.from(out, c => c.charCodeAt(0) & 255); // le contenu est en octets WinAnsi : une lettre = un octet
}

// ---------- Excel (.xlsx = archive zip non compressée) ----------
const CRC = (() => { const T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; } return b => { let c = -1; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }; })();
const u8 = s => new TextEncoder().encode(s);
function zip(files) {
  const parts = [], cen = []; let off = 0;
  const le = (n, b) => Array.from({ length: b }, (_, i) => (n >>> (8 * i)) & 255);
  files.forEach(([name, data]) => {
    const nb = u8(name), crc = CRC(data), h = [...le(0x04034b50, 4), ...le(20, 2), ...le(0x0800, 2), ...le(0, 2), ...le(0, 2), ...le(0x21, 2), ...le(crc, 4), ...le(data.length, 4), ...le(data.length, 4), ...le(nb.length, 2), ...le(0, 2)];
    parts.push(Uint8Array.from(h), nb, data);
    cen.push(Uint8Array.from([...le(0x02014b50, 4), ...le(20, 2), ...le(20, 2), ...le(0x0800, 2), ...le(0, 2), ...le(0, 2), ...le(0x21, 2), ...le(crc, 4), ...le(data.length, 4), ...le(data.length, 4), ...le(nb.length, 2), ...le(0, 2), ...le(0, 2), ...le(0, 2), ...le(0, 2), ...le(0, 4), ...le(off, 4)]), nb);
    off += h.length + nb.length + data.length;
  });
  const cs = cen.reduce((s, x) => s + x.length, 0), end = Uint8Array.from([...le(0x06054b50, 4), ...le(0, 2), ...le(0, 2), ...le(files.length, 2), ...le(files.length, 2), ...le(cs, 4), ...le(off, 4), ...le(0, 2)]);
  const all = [...parts, ...cen, end], out = new Uint8Array(all.reduce((s, x) => s + x.length, 0)); let p = 0; all.forEach(x => { out.set(x, p); p += x.length; });
  return out;
}
const xe = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const col = i => String.fromCharCode(65 + i);
function sheet(head, rows, widths) { // en-tête : style 1 (fond bleu atTension, texte blanc gras)
  const cell = (v, r, c, s) => typeof v === 'number' ? `<c r="${col(c)}${r}"${s ? ` s="${s}"` : ''}><v>${v}</v></c>` : v === '' || v == null ? '' : `<c r="${col(c)}${r}" t="inlineStr"${s ? ` s="${s}"` : ''}><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
  const all = [head, ...rows].map((r, i) => `<row r="${i + 1}"${i ? '' : ' ht="22" customHeight="1"'}>${r.map((v, c) => cell(v, i + 1, c, i ? 0 : 1)).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${all}</sheetData></worksheet>`;
}
export function makeXlsx(acc, drName) {
  const m = model(acc, drName);
  const bp = sheet([t('colDate'), t('x_hour'), t('x_bp'), t('x_pp'), t('sys'), t('dia'), t('pulse'), 'SpO2'], m.bpRows.map(r => [dDate(r.t), dTime(r.t), `${r.sys}/${r.dia} mmHg`, r.pp, r.sys, r.dia, r.pul, r.spo2 ?? '']), [16, 9, 18, 18, 16, 16, 12, 9]);
  const sy = sheet([t('colDate'), t('x_hour'), t('x_symptom'), t('x_sev')], m.symRows.map(r => [dDate(r.t), dTime(r.t), r.s, r.v]), [16, 9, 34, 14]);
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', rn = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const files = [
    ['[Content_Types].xml', `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ['_rels/.rels', `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rn}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `${X}<workbook ${ns} xmlns:r="${rn}"><sheets><sheet name="${xe(t('x_shBP'))}" sheetId="1" r:id="rId1"/><sheet name="${xe(t('x_shSym'))}" sheetId="2" r:id="rId2"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rn}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rn}/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="${rn}/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', `${X}<styleSheet ${ns}><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B5D7A"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
    ['xl/worksheets/sheet1.xml', bp], ['xl/worksheets/sheet2.xml', sy]
  ].map(([n, s]) => [n, u8(s)]);
  return zip(files);
}

export function download(data, name, type) {
  const a = document.createElement('a'), u = URL.createObjectURL(new Blob([data], { type }));
  a.href = u; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4e4);
}
export const fileName = (acc, ext) => `atTension_${(acc ? [acc.first, acc.last].filter(Boolean).join('_') : 'export').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '_')}_${new Date().toISOString().slice(0, 10)}.${ext}`;
