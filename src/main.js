/* Med Shop — e-shop: košík v prohlížeči (localStorage), objednávka → webhunter-admin (uloží, pošle e-maily, vrátí platbu s QR). */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const S = window.SHOP;
  const ROOT = new URL($('script[src*="main.js"]').getAttribute('src').replace(/assets\/main\.js.*$/, ''), location.href).href;
  const kc = n => n == null ? 'Cena dle dohody' : Math.round(n).toLocaleString('cs-CZ').replace(/\s/g, ' ') + ' Kč';
  const img = p => ROOT + (String(p).includes('/') ? p : `assets/img/cut/${p}.webp`);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // katalog: id → položka s variantami
  const catalog = {};
  S.honeys.forEach(h => catalog[h.id] = { ...h, url: ROOT + h.url_path });
  S.products.forEach(p => catalog[p.id] = { ...p, color: p.color || '#F3D88A', text: p.text + (p.note ? ' ' + p.note : ''), url: ROOT + p.url_path });
  const buyable = (id, v) => { const it = catalog[id], x = it && it.variants[v]; return !!(x && x.available && x.price > 0); };

  /* --- navigace --- */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 30);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const burger = $('[data-burger]');
  burger.addEventListener('click', () => {
    const open = !nav.classList.contains('menu-open');
    nav.classList.toggle('menu-open', open); burger.setAttribute('aria-expanded', open);
  });
  $$('#menu a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('menu-open'); burger.setAttribute('aria-expanded', false); }));

  /* --- hero: slova postupně --- */
  let d = 0;
  $$('[data-split] .l1, [data-split] .l2 em').forEach(el => {
    el.innerHTML = el.textContent.trim().split(/\s+/).map(w => `<span class="w"><span style="--d:${d++}">${w}</span></span>`).join(' ');
  });

  /* --- odhalování a čísla --- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    (e.target._rv || [e.target]).forEach(el => el.classList.add('in')); io.unobserve(e.target);
  }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  $$('.rv').forEach(el => io.observe(el));
  $$('.clip-rv').forEach(el => { const p = el.parentElement; (p._rv = p._rv || []).push(el); io.observe(p); });
  $$('.checks .rv, .steps .rv, .stats .rv, .contact__cards .rv').forEach(el => el.style.setProperty('--i', [...el.parentNode.children].indexOf(el)));
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, to = +el.dataset.countTo, suf = el.dataset.suffix || '';
    const from = to > 1000 ? to - 60 : 0, t0 = performance.now(), dur = 1600;
    const step = t => {
      const p = Math.min(1, (t - t0) / dur), v = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 4)));
      el.textContent = v + suf; if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step); cio.unobserve(el);
  }), { threshold: .6 });
  $$('[data-count-to]').forEach(el => cio.observe(el));

  /* --- magnetické tlačítko --- */
  if (matchMedia('(hover: hover)').matches) $$('[data-magnetic]').forEach(b => {
    b.addEventListener('mousemove', e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .18}px, ${(e.clientY - r.top - r.height / 2) * .3}px)`; });
    b.addEventListener('mouseleave', () => b.style.transform = '');
  });

  const toast = msg => { const t = $('[data-toast]'); t.textContent = msg; t.classList.add('is-on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('is-on'), 2600); };
  const vbtns = (it, cur) => it.variants.map((v, i) => `<button class="vbtn${i === cur ? ' is-on' : ''}${v.available ? '' : ' is-out'}" data-i="${i}"><small>${esc(v.label)}</small><b>${v.available ? kc(v.price) + (it.unit ? `<small> / ${esc(it.unit)}</small>` : '') : 'Vyprodáno'}</b></button>`).join('');
  const firstAvail = it => Math.max(0, it.variants.findIndex(v => v.available));

  /* --- spektrum medů (úvod) --- */
  const sp = $('#medy');
  if (sp && S.honeys.length) {
    const spImg = $('[data-sp-img]'), spInfo = $('.spectrum__info'), spVars = $('[data-sp-vars]'), spAdd = $('[data-sp-add]');
    const startId = $('.shelf__item.is-on')?.dataset.honey || S.honeys[0].id;
    let cur = catalog[startId], curV = firstAvail(cur);
    const renderVars = () => { spVars.innerHTML = vbtns(cur, curV); spAdd.disabled = !buyable(cur.id, curV); };
    spVars.addEventListener('click', e => {
      const b = e.target.closest('.vbtn'); if (!b) return;
      curV = +b.dataset.i; renderVars();
      spImg.classList.add('is-out'); setTimeout(() => { spImg.src = img(cur.variants[curV].img); spImg.onload = () => spImg.classList.remove('is-out'); }, 250);
    });
    const selectHoney = id => {
      cur = catalog[id]; curV = firstAvail(cur);
      $$('.shelf__item').forEach(b => { b.classList.toggle('is-on', b.dataset.honey === id); b.setAttribute('aria-selected', b.dataset.honey === id); });
      sp.style.setProperty('--hc', cur.color); sp.style.setProperty('--hi', cur.ink);
      spImg.classList.add('is-out'); spInfo.classList.add('is-out');
      setTimeout(() => {
        spImg.src = img(cur.variants[curV].img || cur.img); spImg.alt = cur.name;
        $('[data-sp-trait]').textContent = cur.trait; $('[data-sp-name]').textContent = cur.name; $('[data-sp-text]').textContent = cur.text;
        $('[data-sp-link]').href = cur.url;
        renderVars();
        spImg.onload = () => spImg.classList.remove('is-out');
        if (spImg.complete) spImg.classList.remove('is-out');
        spInfo.classList.remove('is-out');
      }, 300);
    };
    $$('.shelf__item').forEach(b => b.addEventListener('click', () => selectHoney(b.dataset.honey)));
    spAdd.addEventListener('click', () => addToCart(cur.id, curV));
    renderVars();
  }

  /* --- e-shop: filtry a varianty --- */
  $$('[data-filter]').forEach(c => c.addEventListener('click', () => {
    $$('[data-filter]').forEach(x => x.classList.toggle('is-on', x === c));
    const f = c.dataset.filter;
    $$('[data-grid] .card').forEach(card => card.classList.toggle('is-hidden', f !== 'all' && card.dataset.cat !== f));
  }));
  $$('[data-grid] .card').forEach(card => {
    const it = catalog[card.dataset.id]; card._v = +card.dataset.v || 0;
    const pills = $('[data-pills]', card); if (!pills) return;
    pills.addEventListener('click', e => {
      const p = e.target.closest('.pill'); if (!p) return;
      card._v = +p.dataset.v;
      $$('.pill', pills).forEach(x => x.classList.toggle('is-on', x === p));
      const v = it.variants[card._v];
      $('[data-price]', card).textContent = v.available ? kc(v.price) : 'Vyprodáno';
      $('[data-add]', card).disabled = !v.available;
      const im = $('[data-card-img]', card); im.style.opacity = 0;
      setTimeout(() => { im.src = img(v.img); im.onload = () => im.style.opacity = 1; }, 180);
    });
  });
  $$('[data-add]').forEach(b => b.addEventListener('click', () => {
    const card = b.closest('.card'); if (!addToCart(b.dataset.add, card ? card._v || 0 : 0)) return;
    b.classList.add('is-done'); b.innerHTML = '<svg><use href="#check"/></svg>';
    setTimeout(() => { b.classList.remove('is-done'); b.innerHTML = '<svg><use href="#plus"/></svg>'; }, 1400);
  }));

  /* --- rychlý náhled produktu --- */
  const modal = $('#detail'); let dItem, dV = 0;
  const renderDetail = () => {
    const v = dItem.variants[dV];
    $('[data-d-img]').src = img(v.img); $('[data-d-img]').alt = dItem.name;
    $('[data-d-price]').textContent = v.available ? kc(v.price) + (dItem.unit ? ' / ' + dItem.unit : '') : (v.price ? 'Vyprodáno' : 'Cena dle množství');
    $('[data-d-pills]').innerHTML = dItem.variants.length > 1 ? dItem.variants.map((x, i) => `<button class="pill${i === dV ? ' is-on' : ''}${x.available ? '' : ' is-out'}" data-i="${i}">${esc(x.label)}</button>`).join('') : `<span class="pill is-on">${esc(v.label)}</span>`;
    $('[data-d-add]').style.display = buyable(dItem.id, dV) ? '' : 'none';
  };
  $$('[data-detail]').forEach(b => b.addEventListener('click', () => {
    dItem = catalog[b.dataset.detail]; const card = b.closest('.card'); dV = card ? card._v || 0 : 0;
    $('[data-d-media]').style.setProperty('--c', dItem.color);
    $('[data-d-tag]').textContent = dItem.tag || ''; $('[data-d-name]').textContent = dItem.name; $('[data-d-text]').textContent = dItem.text;
    $('[data-d-link]').href = dItem.url;
    renderDetail(); modal.classList.add('is-open'); modal.setAttribute('aria-hidden', false);
  }));
  $('[data-d-pills]').addEventListener('click', e => { const p = e.target.closest('button.pill'); if (p) { dV = +p.dataset.i; renderDetail(); } });
  $('[data-d-add]').addEventListener('click', () => { addToCart(dItem.id, dV); closeModal(); });
  const closeModal = () => { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', true); };
  $$('[data-detail-close]').forEach(b => b.addEventListener('click', closeModal));

  /* --- stránka produktu --- */
  const pdp = $('[data-pdp]');
  if (pdp) {
    const it = catalog[pdp.dataset.pdp]; let pv = +pdp.dataset.v || 0, pq = 1;
    const vars = $('[data-pdp-vars]'), add = $('[data-pdp-add]'), qEl = $('[data-pdp-q]'), im = $('[data-pdp-img]');
    const sync = () => { if (vars) vars.innerHTML = vbtns(it, pv); if (add) add.disabled = !buyable(it.id, pv); if (qEl) qEl.textContent = pq; };
    vars && vars.addEventListener('click', e => {
      const b = e.target.closest('.vbtn'); if (!b) return; pv = +b.dataset.i; sync();
      im.classList.add('is-out'); setTimeout(() => { im.src = img(it.variants[pv].img); im.onload = () => im.classList.remove('is-out'); }, 200);
    });
    $$('[data-pq]').forEach(b => b.addEventListener('click', () => { pq = Math.min(99, Math.max(1, pq + +b.dataset.pq)); sync(); }));
    add && add.addEventListener('click', () => { addToCart(it.id, pv, pq); pq = 1; sync(); });
    sync();
  }

  /* --- košík --- */
  const KEY = 'medshop-cart';
  let cart = []; try { cart = (JSON.parse(localStorage.getItem(KEY)) || []).filter(x => buyable(x.id, x.v) && x.q > 0); } catch (e) {}
  const drawer = $('#cart');
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} };
  const subtotal = () => cart.reduce((s, x) => s + catalog[x.id].variants[x.v].price * x.q, 0);
  const listeners = [];
  const renderCart = () => {
    const n = cart.reduce((s, x) => s + x.q, 0);
    $$('[data-count]').forEach(c => { c.textContent = n; c.classList.add('bump'); setTimeout(() => c.classList.remove('bump'), 300); });
    drawer.classList.toggle('is-empty', !cart.length);
    $('[data-cart-list]').innerHTML = cart.map((x, i) => {
      const it = catalog[x.id], v = it.variants[x.v];
      return `<li class="ci"><a class="ci__img" href="${it.url}"><img src="${img(v.img)}" alt=""></a>
        <div><div class="ci__name">${esc(it.name)}</div><div class="ci__var">${esc(v.label)}</div>
        <div class="qty"><button data-q="-1" data-i="${i}" aria-label="Méně"><svg><use href="#minus"/></svg></button><span>${x.q}</span><button data-q="1" data-i="${i}" aria-label="Více"><svg><use href="#plus"/></svg></button></div></div>
        <div><div class="ci__price">${kc(v.price * x.q)}</div><button class="ci__rm" data-rm="${i}">Odebrat</button></div></li>`;
    }).join('');
    $('[data-cart-total]').textContent = kc(subtotal());
    listeners.forEach(f => f());
  };
  function addToCart(id, v = 0, q = 1) {
    if (!buyable(id, v)) return false;
    const it = catalog[id];
    const ex = cart.find(x => x.id === id && x.v === v);
    ex ? ex.q = Math.min(99, ex.q + q) : cart.push({ id, v, q });
    save(); renderCart(); toast(`${it.name} (${it.variants[v].label}) je v košíku`);
    return true;
  }
  $('[data-cart-list]').addEventListener('click', e => {
    const q = e.target.closest('[data-q]'), rm = e.target.closest('[data-rm]');
    if (q) { const x = cart[+q.dataset.i]; x.q = Math.min(99, x.q + +q.dataset.q); if (x.q < 1) cart.splice(+q.dataset.i, 1); }
    else if (rm) cart.splice(+rm.dataset.rm, 1); else return;
    save(); renderCart();
  });
  const openCart = () => { drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden', false); };
  const closeCart = () => { drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', true); };
  $$('[data-cart-open]').forEach(b => b.addEventListener('click', openCart));
  $$('[data-cart-close]').forEach(b => b.addEventListener('click', closeCart));
  addEventListener('keydown', e => { if (e.key === 'Escape') { closeCart(); closeModal(); } });
  addEventListener('storage', e => { if (e.key === KEY) { try { cart = JSON.parse(e.newValue) || []; } catch (er) {} renderCart(); } });

  /* --- objednávka --- */
  const co = $('[data-checkout-page]');
  if (co) {
    const form = $('[data-co]'), err = $('[data-co-err]'), btn = $('[data-co-submit]');
    const t0 = Date.now();
    const DONE = 'medshop-last-order';
    const shipSel = () => S.shipping.find(s => s.id === (form.ship ? (form.querySelector('[name=ship]:checked') || {}).value : '')) || S.shipping[0];
    const shipPrice = () => { const s = shipSel(); if (!s) return 0; return s.free_from && subtotal() >= s.free_from ? 0 : s.price; };
    const showDone = o => {
      $('[data-co-form]').hidden = true; $('[data-co-empty]').hidden = true; $('[data-co-done]').hidden = false;
      $('[data-d-num]').textContent = o.num;
      $('[data-d-lead]').textContent = (o.mailed ? `Potvrzení s platebními údaji jsme poslali na ${o.email}. ` : '') + (o.pay ? `Zaplaťte prosím ${kc(o.total)} převodem – nejrychleji naskenováním QR kódu v aplikaci banky.` : '');
      if (o.pay) {
        $('[data-d-qr]').innerHTML = o.pay.qr;
        $('[data-d-acc]').textContent = o.pay.account; $('[data-row-acc]').hidden = !o.pay.account;
        $('[data-d-iban]').textContent = o.pay.iban_f; $('[data-d-amount]').textContent = kc(o.total); $('[data-d-vs]').textContent = o.num;
        $('[data-d-due]').textContent = o.due_days ? `do ${o.due_days} dnů` : ''; $('[data-row-due]').hidden = !o.due_days;
        const vals = { acc: o.pay.account, iban: o.pay.iban, amount: String(o.total), vs: o.num };
        $$('[data-copy]').forEach(b => b.onclick = () => { navigator.clipboard?.writeText(vals[b.dataset.copy]).then(() => toast('Zkopírováno')); });
      } else { $('[data-d-pay]').hidden = true; $('[data-d-nopay]').hidden = false; }
      scrollTo({ top: 0 });
    };
    const renderCo = () => {
      if (!$('[data-co-done]').hidden) return;
      const empty = !cart.length;
      $('[data-co-empty]').hidden = !empty; $('[data-co-form]').hidden = empty;
      if (empty) return;
      $('[data-co-items]').innerHTML = cart.map(x => { const it = catalog[x.id], v = it.variants[x.v];
        return `<li><span class="co__thumb"><img src="${img(v.img)}" alt=""></span><span><b>${esc(it.name)}</b><small>${esc(v.label)} · ${x.q} ks</small></span><em>${kc(v.price * x.q)}</em></li>`; }).join('');
      const sp = shipPrice();
      $('[data-co-sub]').textContent = kc(subtotal()); $('[data-co-ship]').textContent = sp ? kc(sp) : 'zdarma'; $('[data-co-total]').textContent = kc(subtotal() + sp);
      const needAddr = !!(shipSel() || {}).address;
      $('[data-addr-opt]').textContent = needAddr ? '' : '(nepovinná)';
      ['street', 'city', 'zip'].forEach(n => form[n].required = needAddr);
    };
    listeners.push(renderCo);
    form.addEventListener('change', e => { if (e.target.name === 'ship') renderCo(); });
    try { const last = JSON.parse(sessionStorage.getItem(DONE)); if (last && !cart.length) showDone(last); } catch (e) {}
    form.addEventListener('submit', async e => {
      e.preventDefault(); err.textContent = '';
      $$('.fld.is-bad', form).forEach(x => x.classList.remove('is-bad'));
      const bad = $$('input[required], textarea[required]', form).filter(i => i.type === 'checkbox' ? !i.checked : !i.value.trim() || (i.type === 'email' && !/^\S+@\S+\.\S+$/.test(i.value)));
      if (bad.length) {
        bad.forEach(i => i.closest('.fld')?.classList.add('is-bad'));
        err.textContent = bad.some(i => i.type === 'checkbox') && bad.length === 1 ? 'Potvrďte prosím souhlas s obchodními podmínkami.' : 'Vyplňte prosím označené údaje.';
        (bad[0].closest('.fld') || bad[0]).scrollIntoView({ block: 'center', behavior: 'smooth' }); return;
      }
      btn.disabled = true; btn.classList.add('is-busy'); btn.firstChild.textContent = 'Odesílám objednávku… ';
      const fd = Object.fromEntries(new FormData(form));
      const total = subtotal() + shipPrice();
      try {
        const r = await fetch(S.api + '/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          items: cart.map(x => ({ id: x.id, v: x.v, q: x.q })), ship: shipSel().id, total, agree: !!fd.agree, hp: fd.web, ms: Date.now() - t0,
          customer: { name: fd.name, email: fd.email, phone: fd.phone, street: fd.street, city: fd.city, zip: fd.zip, note: fd.note },
        }) });
        const o = await r.json().catch(() => ({}));
        if (!r.ok || !o.ok) throw new Error(o.error || 'Objednávku se nepodařilo odeslat. Zkuste to prosím znovu, nebo nám zavolejte.');
        o.email = fd.email;
        try { sessionStorage.setItem(DONE, JSON.stringify(o)); } catch (er) {}
        cart = []; save(); renderCart(); showDone(o);
      } catch (er) {
        err.textContent = er.message === 'Failed to fetch' ? 'Nepodařilo se spojit se serverem. Zkontrolujte připojení a zkuste to znovu.' : er.message;
      } finally { btn.disabled = false; btn.classList.remove('is-busy'); btn.firstChild.textContent = 'Objednat s povinností platby '; }
    });
  }

  renderCart(); $$('[data-count]').forEach(c => c.classList.remove('bump'));
})();
