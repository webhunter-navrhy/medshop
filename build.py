#!/usr/bin/env python3
"""Med Shop — sestaví statický web ze šablon (src/) a dat (_data/*.json) do site/.
Obsah (medy, zboží, ceny, doprava, bankovní účet, texty, podmínky) se upravuje v administraci na /admin/
(backend webhunter-admin na Cloudflare: přihlášení, uložení do repozitáře, objednávky a e-maily) nebo ručně v _data/."""
import datetime, hashlib, json, os, pathlib, re, shutil
from jinja2 import Environment, FileSystemLoader, pass_context

ROOT = pathlib.Path(__file__).parent
SRC, CONTENT, OUT = ROOT / 'src', ROOT / '_data', ROOT / 'site'
API = 'https://webhunter-admin.webhunter.workers.dev/api/medshop'

if OUT.exists():
    shutil.rmtree(OUT)
shutil.copytree(ROOT / 'assets', OUT / 'assets')
for f in ('style.css', 'main.js'):
    shutil.copy(SRC / f, OUT / 'assets' / f)
if (ROOT / 'img').exists():
    shutil.copytree(ROOT / 'img', OUT / 'img', ignore=shutil.ignore_patterns('.gitkeep'))  # fotky nahrané v administraci
shutil.copytree(ROOT / 'admin', OUT / 'admin')

h = lambda p: hashlib.md5((OUT / p).read_bytes()).hexdigest()[:8]
data = {p.stem: json.loads(p.read_text()) for p in CONTENT.glob('*.json')}
site, shop = data['site'], data['shop']
DOMAIN = site['domain'].rstrip('/')
BASE = '/' if (ROOT / 'CNAME').exists() else '/medshop/'   # kořen webu (404 stránka potřebuje absolutní cesty)

# ---------- katalog ----------
def price_kc(n):
    return f'{n:,}'.replace(',', ' ') + ' Kč'

def is_num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and x > 0

honeys = []
for x in data['honeys']:
    if x.get('hidden'):
        continue
    for v in x['variants']:
        v.setdefault('available', True)
        v['available'] = bool(v['available']) and is_num(v.get('price'))
        v.setdefault('img', x.get('img'))
    x['dv'] = next((i for i, v in enumerate(x['variants']) if v['available']), 0)
    x['kind'], x['url_path'] = 'med', f"med/{x['slug']}/"
    x['priced'] = any(is_num(v.get('price')) for v in x['variants'])
    honeys.append(x)

products = []
for p in data['products']:
    if p.get('hidden'):
        continue
    p['available'] = p.get('available', True) is not False and is_num(p.get('price'))
    p.update(kind='zbozi', url_path=f"produkty/{p['slug']}/", dv=0, priced=is_num(p.get('price')),
             color=p.get('color') or '#F3D88A', ink='#3E2604', tag=p.get('badge', ''),
             variants=[{'label': p['variant'], 'price': p.get('price'), 'img': p['img'], 'available': p['available']}])
    products.append(p)

items = honeys + products
for it in items:
    prices = [v['price'] for v in it['variants'] if v['available']]
    it['from_price'] = (('od ' if len(set(prices)) > 1 else '') + price_kc(min(prices))) if prices else (it.get('price_text') or 'Cena dle množství')

featured = next((x for x in honeys if x['id'] == 'lipovy'), honeys[min(2, len(honeys) - 1)] if honeys else None)
CAT_LABEL = {'medy': 'Medy', 'darky': 'Dárky', 'ostatni': 'Vosk a sklenice'}
cats = [(c, CAT_LABEL.get(c, c.capitalize())) for c in dict.fromkeys(['medy'] * bool(honeys) + [p['cat'] for p in products])]

shipping = [s for s in shop.get('shipping', []) if s.get('active', True) and isinstance(s.get('price'), (int, float)) and not isinstance(s.get('price'), bool)]
shop['shipping_short'] = shipping[0]['name'] + (' zdarma' if shipping and not shipping[0]['price'] else '') if shipping else ''

# ---------- strukturovaná data (schema.org) ----------
abs_img = lambda p: DOMAIN + '/' + (p if '/' in str(p) else f'assets/img/cut/{p}.webp')
store = {
    '@context': 'https://schema.org', '@type': ['Store', 'LocalBusiness'], '@id': DOMAIN + '/#obchod',
    'name': site['name'], 'alternateName': f"Stáčírna medu {site['owner']}", 'description': site['seo']['description'],
    'url': DOMAIN + '/', 'logo': DOMAIN + '/assets/logo.svg', 'image': [DOMAIN + '/assets/og.jpg', DOMAIN + '/assets/img/plastev.webp'],
    'telephone': '+420' + re.sub(r'\D', '', site['mobile']), 'email': site['email'],
    'founder': {'@type': 'Person', 'name': site['owner']}, 'foundingDate': '2001', 'taxID': site['ico'].replace(' ', ''),
    'address': {'@type': 'PostalAddress', 'streetAddress': site['address'], 'addressLocality': 'Olomouc-Lošov',
                'postalCode': re.sub(r'\D', '', site['city'])[:5], 'addressRegion': site.get('region', 'Olomoucký kraj'), 'addressCountry': 'CZ'},
    'geo': {'@type': 'GeoCoordinates', 'latitude': site['geo']['lat'], 'longitude': site['geo']['lon']},
    'hasMap': site['map'], 'areaServed': ['Olomouc', 'Olomoucký kraj', 'Česká republika'],
    'currenciesAccepted': 'CZK', 'paymentAccepted': 'Bankovní převod, QR platba', 'priceRange': '90–540 Kč',
    'makesOffer': [{'@type': 'Offer', 'itemOffered': {'@id': DOMAIN + '/' + it['url_path'] + '#produkt'}} for it in items if it['priced']],
}
prices = [v['price'] for it in items for v in it['variants'] if v['available']]
if prices:
    store['priceRange'] = f'{min(prices)}–{max(prices)} Kč'

def product_ld(it):
    offers = [{'@type': 'Offer', 'name': f"{it['name']} {v['label']}", 'sku': f"{it['id']}-{i}", 'price': v['price'], 'priceCurrency': 'CZK',
               'availability': 'https://schema.org/' + ('InStock' if v['available'] else 'OutOfStock'),
               'url': DOMAIN + '/' + it['url_path'], 'seller': {'@id': DOMAIN + '/#obchod'},
               'itemCondition': 'https://schema.org/NewCondition'} for i, v in enumerate(it['variants']) if is_num(v.get('price'))]
    prod = {'@context': 'https://schema.org', '@type': 'Product', '@id': DOMAIN + '/' + it['url_path'] + '#produkt',
            'name': it['name'], 'description': it['text'], 'image': [abs_img(v['img']) for v in it['variants']][:4],
            'brand': {'@type': 'Brand', 'name': site['name']}, 'category': 'Med' if it['kind'] == 'med' else 'Včelí produkty',
            'countryOfOrigin': 'CZ'}
    if offers:
        prod['offers'] = offers
    crumbs = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': 1, 'name': site['name'], 'item': DOMAIN + '/'},
        {'@type': 'ListItem', 'position': 2, 'name': 'E-shop', 'item': DOMAIN + '/#obchod'},
        {'@type': 'ListItem', 'position': 3, 'name': it['name'], 'item': DOMAIN + '/' + it['url_path']}]}
    return json.dumps([prod, crumbs], ensure_ascii=False)

faq = {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
    {'@type': 'Question', 'name': q['q'], 'acceptedAnswer': {'@type': 'Answer', 'text': q['a']}} for q in data['knowledge']['items']]}

# ---------- šablony ----------
env = Environment(loader=FileSystemLoader([str(SRC), str(SRC / 'pages')]), autoescape=False)
env.filters['tel'] = lambda t: '+420' + re.sub(r'\D', '', t)
env.filters['kc'] = lambda n: price_kc(n) if is_num(n) else 'Cena dle dohody'
env.filters['json'] = lambda o: json.dumps(o, ensure_ascii=False)
env.filters['emph'] = lambda t: re.sub(r'\*(.+?)\*', r'<em>\1</em>', str(t or ''))
env.filters['paras'] = lambda t: ''.join(f'<p>{x.strip()}</p>' for x in str(t or '').split('\n') if x.strip())
NUM = {1: 'Jeden', 2: 'Dva', 3: 'Tři', 4: 'Čtyři', 5: 'Pět', 6: 'Šest', 7: 'Sedm', 8: 'Osm', 9: 'Devět', 10: 'Deset'}
def medy(n):
    w = NUM.get(n, str(n))
    if n == 1: return 'Jeden med, <em>jedna barva</em>'
    if 2 <= n <= 4: return f'{w} medy, <em>{({2: "dvě", 3: "tři", 4: "čtyři"})[n]} barvy</em>'
    return f'{w} medů, <em>{w.lower()} barev</em>'
env.filters['medy'] = medy

@pass_context
def pimg(ctx, p):
    """obrázek z dat → cesta: vyřezaná sklenice (p56) nebo nahraná fotka (img/uploads/…)"""
    p = str(p or '')
    return ctx['root'] + (p if '/' in p else f'assets/img/cut/{p}.webp')
env.filters['pimg'] = pimg

# česká typografie: jednopísmenné předložky a spojky nenechávat na konci řádku (jen v textu)
_NB = re.compile(r'(?<![\w&;])([vszkouiaVSZKOUIA]) (?=\S)')
def nbsp(html):
    parts = re.split(r'(<script.*?</script>|<style.*?</style>|<svg.*?</svg>|<[^>]+>)', html, flags=re.S)
    return ''.join(x if i % 2 else _NB.sub(r'\1&nbsp;', x) for i, x in enumerate(parts))

for name in ('favicon.svg',):
    if (SRC / name).exists():
        shutil.copy(SRC / name, OUT / 'assets' / name)
v = {'css': h('assets/style.css'), 'js': h('assets/main.js'), 'logo': h('assets/logo.svg'), 'fav': h('assets/favicon.svg')}
shop_js = json.dumps({
    'api': API, 'honeys': [{k: x[k] for k in ('id', 'name', 'tag', 'text', 'color', 'trait', 'img', 'variants', 'url_path', 'ink')} for x in honeys],
    'products': [{k: p.get(k) for k in ('id', 'name', 'tag', 'text', 'note', 'color', 'unit', 'variants', 'url_path')} for p in products],
    'shipping': [{k: s.get(k) for k in ('id', 'name', 'price', 'free_from', 'address')} for s in shipping],
    'due_days': shop.get('due_days'),
}, ensure_ascii=False).replace('</', '<\\/')

common = dict(data, site=site, shop=shop, honeys=honeys, products=products, featured=featured, cats=cats, shipping=shipping,
              v=v, year=datetime.date.today().year, ld_store=json.dumps(store, ensure_ascii=False), shop_js=shop_js,
              ld_faq=json.dumps(faq, ensure_ascii=False), hero_pick=featured)
pages = []  # (cesta, priorita) pro sitemap

def render(tpl, out, root, page, **extra):
    ctx = dict(common, root=root, home='' if out == 'index.html' else root, page=page, **extra)
    for it in items:
        it['url'] = root + it['url_path']
    html = env.get_template(tpl).render(ctx)
    dst = OUT / out
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(nbsp(html))
    if not page.get('noindex'):
        pages.append((page['path'], page.get('prio', '0.6')))

for tpl in sorted((SRC / 'pages').glob('*.html')):
    meta = json.loads(re.match(r'\{#\s*(\{.*?\})\s*#\}', tpl.read_text(), re.S).group(1))
    if meta.get('per') == 'item':
        for it in items:
            depth = it['url_path'].count('/')
            first = it['variants'][it['dv']]
            kind = 'med' if it['kind'] == 'med' else 'zboží'
            vars_txt = ', '.join(v['label'] for v in it['variants'] if v['available'])
            title = f"{it['name']}{' – ' + vars_txt if vars_txt and it['kind'] == 'med' else ''} | Med Shop Olomouc"
            desc = (f"{it['name']} ze stáčírny Jiřího Tichého v Olomouci-Lošově. " + (f"Balení {vars_txt}, " if vars_txt else '')
                    + (f"cena {it['from_price']}. " if it['priced'] else '') + "Objednávka online, osobní odběr v Lošově.")
            it['ld'] = product_ld(it)
            others = [o for o in (honeys if it['kind'] == 'med' else items) if o is not it][:5]
            render(tpl.name, it['url_path'] + 'index.html', '../' * depth,
                   {'title': title, 'desc': desc, 'path': it['url_path'], 'og_type': 'product',
                    'og_image': (first['img'] if '/' in str(first['img']) else f"assets/img/cut/{first['img']}.webp"), 'prio': '0.8'},
                   item=it, others=others)
    elif meta.get('per') == 'legal':
        for key, path in (('vop', 'obchodni-podminky/'), ('gdpr', 'ochrana-osobnich-udaju/')):
            doc = data[key]
            render(tpl.name, path + 'index.html', '../',
                   {'title': f"{doc['title']} | Med Shop", 'desc': f"{doc['title']} e-shopu Med Shop – stáčírna medu Jiří Tichý, Olomouc-Lošov.", 'path': path, 'prio': '0.3'},
                   doc=doc)
    else:
        out = meta['out']
        root = BASE if meta.get('abs') else '../' * out.count('/')
        path = '' if out == 'index.html' else out.replace('index.html', '')
        page = {'title': meta.get('title') or site['seo']['title'], 'desc': meta.get('desc') or site['seo']['description'],
                'path': path, 'noindex': meta.get('noindex', False), 'prio': '1.0' if out == 'index.html' else '0.5'}
        render(tpl.name, out, root, page)
    print('✓', tpl.name)

# ---------- sitemap, robots, llms.txt ----------
today = datetime.date.today().isoformat()
(OUT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(
    f'  <url><loc>{DOMAIN}/{p}</loc><lastmod>{today}</lastmod><priority>{pr}</priority></url>\n' for p, pr in pages) + '</urlset>\n')
if site.get('indexovat'):
    (OUT / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /objednavka/\n\nSitemap: {DOMAIN}/sitemap.xml\n')
else:  # návrh / zkušební provoz: neindexovat
    (OUT / 'robots.txt').write_text('User-agent: *\nDisallow: /\n')

L = [f"# {site['name']} – stáčírna medu {site['owner']}, Olomouc-Lošov", '',
     f"> {site['seo']['description']}", '',
     f"{site['name']} je stáčírna medu v Olomouci-Lošově ({site['address']}, {site['city']}), kterou provozuje {site['owner']}. Vznikla v roce 2001 v rodinném domě. "
     "Med nakupuje, filtruje a čeří, pastový med upravuje řízenou krystalizací, stáčí, váží, etiketuje a prodává. "
     "Provozovna je certifikovaná a pod dohledem Státní veterinární správy. Prodává jednotlivcům přes e-shop a obchodům a pekárnám ve velkém (konve 35 kg, sudy 280 kg).", '',
     '## Druhy medu a ceny', '']
for x in honeys:
    L.append(f"- [{x['name']}]({DOMAIN}/{x['url_path']}): {x['trait']}. " + ', '.join(f"{v['label']} {price_kc(v['price'])}" for v in x['variants'] if v['available']))
L += ['', '## Další zboží', '']
for p in products:
    L.append(f"- [{p['name']}]({DOMAIN}/{p['url_path']}): {p['variant']}, " + (price_kc(p['price']) + (f" / {p['unit']}" if p.get('unit') else '') if p['priced'] else (p.get('price_text') or 'cena dle množství')))
L += ['', '## Nákup', '',
      f"- Objednávka přes e-shop na {DOMAIN}/, platba předem bankovním převodem nebo QR platbou (variabilní symbol = číslo objednávky).",
      *[f"- Převzetí: {s['name']} ({'zdarma' if not s['price'] else price_kc(s['price'])})" + (f" – {s['note']}" if s.get('note') else '') for s in shipping],
      f"- {shop.get('vat_note', '')}".rstrip(' -'),
      f"- Velkoodběr (obchody, pekárny): na dotaz, {site['email']}.", '',
      '## Kontakt', '',
      f"- Adresa: {site['address']}, {site['city']} (Olomoucký kraj)",
      f"- Telefon: {site['mobile']}, tel./fax {site['phone']}",
      f"- E-mail: {site['email']}", f"- IČ: {site['ico']}", '',
      '## Stránky', '',
      f"- [Doprava a platba]({DOMAIN}/doprava-a-platba/)", f"- [Obchodní podmínky]({DOMAIN}/obchodni-podminky/)",
      f"- [Ochrana osobních údajů]({DOMAIN}/ochrana-osobnich-udaju/)", '']
(OUT / 'llms.txt').write_text('\n'.join(l for l in L if l is not None))

# administrace: seznam obrázků k výběru + verze pro hlídání zveřejnění
imgs = sorted('assets/img/cut/' + f.name for f in (OUT / 'assets/img/cut').glob('*.webp'))
if (OUT / 'img').exists():
    imgs += sorted(str(f.relative_to(OUT)) for f in (OUT / 'img').rglob('*') if f.is_file())
(OUT / 'admin/images.json').write_text(json.dumps(imgs, ensure_ascii=False))
(OUT / 'version.json').write_text(json.dumps({'sha': os.environ.get('GITHUB_SHA', 'local')}))
ai = OUT / 'admin/index.html'
ai.write_text(ai.read_text().replace('__V_ACSS__', h('admin/admin.css')).replace('__V_AJS__', h('admin/admin.js')))
if (ROOT / 'CNAME').exists():
    shutil.copy(ROOT / 'CNAME', OUT / 'CNAME')
(OUT / '.nojekyll').touch()
print('✓ sitemap.xml, robots.txt, llms.txt,', len(pages), 'stránek v sitemap')
