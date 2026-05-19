// ─────────────────────────────────────────────────────────────────────────────
//  dr-curve.js  —  A2AR antagonist scrollytelling
//  Builds two D3 charts in a sticky panel; IntersectionObserver drives state.
//    #story-chart-dr   — DR curves (morphs between Low / Tumour-like)
//    #story-chart-ado  — CD3 IC50 vs [adenosine] chart
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ── Data ──────────────────────────────────────────────────────────────────
  const COMPOUNDS = [
    { id: 'iteos',  name: 'Inupadenant (iTeos)', color: '#1a8a82', weight: 2.5, ec50Low: 0.063, ec50Tumor: 3      },
    { id: 'arcus',  name: 'AB928 (Arcus)',        color: '#e53e3e', weight: 1.5, ec50Low: 1.44,  ec50Tumor: 4200   },
    { id: 'corvus', name: 'CPI-444 (Corvus)',     color: '#38a169', weight: 1.5, ec50Low: 100,   ec50Tumor: 5000   },
    { id: 'az',     name: 'AZD-4635 (AZ)',        color: '#805ad5', weight: 1.5, ec50Low: 600,   ec50Tumor: 30000  },
  ];

  const CD3_DATA = [
    { id: 'iteos',  name: 'Inupadenant (iTeos)', color: '#1a8a82', weight: 2.5,
      pts: [{ x: 1, y: 0.4 }, { x: 10, y: 0.4 }, { x: 100, y: 0.5 }] },
    { id: 'arcus',  name: 'AB928 (Arcus)',        color: '#e53e3e', weight: 1.5,
      pts: [{ x: 1, y: 0.4 }, { x: 10, y: 30  }, { x: 100, y: 1500 }] },
    { id: 'corvus', name: 'CPI-444 (Corvus)',     color: '#38a169', weight: 1.5,
      pts: [{ x: 1, y: 300 }, { x: 5, y: 1200 }, { x: 25, y: 40000 }, { x: 100, y: 100000 }] },
    { id: 'az',     name: 'AZD-4635 (AZ)',        color: '#805ad5', weight: 1.5,
      pts: [{ x: 1, y: 150 }, { x: 5, y: 400  }, { x: 25, y: 1500  }, { x: 100, y: 12000  }] },
  ];

  function hill(x, ec50) { return 100 * x / (ec50 + x); }

  function fmtNM(v) {
    if (v < 0.01)  return v.toExponential(1) + ' nM';
    if (v < 0.1)   return v.toFixed(3) + ' nM';
    if (v < 1)     return v.toFixed(2) + ' nM';
    if (v < 10)    return v.toFixed(1) + ' nM';
    if (v < 1000)  return Math.round(v) + ' nM';
    if (v < 10000) return (v / 1000).toFixed(1) + ' µM';
    return (v / 1000).toFixed(0) + ' µM';
  }

  function styleAxis(sel) {
    sel.select('.domain').attr('stroke', 'var(--border)');
    sel.selectAll('.tick line').attr('stroke', 'var(--border)');
    sel.selectAll('.tick text')
      .style('font-family', "'IBM Plex Mono', monospace")
      .style('font-size', '10px')
      .attr('fill', 'var(--text-muted)');
  }

  function makeTip(container) {
    const tip = document.createElement('div');
    tip.className = 'chart-tooltip';
    container.appendChild(tip);
    return {
      show(html, x, y) {
        tip.innerHTML = html;
        tip.style.opacity = '1';
        const cW = container.offsetWidth;
        const tw = tip.offsetWidth || 210;
        tip.style.left = (x + tw + 16 > cW ? x - tw - 8 : x + 12) + 'px';
        tip.style.top  = Math.max(0, y - 4) + 'px';
      },
      hide() { tip.style.opacity = '0'; },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  DR CHART  — returns { morphTo }
  // ═══════════════════════════════════════════════════════════════════════════
  function buildDRChart(container) {
    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.display   = 'flex';
    container.style.flexDirection = 'column';

    const svgWrap = document.createElement('div');
    svgWrap.className = 'chart-svg-wrap';
    container.appendChild(svgWrap);

    const tip = makeTip(container);

    const margin = { top: 22, right: 152, bottom: 52, left: 62 };
    const X_MIN  = 0.001, X_MAX = 100000;
    const N_PTS  = 300;
    const xVals  = d3.range(N_PTS).map(i =>
      Math.pow(10, Math.log10(X_MIN) + (Math.log10(X_MAX) - Math.log10(X_MIN)) * i / (N_PTS - 1))
    );

    const svg = d3.select(svgWrap).append('svg').attr('width', '100%').attr('height', '100%');
    const g   = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    let xSc, ySc, paths = [], ic50Group;
    let currentEC50s  = COMPOUNDS.map(c => c.ec50Low);
    let ic50Visible   = false;
    let ic50Timer     = null;

    function innerSize() {
      const r = svgWrap.getBoundingClientRect();
      return {
        w: Math.max(r.width  - margin.left - margin.right,  10),
        h: Math.max(r.height - margin.top  - margin.bottom, 10),
      };
    }

    function renderIC50Labels(w, h) {
      ic50Group.selectAll('*').remove();
      COMPOUNDS.forEach((c, i) => {
        const ec50 = currentEC50s[i];
        if (ec50 < X_MIN * 0.9 || ec50 > X_MAX * 1.1) return;
        const cx = xSc(ec50), cy = ySc(50);
        ic50Group.append('line').attr('x1', cx).attr('x2', cx).attr('y1', cy).attr('y2', h)
          .attr('stroke', c.color).attr('stroke-dasharray', '3,2')
          .attr('stroke-width', 1.5).attr('opacity', 0.65);
        ic50Group.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 4.5)
          .attr('fill', c.color).attr('stroke', 'var(--bg-surface)').attr('stroke-width', 1.5);
        ic50Group.append('text')
          .attr('transform', `translate(${cx},${h + 6 + (i % 2) * 10}) rotate(-40)`)
          .attr('text-anchor', 'end')
          .style('font-family', "'IBM Plex Mono', monospace").style('font-size', '8px')
          .attr('fill', c.color).text(fmtNM(ec50));
      });
    }

    function buildScaffold() {
      g.selectAll('*').remove();
      paths = [];
      const { w, h } = innerSize();

      xSc = d3.scaleLog().domain([X_MIN, X_MAX]).range([0, w]);
      ySc = d3.scaleLinear().domain([0, 105]).range([h, 0]);

      const xTicks = [0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000, 100000];
      const xFmt   = { 0.001: '0.001', 0.01: '0.01', 0.1: '0.1', 1: '1', 10: '10',
                       100: '100', 1000: '1µM', 10000: '10µM', 100000: '100µM' };

      // 50% reference line
      g.append('line').attr('x1', 0).attr('x2', w).attr('y1', ySc(50)).attr('y2', ySc(50))
        .attr('stroke', 'var(--text-muted)').attr('stroke-dasharray', '3,4').attr('stroke-width', 1);
      g.append('text').attr('x', 4).attr('y', ySc(50) - 4)
        .style('font-family', "'IBM Plex Mono', monospace").style('font-size', '9px')
        .attr('fill', 'var(--text-muted)').text('IC₅₀');

      const xAxis = g.append('g').attr('transform', `translate(0,${h})`)
        .call(d3.axisBottom(xSc).tickValues(xTicks).tickFormat(d => xFmt[d] || ''));
      styleAxis(xAxis);
      const yAxis = g.append('g').call(d3.axisLeft(ySc).ticks(5).tickFormat(d => d + '%'));
      styleAxis(yAxis);

      const lbl = s => s.style('font-family', "'IBM Plex Mono', monospace")
        .style('font-size', '0.68rem').attr('fill', 'var(--text-secondary)').attr('text-anchor', 'middle');
      lbl(g.append('text').attr('x', w / 2).attr('y', h + 44)).text('Concentration (nM)');
      lbl(g.append('text').attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', -50))
        .text('% Inhibition');

      // Curves drawn at currentEC50s
      const lGen = d3.line().x(d => xSc(d.x)).y(d => ySc(d.y)).curve(d3.curveCatmullRom);
      COMPOUNDS.forEach((c, i) => {
        const pts = xVals.map(x => ({ x, y: hill(x, currentEC50s[i]) }));
        const p = g.append('path').datum(pts).attr('d', lGen)
          .attr('fill', 'none').attr('stroke', c.color).attr('stroke-width', c.weight);
        paths.push(p);
      });

      // IC50 overlay group
      ic50Group = g.append('g').style('opacity', ic50Visible ? 1 : 0);
      renderIC50Labels(w, h);

      // Legend
      const lx = w + 14;
      COMPOUNDS.forEach((c, i) => {
        const ly = i * 30;
        g.append('line').attr('x1', lx).attr('x2', lx + 20).attr('y1', ly + 7).attr('y2', ly + 7)
          .attr('stroke', c.color).attr('stroke-width', c.weight);
        g.append('text').attr('x', lx + 26).attr('y', ly + 11)
          .style('font-family', "'IBM Plex Mono', monospace").style('font-size', '9.5px')
          .attr('fill', 'var(--text-secondary)').text(c.name);
      });

      // Hover
      const crosshair = g.append('line').attr('y1', 0).attr('y2', h).attr('opacity', 0)
        .attr('stroke', 'var(--text-muted)').attr('stroke-dasharray', '3,3').attr('stroke-width', 1)
        .attr('pointer-events', 'none');

      g.append('rect').attr('width', w).attr('height', h)
        .attr('fill', 'none').attr('pointer-events', 'all')
        .on('mousemove', function (event) {
          const [mx] = d3.pointer(event);
          const xVal = xSc.invert(mx);
          crosshair.attr('x1', mx).attr('x2', mx).attr('opacity', 1);
          const rows = COMPOUNDS.map((c, i) => {
            const pct = hill(xVal, currentEC50s[i]);
            return `<div class="tt-row">
              <span class="tt-dot" style="background:${c.color}"></span>
              <span>${c.name}</span>
              <span class="tt-val">${pct.toFixed(1)}%</span>
            </div>`;
          }).join('');
          tip.show(`<div class="tt-header">${fmtNM(xVal)}</div>${rows}`, margin.left + mx, margin.top + 8);
        })
        .on('mouseleave', () => { crosshair.attr('opacity', 0); tip.hide(); });
    }

    // Morphs curves from current EC50s to target state via log-space interpolation
    function morphTo(state) {
      const targetEC50s = COMPOUNDS.map(c => state === 'low' ? c.ec50Low : c.ec50Tumor);
      const fromEC50s   = [...currentEC50s];

      if (ic50Timer) { clearTimeout(ic50Timer); ic50Timer = null; }
      ic50Group.transition().duration(200).style('opacity', 0);
      ic50Visible = false;

      const { w, h } = innerSize();
      const lGen = d3.line().x(d => xSc(d.x)).y(d => ySc(d.y)).curve(d3.curveCatmullRom);

      paths.forEach((path, i) => {
        const from = fromEC50s[i], to = targetEC50s[i];
        path.transition().duration(900).ease(d3.easeCubicInOut)
          .attrTween('d', () => t => {
            const ec50 = Math.pow(10, Math.log10(from) * (1 - t) + Math.log10(to) * t);
            return lGen(xVals.map(x => ({ x, y: hill(x, ec50) })));
          });
      });

      currentEC50s = targetEC50s;

      if (state === 'tumor') {
        ic50Timer = setTimeout(() => {
          const { w: w2, h: h2 } = innerSize();
          renderIC50Labels(w2, h2);
          ic50Group.transition().duration(400).style('opacity', 1);
          ic50Visible = true;
        }, 1500);
      }
    }

    let rsz;
    window.addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(buildScaffold, 150); });
    requestAnimationFrame(() => requestAnimationFrame(buildScaffold));

    return { morphTo };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  ADO CHART  — CD3 IC50 vs [adenosine]
  // ═══════════════════════════════════════════════════════════════════════════
  function buildADOChart(container) {
    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.display   = 'flex';
    container.style.flexDirection = 'column';

    const svgWrap = document.createElement('div');
    svgWrap.className = 'chart-svg-wrap';
    container.appendChild(svgWrap);

    const tip = makeTip(container);

    const margin = { top: 22, right: 152, bottom: 52, left: 72 };
    const svg = d3.select(svgWrap).append('svg').attr('width', '100%').attr('height', '100%');
    const g   = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    function innerSize() {
      const r = svgWrap.getBoundingClientRect();
      return {
        w: Math.max(r.width  - margin.left - margin.right,  10),
        h: Math.max(r.height - margin.top  - margin.bottom, 10),
      };
    }

    function logLogFit(pts) {
      const n = pts.length;
      const lx = pts.map(p => Math.log10(p.x));
      const ly = pts.map(p => Math.log10(p.y));
      const mx = lx.reduce((a, b) => a + b) / n;
      const my = ly.reduce((a, b) => a + b) / n;
      const slope = lx.reduce((s, x, i) => s + (x - mx) * (ly[i] - my), 0) /
                    lx.reduce((s, x) => s + (x - mx) ** 2, 0);
      const intercept = my - slope * mx;
      return x => Math.pow(10, intercept + slope * Math.log10(x));
    }

    function draw() {
      g.selectAll('*').remove();
      const { w, h } = innerSize();

      const xSc = d3.scaleLog().domain([0.5, 200]).range([0, w]);
      const ySc = d3.scaleLog().domain([0.1, 300000]).range([0, h]);

      const xAxis = g.append('g').attr('transform', `translate(0,${h})`)
        .call(d3.axisBottom(xSc).tickValues([1, 5, 10, 25, 100]).tickFormat(d => d + ' µM'));
      styleAxis(xAxis);
      const yAxis = g.append('g').call(d3.axisLeft(ySc)
        .tickValues([0.1, 1, 10, 100, 1000, 10000, 100000])
        .tickFormat(d => d >= 1000 ? (d / 1000).toFixed(0) + 'µM' : d + ''));
      styleAxis(yAxis);

      const ls = s => s.style('font-family', "'IBM Plex Mono', monospace")
        .style('font-size', '0.68rem').attr('fill', 'var(--text-secondary)').attr('text-anchor', 'middle');
      ls(g.append('text').attr('x', w / 2).attr('y', h + 44)).text('[Adenosine] (µM)');
      ls(g.append('text').attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', -60))
        .text('IC₅₀ (nM)  ←  more potent');

      const curveLine = d3.line().x(d => xSc(d.x)).y(d => ySc(d.y));
      const CURVE_N   = 150;

      CD3_DATA.forEach(c => {
        const fitFn  = logLogFit(c.pts);
        const cxMin  = Math.log10(d3.min(c.pts, p => p.x));
        const cxMax  = Math.log10(d3.max(c.pts, p => p.x));
        const curvePts = d3.range(CURVE_N).map(i => {
          const x = Math.pow(10, cxMin + (cxMax - cxMin) * i / (CURVE_N - 1));
          return { x, y: fitFn(x) };
        });
        g.append('path').datum(curvePts).attr('d', curveLine)
          .attr('fill', 'none').attr('stroke', c.color).attr('stroke-width', c.weight);
        c.pts.forEach(p => {
          g.append('circle').attr('cx', xSc(p.x)).attr('cy', ySc(p.y))
            .attr('r', c.weight === 2.5 ? 5 : 4)
            .attr('fill', c.color).attr('stroke', 'var(--bg-surface)').attr('stroke-width', 1.5);
        });
      });

      const lx = w + 14;
      CD3_DATA.forEach((c, i) => {
        const ly = i * 28;
        g.append('line').attr('x1', lx).attr('x2', lx + 18).attr('y1', ly + 6).attr('y2', ly + 6)
          .attr('stroke', c.color).attr('stroke-width', c.weight);
        g.append('text').attr('x', lx + 24).attr('y', ly + 10)
          .style('font-family', "'IBM Plex Mono', monospace").style('font-size', '9.5px')
          .attr('fill', 'var(--text-secondary)').text(c.name);
      });

      // Hover — snap to nearest data x
      const allX = [...new Set(CD3_DATA.flatMap(c => c.pts.map(p => p.x)))].sort((a, b) => a - b);
      g.append('rect').attr('width', w).attr('height', h)
        .attr('fill', 'none').attr('pointer-events', 'all')
        .on('mousemove', function (event) {
          const [mx] = d3.pointer(event);
          const xVal = xSc.invert(mx);
          const nearest = allX.reduce((best, v) =>
            Math.abs(Math.log10(v) - Math.log10(xVal)) < Math.abs(Math.log10(best) - Math.log10(xVal)) ? v : best);
          const rows = CD3_DATA.map(c => {
            const pt = c.pts.find(p => p.x === nearest);
            return `<div class="tt-row">
              <span class="tt-dot" style="background:${c.color}"></span>
              <span>${c.name}</span>
              <span class="tt-val">${pt ? fmtNM(pt.y) : '—'}</span>
            </div>`;
          }).join('');
          tip.show(`<div class="tt-header">[ADO] = ${nearest} µM</div>${rows}`,
            margin.left + xSc(nearest), margin.top + 20);
        })
        .on('mouseleave', () => tip.hide());
    }

    let rsz;
    window.addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(draw, 150); });
    requestAnimationFrame(() => requestAnimationFrame(draw));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  STORY CONTROLLER
  // ═══════════════════════════════════════════════════════════════════════════
  function initStory() {
    const drEl  = document.getElementById('story-chart-dr');
    const adoEl = document.getElementById('story-chart-ado');
    if (!drEl || !adoEl) return;

    const drAPI = buildDRChart(drEl);
    buildADOChart(adoEl);

    drEl.classList.add('visible');

    const caption = document.getElementById('story-chart-caption');
    const captions = {
      low:   'HEK-hA2AR cell-based cAMP assay · Hill slope = 1 · low adenosine (1 µM)',
      tumor: 'HEK-hA2AR cell-based cAMP assay · Hill slope = 1 · tumour-like conditions (200 µM ADO)',
      ado:   'Human CD3+ T cell cAMP assay · IC₅₀ vs [adenosine] · tumour-like conditions',
    };

    let activeState = 'low';

    function setCaption(text) {
      if (!caption) return;
      caption.style.opacity = '0';
      setTimeout(() => { caption.textContent = text; caption.style.opacity = '1'; }, 200);
    }

    function activate(state) {
      if (state === activeState) return;
      activeState = state;

      setCaption(captions[state] || '');

      if (state === 'ado') {
        drEl.classList.remove('visible');
        adoEl.classList.add('visible');
      } else {
        adoEl.classList.remove('visible');
        drEl.classList.add('visible');
        drAPI.morphTo(state);
      }

      document.querySelectorAll('.story-chapter').forEach(ch =>
        ch.classList.toggle('active', ch.dataset.state === state));
    }

    // Activate first chapter immediately
    const firstChapter = document.querySelector('.story-chapter[data-state="low"]');
    if (firstChapter) firstChapter.classList.add('active');

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) activate(entry.target.dataset.state);
      });
    }, { rootMargin: '-30% 0px -40% 0px', threshold: 0 });

    document.querySelectorAll('.story-chapter').forEach(ch => observer.observe(ch));
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  function init() {
    if (typeof d3 === 'undefined') return;
    initStory();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
