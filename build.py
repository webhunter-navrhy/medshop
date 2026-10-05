#!/usr/bin/env python3
"""Med Shop — sestaví statický web ze šablony (src/) a dat (_data/*.json) do site/.
Obsah (medy, ceny, texty, kontakty) je v _data/*.json — formát pro společnou administraci webhunter-admin."""
import datetime, hashlib, json, pathlib, re, shutil
from jinja2 import Environment, FileSystemLoader

ROOT = pathlib.Path(__file__).parent
SRC, CONTENT, OUT = ROOT / 'src', ROOT / '_data', ROOT / 'site'

if OUT.exists():
    shutil.rmtree(OUT)
shutil.copytree(ROOT / 'assets', OUT / 'assets')
for f in ('style.css', 'main.js'):
    shutil.copy(SRC / f, OUT / 'assets' / f)

h = lambda p: hashlib.md5((OUT / p).read_bytes()).hexdigest()[:8]
data = {p.stem: json.loads(p.read_text()) for p in CONTENT.glob('*.json')}

env = Environment(loader=FileSystemLoader(str(SRC)), autoescape=False)
env.filters['tel'] = lambda t: '+420' + re.sub(r'\D', '', t)
env.filters['kc'] = lambda n: (f'{n:,}'.replace(',', ' ') + ' Kč') if n is not None else 'Cena dle dohody'
env.filters['json'] = lambda o: json.dumps(o, ensure_ascii=False)

# česká typografie: jednopísmenné předložky a spojky nenechávat na konci řádku (jen v textu)
_NB = re.compile(r'(?<![\w&;])([vszkouiaVSZKOUIA]) (?=\S)')


def nbsp(html):
    parts = re.split(r'(<script.*?</script>|<style.*?</style>|<svg.*?</svg>|<[^>]+>)', html, flags=re.S)
    return ''.join(x if i % 2 else _NB.sub(r'\1&nbsp;', x) for i, x in enumerate(parts))


html = env.get_template('index.html').render(
    data,
    v={'css': h('assets/style.css'), 'js': h('assets/main.js'), 'logo': h('assets/logo.svg')},
    year=datetime.date.today().year,
)
(OUT / 'index.html').write_text(nbsp(html))
(OUT / 'robots.txt').write_text('User-agent: *\nDisallow: /\n')
(OUT / '.nojekyll').touch()
print('✓ site/index.html')
