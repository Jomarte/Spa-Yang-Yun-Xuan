/* ============================================================
   YANG YUN XUAN SPA — App JavaScript
   Canvas image-sequence scrubbing + interactions
   ============================================================ */

(function () {
  'use strict';

  // ---- CONFIG ----
  const TOTAL_FRAMES = 240;
  const FRAME_PATH = 'frames/ezgif-frame-';
  const HERO_APPEAR_FRAME = 200; // hero fades in around this frame
  const BATCH_SIZE = 10;

  // ---- DOM REFS ----
  const canvas = document.getElementById('revealCanvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const revealSection = document.getElementById('revealSection');
  const heroContent = document.getElementById('heroContent');
  const skipBtn = document.getElementById('skipBtn');
  const navbar = document.getElementById('navbar');
  const navBrand = document.querySelector('.nav-brand');
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  const navOverlay = document.getElementById('navOverlay');

  // ---- STATE ----
  const frames = new Array(TOTAL_FRAMES);
  let currentFrame = 0;
  let loadedCount = 0;
  let animationSkipped = false;
  let revealSectionEnd = 0;

  // ---- REDUCED MOTION CHECK ----
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    if (skipBtn) skipBtn.classList.add('hidden');
    // Static hero is shown via CSS; reveal section is hidden
    init_NO_animation();
    return;
  }

  // ---- FRAME LOADING ----
  function frameSrc(index) {
    // frames are 1-indexed: ezgif-frame-001.png ... ezgif-frame-240.png
    const num = String(index + 1).padStart(3, '0');
    return FRAME_PATH + num + '.png';
  }

  function loadFrame(index) {
    return new Promise(function (resolve) {
      if (frames[index]) { resolve(); return; }
      const img = new Image();
      img.onload = function () {
        frames[index] = img;
        loadedCount++;
        resolve();
      };
      img.onerror = function () { resolve(); };
      img.src = frameSrc(index);
    });
  }

  // Preload first frame + last few frames immediately
  async function preloadCritical() {
    await loadFrame(0);
    drawFrame(0);
    // Also preload key frames
    await Promise.all([
      loadFrame(Math.floor(TOTAL_FRAMES / 2)),
      loadFrame(TOTAL_FRAMES - 1),
      loadFrame(HERO_APPEAR_FRAME)
    ]);
  }

  // Lazy-load rest of frames in batches during idle
  function lazyLoadFrames() {
    let i = 0;
    function loadBatch() {
      const promises = [];
      for (let j = 0; j < BATCH_SIZE && i < TOTAL_FRAMES; j++, i++) {
        if (!frames[i]) {
          promises.push(loadFrame(i));
        }
      }
      if (promises.length > 0) {
        Promise.all(promises).then(function () {
          if (i < TOTAL_FRAMES) {
            if ('requestIdleCallback' in window) {
              requestIdleCallback(loadBatch);
            } else {
              setTimeout(loadBatch, 16);
            }
          }
        });
      } else if (i < TOTAL_FRAMES) {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(loadBatch);
        } else {
          setTimeout(loadBatch, 16);
        }
      }
    }
    if ('requestIdleCallback' in window) {
      requestIdleCallback(loadBatch);
    } else {
      setTimeout(loadBatch, 100);
    }
  }

  // ---- CANVAS DRAWING ----
  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawFrame(currentFrame);
  }

  function drawFrame(index) {
    if (!ctx || !frames[index]) return;
    const img = frames[index];
    const cw = canvas.width;
    const ch = canvas.height;
    // Cover fit
    const scale = Math.max(cw / img.width, ch / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (cw - w) / 2;
    const y = (ch - h) / 2;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, x, y, w, h);
  }

  // ---- SCROLL SCRUBBING ----
  let ticking = false;

  function onScroll() {
    if (animationSkipped) return;
    if (!ticking) {
      requestAnimationFrame(updateAnimation);
      ticking = true;
    }
  }

  function updateAnimation() {
    ticking = false;
    if (!revealSection) return;

    const rect = revealSection.getBoundingClientRect();
    const sectionHeight = revealSection.offsetHeight - window.innerHeight;
    const scrolled = -rect.top;
    const progress = Math.min(Math.max(scrolled / sectionHeight, 0), 1);
    const frameIndex = Math.min(Math.floor(progress * (TOTAL_FRAMES - 1)), TOTAL_FRAMES - 1);

    if (frameIndex !== currentFrame && frames[frameIndex]) {
      currentFrame = frameIndex;
      drawFrame(currentFrame);
    }

    // Show hero content near end
    if (heroContent) {
      if (currentFrame >= HERO_APPEAR_FRAME) {
        heroContent.classList.add('visible');
      } else {
        heroContent.classList.remove('visible');
      }
    }

    // Skip button visibility
    if (skipBtn) {
      if (progress >= 0.95 || scrolled < 0) {
        skipBtn.classList.add('hidden');
      } else {
        skipBtn.classList.remove('hidden');
      }
    }

    // Track scroll depth
    trackScrollDepth(progress);
  }

  // ---- SKIP ANIMATION ----
  function skipAnimation() {
    animationSkipped = true;
    if (skipBtn) skipBtn.classList.add('hidden');

    // Draw last frame before jumping
    if (frames[TOTAL_FRAMES - 1]) {
      currentFrame = TOTAL_FRAMES - 1;
      drawFrame(currentFrame);
    }

    // Show hero content
    if (heroContent) heroContent.classList.add('visible');

    // Jump instantly to end of reveal section — using the two-argument form
    // to guarantee instant scroll (no smooth conflict with user scroll)
    revealSectionEnd = revealSection
      ? revealSection.offsetTop + revealSection.offsetHeight - window.innerHeight
      : 0;
    window.scrollTo(0, revealSectionEnd);
  }

  // ---- RESET ANIMATION (click on brand logo) ----
  function resetAnimation() {
    // Only act when the brand links to the same page (index.html)
    if (!revealSection) return;

    animationSkipped = false;
    currentFrame = 0;

    // Jump instantly to top
    window.scrollTo(0, 0);

    // Reset canvas to first frame
    drawFrame(0);

    // Hide hero content and show skip button again
    if (heroContent) heroContent.classList.remove('visible');
    if (skipBtn) skipBtn.classList.remove('hidden');
  }

  // ---- NAVBAR ----
  function updateNavbar() {
    if (!navbar) return;
    const scrollY = window.scrollY;
    const threshold = revealSection ? revealSection.offsetHeight * 0.6 : 300;
    if (scrollY > threshold) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }

  // ---- MOBILE MENU ----
  function toggleMobileMenu() {
    if (!navToggle || !navLinks || !navOverlay) return;
    const isOpen = navLinks.classList.contains('open');
    navLinks.classList.toggle('open');
    navOverlay.classList.toggle('active');
    navToggle.classList.toggle('active');
    navToggle.setAttribute('aria-expanded', String(!isOpen));
  }

  function closeMobileMenu() {
    if (!navLinks) return;
    navLinks.classList.remove('open');
    if (navOverlay) navOverlay.classList.remove('active');
    if (navToggle) {
      navToggle.classList.remove('active');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  }

  // ---- INTERSECTION OBSERVER (fade-in) ----
  function initFadeIn() {
    const elements = document.querySelectorAll('.fade-in');
    if (!elements.length) return;

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    elements.forEach(function (el) { observer.observe(el); });
  }

  // ---- FAQ ACCORDION ----
  function initFAQ() {
    const questions = document.querySelectorAll('.faq-question');
    questions.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const item = btn.closest('.faq-item');
        const isOpen = item.classList.contains('open');

        // Close all others
        document.querySelectorAll('.faq-item.open').forEach(function (openItem) {
          openItem.classList.remove('open');
          openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        });

        if (!isOpen) {
          item.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  // ---- PRESSURE SELECTOR ----
  function initPressure() {
    document.querySelectorAll('.pressure-options').forEach(function (group) {
      group.querySelectorAll('.pressure-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          group.querySelectorAll('.pressure-btn').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          trackEvent('service_select', { pressure: btn.dataset.pressure });
        });
      });
    });
  }

  // ---- SMOOTH SCROLL ----
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        const targetId = link.getAttribute('href');
        if (targetId === '#') return;
        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          closeMobileMenu();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // ---- ANALYTICS (placeholder) ----
  let lastDepth = 0;
  function trackScrollDepth(progress) {
    const depth = Math.floor(progress * 100 / 25) * 25;
    if (depth > lastDepth && depth <= 100) {
      lastDepth = depth;
      trackEvent('scroll_depth', { depth: depth + '%' });
    }
  }

  function trackEvent(eventName, params) {
    // GA4 dataLayer push (placeholder)
    if (typeof window.dataLayer !== 'undefined') {
      window.dataLayer.push({ event: eventName, ...params });
    }
  }

  // CTA tracking
  function initCTATracking() {
    document.querySelectorAll('[data-event]').forEach(function (el) {
      el.addEventListener('click', function () {
        trackEvent(el.dataset.event);
      });
    });
  }

  // ---- TREATMENTS CAROUSEL ----
  // Treatment data — edit here to update names, descriptions and WhatsApp links
  var TC_DATA = [
    { num:'01', cat:'Reflexologia',           t1:'REFLEXOLOGIA', t2:'PODAL',
      desc:'Pressão precisa em pontos reflexos plantares que espelham os órgãos do corpo. Uma conversa silenciosa entre as mãos do terapeuta e a fisiologia profunda do ser.',
      dur:'A CONFIRMAR', intensity:'Suave · Média · Forte', wa:'Reflexologia+Podal',       bg:'tc-bg--01', anchor:'reflexologia' },
    { num:'02', cat:'Alívio Muscular',         t1:'COSTAS',       t2:'& OMBROS',
      desc:'Foco cirúrgico nas áreas de maior tensão postural — pescoço, ombros e coluna dorsal. Acupressão e amassamento profundo para libertar o que o dia acumulou.',
      dur:'A CONFIRMAR', intensity:'Suave · Média · Forte', wa:'Massagem+Costas+e+Ombros', bg:'tc-bg--02', anchor:'massagem-terapeutica' },
    { num:'03', cat:'Bem-Estar Total',         t1:'CORPO',        t2:'INTEIRO',
      desc:'Percurso completo pelos meridianos do corpo — do crânio aos pés. Circulação ativada, energia reequilibrada, mente libertada do ruído do quotidiano.',
      dur:'A CONFIRMAR', intensity:'Suave · Média · Forte', wa:'Massagem+Corpo+Inteiro',   bg:'tc-bg--03', anchor:'massagem-relaxante' },
    { num:'04', cat:'Manipulação Terapêutica', t1:'TUI-NA',       t2:'推拿',
      desc:'A técnica mais sofisticada da MTC. Pressão profunda nos meridianos, mobilização articular e trabalho miofascial. Não é conforto — é medicina aplicada.',
      dur:'A CONFIRMAR', intensity:'Média · Forte',         wa:'Tui-Na',                   bg:'tc-bg--04', anchor:'tui-na' },
    { num:'05', cat:'Desintoxicação',          t1:'GUA SHA',      t2:'& VENTOSAS',
      desc:'Raspagem suave e sucção terapêutica que movimentam o sangue estagnado, libertam tensão muscular e estimulam o sistema linfático em profundidade.',
      dur:'A CONFIRMAR', intensity:'Média · Forte',         wa:'Gua+Sha+e+Ventosas',       bg:'tc-bg--05', anchor:'gua-sha' },
    { num:'06', cat:'Calor Terapêutico',       t1:'PEDRAS',       t2:'QUENTES',
      desc:'Pedras vulcânicas basálticas aquecidas a temperatura precisa, colocadas em pontos de acumulação energética. O calor atinge camadas de tensão inacessíveis às mãos.',
      dur:'A CONFIRMAR', intensity:'Suave · Média',         wa:'Pedras+Quentes',            bg:'tc-bg--06', anchor:'pedras-quentes' }
  ];

  function initTreatmentsCarousel() {
    var section   = document.querySelector('.treatments-carousel-section');
    if (!section) return;

    var bgsEl     = document.getElementById('tcBackgrounds');
    var counterEl = document.getElementById('tcCounter');
    var catEl     = document.getElementById('tcInfoCat');
    var titleEl   = document.getElementById('tcInfoTitle');
    var descEl    = document.getElementById('tcInfoDesc');
    var metaEl    = document.getElementById('tcInfoMeta');
    var actionsEl = section.querySelector('.tc-actions');
    var detailLinkEl = document.getElementById('tcDetailLink');
    var thumbsEl  = document.getElementById('tcThumbs');
    var prevBtn   = document.getElementById('tcPrev');
    var nextBtn   = document.getElementById('tcNext');

    if (!bgsEl || !thumbsEl) return;

    var total     = TC_DATA.length;
    var activeIdx = 0;
    var isLocked  = false;

    // Collect background elements (already in HTML)
    var bgs = Array.from(bgsEl.querySelectorAll('.tc-bg'));

    // Elements whose opacity/transform JS controls
    var infoEls = [catEl, titleEl, descEl, metaEl, actionsEl];

    // ---- Build 3 thumbnail cards (next 3 after active) ----
    function buildThumbs(idx) {
      thumbsEl.innerHTML = '';
      var shown = 0;
      for (var offset = 1; offset <= total - 1 && shown < 3; offset++) {
        var i = (idx + offset) % total;
        var t = TC_DATA[i];

        var el = document.createElement('div');
        el.className = 'tc-thumb';
        el.setAttribute('role', 'listitem');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', t.t1 + ' ' + t.t2);
        el.dataset.idx = i;

        el.innerHTML =
          '<div class="tc-thumb__bg ' + t.bg + '"></div>' +
          '<div class="tc-thumb__overlay"></div>' +
          '<div class="tc-thumb__content">' +
            '<span class="tc-thumb__num">' + t.num + '</span>' +
            '<h4 class="tc-thumb__title">' + t.t1 + '<br>' + t.t2 + '</h4>' +
          '</div>';

        (function(idx) {
          el.addEventListener('click',   function() { goTo(idx); });
          el.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goTo(idx); }
          });
        })(i);

        thumbsEl.appendChild(el);
        shown++;
      }
    }

    // ---- Update main text content ----
    function setContent(idx) {
      var t = TC_DATA[idx];
      counterEl.textContent = t.num + ' / 0' + total;
      catEl.textContent  = t.cat;
      titleEl.innerHTML  = t.t1 + '<br>' + t.t2;
      descEl.textContent = t.desc;
      metaEl.innerHTML =
        '<span class="tc-meta-item">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' +
          t.dur + '</span>' +
        '<span class="tc-meta-item tc-meta-int">' + t.intensity + '</span>';
      if (detailLinkEl) {
        detailLinkEl.href = 'tratamentos.html#' + t.anchor;
        detailLinkEl.setAttribute('aria-label', 'Informações e marcações — ' + t.t1 + ' ' + t.t2);
      }
    }

    // ---- Animate content children in (staggered) ----
    function animateIn() {
      infoEls.forEach(function(el, i) {
        if (!el) return;
        // Reset without transition
        el.style.transition = 'none';
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(14px)';
        // Stagger each element
        setTimeout(function() {
          el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
          el.style.opacity    = '1';
          el.style.transform  = 'translateY(0)';
        }, i * 80 + 10);
      });
    }

    // ---- Activate a card ----
    function activateCard(newIdx, animate) {
      // Switch background
      bgs.forEach(function(bg, i) {
        bg.classList.toggle('active', i === newIdx);
      });

      if (animate && !prefersReducedMotion) {
        // Fade out current content
        infoEls.forEach(function(el) {
          if (!el) return;
          el.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
          el.style.opacity    = '0';
          el.style.transform  = 'translateY(8px)';
        });
        setTimeout(function() {
          setContent(newIdx);
          buildThumbs(newIdx);
          animateIn();
          activeIdx = newIdx;
          isLocked  = false;
        }, 220);
      } else {
        setContent(newIdx);
        buildThumbs(newIdx);
        // Show immediately
        infoEls.forEach(function(el) {
          if (!el) return;
          el.style.transition = 'none';
          el.style.opacity    = '1';
          el.style.transform  = 'translateY(0)';
        });
        activeIdx = newIdx;
      }
    }

    // ---- Navigate ----
    function goTo(newIdx) {
      if (isLocked) return;
      isLocked = true;
      activateCard(((newIdx % total) + total) % total, true);
      setTimeout(function() { isLocked = false; }, 950);
    }

    function next() { goTo(activeIdx + 1); }
    function prev() { goTo(activeIdx - 1); }

    if (prevBtn) prevBtn.addEventListener('click', prev);
    if (nextBtn) nextBtn.addEventListener('click', next);

    // Keyboard navigation
    section.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
    });

    // Touch swipe
    var txStart = 0;
    var swiping = false;

    section.addEventListener('touchstart', function(e) {
      txStart = e.touches[0].clientX; swiping = false;
    }, { passive: true });

    section.addEventListener('touchmove', function(e) {
      if (Math.abs(e.touches[0].clientX - txStart) > 8) swiping = true;
    }, { passive: true });

    section.addEventListener('touchend', function(e) {
      if (!swiping) return;
      var dx = e.changedTouches[0].clientX - txStart;
      if (Math.abs(dx) > 48) { dx < 0 ? next() : prev(); }
      swiping = false;
    }, { passive: true });

    // ---- Init: show first card then animate in ----
    activateCard(0, false);
    if (!prefersReducedMotion) {
      // Brief delay so page is painted before animating
      setTimeout(animateIn, 350);
    }
  }

    // ---- NO-ANIMATION INIT ----
  function init_NO_animation() {
    initFadeIn();
    initFAQ();
    initPressure();
    initSmoothScroll();
    initCTATracking();
    initTreatmentsCarousel();
    initTreatNav();
    // Show navbar as scrolled
    if (navbar) navbar.classList.add('scrolled');
    // Mobile menu
    if (navToggle) navToggle.addEventListener('click', toggleMobileMenu);
    if (navOverlay) navOverlay.addEventListener('click', closeMobileMenu);
    window.addEventListener('scroll', updateNavbar, { passive: true });
  }

  // ---- MAIN INIT ----
  async function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Load critical frames
    await preloadCritical();

    // Start lazy loading rest
    lazyLoadFrames();

    // Scroll listener for scrubbing
    window.addEventListener('scroll', function () {
      onScroll();
      updateNavbar();
    }, { passive: true });

    // Skip button
    if (skipBtn) {
      skipBtn.addEventListener('click', skipAnimation);
    }

    // Brand logo — restart animation if on index page
    if (navBrand && revealSection) {
      navBrand.addEventListener('click', function (e) {
        e.preventDefault();
        resetAnimation();
      });
    }

    // Mobile menu
    if (navToggle) navToggle.addEventListener('click', toggleMobileMenu);
    if (navOverlay) navOverlay.addEventListener('click', closeMobileMenu);

    // Other inits
    initFadeIn();
    initFAQ();
    initPressure();
    initSmoothScroll();
    initCTATracking();
    initTreatmentsCarousel();
    initTreatNav();

    // Initial draw
    updateAnimation();
    updateNavbar();
  }

  // ---- TRATAMENTOS PAGE — Active nav link scrollspy ----
  function initTreatNav() {
    var treatNav = document.getElementById('treatNav');
    if (!treatNav) return;

    var sections = document.querySelectorAll('.treat-section[id]');
    var links = treatNav.querySelectorAll('a');
    if (!sections.length || !links.length) return;

    var nb = document.getElementById('navbar');
    var tnH = treatNav.offsetHeight;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          links.forEach(function (a) { a.classList.remove('active'); });
          var active = treatNav.querySelector('a[href="#' + entry.target.id + '"]');
          if (active) {
            active.classList.add('active');
            // scroll the nav link into view horizontally
            active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        }
      });
    }, {
      rootMargin: '-' + ((nb ? nb.offsetHeight : 72) + tnH + 8) + 'px 0px -40% 0px',
      threshold: 0
    });

    sections.forEach(function (s) { observer.observe(s); });
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
