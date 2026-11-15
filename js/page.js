/* DOM motion that needs no WebGL. Runs first so the page works even if 3D fails. */
/* DOM motion that needs no WebGL. Runs first so the page works even if 3D fails. */
(function(){
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  window.F3D = { reduce, fine, vel: 0, mouse: {x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0} };

  document.querySelectorAll('[data-roll]').forEach(el => {
    const t = el.textContent; el.textContent = ''; el.setAttribute('aria-label', t);
    [...t].forEach((c, i) => { const ch = document.createElement('span'); ch.className = 'ch'; ch.style.setProperty('--i', i); ch.setAttribute('aria-hidden', 'true'); ch.innerHTML = '<span></span><span></span>'; ch.children[0].textContent = c; ch.children[1].textContent = c; el.appendChild(ch); });
  });
  document.querySelectorAll('[data-odo]').forEach(el => {
    const v = el.dataset.odo; el.setAttribute('aria-label', v);
    el.innerHTML = [...v].map((d, i) => `<span class="col" style="--i:${i}" data-d="${d}" aria-hidden="true">${'0123456789'.split('').map(n => `<span>${n}</span>`).join('')}</span>`).join('');
  });

  const mb = document.getElementById('menu-btn'), menu = document.getElementById('menu');
  function setMenu(open){ document.body.classList.toggle('menu-open', open); mb.setAttribute('aria-expanded', open); mb.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); menu.setAttribute('aria-hidden', !open); }
  mb.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  addEventListener('pointermove', e => { const m = F3D.mouse; m.x = e.clientX; m.y = e.clientY; m.nx = e.clientX / innerWidth * 2 - 1; m.ny = -(e.clientY / innerHeight * 2 - 1); }, {passive: true});

  if (fine && !reduce){
    document.body.classList.add('has-cursor');
    const cur = document.querySelector('.cursor'), er = cur.querySelector('.eye.r'), ec = cur.querySelector('.eye.c'), lab = cur.querySelector('.cursor-label');
    const N = 10, trail = [];
    for (let i = 0; i < N; i++){ const d = document.createElement('i'); d.className = 'trail'; d.style.background = i % 2 ? 'var(--eye-c)' : 'var(--eye-r)'; d.style.opacity = (1 - i / N) * .5; document.body.appendChild(d); trail.push({el: d, x: 0, y: 0}); }
    const r = {x: 0, y: 0}, c = {x: 0, y: 0}; let lx = 0, ly = 0;
    gsap.ticker.add((time, dms) => {
      const k = x => 1 - Math.pow(1 - x, Math.min(4, (dms || 16.7) / 16.7));   // same feel at 60, 120 or 144 Hz
      const m = F3D.mouse, vx = m.x - lx, vy = m.y - ly; lx = m.x; ly = m.y;
      const big = cur.classList.contains('big'), sep = big ? 0 : Math.min(10, 3 + Math.hypot(vx, vy) * .25);
      r.x += (m.x - sep - r.x) * k(.32); r.y += (m.y - r.y) * k(.32); c.x += (m.x + sep - c.x) * k(.2); c.y += (m.y - c.y) * k(.2);
      er.style.transform = `translate3d(${r.x}px,${r.y}px,0)`; ec.style.transform = `translate3d(${c.x}px,${c.y}px,0)`;
      lab.style.transform = `translate3d(${(r.x + c.x) / 2}px,${(r.y + c.y) / 2}px,0) translate(-50%,-50%)`;
      let px = (r.x + c.x) / 2, py = (r.y + c.y) / 2;
      trail.forEach(t => { t.x += (px - t.x) * k(.38); t.y += (py - t.y) * k(.38); px = t.x; py = t.y; t.el.style.transform = `translate3d(${t.x}px,${t.y}px,0)`; t.el.style.visibility = big ? 'hidden' : 'visible'; });
    });
    document.addEventListener('pointerover', e => { const t = e.target.closest('[data-cursor]'); if (t){ cur.classList.add('big'); lab.textContent = t.dataset.cursor; } else cur.classList.remove('big'); });
  }

  const gb = document.getElementById('get-btn');
  if (fine && !reduce){
    gb.addEventListener('pointermove', e => { const b = gb.getBoundingClientRect(); gsap.to(gb, {x: (e.clientX - b.left - b.width / 2) * .3, y: (e.clientY - b.top - b.height / 2) * .4, duration: .6, ease: 'power3.out'}); });
    gb.addEventListener('pointerleave', () => gsap.to(gb, {x: 0, y: 0, duration: .9, ease: 'elastic.out(1,.4)'}));
  }

  // Finale stickers, our own motifs: two eyes, anaglyph glasses, pad, 360°, voice, mark, SBS, 3D.
  const S = body => `<svg viewBox="0 0 120 120"><g stroke="#fff" stroke-width="7" stroke-linejoin="round" paint-order="stroke">${body}</g></svg>`;
  const T = (x, y, s, fill, txt, fam = 'Inter Tight, sans-serif') => `<text x="${x}" y="${y}" text-anchor="middle" font-family="${fam}" font-weight="600" font-size="${s}" fill="${fill}" stroke-width="0">${txt}</text>`;
  const stickers = [
    S('<rect x="10" y="34" width="100" height="52" rx="26" fill="#141B3A"/><circle cx="42" cy="60" r="15" fill="#F05A5A" stroke-width="0"/><circle cx="78" cy="60" r="15" fill="#4CC9F0" stroke-width="0"/>'),
    S('<path d="M8 48h104l-6 30c-2 8-8 12-16 12H74c-6 0-9-4-11-10l-3-8-3 8c-2 6-5 10-11 10H30c-8 0-14-4-16-12z" fill="#1B2330"/><rect x="20" y="56" width="30" height="22" rx="8" fill="#F05A5A" stroke-width="0"/><rect x="70" y="56" width="30" height="22" rx="8" fill="#4CC9F0" stroke-width="0"/>'),
    S('<path d="M30 30h60c18 0 26 18 28 40 2 18-6 28-18 28-10 0-15-8-21-16H41c-6 8-11 16-21 16-12 0-20-10-18-28 2-22 10-40 28-40z" fill="#5D58FB"/><circle cx="38" cy="56" r="9" fill="#fff" stroke-width="0"/><circle cx="84" cy="48" r="5" fill="#4CC9F0" stroke-width="0"/><circle cx="94" cy="58" r="5" fill="#F05A5A" stroke-width="0"/><circle cx="84" cy="68" r="5" fill="#FFD166" stroke-width="0"/><circle cx="74" cy="58" r="5" fill="#fff" stroke-width="0"/>'),
    S('<circle cx="60" cy="60" r="48" fill="#FFD166"/>' + T(60, 72, 34, '#1B2330', '360°')),
    S('<path d="M14 26h92c6 0 10 4 10 10v40c0 6-4 10-10 10H52l-22 18 4-18H14c-6 0-10-4-10-10V36c0-6 4-10 10-10z" fill="#fff" stroke="#1B2330" stroke-width="3"/>' + T(60, 63, 19, '#1B2330', 'Turn it up!')),
    S('<rect x="14" y="42" width="62" height="62" rx="18" fill="none" stroke="#2F80FF" stroke-width="12" paint-order="normal"/><rect x="44" y="16" width="58" height="58" rx="16" fill="#8B3DDF"/>'),
    S('<path d="M60 8l13 33 35 3-27 22 9 34-30-19-30 19 9-34L12 44l35-3z" fill="#4CC9F0"/>'),
    S('<rect x="12" y="34" width="96" height="52" rx="14" fill="#F05A5A"/>' + T(60, 70, 26, '#fff', 'SBS', 'JetBrains Mono, monospace')),
    S('<circle cx="60" cy="60" r="46" fill="#2F80FF"/>' + T(60, 73, 38, '#fff', '3D')),
    S('<path d="M60 104C30 82 12 64 12 42c0-14 11-26 25-26 10 0 18 6 23 14 5-8 13-14 23-14 14 0 25 12 25 26 0 22-18 40-48 62z" fill="#F05A5A"/>')
  ];
  document.getElementById('stickers').innerHTML = stickers.map((s, i) => `<div class="stk" data-i="${i}">${s}</div>`).join('');

  // footer wordmark: fit to the row
  const wm = document.getElementById('wordmark'), wl = [...wm.children];
  const fit = () => { wm.style.fontSize = '18vw'; const need = wl.reduce((a, l) => a + l.getBoundingClientRect().width, 0);
    const room = wm.clientWidth; if (need > 0) wm.style.fontSize = (parseFloat(getComputedStyle(wm).fontSize) * room / need * .94).toFixed(1) + 'px'; };
  addEventListener('resize', fit); (document.fonts ? document.fonts.ready : Promise.resolve()).then(fit); fit();
  // soft wave: letters near the pointer rise, eased every frame, settling back when it leaves
  if (!reduce){
    let px = -1e4, on = false, raf = 0; const lift = wl.map(() => 0);
    const tick = () => { let moving = false;
      wl.forEach((l, i) => { const r = l.getBoundingClientRect(), d = Math.abs(px - (r.left + r.width / 2)) / r.width;
        const t = on ? -Math.max(0, 1 - d / 1.6) * r.height * .09 : 0; lift[i] += (t - lift[i]) * .12;
        if (Math.abs(t - lift[i]) > .1) moving = true; l.style.setProperty('--lift', lift[i].toFixed(2) + 'px'); });
      raf = moving || on ? requestAnimationFrame(tick) : 0; };
    wm.addEventListener('pointermove', e => { px = e.clientX; on = true; if (!raf) raf = requestAnimationFrame(tick); });
    wm.addEventListener('pointerleave', () => { on = false; if (!raf) raf = requestAnimationFrame(tick); });
  }
})();
