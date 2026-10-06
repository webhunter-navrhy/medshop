# Med Shop – e-shop stáčírny medu (Jiří Tichý, Olomouc-Lošov)

Statický web generovaný z dat + společný backend **webhunter-admin** (Cloudflare Worker) pro administraci, objednávky a e-maily.

- **Obsah** v `_data/*.json`: `honeys.json` (medy, balení, ceny, dostupnost), `products.json` (další zboží), `shop.json` (bankovní účet, splatnost, doprava, texty objednávky), `site.json` (texty, kontakty, SEO, `indexovat`), `vop.json`, `gdpr.json`, `wholesale.json`, `process.json`, `knowledge.json`.
- **Šablony** `src/base.html` + `src/pages/*.html`, `src/style.css`, `src/main.js` (košík, objednávka). `python3 build.py` → `site/` (produktové stránky, sitemap, robots, llms.txt, schema.org, `?v=` hashe). Push do `main` → GitHub Actions → Pages.
- **Administrace** `/admin/` (přihlášení heslem přes webhunter-admin). Uložení = commit do repa, web se přegeneruje za ~1 min. Objednávky jsou v KV backendu, ne v repu.
- **Objednávka**: `POST https://webhunter-admin.webhunter.workers.dev/api/medshop/order` – backend přepočítá ceny z repa, uloží objednávku, pošle e-mail prodejci (`shop.to` v KV) a zákazníkovi s QR Platbou (SPAYD). Platba jen převodem, VS = číslo objednávky.
- **Spuštění na www.med-shop.cz**: soubor `CNAME`, DNS u Forpsi (A/www, MX nechat), `site.json` → `indexovat: true`, v KV `shop.to` → info@med-shop.cz a `test: false`, v adminu vymazat „Zkušební provoz“, změnit heslo.
