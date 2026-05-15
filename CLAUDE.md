# CLAUDE.md — jmarchante-wq.github.io

This file gives you full context on this project. Read it before making any changes.

---

## Who this is for

**João Marchante** — Senior Scientist and former Screening & Assay Development Team Lead
at iTeos Therapeutics (Brussels). ~15 years preclinical drug discovery experience across
in vitro pharmacology, assay development, screening cascade design, translational PK/PD,
bioinformatics, and CRO management. Currently job searching for senior roles in Europe.

This website serves as a personal portfolio and CV — advertising his expertise to
potential employers in oncology, immuno-oncology, and related fields.

---

## Project overview

A single-page personal portfolio site hosted on GitHub Pages at:
`https://jmarchante-wq.github.io`

**Core concept:** D3.js data visualisations are the centrepiece — they demonstrate
João's data-first mindset directly, rather than just claiming it in prose.
João is actively learning D3.js (currently early in a D3 course), so visualisations
are being added incrementally as his skills develop.

---

## File structure

```
jmarchante-wq.github.io/
├── CLAUDE.md              ← this file
├── index.html             ← single-page site, all sections
├── style.css              ← all styles, light/dark theme via CSS variables
├── main.js                ← JS: theme toggle, scroll behaviour, D3 stubs
└── visualizations/        ← (not yet created) D3 charts will live here
    ├── dr-curve.js        ← planned: dose-response curves
    ├── cascade.js         ← planned: screening funnel
    └── timeline.js        ← planned: programme timeline
```

---

## Design system

### Fonts (loaded from Google Fonts)
- **Display:** DM Serif Display — headings and hero title
- **Body:** IBM Plex Sans — paragraph text
- **Mono:** IBM Plex Mono — labels, tags, nav, section numbers

### Light mode (default) — CSS variables on `:root`
```css
--bg:             #f2f0eb   /* warm dirty white */
--bg-surface:     #e8e5de
--bg-card:        #edeae3
--border:         #ccc8be
--accent:         #1a8a82   /* teal */
--accent-dim:     #5ab8b1
--text-primary:   #1a1f2e
--text-secondary: #4a5568
--text-muted:     #8a9ab0
```

### Dark mode — CSS variables on `html.dark`
```css
--bg:             #0a0e14
--bg-surface:     #111720
--bg-card:        #161d28
--border:         #1e2a38
--accent:         #4ecdc4
--accent-dim:     #2a7a75
--text-primary:   #e8edf2
--text-secondary: #8a9ab0
--text-muted:     #4a5a6e
```

### Theme switching
- Toggle button in navbar (top right)
- `html.dark` class toggled via JS
- Preference saved to `localStorage`
- All backgrounds, borders, and text use `var()` — never hardcode colours

### Key rule
**Never use hardcoded colour values anywhere in CSS or JS.**
Always use the CSS custom properties above so both themes work correctly.

---

## Site sections

| # | ID | Content |
|---|-----|---------|
| 01 | `#about` | Bio, positioning, 4 stat cards |
| 02 | `#expertise` | 6 expertise cards in a grid |
| 03 | `#cases` | 3 case studies, each with a D3 chart slot |
| 04 | `#cv` | Experience timeline + tech tags |
| 05 | `#contact` | Email, LinkedIn, GitHub links |

---

## D3 visualisations — status and plan

### 1. Dose–Response Curves ← **build this first**
- **Container:** `#dr-curve-chart` (inside `.case-visual` div)
- **Concept:** 3–4 sigmoid curves using the 4-parameter logistic (Hill) equation
- **Interaction:** hover anywhere on a curve → tooltip shows EC₅₀ and % activity at that point
- **Data:** synthetic/anonymised — realistic compound values
- **Status:** placeholder box only, stub in `main.js`

### 2. Screening Cascade Funnel
- **Container:** `#cascade-chart`
- **Concept:** horizontal funnel showing compound counts at each stage
  (Library → Primary screen → Confirmation → Dose-response → Candidates)
- **Interaction:** hover on bar → show hit rate vs previous stage
- **Status:** placeholder only

### 3. Programme Timeline
- **Container:** `#timeline-chart`
- **Concept:** horizontal timeline of programmes João contributed to,
  from target ID to clinical entry, with milestone nodes
- **Interaction:** click node → show milestone detail
- **Status:** placeholder only

### 4. Hero visualisation (optional)
- **Container:** `#hero-chart`
- **Concept:** ambient animated background element — could be a slow
  particle network, animated axes, or a subtle waveform
- **Status:** placeholder only, lowest priority

---

## Coding conventions

- **No frameworks** — vanilla HTML, CSS, JS + D3 only
- **No hardcoded colours** — always use CSS variables
- **D3 version:** v7 (loaded via CDN in index.html)
- **Responsive:** mobile breakpoints at 900px and 600px
- **Animations:** scroll-reveal on `.reveal` elements via IntersectionObserver
- **Commits:** descriptive messages, one logical change per commit
  e.g. `"Add D3 dose-response curves with hover tooltip"`

---

## Content notes

- João's email and LinkedIn URL in `#contact` are **placeholders** — do not
  change without asking him
- The About text and stats reflect his real background — verify with him
  before editing
- Thesis situation: doctoral research completed, 5 publications, thesis not
  defended — this is handled transparently in the CV section, do not obscure it
- Asset count in stats card says "5+" — verify current number with João

---

## What was built in the previous session (chat with Claude.ai)

1. Full HTML shell with all sections and placeholder D3 containers
2. Complete CSS with light/dark theme system
3. `main.js` with theme toggle, scroll-reveal, active nav tracking, D3 stubs
4. Light mode set as default (warm dirty white); dark mode toggled via button
5. Navbar background fixed to use CSS variable (not hardcoded dark colour)
6. Files pushed to GitHub, site live at `https://jmarchante-wq.github.io`

**Next task: build the dose–response curves in `#dr-curve-chart`**

---

## Deployment

- Hosted on GitHub Pages — push to `main` branch, auto-deploys in ~60 seconds
- Hard refresh with Ctrl+Shift+R to bypass browser cache after deploys
- Check deploy status at:
  `https://github.com/jmarchante-wq/jmarchante-wq.github.io/actions`
