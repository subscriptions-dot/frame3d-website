# Frame3D Spatial Browser website

Static site: plain HTML, CSS and JavaScript. No build step, nothing to install.

## Run it on your computer

The page loads 3D files, so open it through a small local server (double-clicking index.html will not load the 3D):

```bash
cd Frame3D-Website
python3 -m http.server 8080
```

Then open http://localhost:8080

## Folder layout

| Path | What it is |
|---|---|
| `index.html` | Page markup: header, top banner, sections, footer |
| `legal.html` | Privacy, credits and licences, trademarks |
| `css/style.css` | Styles for the whole page |
| `css/orbit-hero.css` | Styles for the top banner (orbit, planets, feature pills) |
| `js/page.js` | Cursor, menu, rolling text, card tilt: everything that needs no 3D |
| `js/main.js` | 3D scenes and scroll: statement, Spaces card, features, numbers, screen dive, Quest finale |
| `js/orbit-hero.js` | Top banner: glass Frame3D mark, orbit rings, six feature planets and their pills |
| `assets/images/` | Photos and backgrounds (WebP) |
| `assets/models/` | 3D models (glTF stored as JSON) |

## Libraries (loaded from CDNs, pinned versions)

- three.js 0.165.0 (jsDelivr)
- GSAP 3.12.5 + ScrollTrigger (cdnjs)
- Lenis 1.1.13 smooth scroll (jsDelivr)

Fonts: Inter, Inter Tight, JetBrains Mono (Google Fonts).

## Put it online

Upload the whole folder to any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages). `index.html` must stay at the top level.
