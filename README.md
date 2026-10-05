# Med Shop — návrh webu

Nezávazný návrh nového webu pro Med Shop (stáčírna medu Jiří Tichý, Olomouc-Lošov, med-shop.cz). Statický web generovaný z dat.

- **Obsah** v `_data/*.json`: `site.json` (texty, kontakty), `honeys.json` (5 druhů medu s variantami a cenami), `products.json` (dárky, vosk, sklenice), `wholesale.json`, `process.json`, `knowledge.json`, `credits.json`.
- **Šablona** `src/index.html` (Jinja), `src/style.css`, `src/main.js`; logo „Med Shop“ vektorizované z původní hlavičky v `brand/`.
- `python3 build.py` → `site/` (`?v=` hashe proti cache GitHub Pages, noindex + robots.txt). Push do `main` → GitHub Actions nasadí Pages.
- Texty, ceny a fotky výrobků jsou z med-shop.cz; výrobky vyřezané z jeho fotek (`assets/img/cut/`). Ilustrační fotky z Wikimedia Commons (licence v `credits.json`).
- E-shop a košík jsou jen **ukázka** (localStorage), nic se neobjednává.
