/* =====================================================================
   Administrace Med Shop
   Obsah a ceny jsou v repozitáři webu (_data/*.json). Uložení = jeden commit přes
   backend webhunter-admin (Cloudflare Worker, přihlášení heslem); GitHub Action pak
   web přegeneruje (~1 min). Objednávky jsou uložené přímo v backendu (ne v repozitáři).
   ===================================================================== */
'use strict';
(() => {
const CFG = {
  id: 'medshop', site: '../',
  api: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.search.includes('local') ? 'http://localhost:8787' : 'https://webhunter-admin.webhunter.workers.dev',
};
const FILES = {
  honeys: '_data/honeys.json', products: '_data/products.json', shop: '_data/shop.json', site: '_data/site.json',
  wholesale: '_data/wholesale.json', process: '_data/process.json', knowledge: '_data/knowledge.json', vop: '_data/vop.json', gdpr: '_data/gdpr.json',
};
const LABEL = { honeys: 'Druhy medu', products: 'Další zboží', shop: 'Doprava a platba', site: 'Texty a kontakty', wholesale: 'Pro obchody', process: 'Jak med vzniká', knowledge: 'Malá škola medu', vop: 'Obchodní podmínky', gdpr: 'Ochrana údajů' };
const SK = 'medshop_admin';

const S = { sess: null, def: false, D: {}, snap: {}, pending: {}, preview: {}, saving: false, lib: null, orders: null, ofilter: 'nova' };

/* ---------------------------------------------------------------- ikony */
const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC = {
  home: I('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  phone: I('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  lesson: I('<circle cx="12" cy="5" r="2"/><path d="M12 7v6l-4 7M12 13l4 7M6 10h12"/>'),
  cal: I('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  tag: I('<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'),
  q: I('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h0"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.7 1.7 0 0 0-2.8 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.8-1.2 2 2 0 1 1-2.8-2.8A1.7 1.7 0 0 0 3.3 14a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.8 2 2 0 1 1 2.8-2.8A1.7 1.7 0 0 0 10 3.3a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.8 1.2 2 2 0 1 1 2.8 2.8A1.7 1.7 0 0 0 20.7 10a2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.3 1z"/>'),
  ext: I('<path d="M14 4h6v6M20 4L10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>'),
  menu: I('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  x: I('<path d="M18 6L6 18M6 6l12 12"/>'),
  up: I('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  down: I('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  trash: I('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  chev: I('<path d="M6 9l6 6 6-6"/>'),
  eye: I('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>'),
  upload: I('<path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M17 8l-5-5-5 5M12 3v12"/>'),
  image: I('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h0"/>'),
  logout: I('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  copy: I('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
};

/* ---------------------------------------------------------------- utils */
const $ = (s, c = document) => c.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const uid = () => Math.random().toString(36).slice(2, 8);
const slugify = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const imgSrc = (p) => !p ? '' : S.preview[p] || (/^(https?:|blob:|data:)/.test(p) ? p : CFG.site + (p.includes('/') ? p : 'assets/img/cut/' + p + '.webp'));

/** h('div.class', {attr}, ...children) — malý DOM helper */
function h(sel, props = {}, ...kids) {
  const [tag, ...cls] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}

function toast(title, sub = '', type = '') {
  const el = h('div.toast' + (type ? '.' + type : ''), {}, h('b', {}, title), sub ? h('small', {}, sub) : null);
  $('#toasts').append(el);
  setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 450); }, type === 'err' ? 7000 : 4000);
}
function modal({ title, body, actions = [] }) {
  return new Promise((resolve) => {
    const close = (v) => { bg.remove(); resolve(v); };
    const box = h('div.modal', { role: 'dialog', 'aria-modal': 'true' }, h('h2', {}, title));
    if (typeof body === 'string') box.append(h('div', { html: body })); else if (body) box.append(body);
    box.append(h('div.modal-actions', {}, actions.map((a) => h('button.btn' + (a.cls ? '.' + a.cls : ''), { type: 'button', onclick: () => close(typeof a.value === 'function' ? a.value(box) : a.value) }, a.label))));
    const bg = h('div.modal-bg', { onclick: (e) => { if (e.target === bg) close(null); } }, box);
    $('#modal-root').append(bg);
    const f = box.querySelector('input,textarea,select,button.btn-primary'); if (f) setTimeout(() => f.focus(), 50);
  });
}
const confirmDlg = (title, text, ok = 'Smazat', cls = 'btn-dark') => modal({ title, body: `<p>${esc(text)}</p>`, actions: [{ label: 'Zrušit', value: false }, { label: ok, cls, value: true }] }).then((v) => v === true);

/* ---------------------------------------------------------------- API */
const b64e = (bytes) => { let s = ''; bytes = new Uint8Array(bytes); for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
const utf8b64 = (str) => b64e(new TextEncoder().encode(str));
function saveSess() { localStorage.setItem(SK, JSON.stringify({ t: S.sess, def: S.def, exp: Date.now() + 11.5 * 3600e3 })); }
async function api(path, opt = {}, retried = false) {
  const headers = { ...(typeof opt.body === 'string' ? { 'Content-Type': 'application/json' } : {}) };
  if (S.sess) headers.Authorization = 'Bearer ' + S.sess;
  let r;
  try { r = await fetch(`${CFG.api}/api/${CFG.id}${path}`, { ...opt, headers, cache: 'no-store' }); }
  catch { throw new Error('Nelze se spojit se serverem. Zkontrolujte připojení k internetu.'); }
  if (r.status === 401 && path !== '/login' && !retried && S.D.site) { if (await reauth()) return api(path, opt, true); }
  if (!r.ok) { let m = r.statusText; try { m = (await r.json()).error || m; } catch {} const e = new Error(m); e.status = r.status; throw e; }
  return opt.raw ? r.text() : r.json();
}
const readFile = (p) => api('/file?path=' + encodeURIComponent(p) + '&t=' + Date.now(), { raw: true });
async function commit(files, message) {
  const out = []; const queue = [...files];
  const worker = async () => { while (queue.length) { const f = queue.shift(); const { sha } = await api('/blob', { method: 'POST', body: JSON.stringify({ content: f.b64 ?? utf8b64(f.content), encoding: 'base64' }) }); out.push({ path: f.path, sha }); } };
  await Promise.all([worker(), worker(), worker()]);
  return (await api('/commit', { method: 'POST', body: JSON.stringify({ files: out, message }) })).sha;
}
async function reauth() {
  const inp = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Heslo' });
  const pw = await modal({ title: 'Přihlášení vypršelo', body: h('div', {}, h('p', {}, 'Zadejte prosím heslo znovu — rozdělaná práce zůstane zachovaná.'), inp), actions: [{ label: 'Zrušit', value: null }, { label: 'Přihlásit', cls: 'btn-primary', value: () => inp.value }] });
  if (!pw) return false;
  try { const r = await api('/login', { method: 'POST', body: JSON.stringify({ password: pw }) }); S.sess = r.token; S.def = r.def; saveSess(); return true; }
  catch (e) { toast('Přihlášení se nepovedlo', e.message, 'err'); return false; }
}

/* ---------------------------------------------------------------- data */
async function loadAll() {
  const keys = Object.keys(FILES);
  const res = await Promise.all(keys.map((k) => readFile(FILES[k]).then(JSON.parse)));
  keys.forEach((k, i) => { S.D[k] = res[i]; });
  snapshot();
}
function snapshot(keys = Object.keys(FILES)) { keys.forEach((k) => { S.snap[k] = JSON.stringify(S.D[k]); }); }
const dirtyKeys = () => Object.keys(FILES).filter((k) => S.D[k] && JSON.stringify(S.D[k]) !== S.snap[k]);
const changed = debounce(() => updateSavebar(), 100);
window.addEventListener('beforeunload', (e) => { if (dirtyKeys().length) { e.preventDefault(); e.returnValue = ''; } });

function validate() {
  const ids = new Set(), slugs = new Set();
  const fix = (it, prefix) => {
    if (!it.id) it.id = slugify(it.name) || prefix + '-' + uid();
    while (ids.has(it.id)) it.id = it.id + '-' + uid();
    ids.add(it.id);
    if (!it.slug) it.slug = slugify(it.name) || it.id;
    while (slugs.has(it.slug)) it.slug = it.slug + '-' + uid();
    slugs.add(it.slug);
  };
  for (const x of S.D.honeys) {
    if (!x.name?.trim()) return 'Jeden druh medu nemá název.';
    if (!x.variants?.length) return `${x.name}: přidejte alespoň jedno balení.`;
    for (const v of x.variants) if (!v.label?.trim()) return `${x.name}: jedno balení nemá název (např. 950 g).`;
    fix(x, 'med');
  }
  for (const p of S.D.products) {
    if (!p.name?.trim()) return 'Jedno zboží nemá název.';
    fix(p, 'zbozi');
  }
  for (const s of S.D.shop.shipping) {
    if (!s.name?.trim()) return 'Jeden způsob převzetí nemá název.';
    if (!s.id) s.id = slugify(s.name) || 'doprava-' + uid();
  }
  const b = S.D.shop.bank;
  if (b.account?.trim() && !czIban(b.account)) return 'Číslo bankovního účtu nevypadá správně. Zadejte ho ve tvaru 123456789/0100 nebo 19-123456789/0800.';
  if (b.iban?.trim() && !ibanValid(b.iban)) return 'IBAN nevypadá správně. Zkontrolujte ho, nebo pole nechte prázdné – vypočítá se z čísla účtu.';
  return null;
}
async function saveAll() {
  const keys = dirtyKeys();
  if (!keys.length || S.saving) return;
  const err = validate(); if (err) return toast('Nelze uložit', err, 'err');
  S.saving = true; updateSavebar();
  const bar = h('div.progress-line'); document.body.append(bar);
  try {
    const files = keys.map((k) => ({ path: FILES[k], content: JSON.stringify(S.D[k], null, 2) + '\n' }));
    const used = JSON.stringify(S.D);
    const imgs = Object.keys(S.pending).filter((p) => used.includes(p));
    imgs.forEach((p) => files.push({ path: p, b64: S.pending[p] }));
    const sha = await commit(files, keys.map((k) => LABEL[k]).join(', ') + (imgs.length ? ` (+${imgs.length} foto)` : ''));
    imgs.forEach((p) => delete S.pending[p]);
    snapshot(keys);
    toast('Uloženo', 'Změny se na webu objeví přibližně za minutu.', 'ok');
    watchPublish(sha);
  } catch (e) { toast('Uložení se nepovedlo', e.message, 'err'); }
  finally { S.saving = false; bar.remove(); updateSavebar(); }
}
function discard() { dirtyKeys().forEach((k) => { S.D[k] = JSON.parse(S.snap[k]); }); updateSavebar(); route(); toast('Změny zahozeny'); }

/* publikace — čeká, až version.json na webu obsahuje nový commit */
let pubTimer = null;
function setPub(state, text) { const el = $('.pub'); if (el) { el.className = 'pub ' + state; el.innerHTML = `<i></i><span>${esc(text)}</span>`; } }
function watchPublish(sha) {
  localStorage.setItem(SK + '_pub', JSON.stringify({ sha, t: Date.now() }));
  clearInterval(pubTimer); setPub('busy', 'Zveřejňuji změny…');
  const t0 = Date.now();
  pubTimer = setInterval(async () => {
    try {
      const v = await fetch(CFG.site + 'version.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json());
      if (v.sha === sha) { clearInterval(pubTimer); localStorage.removeItem(SK + '_pub'); setPub('', 'Web je aktuální'); toast('Změny jsou na webu', 'Web byl právě aktualizován.', 'ok'); return; }
    } catch {}
    if (Date.now() - t0 > 8 * 60000) { clearInterval(pubTimer); setPub('warn', 'Zveřejnění trvá déle'); }
  }, 6000);
}
function initPub() { const p = JSON.parse(localStorage.getItem(SK + '_pub') || 'null'); if (p && Date.now() - p.t < 10 * 60000) watchPublish(p.sha); else setPub('', 'Web je aktuální'); }

/* ---------------------------------------------------------------- obrázky */
async function compress(file, max = 1800) {
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { throw new Error(`Soubor „${file.name}“ nejde načíst. Použijte JPG, PNG nebo WebP.`); }
  const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  let blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.82)), ext = 'webp';
  if (!blob || blob.type !== 'image/webp') { blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86)); ext = 'jpg'; }
  return { blob, ext };
}
async function upload(file, hint) {
  const { blob, ext } = await compress(file);
  const d = new Date();
  const name = (slugify(hint) || slugify(file.name.replace(/\.[^.]+$/, '')) || 'foto').slice(0, 40);
  const path = `img/uploads/${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}/${name}-${uid()}.${ext}`;
  S.pending[path] = b64e(await blob.arrayBuffer());
  S.preview[path] = URL.createObjectURL(blob);
  return path;
}
async function library() {
  if (!S.lib) { try { S.lib = await fetch(CFG.site + 'admin/images.json?t=' + Date.now()).then((r) => r.json()); } catch { S.lib = []; } }
  return [...Object.keys(S.pending), ...S.lib];
}

/* ---------------------------------------------------------------- pole formulářů */
const bump = () => changed();
function fText(obj, key, label, o = {}) {
  const inp = o.multi
    ? h('textarea', { rows: o.rows || 4, placeholder: o.ph || '', oninput: (e) => { obj[key] = e.target.value; bump(); o.on?.(); } })
    : h('input', { type: o.type || 'text', placeholder: o.ph || '', inputmode: o.inputmode, autocomplete: 'off', oninput: (e) => { obj[key] = o.type === 'number' ? +e.target.value : e.target.value; bump(); o.on?.(); } });
  inp.value = obj[key] ?? '';
  return h('label.field', {}, h('span', {}, label), inp, o.hint ? h('small', {}, o.hint) : null);
}
function fSelect(obj, key, label, options, o = {}) {
  if (obj[key] != null && !options.some(([v]) => String(v) === String(obj[key]))) options = [[obj[key], o.custom ? o.custom(obj[key]) : String(obj[key])], ...options];
  const sel = h('select', { onchange: (e) => { const v = e.target.value; obj[key] = o.num ? +v : v; bump(); o.on?.(); } },
    options.map(([v, t]) => h('option', { value: v }, t)));
  sel.value = String(obj[key] ?? options[0][0]);
  return h('label.field', {}, h('span', {}, label), sel);
}
function fCheck(obj, key, label) {
  return h('label.check', {}, h('input', { type: 'checkbox', checked: obj[key], onchange: (e) => { obj[key] = e.target.checked; bump(); } }), h('span', {}, label));
}
function fImage(obj, key, label, hint = '', on) {
  const prev = h('img.prev', { src: imgSrc(obj[key]), alt: '' });
  const set = (p) => { obj[key] = p; prev.src = imgSrc(p); bump(); on?.(); };
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { set(await upload(f, hint)); toast('Fotka připravena', 'Na web se nahraje po uložení.'); } catch (er) { toast('Fotku se nepodařilo načíst', er.message, 'err'); }
    e.target.value = '';
  } });
  const pick = async () => {
    const list = await library();
    const grid = h('div.lib', {}, list.map((p) => h('button', { type: 'button', onclick: () => { set(p.startsWith('assets/img/cut/') ? p.split('/').pop().replace(/\.webp$/, '') : p); document.querySelector('.modal-bg')?.click(); } }, h('img', { src: imgSrc(p), loading: 'lazy', alt: '' }))));
    modal({ title: 'Vybrat fotku z webu', body: grid, actions: [{ label: 'Zavřít', value: null }] });
  };
  return h('div.field', {}, h('span', {}, label),
    h('div.img-field', {}, prev, h('div.acts', {},
      h('button.btn.btn-sm', { type: 'button', onclick: () => file.click(), html: IC.upload + 'Nahrát novou' }),
      h('button.btn.btn-sm.btn-ghost', { type: 'button', onclick: pick, html: IC.image + 'Vybrat z webu' }), file)));
}
/** seznam položek s rozbalováním, řazením a mazáním */
function fList(arr, o) {
  const wrap = h('div');
  const render = (openIdx = -1) => {
    wrap.replaceChildren();
    const items = h('div.items');
    if (!arr.length) items.append(h('p.empty', {}, o.empty || 'Zatím tu nic není.'));
    arr.forEach((it, i) => {
      const title = h('b'), sub = h('small'), thumb = o.thumb ? h('img.thumb', { alt: '' }) : null;
      const refresh = () => { title.textContent = o.title(it) || '(bez názvu)'; sub.textContent = o.sub ? o.sub(it) : ''; if (thumb) thumb.src = imgSrc(o.thumb(it)); };
      const body = h('div.item-body');
      let built = false;
      const el = h('div.item');
      const toggle = () => { if (!built) { o.body(it, body, refresh); built = true; } el.classList.toggle('open'); };
      const head = h('div.item-head', {},
        thumb, h('div.t', { onclick: toggle }, title, sub),
        h('div.item-tools', {},
          o.sortable === false ? null : h('button.btn.btn-icon.btn-ghost', { type: 'button', title: 'Posunout nahoru', 'aria-label': 'Posunout nahoru', disabled: i === 0, onclick: () => { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); bump(); render(); }, html: IC.up }),
          o.sortable === false ? null : h('button.btn.btn-icon.btn-ghost', { type: 'button', title: 'Posunout dolů', 'aria-label': 'Posunout dolů', disabled: i === arr.length - 1, onclick: () => { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); bump(); render(); }, html: IC.down }),
          h('button.btn.btn-icon.btn-ghost', { type: 'button', title: 'Smazat', 'aria-label': 'Smazat', onclick: async () => { if (await confirmDlg('Smazat položku?', `„${o.title(it) || 'bez názvu'}“ bude odstraněna.`)) { arr.splice(i, 1); bump(); render(); } }, html: IC.trash }),
          h('button.btn.btn-icon.btn-ghost.chev', { type: 'button', 'aria-label': 'Rozbalit', onclick: toggle, html: IC.chev })));
      el.append(head, body); items.append(el); refresh();
      if (i === openIdx) toggle();
    });
    wrap.append(items, h('button.btn.add', { type: 'button', onclick: () => { arr.push(o.make()); bump(); render(arr.length - 1); }, html: IC.plus + (o.addLabel || 'Přidat') }));
  };
  render();
  return wrap;
}
/** seznam textů (odstavce, kvalifikace) */
function fStrList(arr, label, o = {}) {
  const box = h('div.field', {}, h('span', {}, label));
  const list = h('div');
  const render = () => {
    list.replaceChildren(...arr.map((v, i) => {
      const inp = o.multi ? h('textarea', { rows: 3 }) : h('input', { type: 'text' });
      inp.value = v; inp.addEventListener('input', (e) => { arr[i] = e.target.value; bump(); });
      return h('div', { style: 'display:flex;gap:.4rem;align-items:flex-start;margin-bottom:.45rem' }, inp,
        h('button.btn.btn-icon.btn-ghost', { type: 'button', 'aria-label': 'Smazat', onclick: () => { arr.splice(i, 1); bump(); render(); }, html: IC.trash }));
    }), h('button.btn.btn-sm', { type: 'button', onclick: () => { arr.push(''); bump(); render(); list.querySelector((o.multi ? 'textarea' : 'input') + ':last-of-type'); }, html: IC.plus + (o.add || 'Přidat') }));
  };
  render(); box.append(list);
  return box;
}
const card = (title, hint, ...kids) => h('section.card', {}, title ? h('h2', {}, title) : null, hint ? h('p.hint', {}, hint) : null, ...kids);
const row2 = (...kids) => h('div.row2', {}, ...kids);


/* ---------------------------------------------------------------- banka (stejný výpočet jako backend) */
const W11 = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1];
const mod11 = (d) => { d = d.padStart(10, '0'); let s = 0; for (let i = 0; i < 10; i++) s += +d[i] * W11[i]; return s % 11 === 0; };
const mod97 = (n) => { let r = 0; for (const ch of n) r = (r * 10 + +ch) % 97; return r; };
function ibanValid(iban) {
  const s = String(iban || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  return mod97((s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))) === 1;
}
function czIban(account) {
  const m = String(account || '').replace(/\s+/g, '').match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
  if (!m) return null;
  const [, pre = '', num, bank] = m;
  if ((pre && !mod11(pre)) || !mod11(num)) return null;
  const bban = bank + pre.padStart(6, '0') + num.padStart(10, '0');
  return 'CZ' + String(98 - mod97(bban + '123500')).padStart(2, '0') + bban;
}
const fmtIban = (s) => s.replace(/(.{4})/g, '$1 ').trim();
const kc = (n) => (n == null || n === '' ? '–' : Math.round(+n).toLocaleString('cs-CZ') + ' Kč');
const fdate = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

/* ---------------------------------------------------------------- další pole */
function fPrice(obj, key, label, o = {}) {
  const inp = h('input', { type: 'text', inputmode: 'numeric', placeholder: o.ph || '', autocomplete: 'off', oninput: (e) => {
    const v = e.target.value.replace(/\s/g, '').replace(',', '.');
    obj[key] = v === '' ? null : (Number.isFinite(+v) ? +v : obj[key]); bump(); o.on?.();
  } });
  inp.value = obj[key] ?? '';
  return h('label.field', {}, h('span', {}, label), h('div.price-in', {}, inp), o.hint ? h('small', {}, o.hint) : null);
}
function fColor(obj, key, label, hint) {
  const txt = h('input', { type: 'text', value: obj[key] || '', maxlength: 7, style: 'max-width:8rem', oninput: (e) => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) { obj[key] = e.target.value; col.value = e.target.value; bump(); } } });
  const col = h('input', { type: 'color', value: obj[key] || '#E8AE2A', oninput: (e) => { obj[key] = e.target.value; txt.value = e.target.value; bump(); } });
  return h('div.field', {}, h('span', {}, label), h('div.color-field', {}, col, txt), hint ? h('small', {}, hint) : null);
}
/** malý výběr obrázku (ikonka v řádku varianty) */
function pickImage(obj, key, hint, onDone) {
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { obj[key] = await upload(f, hint); bump(); onDone(); toast('Fotka připravena', 'Na web se nahraje po uložení.'); } catch (er) { toast('Fotku se nepodařilo načíst', er.message, 'err'); }
  } });
  library().then((list) => {
    const grid = h('div.lib', {}, list.map((p) => h('button', { type: 'button', onclick: () => { obj[key] = p.startsWith('assets/img/cut/') ? p.split('/').pop().replace(/\.webp$/, '') : p; bump(); onDone(); document.querySelector('.modal-bg')?.click(); } }, h('img', { src: imgSrc(p), loading: 'lazy', alt: '' }))));
    modal({ title: 'Fotka balení', body: h('div', {}, h('button.btn.btn-sm', { type: 'button', style: 'margin-bottom:.8rem', onclick: () => file.click(), html: IC.upload + 'Nahrát novou fotku' }), file, grid), actions: [{ label: 'Zavřít', value: null }] });
  });
}
function fVariants(x, refresh) {
  const box = h('div.field', {}, h('span', {}, 'Balení a ceny'));
  const list = h('div');
  const render = () => {
    list.replaceChildren(...x.variants.map((v, i) => {
      const im = h('img.vimg', { src: imgSrc(v.img || x.img), alt: '', title: 'Změnit fotku balení', onclick: () => pickImage(v, 'img', x.name + ' ' + v.label, () => { im.src = imgSrc(v.img); }) });
      const lab = h('input', { type: 'text', value: v.label || '', placeholder: 'např. 950 g', 'aria-label': 'Balení', oninput: (e) => { v.label = e.target.value; bump(); refresh?.(); } });
      const pr = h('div.price-in', {}, h('input', { type: 'text', inputmode: 'numeric', value: v.price ?? '', 'aria-label': 'Cena', placeholder: 'Cena', oninput: (e) => { const n = e.target.value.replace(/\s/g, '').replace(',', '.'); v.price = n === '' ? null : (Number.isFinite(+n) ? +n : v.price); bump(); refresh?.(); } }));
      const av = h('label.check', {}, h('input', { type: 'checkbox', checked: v.available !== false, onchange: (e) => { v.available = e.target.checked; bump(); refresh?.(); } }), h('span', {}, 'Skladem'));
      const del = h('button.btn.btn-icon.btn-ghost.del', { type: 'button', 'aria-label': 'Smazat balení', onclick: async () => { if (await confirmDlg('Smazat balení?', `„${v.label || 'bez názvu'}“ zmizí z e-shopu.`)) { x.variants.splice(i, 1); bump(); render(); refresh?.(); } }, html: IC.trash });
      return h('div.vrow', {}, im, lab, pr, av, del);
    }), h('button.btn.btn-sm', { type: 'button', style: 'margin-top:.6rem', onclick: () => { x.variants.push({ label: '', price: null, img: x.img, available: true }); bump(); render(); }, html: IC.plus + 'Přidat balení' }));
  };
  render(); box.append(list, h('small', {}, 'Klikněte na fotku pro změnu. Bez ceny nebo bez „Skladem“ se balení nedá objednat.'));
  return box;
}

/* ---------------------------------------------------------------- pohledy */
const NAV = [
  ['', 'Přehled', 'home'], ['objednavky', 'Objednávky', 'bag'], ['-'],
  ['medy', 'Druhy medu', 'jar', 'honeys'], ['zbozi', 'Další zboží', 'gift', 'products'],
  ['platba', 'Platba a bankovní účet', 'bank', 'shop'], ['doprava', 'Doprava', 'truck', 'shop'], ['-'],
  ['texty', 'Texty na webu', 'text', 'site'], ['kontakty', 'Kontakty a firma', 'phone', 'site'],
  ['obchody', 'Pro obchody', 'box', 'wholesale'], ['postup', 'Jak med vzniká', 'steps', 'process'], ['skola', 'Malá škola medu', 'q', 'knowledge'],
  ['podminky', 'Obchodní podmínky a GDPR', 'doc', 'vop'], ['-'], ['nastaveni', 'Heslo a odhlášení', 'gear'],
];
Object.assign(IC, {
  bag: I('<path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8zM9 8V6.5a3 3 0 0 1 6 0V8"/>'),
  jar: I('<path d="M8 3h8M7 6h10v2a3 3 0 0 1 1 2v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9a3 3 0 0 1 1-2z"/><path d="M6.5 13h11"/>'),
  gift: I('<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8S10.5 3.5 8 4.5 9 8 12 8zm0 0s1.5-4.5 4-3.5S15 8 12 8z"/>'),
  bank: I('<path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>'),
  truck: I('<path d="M3 6h11v10H3zM14 9h4l3 3.5V16h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>'),
  text: I('<path d="M5 6h14M5 11h14M5 16h9"/>'),
  box: I('<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>'),
  steps: I('<circle cx="6" cy="6" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><path d="M8 6h4a4 4 0 0 1 4 4M16 14a4 4 0 0 1-4 4H8"/>'),
  doc: I('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'),
  mail: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>'),
});
const view = (title, lead, ...kids) => { const m = $('main.view'); m.replaceChildren(h('div.view-head', {}, h('h1', {}, title), lead ? h('p', {}, lead) : null), ...kids); window.scrollTo(0, 0); };
const shopUrl = () => new URL(CFG.site, location.href).href;
const STATUS = { nova: 'Nová – čeká na platbu', zaplacena: 'Zaplacená', pripravena: 'Připravená / odeslaná', vyrizena: 'Vyřízená', zrusena: 'Zrušená' };
const badge = (s) => h('span.badge.s-' + s, {}, STATUS[s] || s);

async function loadOrders(force) {
  if (S.orders && !force) return S.orders;
  S.orders = await api('/orders');
  return S.orders;
}
function bankState() {
  const b = S.D.shop.bank;
  const iban = ibanValid(b.iban) ? b.iban.replace(/\s/g, '').toUpperCase() : czIban(b.account);
  return iban;
}

function vDash() {
  const warn = [];
  if (!bankState()) warn.push(h('div.banner', { html: `${IC.info}<p><b>Chybí bankovní účet.</b> Zákazníci po objednávce neuvidí platební údaje ani QR kód. <a href="#/platba">Doplnit účet</a></p>` }));
  if (S.def) warn.push(h('div.banner', { html: `${IC.info}<p>Používáte výchozí heslo <b>admin</b>. <a href="#/nastaveni">Nastavte si prosím vlastní heslo</a>, ať do administrace nemůže nikdo jiný.</p>` }));
  const ordBox = h('div', {}, h('p', { style: 'color:var(--muted)' }, 'Načítám objednávky…'));
  loadOrders().then((o) => {
    const nove = o.orders.filter((x) => x.s === 'nova').length, zapl = o.orders.filter((x) => x.s === 'zaplacena').length;
    ordBox.replaceChildren(h('p', {}, nove ? h('b', {}, `${nove} ${nove === 1 ? 'nová objednávka čeká' : nove < 5 ? 'nové objednávky čekají' : 'nových objednávek čeká'} na platbu`) : 'Žádná nová objednávka nečeká.',
      zapl ? ` · ${zapl} zaplacen${zapl === 1 ? 'á' : 'é'} k vyřízení` : ''),
      h('p', { style: 'color:var(--muted);font-size:.88rem;margin-top:.3rem' }, `Objednávky chodí e-mailem na ${o.to || '–'}.${o.test ? ' E-shop je ve zkušebním provozu.' : ''}`),
      h('a.btn.btn-dark', { href: '#/objednavky', style: 'margin-top:.8rem', html: IC.bag + 'Otevřít objednávky' }));
  }).catch((e) => ordBox.replaceChildren(h('p.note-warn', {}, 'Objednávky se nepodařilo načíst: ' + e.message)));
  const tiles = [['medy', 'Druhy medu', 'jar', 'Medy, balení, ceny, fotky'], ['zbozi', 'Další zboží', 'gift', 'Dárkový koš, vosk, sklenice…'],
    ['platba', 'Platba a účet', 'bank', 'Číslo účtu pro QR platbu'], ['doprava', 'Doprava', 'truck', 'Osobní odběr, zásilka, ceny'],
    ['texty', 'Texty na webu', 'text', 'Úvod, o stáčírně, čísla'], ['kontakty', 'Kontakty', 'phone', 'Adresa, telefon, e-mail']]
    .map(([id, label, ic, sub]) => h('a.tile', { href: '#/' + id }, h('span', { html: IC[ic] }), h('b', {}, label), h('small', {}, sub)));
  view('Dobrý den 👋', 'Tady spravujete e-shop Med Shop: objednávky, medy a ceny, dopravu, bankovní účet i texty webu. Změny uložíte tlačítkem dole – na webu se objeví zhruba za minutu.',
    ...warn, card('Objednávky', null, ordBox), h('div.tiles', {}, tiles),
    h('a.btn.btn-dark', { href: CFG.site, target: '_blank', rel: 'noopener', style: 'margin-top:1rem', html: IC.ext + 'Otevřít web' }));
}

/* ---------- objednávky ---------- */
async function vOrders(num) {
  if (num) return vOrder(num);
  view('Objednávky', 'Každá objednávka z webu Vám zároveň přijde e-mailem. Tady jí měníte stav – zákazník změnu stavu e-mailem nedostává.', h('p', { style: 'color:var(--muted)' }, 'Načítám…'));
  let o;
  try { o = await loadOrders(true); } catch (e) { return view('Objednávky', null, card(null, null, h('p.note-warn', {}, e.message))); }
  const filt = h('div.ofilters');
  const list = h('div.olist');
  const counts = { all: o.orders.length }; o.orders.forEach((x) => { counts[x.s] = (counts[x.s] || 0) + 1; });
  const render = () => {
    filt.replaceChildren(...[['all', 'Všechny'], ...Object.entries(STATUS)].map(([k, l]) => h('button' + (S.ofilter === k ? '.on' : ''), { type: 'button', onclick: () => { S.ofilter = k; render(); } }, l.replace(' – čeká na platbu', ''), h('small', {}, String(counts[k] || 0)))));
    const rows = o.orders.filter((x) => S.ofilter === 'all' || x.s === S.ofilter);
    list.replaceChildren(...(rows.length ? rows.map((x) => h('a.orow', { href: '#/objednavky/' + x.num },
      h('div', {}, h('b.num', {}, `č. ${x.num}`), ' · ', h('span', {}, x.n || ''), h('br'), h('small', {}, fdate(x.d)), ' ', badge(x.s), x.x ? h('span.badge.test', { style: 'margin-left:.3rem' }, 'zkušební') : null),
      h('div.sum', {}, kc(x.t)))) : [h('p.empty', {}, S.ofilter === 'all' ? 'Zatím žádné objednávky.' : 'V tomto stavu teď nic není.')]));
  };
  render();
  view('Objednávky', 'Každá objednávka z webu Vám zároveň přijde e-mailem. Tady jí měníte stav – zákazník změnu stavu e-mailem nedostává.',
    filt, list, h('p', { style: 'color:var(--muted);font-size:.85rem;margin-top:1rem' }, `Nové objednávky chodí e-mailem na ${o.to || '–'}.`));
}
async function vOrder(num) {
  view(`Objednávka č. ${num}`, null, h('p', { style: 'color:var(--muted)' }, 'Načítám…'));
  let o;
  try { o = await api('/orders?num=' + encodeURIComponent(num)); } catch (e) { return view(`Objednávka č. ${num}`, null, card(null, null, h('p.note-warn', {}, e.message)), h('a.btn', { href: '#/objednavky' }, 'Zpět na objednávky')); }
  const c = o.customer || {};
  const setStatus = async (s) => {
    try { o = await api('/orders', { method: 'POST', body: JSON.stringify({ num, status: s }) }); S.orders = null; toast('Stav změněn', STATUS[s], 'ok'); vOrder(num); }
    catch (e) { toast('Nepodařilo se uložit', e.message, 'err'); }
  };
  const note = h('textarea', { rows: 3, placeholder: 'Poznámka jen pro Vás (zákazník ji nevidí)' }); note.value = o.note || '';
  const addr = [c.street, [c.zip, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const p = o.pay;
  view(`Objednávka č. ${num}`, `${fdate(o.created)}${o.test ? ' · zkušební provoz' : ''}`,
    h('a.crumb', { href: '#/objednavky' }, '← Všechny objednávky'),
    card('Stav', null, h('p', { style: 'margin-bottom:.8rem' }, badge(o.status)),
      h('div.status-btns', {}, Object.entries(STATUS).map(([k, l]) => h('button.btn.btn-sm' + (o.status === k ? '.on' : ''), { type: 'button', onclick: () => o.status !== k && setStatus(k) }, l))),
      o.history?.length ? h('ul.hist', { style: 'margin-top:.9rem' }, o.history.map((x) => h('li', {}, `${fdate(x.t)} – ${STATUS[x.s] || x.s}`))) : null),
    card('Zboží', null, h('table.otable', {}, h('tbody', {},
      ...o.items.map((x) => h('tr', {}, h('td', {}, h('b', {}, x.name), h('br'), h('small', { style: 'color:var(--muted)' }, x.variant)), h('td.r', {}, `${x.q} ×`), h('td.r', {}, kc(x.sum)))),
      h('tr', {}, h('td', { colspan: 2 }, o.ship?.name || 'Převzetí'), h('td.r', {}, o.ship?.price ? kc(o.ship.price) : 'zdarma')),
      h('tr.tot', {}, h('td', { colspan: 2 }, 'Celkem'), h('td.r', {}, kc(o.total)))))),
    card('Zákazník', null, h('dl.kv', {},
      h('dt', {}, 'Jméno'), h('dd', {}, c.name || ''), h('dt', {}, 'E-mail'), h('dd', {}, h('a', { href: `mailto:${c.email}?subject=${encodeURIComponent('Objednávka č. ' + num + ' – Med Shop')}` }, c.email || '')),
      h('dt', {}, 'Telefon'), h('dd', {}, h('a', { href: 'tel:' + (c.phone || '').replace(/[^\d+]/g, '') }, c.phone || '')),
      h('dt', {}, 'Adresa'), h('dd', {}, addr || '–'), h('dt', {}, 'Převzetí'), h('dd', {}, o.ship?.name || ''),
      h('dt', {}, 'Poznámka'), h('dd', {}, c.note || '–'))),
    card('Platba', null, p ? h('dl.kv', {}, h('dt', {}, 'Účet'), h('dd', {}, p.account || fmtIban(p.iban)), h('dt', {}, 'Variabilní symbol'), h('dd', {}, h('b', {}, p.vs)), h('dt', {}, 'Částka'), h('dd', {}, kc(p.amount)))
      : h('p.note-warn', {}, 'V době objednávky nebyl v administraci vyplněný bankovní účet – zákazník platební údaje nedostal. Pošlete mu je prosím e-mailem.'),
      o.mail && (!o.mail.customer || !o.mail.seller) ? h('p.note-warn', { style: 'margin-top:.6rem' }, 'Pozor: potvrzovací e-mail zákazníkovi se nepodařilo odeslat.') : null),
    card('Poznámka pro Vás', null, note, h('button.btn.btn-sm', { type: 'button', style: 'margin-top:.6rem', onclick: async () => {
      try { await api('/orders', { method: 'POST', body: JSON.stringify({ num, note: note.value }) }); toast('Poznámka uložena', '', 'ok'); } catch (e) { toast('Nepodařilo se uložit', e.message, 'err'); }
    } }, 'Uložit poznámku')),
    h('div', { style: 'display:flex;gap:.5rem;flex-wrap:wrap' },
      h('a.btn', { href: `mailto:${c.email}?subject=${encodeURIComponent('Objednávka č. ' + num + ' – Med Shop')}`, html: IC.mail + 'Napsat zákazníkovi' }),
      (o.status === 'zrusena' || o.test) ? h('button.btn.btn-ghost.btn-danger', { type: 'button', onclick: async () => {
        if (!(await confirmDlg('Smazat objednávku?', `Objednávka č. ${num} se trvale odstraní z administrace.`))) return;
        try { await api('/orders', { method: 'POST', body: JSON.stringify({ num, delete: true }) }); S.orders = null; toast('Objednávka smazána'); location.hash = '#/objednavky'; } catch (e) { toast('Nepodařilo se smazat', e.message, 'err'); }
      }, html: IC.trash + 'Smazat' }) : null));
}

/* ---------- medy a zboží ---------- */
function vHoneys() {
  view('Druhy medu', 'Medy v hlavní nabídce („police“ s barvami, e-shop i vlastní stránka každého medu). Pořadí zde = pořadí na webu.',
    fList(S.D.honeys, {
      title: (x) => x.name + (x.hidden ? ' (skrytý)' : ''), sub: (x) => x.variants.map((v) => `${v.label} ${v.price ? kc(v.price) : ''}${v.available === false ? ' ✕' : ''}`).join(' · '), thumb: (x) => x.img,
      addLabel: 'Přidat druh medu',
      make: () => ({ id: '', slug: '', name: '', short: '', color: '#E8AE2A', ink: '#3E2604', trait: '', text: '', tag: '', img: 'p56', hidden: false, variants: [{ label: '950 g', price: null, img: 'p56', available: true }, { label: '400 g', price: null, img: 'p61', available: true }] }),
      body: (x, b, r) => b.append(
        row2(fText(x, 'name', 'Název', { on: r, ph: 'Med lipový' }), fText(x, 'short', 'Krátký název na polici', { ph: 'Lipový' })),
        row2(fText(x, 'trait', 'Vlastnost (nad názvem)', { ph: 'Čirý a dlouho tekutý' }), fText(x, 'tag', 'Štítek na kartě', { ph: 'Vůně lipových květů' })),
        fText(x, 'text', 'Popis', { multi: true, rows: 5 }),
        fVariants(x, r),
        row2(fColor(x, 'color', 'Barva medu', 'Pozadí police a karty.'), fSelect(x, 'ink', 'Barva písma na této barvě', [['#3E2604', 'Tmavé písmo (na světlé med)'], ['#FFF4D8', 'Světlé písmo (na tmavé med)']], { custom: (c) => (parseInt(c.slice(1, 3), 16) < 128 ? 'Tmavé písmo' : 'Světlé písmo') + ' (původní odstín)' })),
        fImage(x, 'img', 'Hlavní fotka (sklenice na polici)', x.name, r),
        fCheck(x, 'hidden', 'Skrýt z webu (např. když med dočasně nemáte)'),
        x.slug ? h('p', { style: 'color:var(--muted);font-size:.82rem' }, `Adresa stránky: ${shopUrl()}med/${x.slug}/`) : null),
    }));
}
function vProducts() {
  view('Další zboží', 'Dárky, vosk, sklenice a další. Bez ceny se u zboží zobrazí „Poptat“ (e-mail).',
    fList(S.D.products, {
      title: (p) => p.name + (p.hidden ? ' (skryté)' : ''), sub: (p) => [p.variant, p.price ? kc(p.price) + (p.unit ? ' / ' + p.unit : '') : 'bez ceny', p.available === false ? 'vyprodáno' : ''].filter(Boolean).join(' · '), thumb: (p) => p.img,
      addLabel: 'Přidat zboží',
      make: () => ({ id: '', slug: '', cat: 'darky', name: '', variant: '', price: null, img: 'p71', text: '', badge: '', available: true, hidden: false, feature: false }),
      body: (p, b, r) => b.append(
        row2(fText(p, 'name', 'Název', { on: r }), fSelect(p, 'cat', 'Kategorie', [['darky', 'Dárky'], ['medy', 'Medy'], ['ostatni', 'Vosk a sklenice']])),
        row2(fText(p, 'variant', 'Balení / varianta', { on: r, ph: 'např. 950 g' }), fText(p, 'badge', 'Štítek', { ph: 'Na dárek' })),
        row2(fPrice(p, 'price', 'Cena', { on: r, hint: 'Prázdné = cena dle dohody (tlačítko Poptat).' }), fText(p, 'unit', 'Cena za jednotku (nepovinné)', { ph: 'kg' })),
        fText(p, 'text', 'Popis', { multi: true, rows: 4 }), fText(p, 'note', 'Doplňující poznámka (nepovinná)'),
        fImage(p, 'img', 'Fotka', p.name, r),
        fCheck(p, 'available', 'Skladem (lze objednat)'), fCheck(p, 'feature', 'Zvýraznit v e-shopu (velká tmavá karta)'), fCheck(p, 'hidden', 'Skrýt z webu'),
        p.slug ? h('p', { style: 'color:var(--muted);font-size:.82rem' }, `Adresa stránky: ${shopUrl()}produkty/${p.slug}/`) : null),
    }));
}

/* ---------- platba a doprava ---------- */
function vPayment() {
  const d = S.D.shop, b = d.bank;
  const out = h('p', { style: 'font-size:.9rem' });
  const upd = () => {
    const ib = ibanValid(b.iban) ? b.iban.replace(/\s/g, '').toUpperCase() : null, ca = czIban(b.account);
    if (b.iban?.trim() && !ib) { out.className = 'note-warn'; out.textContent = 'IBAN nevypadá správně.'; return; }
    if (b.account?.trim() && !ca) { out.className = 'note-warn'; out.textContent = 'Číslo účtu nevypadá správně (kontrolní součet nesedí). Zkontrolujte ho prosím.'; return; }
    const use = ib || ca;
    if (!use) { out.className = 'note-warn'; out.textContent = 'Zatím není vyplněný účet – zákazníci nedostanou platební údaje.'; return; }
    out.className = 'note-ok'; out.textContent = `✓ QR platba bude na IBAN ${fmtIban(use)}`;
  };
  upd();
  view('Platba a bankovní účet', 'Zákazníci platí předem převodem. Po objednávce uvidí číslo účtu, částku, variabilní symbol (= číslo objednávky) a QR kód. Totéž dostanou e-mailem.',
    card('Bankovní účet', 'Na tento účet budou zákazníci posílat platby. QR kód se vytvoří automaticky.',
      fText(b, 'account', 'Číslo účtu', { ph: '123456789/0100', on: upd, hint: 'Ve tvaru číslo/kód banky, případně s předčíslím: 19-123456789/0800.' }),
      fText(b, 'iban', 'IBAN (nepovinné)', { ph: 'CZ65 0800 0000 1920 0014 5399', on: upd, hint: 'Vyplňte jen tehdy, když chcete jiný než vypočítaný z čísla účtu.' }),
      fText(b, 'name', 'Majitel účtu (zobrazí se v QR platbě)'), out),
    card('Podmínky platby', null,
      fText(d, 'due_days', 'Splatnost (dnů)', { type: 'number', inputmode: 'numeric' }),
      fText(d, 'vat_note', 'Poznámka k DPH', { hint: 'Zobrazí se v e-mailu, v objednávce a v patičce webu.' }),
      fText(d, 'checkout_note', 'Text u platby v objednávce', { multi: true, rows: 3 }),
      fText(d, 'thanks', 'Text po odeslání objednávky', { multi: true, rows: 3, hint: 'Zobrazí se na webu po objednání a v potvrzovacím e-mailu.' })),
    card('Zkušební provoz', null, fText(d, 'test_notice', 'Upozornění v košíku a objednávce', { hint: 'Až budete objednávky opravdu vyřizovat, pole vymažte.' })));
}
function vShipping() {
  const d = S.D.shop;
  view('Doprava', 'Způsoby převzetí, které si zákazník vybírá v objednávce. Způsob bez ceny se na webu nezobrazí.',
    card('Způsoby převzetí', null, fList(d.shipping, {
      title: (s) => s.name + (s.active === false ? ' (vypnuto)' : ''), sub: (s) => s.price == null ? 'bez ceny – nezobrazuje se' : (s.price ? kc(s.price) : 'zdarma') + (s.free_from ? ` · od ${kc(s.free_from)} zdarma` : ''),
      addLabel: 'Přidat způsob převzetí', make: () => ({ id: '', name: '', note: '', price: null, free_from: null, address: true, active: true }),
      body: (s, b, r) => b.append(fText(s, 'name', 'Název', { on: r, ph: 'Zásilkovna, Česká pošta…' }),
        row2(fPrice(s, 'price', 'Cena', { on: r, hint: '0 = zdarma.' }), fPrice(s, 'free_from', 'Zdarma od (nepovinné)', { on: r })),
        fText(s, 'note', 'Popis pro zákazníka', { multi: true, rows: 2 }),
        fCheck(s, 'address', 'Vyžadovat doručovací adresu'), fCheck(s, 'active', 'Nabízet na webu')),
    })),
    card('Text o dopravě', 'Na stránce Doprava a platba.', fText(d, 'shipping_text', 'Text', { multi: true, rows: 4 })));
}

/* ---------- texty ---------- */
function vTexts() {
  const s = S.D.site;
  view('Texty na webu', 'Hlavní texty úvodní stránky. Slova mezi hvězdičkami (*takto*) se zobrazí kurzívou.',
    card('Úvod (první obrazovka)', null, fText(s.hero, 'eyebrow', 'Nadpis nad hlavním nadpisem'),
      row2(fText(s.hero, 'h1a', 'Hlavní nadpis – 1. řádek'), fText(s.hero, 'h1b', 'Hlavní nadpis – 2. řádek (kurzíva)')),
      fText(s.hero, 'lead', 'Text pod nadpisem', { multi: true, rows: 3 }), fStrList(s.hero.facts, 'Krátké fakty pod tlačítky', { add: 'Přidat fakt' })),
    card('Běžící pás', null, fStrList(s.marquee, 'Položky', { add: 'Přidat položku' })),
    card('Co je med?', null, fText(s.intro, 'quote', 'Citát', { multi: true, rows: 2 }), fText(s.intro, 'text', 'Text', { multi: true, rows: 4 }), fText(s.intro, 'closing', 'Závěrečná věta')),
    card('Ze stáčírny', null, row2(fText(s.about, 'h2a', 'Nadpis'), fText(s.about, 'h2b', 'Nadpis – kurzíva')), fText(s.about, 'text', 'Text', { multi: true, rows: 5 }), fStrList(s.about.scope, 'Co děláme', { add: 'Přidat' })),
    card('Čísla', null, fList(s.stats, { title: (x) => `${x.n}${x.suffix || ''}`, sub: (x) => x.label, addLabel: 'Přidat číslo', make: () => ({ n: 0, suffix: '', label: '' }),
      body: (x, b, r) => b.append(row2(fText(x, 'n', 'Číslo', { type: 'number', on: r }), fText(x, 'suffix', 'Přípona', { ph: ' kg', on: r })), fText(x, 'label', 'Popis', { on: r })) })),
    card('Kontakt – úvodní text', null, fText(s, 'contact_note', 'Text', { multi: true, rows: 3 }), fText(s, 'access', 'Příjezd k provozovně', { multi: true, rows: 3 })),
    card('Vyhledávače (Google, AI)', 'Titulek a popis úvodní stránky ve výsledcích hledání.', fText(s.seo, 'title', 'Titulek'), fText(s.seo, 'description', 'Popis', { multi: true, rows: 3, hint: 'Ideálně 120–160 znaků.' })));
}
function vContacts() {
  const s = S.D.site;
  view('Kontakty a firma', 'Údaje v kontaktech, patičce, e-mailech zákazníkům a pro vyhledávače.',
    card('Firma', null, row2(fText(s, 'owner', 'Jméno / firma'), fText(s, 'label', 'Činnost', { ph: 'Stáčírna medu' })),
      row2(fText(s, 'address', 'Ulice a číslo'), fText(s, 'city', 'PSČ a město')), row2(fText(s, 'ico', 'IČ'), fText(s, 'dic', 'DIČ (nepovinné)'))),
    card('Kontakt', null, row2(fText(s, 'mobile', 'Mobil', { type: 'tel' }), fText(s, 'phone', 'Telefon / fax', { type: 'tel' })), fText(s, 'email', 'E-mail', { type: 'email', hint: 'Na tuto adresu mohou zákazníci odpovídat na potvrzení objednávky.' }), fText(s, 'map', 'Odkaz na mapu', { type: 'url' })));
}
function vWholesale() {
  const w = S.D.wholesale;
  view('Pro obchody', 'Sekce o velkoodběru (konve, sudy).',
    card(null, null, row2(fText(w, 'h2a', 'Nadpis'), fText(w, 'h2b', 'Nadpis – kurzíva')), fText(w, 'text', 'Text', { multi: true, rows: 3 }), fStrList(w.why, 'Výhody', { add: 'Přidat' })),
    card('Balení pro obchody', null, fList(w.items, { title: (x) => x.name, sub: (x) => x.note, addLabel: 'Přidat', make: () => ({ name: '', note: '', img: null }),
      body: (x, b, r) => b.append(fText(x, 'name', 'Název', { on: r }), fText(x, 'note', 'Poznámka', { on: r })) })));
}
function vProcess() {
  const p = S.D.process;
  view('Jak med vzniká', 'Kroky od nákupu suroviny po prodej.',
    card(null, null, fText(p, 'intro', 'Úvodní text', { multi: true, rows: 3 })),
    card('Kroky', null, fList(p.steps, { title: (x) => x.t, sub: (x) => x.d, addLabel: 'Přidat krok', make: () => ({ t: '', d: '' }),
      body: (x, b, r) => b.append(fText(x, 't', 'Název kroku', { on: r }), fText(x, 'd', 'Popis', { on: r, multi: true, rows: 2 }), fText(x, 'alt', 'Odlišnost pro pastový med (nepovinné)')) })));
}
function vSchool() {
  const k = S.D.knowledge;
  view('Malá škola medu', 'Otázky a odpovědi. Vyhledávače a AI asistenti je čtou jako „časté dotazy“.',
    card(null, null, row2(fText(k, 'h2a', 'Nadpis'), fText(k, 'h2b', 'Nadpis – kurzíva')), fText(k, 'closing', 'Závěrečný citát')),
    card('Otázky', null, fList(k.items, { title: (x) => x.q, addLabel: 'Přidat otázku', make: () => ({ q: '', a: '' }),
      body: (x, b, r) => b.append(fText(x, 'q', 'Otázka', { on: r }), fText(x, 'a', 'Odpověď', { multi: true, rows: 4 })) })));
}
function vLegal() {
  const sec = (doc) => fList(doc.sections, { title: (x) => x.h, addLabel: 'Přidat oddíl', make: () => ({ h: '', p: '' }),
    body: (x, b, r) => b.append(fText(x, 'h', 'Nadpis', { on: r }), fText(x, 'p', 'Text', { multi: true, rows: 7, hint: 'Nový řádek = nový odstavec.' })) });
  view('Obchodní podmínky a GDPR', 'Texty stránek Obchodní podmínky a Ochrana osobních údajů. Doporučujeme je před spuštěním e-shopu zkontrolovat.',
    card('Obchodní podmínky', null, fText(S.D.vop, 'intro', 'Úvod (prodávající, kontakt)', { multi: true, rows: 4 }), fText(S.D.vop, 'updated', 'Platné od', { ph: '1. 11. 2026' }), sec(S.D.vop)),
    card('Ochrana osobních údajů', null, fText(S.D.gdpr, 'intro', 'Úvod (správce)', { multi: true, rows: 3 }), fText(S.D.gdpr, 'updated', 'Platné od'), sec(S.D.gdpr)));
}
function vSettings() {
  const f = { old: '', pw: '', pw2: '' };
  const msg = h('p', { style: 'color:var(--err);font-size:.9rem;min-height:1.2rem' });
  const pwInput = (key, label, ac) => h('label.field', {}, h('span', {}, label), h('input', { type: 'password', autocomplete: ac, oninput: (e) => { f[key] = e.target.value; } }));
  view('Heslo a odhlášení', null,
    card('Změnit heslo', S.def ? 'Zatím používáte výchozí heslo „admin“. Nastavte si vlastní — alespoň 8 znaků.' : 'Po změně hesla se odhlásí všechna ostatní zařízení.',
      pwInput('old', 'Současné heslo', 'current-password'), pwInput('pw', 'Nové heslo', 'new-password'), pwInput('pw2', 'Nové heslo znovu', 'new-password'), msg,
      h('button.btn.btn-primary', { type: 'button', onclick: async (e) => {
        msg.textContent = '';
        if (f.pw.length < 8) return (msg.textContent = 'Nové heslo musí mít alespoň 8 znaků.');
        if (f.pw !== f.pw2) return (msg.textContent = 'Nová hesla se neshodují.');
        e.target.disabled = true;
        try { const r = await api('/password', { method: 'POST', body: JSON.stringify({ old: f.old, password: f.pw }) }); S.sess = r.token; S.def = false; saveSess(); toast('Heslo změněno', 'Příště se přihlaste novým heslem.', 'ok'); route(); }
        catch (er) { msg.textContent = er.message; } finally { e.target.disabled = false; }
      } }, 'Uložit nové heslo')),
    card('Odhlásit se', null, h('button.btn', { type: 'button', onclick: logout, html: IC.logout + 'Odhlásit' })));
}

/* ---------------------------------------------------------------- shell */
function renderShell() {
  const nav = h('nav.nav', { id: 'nav', 'aria-label': 'Sekce administrace' },
    h('button.btn.btn-icon.btn-ghost.nav-close', { type: 'button', 'aria-label': 'Zavřít menu', onclick: () => nav.classList.remove('open'), html: IC.x }),
    NAV.map(([id, label, ic, key]) => id === '-' ? h('hr') : h('a', { href: '#/' + id, 'data-id': id, 'data-key': key || '', onclick: () => nav.classList.remove('open'), html: IC[ic] + `<span>${esc(label)}</span>` })),
    h('hr'), h('a', { href: CFG.site, target: '_blank', rel: 'noopener', html: IC.ext + '<span>Zobrazit web</span>' }));
  const bar = h('div.savebar', { id: 'savebar' }, h('span', {}, ''),
    h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: async () => { if (await confirmDlg('Zahodit změny?', 'Neuložené úpravy se ztratí.', 'Zahodit')) discard(); } }, 'Zahodit'),
    h('button.btn.btn-primary', { type: 'button', onclick: saveAll }, 'Uložit změny'));
  $('#app').replaceChildren(h('div.shell', {},
    h('header.top', {},
      h('button.btn.btn-icon.btn-ghost.menu-btn', { type: 'button', 'aria-label': 'Menu', onclick: () => nav.classList.add('open'), html: IC.menu }),
      h('a.top-logo', { href: '#/' }, h('img', { src: CFG.site + 'assets/logo.svg', alt: 'Med Shop' }), h('span', {}, 'Administrace')),
      h('div.pub'), h('a.btn.btn-sm', { href: CFG.site, target: '_blank', rel: 'noopener', html: IC.eye + '<span>Web</span>' })),
    h('div.layout', {}, nav, h('main.view'))), bar);
  initPub();
}
function updateSavebar() {
  const keys = dirtyKeys(); const bar = $('#savebar'); if (!bar) return;
  bar.classList.toggle('on', keys.length > 0 || S.saving);
  bar.querySelector('span').textContent = S.saving ? 'Ukládám…' : `Neuložené změny: ${keys.map((k) => LABEL[k]).join(', ')}`;
  bar.querySelectorAll('button').forEach((b) => { b.disabled = S.saving; });
  document.querySelectorAll('.nav a[data-key]').forEach((a) => { a.querySelector('.dot')?.remove(); if (keys.includes(a.dataset.key)) a.append(h('i.dot')); });
}
const VIEWS = { '': vDash, objednavky: vOrders, medy: vHoneys, zbozi: vProducts, platba: vPayment, doprava: vShipping, texty: vTexts, kontakty: vContacts, obchody: vWholesale, postup: vProcess, skola: vSchool, podminky: vLegal, nastaveni: vSettings };
function route() {
  const [id, arg] = location.hash.replace(/^#\/?/, '').split('/');
  (VIEWS[id] || vDash)(arg);
  document.querySelectorAll('.nav a[data-id]').forEach((a) => a.classList.toggle('on', a.dataset.id === (VIEWS[id] ? id : '')));
  updateSavebar();
}
window.addEventListener('hashchange', route);

/* ---------------------------------------------------------------- přihlášení */
function renderLogin(msg = '') {
  const inp = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', placeholder: 'Heslo', required: true });
  const err = h('p.login-err', {}, msg);
  const btn = h('button.btn.btn-dark', { type: 'submit' }, 'Přihlásit se');
  const form = h('form.login-card', { onsubmit: async (e) => {
    e.preventDefault(); err.textContent = ''; btn.disabled = true; btn.textContent = 'Přihlašuji…';
    try {
      const r = await api('/login', { method: 'POST', body: JSON.stringify({ password: inp.value }) });
      S.sess = r.token; S.def = r.def; saveSess(); await start();
    } catch (er) { err.textContent = er.message; btn.disabled = false; btn.textContent = 'Přihlásit se'; inp.select(); }
  } },
  h('img', { src: CFG.site + 'assets/logo.svg', alt: 'Med Shop' }), h('h1', {}, 'Administrace e-shopu'), h('p', {}, 'Přihlaste se heslem k administraci.'),
  h('label.field', {}, h('span', {}, 'Heslo'), h('div.pw-wrap', {}, inp, h('button.pw-eye', { type: 'button', 'aria-label': 'Zobrazit heslo', onclick: () => { inp.type = inp.type === 'password' ? 'text' : 'password'; }, html: IC.eye }))),
  btn, err);
  $('#app').replaceChildren(h('div.login', {}, form));
  setTimeout(() => inp.focus(), 50);
}
function logout() {
  if (dirtyKeys().length && !confirm('Máte neuložené změny. Opravdu se odhlásit?')) return;
  localStorage.removeItem(SK); S.sess = null; S.D = {}; renderLogin();
}
async function start() {
  $('#app').innerHTML = `<div class="boot"><img src="${CFG.site}assets/logo.svg" alt=""><span class="spin"></span></div>`;
  try { await loadAll(); } catch (e) {
    if (e.status === 401) { localStorage.removeItem(SK); S.sess = null; return renderLogin('Přihlášení vypršelo, přihlaste se prosím znovu.'); }
    return renderLogin('Obsah webu se nepodařilo načíst: ' + e.message);
  }
  renderShell(); route();
}
function boot() {
  const s = JSON.parse(localStorage.getItem(SK) || 'null');
  if (s && s.exp > Date.now()) { S.sess = s.t; S.def = s.def; start(); } else renderLogin();
}
boot();
})();
