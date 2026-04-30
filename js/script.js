/* ============================================================
   script.js — National Youth Climate Grant
   Scroll engine + interactive perspective panel system.

   Modules:
     1. Page curtain             (cinematic open)
     2. Parallax engine          (image movement on scroll)
     3. Scroll reveal            (IntersectionObserver)
     4. Word stack reveal        (staggered word-by-word)
     5. Navbar behaviour         (transparent → frosted glass)
     6. Panel interaction        (expand / collapse / stories)
     7. Data-href links          (whole-area click zones)
   ============================================================ */

/* ── Module-level state ── */
let scrollObserver = null;   // shared IntersectionObserver, used by main + dynamic sections
let activeStory    = null;   // 'rural' | 'urban' | null


/* ─── 1. PAGE CURTAIN ────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  const curtain = document.getElementById('curtain');
  if (curtain) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      curtain.classList.add('lifted');
    }));
  }

  initParallax();
  initScrollReveal();       // initialises scrollObserver and observes document
  initWordReveal();
  initNavbar();
  initPanels();
  initDataHrefLinks();
});


/* ─── 2. PARALLAX ENGINE ─────────────────────────────────── */
/*
  Background image elements with [data-parallax="<speed>"] shift
  vertically as the page scrolls, creating depth.

  speed guide:
    0.25 → very subtle (wide landscape backgrounds)
    0.40 → moderate (portrait images)

  The parent element is the reference frame — we find how far its
  centre is from the viewport centre, multiply by speed, and apply
  translateY. This ensures every section has its own zero-point.

  requestAnimationFrame + ticking flag prevents redundant layouts.
  passive: true lets the browser optimise scroll performance.
*/
function initParallax() {
  const targets = document.querySelectorAll('[data-parallax]');
  if (!targets.length) return;

  let ticking = false;

  function tick() {
    const vh = window.innerHeight;
    targets.forEach(el => {
      const rect = el.parentElement.getBoundingClientRect();
      if (rect.bottom < -300 || rect.top > vh + 300) return;
      const speed  = parseFloat(el.dataset.parallax) || 0.3;
      const offset = (rect.top + rect.height * 0.5 - vh * 0.5) * speed;
      el.style.transform = `translateY(${offset}px)`;
    });
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(tick); ticking = true; }
  }, { passive: true });

  tick(); // initialise positions before any scroll
}


/* ─── 3. SCROLL REVEAL (IntersectionObserver) ────────────── */
/*
  Elements with .fade-up / .fade-in / .slide-l / .slide-r /
  .scale-up start invisible (defined in CSS). When 12% of the
  element enters the viewport, we add .is-visible which triggers
  the CSS transition to its final state.

  observeSection(root) can be called with any DOM element as root,
  making it re-usable when dynamic sections are revealed (perspective
  stories, shared insight). It skips elements that are already visible.
*/
function initScrollReveal() {

  scrollObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        scrollObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -55px 0px' }
  );

  observeSection(document);
}

function observeSection(root) {
  if (!scrollObserver) return;
  const sel = '.fade-up, .fade-in, .slide-l, .slide-r, .scale-up';
  root.querySelectorAll(sel).forEach(el => {
    if (!el.classList.contains('is-visible')) {
      scrollObserver.observe(el);
    }
  });
}


/* ─── 4. WORD STACK REVEAL ───────────────────────────────── */
/*
  .word-stack containers hold .word-item children.
  When the container reaches 40% visibility, JS fires each word
  with a 280ms stagger — so they land one at a time, like reading
  cards held up in silence.

  Same root-parameter pattern as observeSection, so it works for
  dynamically shown sections too.
*/
function initWordReveal(root) {
  root = root || document;
  const containers = root.querySelectorAll('.word-stack');
  if (!containers.length) return;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const items = entry.target.querySelectorAll('.word-item');
        items.forEach((item, i) => {
          setTimeout(() => item.classList.add('is-visible'), i * 280);
        });
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.4 }
  );

  containers.forEach(c => observer.observe(c));
}


/* ─── 5. NAVBAR ──────────────────────────────────────────── */
/*
  Transparent over fullscreen hero images.
  After 80px scroll, adds .nav--solid for frosted-glass background.
  Also marks the current page's nav link as .active.
*/
function initNavbar() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  const check = () => nav.classList.toggle('nav--solid', window.scrollY > 80);
  window.addEventListener('scroll', check, { passive: true });
  check();

  const page = window.location.pathname.split('/').pop() || 'index.html';
  nav.querySelectorAll('.nav__links a').forEach(a => {
    if (a.getAttribute('href') === page) a.classList.add('active');
  });
}


/* ─── 6. PANEL INTERACTION ───────────────────────────────── */
/*
  The centrepiece interaction of the homepage.

  Flow:
    1. User sees split-view: Rural | Urban (50% / 50%)
    2. Click a panel:
       — That panel gets .is-active  → CSS grows it (flex: 4)
       — Other panel gets .is-inactive → CSS collapses it (flex: 0, opacity: 0)
       — .split-view.has-selection is added to trigger these CSS rules
       — 700ms later: the perspective story section appears below and we scroll to it
       — Back button becomes visible
    3. Story ends with a "Continue" button → showSharedInsight()
    4. Back button → resetPanels() restores 50/50 view and hides stories

  Why 700ms delay for story reveal?
    The flex transition takes ~0.9s. Waiting 700ms means the panel
    is mostly expanded before the story snaps into view, so the two
    animations don't fight each other visually.
*/
function initPanels() {
  const panels = document.querySelectorAll('.panel');
  if (!panels.length) return;

  panels.forEach(panel => {
    panel.addEventListener('click', () => {
      const id = panel.dataset.perspective;
      if (!id || activeStory) return;   // ignore if story already active
      activatePerspective(id);
    });

    // Keyboard accessibility
    panel.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        panel.click();
      }
    });
  });

  // Wire up "Back" button
  const backBtn = document.getElementById('story-back-btn');
  if (backBtn) backBtn.addEventListener('click', resetPanels);

  // Wire up "Continue" buttons at end of each story
  document.querySelectorAll('.story-continue-btn').forEach(btn => {
    btn.addEventListener('click', showSharedInsight);
  });
}

function activatePerspective(id) {
  activeStory = id;
  const splitView = document.querySelector('.split-view');
  if (!splitView) return;

  // Step 1: expand selected panel, collapse the other
  splitView.classList.add('has-selection');
  document.querySelectorAll('.panel').forEach(p => {
    p.classList.toggle('is-active',   p.dataset.perspective === id);
    p.classList.toggle('is-inactive', p.dataset.perspective !== id);
  });

  // Step 2: after animation, reveal story and scroll to it
  setTimeout(() => {
    const storyEl = document.getElementById('story-' + id);
    if (!storyEl) return;

    storyEl.style.display = 'block';

    // Re-run animation setup for newly visible content
    requestAnimationFrame(() => {
      observeSection(storyEl);
      initWordReveal(storyEl);
      storyEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Show back button
    const backBtn = document.getElementById('story-back-btn');
    if (backBtn) backBtn.style.display = 'flex';

  }, 700);
}

function resetPanels() {
  activeStory = null;

  // Hide stories and shared insight
  ['story-rural', 'story-urban', 'shared-insight'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = 'none';
      // Reset word reveal items so they can replay if story is reopened
      el.querySelectorAll('.word-item.is-visible').forEach(w => w.classList.remove('is-visible'));
      // Reset other scroll animations
      el.querySelectorAll('.fade-up.is-visible, .fade-in.is-visible, .slide-l.is-visible, .slide-r.is-visible, .scale-up.is-visible').forEach(a => a.classList.remove('is-visible'));
    }
  });

  // Restore 50/50 split
  const splitView = document.querySelector('.split-view');
  if (splitView) splitView.classList.remove('has-selection');
  document.querySelectorAll('.panel').forEach(p => {
    p.classList.remove('is-active', 'is-inactive');
  });

  // Hide back button
  const backBtn = document.getElementById('story-back-btn');
  if (backBtn) backBtn.style.display = 'none';

  // Scroll back to the split view
  const perspectiveSection = document.getElementById('perspectives');
  if (perspectiveSection) {
    perspectiveSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function showSharedInsight() {
  const insight = document.getElementById('shared-insight');
  if (!insight) return;

  insight.style.display = 'block';

  requestAnimationFrame(() => {
    observeSection(insight);
    insight.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}


/* ─── 7. DATA-HREF LINKS ─────────────────────────────────── */
/*
  Elements with data-href="page.html" become full-area links.
  A brief body fade-out on click gives a smooth page exit.
*/
function initDataHrefLinks() {
  document.querySelectorAll('[data-href]').forEach(el => {
    el.style.cursor = 'pointer';
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'link');

    function go() {
      const href = el.dataset.href;
      document.body.style.transition = 'opacity 0.3s ease';
      document.body.style.opacity = '0';
      setTimeout(() => { window.location.href = href; }, 300);
    }

    el.addEventListener('click', go);
    el.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  });
}
