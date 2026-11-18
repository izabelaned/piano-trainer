#!/usr/bin/env python3
"""Stamp a new version into index.html so browsers load fresh JS/CSS after each deploy.

GitHub Pages lets browsers cache files for a while, and ES modules imported from
other modules ("./lessons.js") ignore a ?v= on main.js. An import map rewrites
every module URL to include the version, so a new deploy is picked up at once.
Run before committing:  python3 tools/bump-version.py
"""
import pathlib, re, time

root = pathlib.Path(__file__).resolve().parent.parent
v = time.strftime("%Y%m%d%H%M%S")
modules = sorted(p.name for p in (root / "js").glob("*.js"))
imports = ",\n".join(f'    "./js/{m}": "./js/{m}?v={v}"' for m in modules)
importmap = f'<script type="importmap">\n{{ "imports": {{\n{imports}\n}} }}\n</script>'

html = (root / "index.html").read_text()
html = re.sub(r'<script type="importmap">.*?</script>\n?', "", html, flags=re.S)
html = re.sub(r'href="css/app.css(\?v=\d+)?"', f'href="css/app.css?v={v}"', html)
# the entry point must be an import (script src= ignores import maps)
html = re.sub(r'<script type="module"[^>]*>.*?</script>', '', html, flags=re.S)
html = html.replace("</body>", f'{importmap}\n<script type="module">import "./js/main.js";</script>\n</body>')
(root / "index.html").write_text(html)
print("version", v)
