# Frame3D Spatial Browser website

Marketing site for Frame3D Spatial Browser (Meta Quest). Static HTML, CSS and JavaScript:
no build step for visitors, nothing to install. Live at
<https://subscriptions-dot.github.io/frame3d-website/>.

## Site map

| Page | File | What is on it |
|---|---|---|
| Home | `index.html` | 3D orbit banner, the idea, Spaces card, features grid, numbers, screen dive, Quest finale, footer |
| Features | `features.html` | Every feature in groups (3D & video, browsing, make it yours, play & control, privacy) + review cards |
| FAQ | `faq.html` | Short answers (headsets, price, account, privacy, VR video, DRM, add-ons, updates) |
| Help | `help.html` | Install on Quest (sideload), fixes for common problems, how to report a bug |
| Contact | `contact.html` | Support / bugs / press, community links |
| Privacy & legal | `legal.html` | Privacy policy, this website, credits & licences, trademarks |
| Not found | `404.html` | Shown by GitHub Pages for any wrong address |
| — | `sitemap.xml`, `robots.txt` | For search engines (written by the export) |
| — | `og.png` | Picture shown when the link is shared (WhatsApp, X, Telegram…) |

## Placeholders to replace before launch

All of them live in **one place**: `SETTINGS` at the top of `tools/build_pages.py`.
Change a value, run `python3 tools/build_pages.py`, then publish (below). Every page and the home
footer update together. Anything still a placeholder shows a small yellow **placeholder** tag on the page.

| Setting | Now | Used on |
|---|---|---|
| `support_email` | `support@example.com` | Contact, Help, Privacy |
| `press_email` | `press@example.com` | Contact |
| `telegram`, `discord`, `youtube`, `instagram`, `x` | empty (icons point to Contact › Community, "coming soon") | footer icons on every page, Contact |
| `site_url` | GitHub Pages address | canonical links, share tags, sitemap. Change it when you move to your own domain |

Also marked with a placeholder tag in the page text (edit them in `tools/build_pages.py`):
- FAQ: the list of supported headsets, and the Meta Store answer.
- Help: "Something else" in Fix a problem.
- Features: the three review cards. Put in **real** quotes only, with the person's OK.

## Folder layout (source, `software/frame3d-website/`)

| Path | What it is |
|---|---|
| `site/index.html` | Home page, everything inline (Artifact-style fragment: no doctype/head tags) |
| `site/{features,faq,help,contact,legal,404}.html` | Reading pages. **Generated**: edit `tools/build_pages.py`, not these files |
| `site/assets/pages.css` | Shared style of the reading pages |
| `site/assets/orbit_hero.{js,css}` | Top banner: glass mark, orbit rings, six feature planets |
| `site/assets/*.webp`, `*.gltf.json`, `og.png` | Pictures, 3D models, share picture |
| `tools/build_pages.py` | Writes the reading pages, and the share tags + social icons in `site/index.html` |
| `tools/export_site.py` | Turns `site/` into the publishable folder (split CSS/JS, sorted assets, versioned URLs, sitemap) |
| `tools/shrink_models.py` | Makes the 3D models download faster (float precision trim, PNG → WebP) |
| `tools/make_og.py` | Draws `og.png` |
| `tools/build_dist.py` | Older single-folder build, kept for reference |
| `blender/` | Scripts that made the renders and baked models |

The published folder (GitHub repo `subscriptions-dot/frame3d-website`) looks like:
`index.html`, the reading pages, `css/`, `js/` (`page.js`, `main.js`, `orbit-hero.js`),
`assets/images/`, `assets/models/`, `og.png`, `sitemap.xml`, `robots.txt`, `.nojekyll`.

## Edit and publish

```bash
cd software/frame3d-website
python3 tools/build_pages.py                  # after changing pages or SETTINGS
python3 tools/export_site.py /tmp/f3d-site    # build the publishable folder
cd /tmp/f3d-site && python3 -m http.server 8080   # check it at http://localhost:8080
```

To publish, copy the exported folder over a clone of `subscriptions-dot/frame3d-website`
(keep its `.git`), commit and push. GitHub Pages serves it in about a minute. Each export stamps a
new version on the CSS/JS links, so phones never keep an old script.

## How the home page works

One fixed WebGL canvas (three.js 0.165) paints the ground and every 3D view; the DOM floats on top.
GSAP ScrollTrigger drives the scenes, Lenis drives scrolling (on phones too, so the page and the 3D
move in the same frame). Performance rules that keep it smooth:
- Every scene is drawn once off screen at load (`warm()`), so nothing compiles mid-scroll.
- Bloom, SMAA and grain are skipped when no 3D is on screen; quality steps down by itself on slow devices.
- Phone address-bar resizes never rebuild the page; GL buffers resize after scrolling settles.
- Touch scroll speed: `touchMultiplier` / `touchInertiaMultiplier` in the Lenis setup in `site/index.html`.

## Facts that must match the app

Feature copy must match the app (`Frame3DTour.kt`, `VoiceCommands.kt`, app docs). Numbers on the page:
38 depth maps/s, 13 ms per map on GPU, 3360×1760 swapchain (1680×1760 per eye), 90 Hz in a page's VR session.
Check each feature on the headset before launch.

Libraries (pinned, from CDNs): three.js 0.165.0 (jsDelivr), GSAP 3.12.5 + ScrollTrigger (cdnjs),
Lenis 1.1.13 (jsDelivr). Fonts: Inter, Inter Tight, JetBrains Mono (Google Fonts).
