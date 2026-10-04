/* =====================================================================
   LA VICTORIA | app.js
   ---------------------------------------------------------------------
   Orden de ejecucion:
     1. Utilidades y detección de capacidades
     2. Piezas independientes de librerías (menú, FAQ, visor, formulario, chispas)
     3. Piezas con GSAP + ScrollTrigger + Lenis (si no cargan, la página sigue
        funcionando: el CSS muestra todo el contenido con la clase .no-gsap)
     4. Loader y arranque

   Cada animación comunica algo concreto:
     - Loader: la cortina metálica se levanta, igual que abre el taller.
     - Chispas: soldadura, el oficio del negocio. Reaccionan al cursor y a los clics.
     - Líneas de tiempo / galería: avance del proyecto a medida que haces scroll.
   ===================================================================== */
(() => {
    'use strict';

    /* ---------- 1. Utilidades ---------- */
    const doc = document.documentElement;
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
    const safe = (fn, label) => { try { fn(); } catch (err) { console.error('[La Victoria] ' + (label || fn.name), err); } };

    const WA_NUMBER = '526751124124';
    const waLink = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const hasGSAP = !!(window.gsap && window.ScrollTrigger);

    doc.classList.add('js-ready');
    if (!hasGSAP) doc.classList.add('no-gsap');
    if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

    let lenis = null;   // scroll suave
    let embers = null;  // controlador del canvas de chispas

    /* ---------- Imágenes: se muestran con fade al cargar ---------- */
    function initImages() {
        const SKEL = '.frame, .card__media, .work__img';
        $$('img').forEach((img) => {
            const done = () => {
                img.classList.add('is-loaded');
                const box = img.closest(SKEL);
                if (box) box.classList.add('is-loaded');
            };
            if (img.complete && img.naturalWidth) done();
            else {
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
            }
        });
    }

    /* ---------- Texto: separa palabras para las animaciones ---------- */
    function splitWords(el) {
        el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
        const walk = (node) => {
            Array.from(node.childNodes).forEach((child) => {
                if (child.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach((part) => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const w = document.createElement('span');
                        w.className = 'w';
                        w.setAttribute('aria-hidden', 'true');
                        const inner = document.createElement('span');
                        inner.textContent = part;
                        w.appendChild(inner);
                        frag.appendChild(w);
                    });
                    child.replaceWith(frag);
                } else if (child.nodeType === 1) walk(child);
            });
        };
        walk(el);
    }

    function wrapWords(el) {
        const words = el.textContent.trim().split(/\s+/);
        el.textContent = '';
        words.forEach((word, i) => {
            const s = document.createElement('span');
            s.className = 'mw';
            s.textContent = word;
            el.appendChild(s);
            if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
        });
    }

    function wrapChars(el) {
        const chars = Array.from(el.textContent.trim());
        el.textContent = '';
        chars.forEach((c) => {
            const s = document.createElement('span');
            s.className = 'ch';
            s.textContent = c === ' ' ? ' ' : c;
            el.appendChild(s);
        });
    }

    function prepareText() {
        $$('[data-split]').forEach(splitWords);
        const manifesto = $('[data-manifesto]');
        if (manifesto) wrapWords(manifesto);
        const giant = $('[data-giant]');
        if (giant) wrapChars(giant);
        // Estado inicial de las máscaras (se fija con GSAP para no mezclar % de CSS con yPercent)
        if (hasGSAP && !reduce) gsap.set('.w > span, [data-giant] .ch', { yPercent: 112 });
    }

    /* ---------- 2. Menú móvil ---------- */
    function initMenu() {
        const burger = $('#burger');
        const menu = $('#menu');
        if (!burger || !menu) return;
        let open = false;

        const set = (value) => {
            open = value;
            menu.classList.toggle('is-open', value);
            menu.inert = !value;
            burger.setAttribute('aria-expanded', String(value));
            burger.setAttribute('aria-label', value ? 'Cerrar menú' : 'Abrir menú');
            doc.classList.toggle('menu-open', value);
            if (lenis) value ? lenis.stop() : lenis.start();
        };

        burger.addEventListener('click', () => set(!open));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { set(false); burger.focus(); } });
        $$('[data-menu-link]', menu).forEach((a) => a.addEventListener('click', () => set(false)));
        matchMedia('(min-width: 900px)').addEventListener('change', (e) => { if (e.matches && open) set(false); });
    }

    /* ---------- Enlaces ancla con scroll suave ---------- */
    function initAnchors() {
        document.addEventListener('click', (e) => {
            const a = e.target.closest('a[href^="#"]');
            if (!a) return;
            const id = a.getAttribute('href');
            if (id.length < 2) return;
            const target = document.querySelector(id);
            if (!target) return;
            e.preventDefault();
            if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.5 });
            else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
            history.replaceState(null, '', id);
        });
    }

    /* ---------- Preguntas frecuentes ---------- */
    function initFaq() {
        const items = $$('.faq__item');
        items.forEach((item) => {
            const btn = $('.faq__q', item);
            btn.addEventListener('click', () => {
                const willOpen = !item.classList.contains('is-open');
                items.forEach((other) => {
                    other.classList.remove('is-open');
                    $('.faq__q', other).setAttribute('aria-expanded', 'false');
                });
                if (willOpen) {
                    item.classList.add('is-open');
                    btn.setAttribute('aria-expanded', 'true');
                }
                if (hasGSAP) setTimeout(() => ScrollTrigger.refresh(), 650);
            });
        });
    }

    /* ---------- Visor de fotos ---------- */
    function initLightbox() {
        const dlg = $('#lightbox');
        const triggers = $$('[data-lightbox]');
        if (!dlg || !triggers.length || typeof dlg.showModal !== 'function') return;
        const img = $('#lb-img');
        const cap = $('#lb-cap');
        let index = 0;

        const show = (i) => {
            index = (i + triggers.length) % triggers.length;
            const src = $('img', triggers[index]);
            img.src = src.currentSrc || src.src;
            img.alt = src.alt;
            cap.textContent = $('figcaption', triggers[index].closest('figure')).textContent;
        };

        triggers.forEach((btn, i) => btn.addEventListener('click', () => {
            show(i);
            dlg.showModal();
            if (lenis) lenis.stop();
        }));
        dlg.addEventListener('close', () => { if (lenis && !doc.classList.contains('menu-open')) lenis.start(); });
        $('[data-lb-close]', dlg).addEventListener('click', () => dlg.close());
        $('[data-lb-prev]', dlg).addEventListener('click', () => show(index - 1));
        $('[data-lb-next]', dlg).addEventListener('click', () => show(index + 1));
        dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
        dlg.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') show(index - 1);
            if (e.key === 'ArrowRight') show(index + 1);
        });

        let startX = null;
        dlg.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
        dlg.addEventListener('touchend', (e) => {
            if (startX === null) return;
            const dx = e.changedTouches[0].clientX - startX;
            if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
            startX = null;
        }, { passive: true });
    }

    /* ---------- Formulario: valida y abre WhatsApp ---------- */
    function initForm() {
        const form = $('#quote-form');
        if (!form) return;
        const btn = $('#f-submit');
        const label = $('.btn__label', btn);
        const status = $('#f-status');
        const LABEL = label.textContent;

        const setError = (inputId, message) => {
            const input = $('#' + inputId);
            const err = $('#' + inputId + '-err');
            const field = input.closest('.field');
            field.classList.toggle('has-error', !!message);
            input.setAttribute('aria-invalid', message ? 'true' : 'false');
            err.textContent = message;
        };

        ['f-name', 'f-need'].forEach((id) => {
            const input = $('#' + id);
            input.addEventListener('input', () => setError(id, ''));
            input.addEventListener('change', () => setError(id, ''));
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = $('#f-name').value.trim();
            const need = $('#f-need').value;
            const msg = $('#f-msg').value.trim();
            status.textContent = '';

            setError('f-name', name.length < 2 ? 'Escribe tu nombre para saber con quién hablamos.' : '');
            setError('f-need', need ? '' : 'Elige qué quieres cotizar.');
            const firstBad = $('.has-error input, .has-error select', form);
            if (firstBad) { firstBad.focus(); return; }

            let text = `Hola, soy ${name}. Quiero cotizar: ${need}.`;
            if (msg) text += `\n\nDetalles: ${msg}`;
            text += '\n\n¿Me pueden ayudar con una cotización?';
            const url = waLink(text);

            btn.disabled = true;
            btn.classList.add('is-loading');
            label.textContent = 'Abriendo WhatsApp';

            const win = window.open(url, '_blank');
            if (win) win.opener = null;

            setTimeout(() => {
                btn.disabled = false;
                btn.classList.remove('is-loading');
                label.textContent = LABEL;
                if (win) {
                    status.textContent = 'Listo. Se abrió WhatsApp con tu mensaje.';
                    form.reset();
                } else {
                    status.innerHTML = 'Tu navegador bloqueó la ventana. <a href="' + url + '" target="_blank" rel="noopener">Abrir WhatsApp</a>';
                }
            }, 900);
        });
    }

    /* ---------- Chispas de soldadura (canvas) ---------- */
    function initEmbers() {
        const cv = $('#embers');
        if (!cv) return null;
        if (reduce) { cv.remove(); return null; }

        const ctx = cv.getContext('2d');
        let W = 0, H = 0;
        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            W = window.innerWidth;
            H = window.innerHeight;
            cv.width = Math.round(W * dpr);
            cv.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        window.addEventListener('resize', debounce(resize, 150));

        // Paleta de calor: blanco-amarillo (recién nacida) a naranja oscuro (se apaga)
        const PALETTE = Array.from({ length: 24 }, (_, i) => {
            const t = i / 23;
            return `rgb(255,${Math.round(88 + 150 * Math.pow(t, 1.3))},${Math.round(34 + 120 * Math.pow(t, 2.4))})`;
        });

        const MAX = W < 768 ? 80 : 170;
        const GRAVITY = 560;
        const sparks = [];
        let level = 1, targetLevel = 1;
        let emberAcc = 0, burstTimer = 1.2;

        const burst = (x, y, n, { spread = 2.2, speed = 380 } = {}) => {
            for (let i = 0; i < n && sparks.length < MAX; i++) {
                const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread;
                const v = speed * (0.35 + Math.random() * 0.9);
                sparks.push({
                    x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
                    life: 0, max: 0.6 + Math.random() * 0.9, size: 0.8 + Math.random() * 1.5, ember: false
                });
            }
        };
        const ember = () => {
            if (sparks.length >= MAX) return;
            sparks.push({
                x: Math.random() * W, y: H + 12, vx: (Math.random() - 0.5) * 26, vy: -(26 + Math.random() * 60),
                life: 0, max: 4 + Math.random() * 4, size: 0.8 + Math.random() * 1.7, ember: true
            });
        };

        const stackRect = () => { const s = $('[data-stack]'); return s ? s.getBoundingClientRect() : null; };

        const update = (dt) => {
            level += (targetLevel - level) * Math.min(1, dt * 3);

            emberAcc += dt * (2 + 9 * level);
            while (emberAcc >= 1) { ember(); emberAcc -= 1; }

            burstTimer -= dt;
            if (burstTimer <= 0) {
                burstTimer = 1.1 + Math.random() * 1.8;
                const r = stackRect();
                if (level > 0.5 && r && r.bottom > 0 && r.top < H) {
                    burst(r.left + r.width * (0.15 + Math.random() * 0.75), r.top + r.height * (0.55 + Math.random() * 0.4),
                        12 + Math.floor(Math.random() * 14), { spread: 2, speed: 430 });
                }
            }

            for (let i = sparks.length - 1; i >= 0; i--) {
                const s = sparks[i];
                s.life += dt;
                if (s.life >= s.max) { sparks.splice(i, 1); continue; }
                if (s.ember) {
                    s.x += s.vx * dt + Math.sin(s.life * 2 + s.max) * 0.25;
                    s.y += s.vy * dt;
                } else {
                    s.vy += GRAVITY * dt;
                    s.vx *= 1 - 0.9 * dt;
                    s.x += s.vx * dt;
                    s.y += s.vy * dt;
                }
            }
        };

        const draw = () => {
            ctx.clearRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'lighter';
            ctx.lineCap = 'round';
            for (const s of sparks) {
                const k = 1 - s.life / s.max;
                const color = PALETTE[Math.max(0, Math.min(23, Math.floor(k * 23)))];
                if (s.ember) {
                    const a = Math.min(1, k * 1.6) * (0.55 + 0.45 * Math.sin(s.life * 6 + s.max));
                    ctx.globalAlpha = a * 0.22 * (0.25 + level * 0.75);
                    ctx.fillStyle = color;
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.size * 3.4, 0, 6.2832); ctx.fill();
                    ctx.globalAlpha = a * (0.3 + level * 0.7);
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, 6.2832); ctx.fill();
                } else {
                    ctx.globalAlpha = Math.min(1, k * 1.8);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = s.size;
                    ctx.beginPath();
                    ctx.moveTo(s.x - s.vx * 0.038, s.y - s.vy * 0.038);
                    ctx.lineTo(s.x, s.y);
                    ctx.stroke();
                }
            }
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        };

        let last = performance.now();
        const loop = (now) => {
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            if (!document.hidden) { update(dt); draw(); }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);

        // Chispas que siguen al cursor dentro del hero (como un esmeril)
        const hero = $('.hero');
        if (hero && finePointer) {
            let lx = 0, ly = 0;
            hero.addEventListener('pointermove', (e) => {
                const d = Math.hypot(e.clientX - lx, e.clientY - ly);
                if (d > 22) { burst(e.clientX, e.clientY, 2, { spread: 3.4, speed: 190 }); lx = e.clientX; ly = e.clientY; }
            }, { passive: true });
        }
        // Explosión al presionar un botón principal (retroalimentación del clic)
        document.addEventListener('click', (e) => {
            const el = e.target.closest('.btn--primary, .fab, .card__go');
            if (!el) return;
            const r = el.getBoundingClientRect();
            burst(r.left + r.width / 2, r.top + r.height / 2, 26, { spread: 6.28, speed: 330 });
        });

        return { setLevel: (v) => { targetLevel = v; } };
    }

    /* ---------- 3. Scroll suave + animaciones (GSAP) ---------- */
    function initSmoothScroll() {
        if (reduce || !window.Lenis) return;
        lenis = new Lenis({
            duration: 1.15,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            wheelMultiplier: 0.9
        });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
        lenis.stop(); // se libera cuando termina el loader
    }

    function initScrollFx() {
        const nav = $('#nav');
        const progress = $('#progress');

        // Barra de progreso + estado de la navegación
        ScrollTrigger.create({
            start: 0, end: 'max',
            onUpdate: (self) => {
                progress.style.transform = `scaleX(${self.progress})`;
                const hide = self.direction === 1 && self.scroll() > 700 && !doc.classList.contains('menu-open');
                nav.classList.toggle('is-hidden', hide);
            }
        });
        ScrollTrigger.create({ start: 'top -24', end: 'max', toggleClass: { targets: nav, className: 'is-scrolled' } });

        // Línea de tiempo del proceso: avanza con el scroll y enciende cada paso
        const steps = $('[data-steps]');
        if (steps) {
            const items = $$('.step', steps);
            ScrollTrigger.create({
                trigger: steps, start: 'top 78%', end: 'bottom 52%',
                onUpdate: (self) => {
                    steps.style.setProperty('--p', self.progress.toFixed(3));
                    items.forEach((s, i) => s.classList.toggle('is-active', self.progress >= i / items.length + 0.02));
                }
            });
        }

        if (reduce) return;

        // Títulos: las palabras suben desde una máscara
        $$('[data-split]').forEach((el) => {
            if (el.closest('.hero')) return;
            const words = $$('.w > span', el);
            ScrollTrigger.create({
                trigger: el, start: 'top 88%', once: true,
                onEnter: () => gsap.fromTo(words, { yPercent: 112 }, { yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: 0.055 })
            });
        });

        // Elementos sueltos que entran al hacer scroll
        ScrollTrigger.batch('[data-reveal]', {
            start: 'top 90%', once: true,
            onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.09, overwrite: true })
        });

        // Manifiesto: cada palabra se enciende al avanzar la lectura
        const words = $$('.mw');
        if (words.length) {
            gsap.fromTo(words, { opacity: 0.16 }, {
                opacity: 1, ease: 'none', stagger: 0.12,
                scrollTrigger: { trigger: '.manifesto__text', start: 'top 82%', end: 'bottom 52%', scrub: true }
            });
        }

        // Hero: al salir, el texto se aleja y la pila de fotos se desplaza más despacio
        gsap.to('.hero__copy', {
            yPercent: -10, opacity: 0.2, ease: 'none',
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 20%', scrub: true }
        });
        gsap.to('[data-stack]', {
            yPercent: -6, ease: 'none',
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
        });
        // Intensidad de las chispas: máxima en el hero, tenue en el resto
        ScrollTrigger.create({
            trigger: '.hero', start: 'top top', end: 'bottom 40%',
            onToggle: (self) => { if (embers) embers.setLevel(self.isActive ? 1 : 0.2); }
        });

        // Marquesina: acelera e inclina según la velocidad del scroll
        const track = $('[data-marquee]');
        if (track) {
            const anim = track.getAnimations ? track.getAnimations()[0] : null;
            const setSkew = gsap.quickTo(track, 'skewX', { duration: 0.6, ease: 'power3' });
            ScrollTrigger.create({
                start: 0, end: 'max',
                onUpdate: (self) => {
                    const v = self.getVelocity();
                    setSkew(clamp(-v / 260, -9, 9));
                    if (anim) anim.playbackRate = 1 + clamp(Math.abs(v) / 350, 0, 6);
                }
            });
            ScrollTrigger.addEventListener('scrollEnd', () => {
                setSkew(0);
                if (anim) gsap.to(anim, { playbackRate: 1, duration: 0.9, ease: 'power2.out', overwrite: true });
            });
        }

        // Servicios: revelado con máscara + parallax de la foto + luz que sigue al cursor
        $$('[data-card]').forEach((card) => {
            ScrollTrigger.create({
                trigger: card, start: 'top 90%', once: true,
                onEnter: () => gsap.fromTo(card,
                    { clipPath: 'inset(100% 0% 0% 0% round 10px)', y: 48 },
                    { clipPath: 'inset(0% 0% 0% 0% round 10px)', y: 0, duration: 1.3, ease: 'expo.out' })
            });
            const px = $('.px', card);
            if (px) {
                gsap.fromTo(px, { yPercent: -5 }, {
                    yPercent: 5, ease: 'none',
                    scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true }
                });
            }
            if (finePointer) {
                card.addEventListener('pointermove', (e) => {
                    const r = card.getBoundingClientRect();
                    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
                    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
                }, { passive: true });
            }
        });

        // Trabajos: en escritorio la sección se ancla y la galería avanza en horizontal
        const works = $('.works');
        const viewport = $('[data-works-viewport]');
        const wTrack = $('[data-works-track]');
        const meter = $('[data-works-meter]');
        if (works && viewport && wTrack) {
            viewport.addEventListener('scroll', () => {
                const max = viewport.scrollWidth - viewport.clientWidth;
                if (meter && max > 0) meter.style.transform = `scaleX(${viewport.scrollLeft / max})`;
            }, { passive: true });

            gsap.matchMedia().add('(min-width: 1024px) and (hover: hover)', () => {
                works.classList.add('is-pinned');
                const pad = () => parseFloat(getComputedStyle(viewport).paddingLeft) || 0;
                const dist = () => Math.max(0, wTrack.offsetWidth + pad() * 2 - viewport.clientWidth);

                const tween = gsap.to(wTrack, {
                    x: () => -dist(), ease: 'none',
                    scrollTrigger: {
                        trigger: $('[data-works-pin]'), start: 'top top', end: () => '+=' + dist(),
                        pin: true, scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true,
                        onUpdate: (self) => { if (meter) meter.style.transform = `scaleX(${self.progress})`; }
                    }
                });
                $$('.work__img img', wTrack).forEach((img) => {
                    gsap.fromTo(img, { xPercent: -5 }, {
                        xPercent: 5, ease: 'none',
                        scrollTrigger: { trigger: img.closest('.work'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true }
                    });
                });
                // Teclado: al enfocar una foto fuera de pantalla, el scroll avanza hasta ella
                const onFocus = (e) => {
                    const item = e.target.closest('.work');
                    if (!item) return;
                    const st = tween.scrollTrigger;
                    const ratio = clamp((item.offsetLeft - pad()) / (dist() || 1), 0, 1);
                    const y = st.start + ratio * (st.end - st.start);
                    if (lenis) lenis.scrollTo(y, { duration: 0.9 }); else window.scrollTo(0, y);
                };
                wTrack.addEventListener('focusin', onFocus);
                return () => {
                    wTrack.removeEventListener('focusin', onFocus);
                    works.classList.remove('is-pinned');
                };
            });
        }

        // Pie: el nombre gigante sube letra por letra
        const giant = $$('[data-giant] .ch');
        if (giant.length) {
            ScrollTrigger.create({
                trigger: '.footer', start: 'top 80%', once: true,
                onEnter: () => gsap.fromTo(giant, { yPercent: 105 }, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.05 })
            });
        }

        // Botones principales: leve atracción hacia el cursor
        if (finePointer) {
            $$('[data-magnetic]').forEach((btn) => {
                const qx = gsap.quickTo(btn, 'x', { duration: 0.6, ease: 'power3' });
                const qy = gsap.quickTo(btn, 'y', { duration: 0.6, ease: 'power3' });
                btn.addEventListener('pointermove', (e) => {
                    const r = btn.getBoundingClientRect();
                    qx((e.clientX - r.left - r.width / 2) * 0.28);
                    qy((e.clientY - r.top - r.height / 2) * 0.4);
                });
                btn.addEventListener('pointerleave', () => { qx(0); qy(0); });
            });
        }
    }

    // Sin GSAP: solo marca la navegación al hacer scroll
    function initFallbackNav() {
        const nav = $('#nav');
        const sentinel = document.createElement('div');
        sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:24px;pointer-events:none';
        document.body.prepend(sentinel);
        new IntersectionObserver(([entry]) => nav.classList.toggle('is-scrolled', !entry.isIntersecting)).observe(sentinel);
    }

    /* ---------- Hero ---------- */
    function playHero() {
        const words = $$('.hero__title .w > span');
        const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: initHeroPointer });
        tl.fromTo('.hero .eyebrow', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1 }, 0)
          .fromTo(words, { yPercent: 112 }, { yPercent: 0, duration: 1.25, stagger: 0.07 }, 0.12)
          .fromTo('.hero__sub', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1 }, 0.5)
          .fromTo('.hero__cta', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1 }, 0.62)
          .fromTo('.frame', { opacity: 0, yPercent: 16, scale: 0.9, rotate: (i) => [-4, 3, -3][i] || 0 },
                  { opacity: 1, yPercent: 0, scale: 1, rotate: 0, duration: 1.5, stagger: 0.14 }, 0.25)
          .fromTo('.dim__line', { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: 'power3.inOut' }, 1.1)
          .fromTo('.dim__label', { opacity: 0 }, { opacity: 1, duration: 0.6 }, 1.5);
    }

    // Inclinación 3D y profundidad de las fotos según el cursor
    function initHeroPointer() {
        if (!finePointer || reduce) return;
        const hero = $('.hero');
        const stack = $('[data-stack]');
        const frames = $$('.frame', stack);
        gsap.set(stack, { transformPerspective: 1100 });
        const rx = gsap.quickTo(stack, 'rotationX', { duration: 0.9, ease: 'power3' });
        const ry = gsap.quickTo(stack, 'rotationY', { duration: 0.9, ease: 'power3' });
        const fx = frames.map((f) => gsap.quickTo(f, 'x', { duration: 1, ease: 'power3' }));
        const fy = frames.map((f) => gsap.quickTo(f, 'y', { duration: 1, ease: 'power3' }));

        hero.addEventListener('pointermove', (e) => {
            const r = hero.getBoundingClientRect();
            const nx = (e.clientX - r.left) / r.width - 0.5;
            const ny = (e.clientY - r.top) / r.height - 0.5;
            ry(nx * 10);
            rx(-ny * 8);
            frames.forEach((f, i) => {
                const depth = parseFloat(f.dataset.depth) || 1;
                fx[i](nx * 26 * depth);
                fy[i](ny * 18 * depth);
            });
        });
        hero.addEventListener('pointerleave', () => {
            rx(0); ry(0);
            fx.forEach((q) => q(0));
            fy.forEach((q) => q(0));
        });
    }

    /* ---------- 4. Loader y arranque ---------- */
    function onLoaderDone() {
        doc.classList.remove('is-loading');
        if (lenis) lenis.start();
        if (hasGSAP) {
            playHero();
            gsap.fromTo('#fab', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1, delay: 0.9, ease: 'expo.out' });
            ScrollTrigger.refresh();
        }
    }

    function initLoader() {
        const loader = $('#loader');
        if (!loader) { onLoaderDone(); return; }
        const pctEl = $('#loader-pct');
        const slats = $('.loader__slats', loader);
        const count = Math.ceil(window.innerHeight / 52);
        for (let i = 0; i < count; i++) slats.appendChild(document.createElement('i'));
        doc.classList.add('is-loading');

        const MIN = reduce ? 0 : 2300;   // tiempo mínimo para que se aprecie la animación
        const MAX = 7000;                // límite de seguridad
        const t0 = performance.now();
        let pageLoaded = document.readyState === 'complete';
        if (!pageLoaded) window.addEventListener('load', () => { pageLoaded = true; }, { once: true });
        let fontsReady = false;
        (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { fontsReady = true; });

        let shown = 0;
        const leave = () => {
            pctEl.textContent = '100';
            loader.classList.add('is-leaving');
            setTimeout(() => {
                loader.classList.add('is-done');
                onLoaderDone();
                setTimeout(() => loader.remove(), reduce ? 60 : 1500);
            }, reduce ? 0 : 380);
        };
        const frame = (now) => {
            const t = now - t0;
            const ready = (pageLoaded && fontsReady && t >= MIN) || t >= MAX;
            const timeP = Math.min(t / (MIN || 1), 1);
            const target = ready ? 100 : 92 * (1 - Math.pow(1 - timeP, 3));
            shown += (target - shown) * (ready ? 0.22 : 0.12);
            pctEl.textContent = String(Math.min(100, Math.round(shown)));
            if (ready && shown > 99.4) { leave(); return; }
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }

    /* ---------- Arranque ---------- */
    safe(initImages, 'imágenes');
    safe(prepareText, 'texto');
    safe(initMenu, 'menú');
    safe(initAnchors, 'anclas');
    safe(initFaq, 'faq');
    safe(initLightbox, 'visor');
    safe(initForm, 'formulario');
    embers = null;
    safe(() => { embers = initEmbers(); }, 'chispas');
    if (hasGSAP) {
        safe(initSmoothScroll, 'scroll suave');
        safe(initScrollFx, 'scroll fx');
        window.addEventListener('load', () => ScrollTrigger.refresh());
        if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
    } else {
        safe(initFallbackNav, 'nav');
    }
    safe(initLoader, 'loader');
})();
