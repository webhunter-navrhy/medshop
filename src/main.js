/* Med Shop — návrh. Košík je jen ukázka (localStorage), nic se neodesílá. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const { honeys, products } = window.SHOP;
  const kc = n => n == null ? 'Cena dle dohody' : n.toLocaleString('cs-CZ').replace(/\s/g, ' ') + ' Kč';
  const img = id => `assets/img/cut/${id}.webp`;

  // katalog: id → položka s variantami
  const catalog = {};
  honeys.forEach(h => catalog[h.id] = { id: h.id, name: h.name, tag: h.tag, text: h.text, color: h.color, variants: h.variants });
  products.forEach(p => catalog[p.id] = { id: p.id, name: p.name, tag: p.badge || '', text: p.text + (p.note ? ' ' + p.note : ''), color: '#F3D88A', unit: p.unit, variants: [{ label: p.variant, price: p.price, img: p.img }] });

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
  // .clip-rv je oříznutý na nulu, takže se sleduje jeho rodič
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    (e.target._rv || [e.target]).forEach(el => el.classList.add('in')); io.unobserve(e.target);
  }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  $$('.rv').forEach(el => io.observe(el));
  $$('.clip-rv').forEach(el => { const p = el.parentElement; (p._rv = p._rv || []).push(el); io.observe(p); });
  $$('.checks .rv, .steps .rv, .stats .rv, .contact__cards .rv').forEach((el, i, arr) => el.style.setProperty('--i', [...el.parentNode.children].indexOf(el)));

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

  /* --- spektrum medů --- */
  const sp = $('#medy'), spImg = $('[data-sp-img]'), spInfo = $('.spectrum__info'), spVars = $('[data-sp-vars]');
  let cur = honeys[2], curV = 0;
  const renderVars = () => {
    spVars.innerHTML = cur.variants.map((v, i) => `<button class="vbtn${i === curV ? ' is-on' : ''}" data-i="${i}"><small>${v.label}</small><b>${kc(v.price)}</b></button>`).join('');
  };
  spVars.addEventListener('click', e => {
    const b = e.target.closest('.vbtn'); if (!b) return;
    curV = +b.dataset.i; renderVars();
    spImg.classList.add('is-out'); setTimeout(() => { spImg.src = img(cur.variants[curV].img); spImg.onload = () => spImg.classList.remove('is-out'); }, 250);
  });
  const selectHoney = id => {
    cur = honeys.find(h => h.id === id); curV = 0;
    $$('.shelf__item').forEach(b => { b.classList.toggle('is-on', b.dataset.honey === id); b.setAttribute('aria-selected', b.dataset.honey === id); });
    sp.style.setProperty('--hc', cur.color); sp.style.setProperty('--hi', cur.ink);
    spImg.classList.add('is-out'); spInfo.classList.add('is-out');
    setTimeout(() => {
      spImg.src = img(cur.img); spImg.alt = cur.name;
      $('[data-sp-trait]').textContent = cur.trait; $('[data-sp-name]').textContent = cur.name; $('[data-sp-text]').textContent = cur.text;
      renderVars();
      spImg.onload = () => spImg.classList.remove('is-out');
      if (spImg.complete) spImg.classList.remove('is-out');
      spInfo.classList.remove('is-out');
    }, 300);
  };
  $$('.shelf__item').forEach(b => b.addEventListener('click', () => selectHoney(b.dataset.honey)));
  $('[data-sp-add]').addEventListener('click', () => addToCart(cur.id, curV));
  renderVars();

  /* --- e-shop: filtry a varianty --- */
  $$('[data-filter]').forEach(c => c.addEventListener('click', () => {
    $$('[data-filter]').forEach(x => x.classList.toggle('is-on', x === c));
    const f = c.dataset.filter;
    $$('[data-grid] .card').forEach(card => card.classList.toggle('is-hidden', f !== 'all' && card.dataset.cat !== f));
  }));
  $$('[data-grid] .card').forEach(card => {
    const it = catalog[card.dataset.id]; card._v = 0;
    const pills = $('[data-pills]', card); if (!pills) return;
    pills.addEventListener('click', e => {
      const p = e.target.closest('.pill'); if (!p) return;
      card._v = +p.dataset.v;
      $$('.pill', pills).forEach(x => x.classList.toggle('is-on', x === p));
      $('[data-price]', card).textContent = kc(it.variants[card._v].price);
      const im = $('[data-card-img]', card); im.style.opacity = 0;
      setTimeout(() => { im.src = img(it.variants[card._v].img); im.onload = () => im.style.opacity = 1; }, 180);
    });
  });
  $$('[data-add]').forEach(b => b.addEventListener('click', () => {
    const card = b.closest('.card'); addToCart(b.dataset.add, card ? card._v || 0 : 0);
    b.classList.add('is-done'); b.innerHTML = '<svg><use href="#check"/></svg>';
    setTimeout(() => { b.classList.remove('is-done'); b.innerHTML = '<svg><use href="#plus"/></svg>'; }, 1400);
  }));

  /* --- detail produktu --- */
  const modal = $('#detail'); let dItem, dV = 0;
  const renderDetail = () => {
    const v = dItem.variants[dV];
    $('[data-d-img]').src = img(v.img); $('[data-d-img]').alt = dItem.name;
    $('[data-d-price]').textContent = kc(v.price) + (dItem.unit && v.price ? ' / ' + dItem.unit : '');
    $('[data-d-pills]').innerHTML = dItem.variants.length > 1 ? dItem.variants.map((x, i) => `<button class="pill${i === dV ? ' is-on' : ''}" data-i="${i}">${x.label}</button>`).join('') : `<span class="pill is-on">${v.label}</span>`;
    $('[data-d-add]').style.display = v.price ? '' : 'none';
  };
  $$('[data-detail]').forEach(b => b.addEventListener('click', () => {
    dItem = catalog[b.dataset.detail]; const card = b.closest('.card'); dV = card ? card._v || 0 : 0;
    $('[data-d-media]').style.setProperty('--c', dItem.color);
    $('[data-d-tag]').textContent = dItem.tag; $('[data-d-name]').textContent = dItem.name; $('[data-d-text]').textContent = dItem.text;
    renderDetail(); modal.classList.add('is-open'); modal.setAttribute('aria-hidden', false);
  }));
  $('[data-d-pills]').addEventListener('click', e => { const p = e.target.closest('button.pill'); if (p) { dV = +p.dataset.i; renderDetail(); } });
  $('[data-d-add]').addEventListener('click', () => { addToCart(dItem.id, dV); closeModal(); });
  const closeModal = () => { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', true); };
  $$('[data-detail-close]').forEach(b => b.addEventListener('click', closeModal));

  /* --- košík (ukázka) --- */
  const KEY = 'medshop-demo-cart';
  let cart = []; try { cart = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) {}
  const drawer = $('#cart');
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} };
  const renderCart = () => {
    const n = cart.reduce((s, x) => s + x.q, 0);
    $$('[data-count]').forEach(c => { c.textContent = n; c.classList.add('bump'); setTimeout(() => c.classList.remove('bump'), 300); });
    drawer.classList.toggle('is-empty', !cart.length);
    $('[data-cart-list]').innerHTML = cart.map((x, i) => {
      const it = catalog[x.id], v = it.variants[x.v];
      return `<li class="ci"><div class="ci__img"><img src="${img(v.img)}" alt=""></div>
        <div><div class="ci__name">${it.name}</div><div class="ci__var">${v.label}</div>
        <div class="qty"><button data-q="-1" data-i="${i}" aria-label="Méně"><svg><use href="#minus"/></svg></button><span>${x.q}</span><button data-q="1" data-i="${i}" aria-label="Více"><svg><use href="#plus"/></svg></button></div></div>
        <div><div class="ci__price">${kc(v.price * x.q)}</div><button class="ci__rm" data-rm="${i}">Odebrat</button></div></li>`;
    }).join('');
    $('[data-cart-total]').textContent = kc(cart.reduce((s, x) => s + catalog[x.id].variants[x.v].price * x.q, 0));
  };
  const toast = msg => { const t = $('[data-toast]'); t.textContent = msg; t.classList.add('is-on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('is-on'), 2600); };
  function addToCart(id, v = 0) {
    const it = catalog[id]; if (!it || it.variants[v].price == null) return;
    const ex = cart.find(x => x.id === id && x.v === v);
    ex ? ex.q++ : cart.push({ id, v, q: 1 });
    save(); renderCart(); toast(`${it.name} (${it.variants[v].label}) je v košíku`);
  }
  $('[data-cart-list]').addEventListener('click', e => {
    const q = e.target.closest('[data-q]'), rm = e.target.closest('[data-rm]');
    if (q) { const x = cart[+q.dataset.i]; x.q += +q.dataset.q; if (x.q < 1) cart.splice(+q.dataset.i, 1); }
    else if (rm) cart.splice(+rm.dataset.rm, 1); else return;
    save(); renderCart();
  });
  const openCart = () => { drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden', false); };
  const closeCart = () => { drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', true); };
  $$('[data-cart-open]').forEach(b => b.addEventListener('click', openCart));
  $$('[data-cart-close]').forEach(b => b.addEventListener('click', closeCart));
  $('[data-checkout]').addEventListener('click', () => toast('Tohle je ukázka košíku — v návrhu se objednávka neodesílá.'));
  addEventListener('keydown', e => { if (e.key === 'Escape') { closeCart(); closeModal(); } });
  renderCart(); $$('[data-count]').forEach(c => c.classList.remove('bump'));
})();
