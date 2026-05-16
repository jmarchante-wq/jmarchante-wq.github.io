// ═══════════════════════════════════════════
//  main.js — João Marchante · jmarchante-wq.github.io
//  D3 visualisations will be added here as the
//  course progresses. Each chart has its own
//  target container ID in index.html.
// ═══════════════════════════════════════════

// ── Theme toggle ──
const html = document.documentElement;
const toggleBtn = document.getElementById('theme-toggle');
const toggleLabel = toggleBtn.querySelector('.toggle-label');

// Restore saved preference
if (localStorage.getItem('theme') === 'dark') {
  html.classList.add('dark');
  toggleLabel.textContent = 'light';
}

toggleBtn.addEventListener('click', () => {
  const isDark = html.classList.toggle('dark');
  toggleLabel.textContent = isDark ? 'light' : 'dark';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// ── Navbar: add scrolled class for styling ──
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
});

// ── Active nav link on scroll ──
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute('id');
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
      });
    }
  });
}, { threshold: 0.4 });

sections.forEach(s => observer.observe(s));

// ── Scroll reveal for sections ──
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.expertise-card, .case, .stat, .cv-entry, .pub-entry').forEach(el => {
  el.classList.add('reveal');
  revealObserver.observe(el);
});


// ── Publications: collapsible toggle ──
const pubToggle   = document.getElementById('pub-toggle');
const pubOverflow = document.getElementById('pub-overflow');

if (pubToggle && pubOverflow) {
  pubToggle.addEventListener('click', () => {
    const expanded = pubOverflow.classList.toggle('expanded');
    pubToggle.classList.toggle('expanded', expanded);
    pubToggle.querySelector('.pub-toggle-text').textContent = expanded ? 'Show less' : 'Show 5 more';
  });
}


// ═══════════════════════════════════════════
//  D3 VISUALISATIONS
//  Uncomment and fill in as you build them.
// ═══════════════════════════════════════════

// ── 1. Dose–Response Curves ──────────────
// Target: #dr-curve-chart
// TODO: 4-parameter logistic (Hill equation)
//        with tooltip showing EC50 + Emax on hover
//
// function drawDRCurves() {
//   const container = document.getElementById('dr-curve-chart');
//   const { width, height } = container.getBoundingClientRect();
//   // ... your D3 code here
// }
// drawDRCurves();


// ── 2. Screening Cascade ─────────────────
// Target: #cascade-chart
// TODO: Horizontal funnel / bar chart
//        showing compound numbers at each stage
//
// function drawCascade() {
//   const container = document.getElementById('cascade-chart');
//   // ... your D3 code here
// }
// drawCascade();


// ── 3. Programme Timeline ────────────────
// Target: #timeline-chart
// TODO: Horizontal timeline with programme milestones
//
// function drawTimeline() {
//   const container = document.getElementById('timeline-chart');
//   // ... your D3 code here
// }
// drawTimeline();


// ── 4. Hero visualisation ────────────────
// Target: #hero-chart
// TODO: Optional ambient animated element
//
// function drawHero() {
//   const container = document.getElementById('hero-chart');
//   // ... your D3 code here
// }
// drawHero();
