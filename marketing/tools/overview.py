"""Erzeugt marketing/UEBERSICHT.html: alle Bilder und Videos auf einer Seite (lokal im Browser öffnen).

Aufruf (Repo-Root): python3 marketing/tools/overview.py
"""

from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GROUPS = [
    ("Profilbild", "profile/*.png"),
    ("Marke", "brand/*.png"),
    ("Feed 3:4 (1080 × 1440)", "posts/*-1080x1440.png"),
    ("Feed 4:5 (1080 × 1350)", "posts/*-1080x1350.png"),
    ("Karussell", "posts/02-karussell/*.png"),
    ("Stories 9:16", "stories/*.png"),
    ("Reel-Titelbilder und Serien-Cover", "stories/reel-cover/*.png"),
    ("Videos", "videos/*.mp4"),
    ("Screenshots hell (Beispieldaten)", "screenshots/light-*.png"),
    ("Screenshots dunkel (Beispieldaten)", "screenshots/dark-*.png"),
]


def tile(p: Path) -> str:
    rel = escape(p.relative_to(ROOT).as_posix())
    media = (f'<video src="{rel}" controls muted playsinline preload="metadata"></video>'
             if p.suffix == ".mp4" else f'<img src="{rel}" loading="lazy" alt="{escape(p.stem)}">')
    return f'<figure><a href="{rel}">{media}</a><figcaption>{escape(p.name)}</figcaption></figure>'


def main():
    parts = []
    for title, pattern in GROUPS:
        files = sorted(ROOT.glob(pattern))
        if files:
            parts.append(f"<h2>{escape(title)} <small>({len(files)})</small></h2><div class=g>"
                         + "".join(tile(f) for f in files) + "</div>")
    html = f"""<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Fangpunkt – Marketing-Übersicht</title>
<style>
:root{{--bg:#f3f6f6;--fg:#0e2229;--mut:#4a5f66;--card:#fff}}
@media (prefers-color-scheme:dark){{:root{{--bg:#0a181d;--fg:#e4eef0;--mut:#9cb2b8;--card:#10242a}}}}
body{{margin:0;padding:24px 16px 64px;background:var(--bg);color:var(--fg);font:15px/1.4 system-ui,sans-serif}}
h1{{font-size:24px;margin:0 0 4px}} p{{color:var(--mut);margin:0 0 24px}}
h2{{font-size:18px;margin:32px 0 12px}} small{{color:var(--mut);font-weight:400}}
.g{{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}}
figure{{margin:0;background:var(--card);border-radius:12px;padding:8px}}
img,video{{width:100%;height:auto;display:block;border-radius:6px}}
figcaption{{font-size:12px;color:var(--mut);margin-top:6px;word-break:break-all}}
</style></head><body>
<h1>Fangpunkt – Marketing-Übersicht</h1>
<p>Alle erzeugten Dateien. Antippen öffnet die Originalgröße. Texte zu den Motiven: posts/CAPTIONS.md.</p>
{''.join(parts)}
</body></html>"""
    (ROOT / "UEBERSICHT.html").write_text(html, encoding="utf-8")
    print("UEBERSICHT.html")


if __name__ == "__main__":
    main()
