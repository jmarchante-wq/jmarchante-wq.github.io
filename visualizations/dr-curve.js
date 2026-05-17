// ─────────────────────────────────────────────────────────────────────────────
//  dr-curve.js  —  A2AR antagonist competitive profiling
//  Three D3 v7 charts:
//    #dr-curve-chart  — DR curves, two tabs (Low ADO / Tumor-like)
//    #ado-chart       — IC50 vs [ADO] in human CD3+ T cells
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ── Compound definitions ──────────────────────────────────────────────────
  // EC50 in nM; HEK-hA2AR cell-based cAMP assay
  // Arcus values provided; iTeos/Corvus/AZ read from published figures
  const COMPOUNDS = [
    { id: 'iteos',  name: 'Inupadenant (iTeos)', color: '#1a8a82', weight: 2.5, ec50Low: 0.063, ec50Tumor: 3      },
    { id: 'arcus',  name: 'AB928 (Arcus)',        color: '#e53e3e', weight: 1.5, ec50Low: 1.44,  ec50Tumor: 4200   },
    { id: 'corvus', name: 'CPI-444 (Corvus)',     color: '#38a169', weight: 1.5, ec50Low: 100,   ec50Tumor: 5000   },
    { id: 'az',     name: 'AZD-4635 (AZ)',        color: '#805ad5', weight: 1.5, ec50Low: 600,   ec50Tumor: 30000  },
  ];

  // ── CD3 assay data ────────────────────────────────────────────────────────
  // IC50 (nM) vs [ADO] (µM); human CD3+ T cell cAMP assay, tumour-like conditions
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

  // ── Hill equation ─────────────────────────────────────────────────────────
  function hill(x, ec50, emax) {
    return emax * x / (ec50 + x);  // hill = 1 for all compounds
  }

  // ── Format nM ─────────────────────────────────────────────────────────────
  function fmtNM(v) {
    if (v < 0.01)   return v.toExponential(1) + ' nM';
    if (v < 0.1)    return v.toFixed(3) + ' nM';
    if (v < 1)      return v.toFixed(2) + ' nM';
    if (v < 10)     return v.toFixed(1) + ' nM';
    if (v < 1000)   return Math.round(v) + ' nM';
    if (v < 10000)  return (v / 1000).toFixed(1) + ' µM';
    return (v / 1000).toFixed(0) + ' µM';
  }

  // ── Shared axis styler ────────────────────────────────────────────────────
  function styleAxis(sel) {
    sel.select('.domain').attr('stroke', 'var(--border)');
    sel.selectAll('.tick line').attr('stroke', 'var(--border)');
    sel.selectAll('.tick text')
      .style('font-family', "'IBM Plex Mono', monospace")
      .style('font-size', '10px')
      .attr('fill', 'var(--text-muted)');
  }

  // ── Tooltip helper ────────────────────────────────────────────────────────
  function makeTipFn(container, svgWrap, margin) {
    const tooltip = container.querySelector('.chart-tooltip');
    return {
      show(html, mx, my) {
        tooltip.innerHTML = html;
        tooltip.style.opacity = '1';
        const cR = container.getBoundingClientRect();
        const wR = svgWrap.getBoundingClientRect();
        const tx = wR.left - cR.left + margin.left + mx;
        const ty = wR.top  - cR.top  + margin.top  + my;
        const tw = tooltip.offsetWidth || 210;
        tooltip.style.left = (tx + tw + 16 > container.offsetWidth ? tx - tw - 8 : tx + 12) + 'px';
        tooltip.style.top  = Math.max(0, ty - 4) + 'px';
      },
      hide() { tooltip.style.opacity = '0'; },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  DR CHART  (#dr-curve-chart)
  // ═══════════════════════════════════════════════════════════════════════════
  function buildDRChart(container) {
    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.display   = 'flex';
    container.style.flexDirection = 'column';

    // ── Controls row ─────────────────────────────────────────────────────────
    const tabBar = document.createElement('div');
    tabBar.className = 'chart-tabs';
    tabBar.innerHTML = `
      <button class="chart-tab active" data-tab="low">Low Adenosine</button>
      <button class="chart-tab" data-tab="tumor">Tumour-like</button>
      <button class="chart-ic50-btn" id="ic50-toggle">IC₅₀</button>
    `;
    container.appendChild(tabBar);

    const svgWrap = document.createElement('div');
    svgWrap.className = 'chart-svg-wrap';
    container.appendChild(svgWrap);

    const tipDiv = document.createElement('div');
    tipDiv.className = 'chart-tooltip';
    container.appendChild(tipDiv);

    const margin = { top: 22, right: 152, bottom: 52, left: 62 };
    const X_MIN = 0.001, X_MAX = 100000; // nM
    const N_PTS  = 300;

    const svg = d3.select(svgWrap).append('svg').attr('width', '100%').attr('height', '100%');
    const g   = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    let showIC50  = false;
    let activeTab = 'low';
    let ic50Layer = null;                 // D3 selection, updated each draw

    const tip = makeTipFn(container, svgWrap, margin);

    function innerSize() {
      const r = svgWrap.getBoundingClientRect();
      return {
        w: Math.max(r.width  - margin.left - margin.right,  10),
        h: Math.max(r.height - margin.top  - margin.bottom, 10),
      };
    }

    function draw() {
      g.selectAll('*').remove();
      const { w, h } = innerSize();
      const ec50Key = activeTab === 'low' ? 'ec50Low' : 'ec50Tumor';

      const xSc = d3.scaleLog().domain([X_MIN, X_MAX]).range([0, w]);
      const ySc = d3.scaleLinear().domain([0, 105]).range([h, 0]);

      const xTicks = [0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000, 100000];
      const xFmt = { 0.001:'0.001',0.01:'0.01',0.1:'0.1',1:'1',10:'10',
                     100:'100',1000:'1µM',10000:'10µM',100000:'100µM' };

      // 50% reference
      g.append('line')
        .attr('x1', 0).attr('x2', w)
        .attr('y1', ySc(50)).attr('y2', ySc(50))
        .attr('stroke', 'var(--text-muted)').attr('stroke-dasharray', '3,4').attr('stroke-width', 1);
      g.append('text')
        .attr('x', 4).attr('y', ySc(50) - 4)
        .style('font-family', "'IBM Plex Mono', monospace").style('font-size', '9px')
        .attr('fill', 'var(--text-muted)').text('IC₅₀');

      // Axes
      const xAxis = g.append('g').attr('transform', `translate(0,${h})`)
        .call(d3.axisBottom(xSc).tickValues(xTicks).tickFormat(d => xFmt[d] || ''));
      styleAxis(xAxis);

      const yAxis = g.append('g').call(d3.axisLeft(ySc).ticks(5).tickFormat(d => d + '%'));
      styleAxis(yAxis);

      // Labels
      const labelStyle = s => s.style('font-family', "'IBM Plex Mono', monospace")
        .style('font-size', '0.68rem').attr('fill', 'var(--text-secondary)').attr('text-anchor', 'middle');
      labelStyle(g.append('text').attr('x', w / 2).attr('y', h + 44)).text('Concentration (nM)');
      labelStyle(g.append('text').attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', -50))
        .text('% Inhibition');

      // Curves
      const lGen = d3.line().x(d => xSc(d.x)).y(d => ySc(d.y)).curve(d3.curveCatmullRom);
      const logMin = Math.log10(X_MIN), logMax = Math.log10(X_MAX);

      COMPOUNDS.forEach(c => {
        const pts = d3.range(N_PTS).map(i => {
          const x = Math.pow(10, logMin + (logMax - logMin) * i / (N_PTS - 1));
          return { x, y: hill(x, c[ec50Key], 100) };
        });
        g.append('path').datum(pts).attr('d', lGen)
          .attr('fill', 'none').attr('stroke', c.color).attr('stroke-width', c.weight);
      });

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

      // ── IC50 overlay ───────────────────────────────────────────────────────
      ic50Layer = g.append('g').style('opacity', showIC50 ? 1 : 0);

      COMPOUNDS.forEach((c, i) => {
        const ec50 = c[ec50Key];
        if (ec50 < X_MIN * 0.9 || ec50 > X_MAX * 1.1) return;
        const cx = xSc(ec50);
        const cy = ySc(50);

        // Vertical dashed drop to x-axis
        ic50Layer.append('line')
          .attr('x1', cx).attr('x2', cx).attr('y1', cy).attr('y2', h)
          .attr('stroke', c.color).attr('stroke-dasharray', '3,2')
          .attr('stroke-width', 1.5).attr('opacity', 0.65);

        // Dot at 50% crossing
        ic50Layer.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 4.5)
          .attr('fill', c.color).attr('stroke', 'var(--bg-surface)').attr('stroke-width', 1.5);

        // Label — rotated below axis, alternating depth to avoid overlap
        const labelDepth = h + 6 + (i % 2) * 10;
        ic50Layer.append('text')
          .attr('transform', `translate(${cx},${labelDepth}) rotate(-40)`)
          .attr('text-anchor', 'end')
          .style('font-family', "'IBM Plex Mono', monospace").style('font-size', '8px')
          .attr('fill', c.color)
          .text(fmtNM(ec50));
      });

      // ── Hover ──────────────────────────────────────────────────────────────
      const crosshair = g.append('line')
        .attr('y1', 0).attr('y2', h).attr('opacity', 0)
        .attr('stroke', 'var(--text-muted)').attr('stroke-dasharray', '3,3').attr('stroke-width', 1)
        .attr('pointer-events', 'none');

      g.append('rect').attr('width', w).attr('height', h)
        .attr('fill', 'none').attr('pointer-events', 'all')
        .on('mousemove', function (event) {
          const [mx] = d3.pointer(event);
          const xVal = xSc.invert(mx);
          crosshair.attr('x1', mx).attr('x2', mx).attr('opacity', 1);
          const rows = COMPOUNDS.map(c => {
            const pct = hill(xVal, c[ec50Key], 100);
            return `<div class="tt-row">
              <span class="tt-dot" style="background:${c.color}"></span>
              <span>${c.name}</span>
              <span class="tt-val">${pct.toFixed(1)}%</span>
            </div>`;
          }).join('');
          tip.show(`<div class="tt-header">${fmtNM(xVal)}</div>${rows}`, mx, 8);
        })
        .on('mouseleave', () => { crosshair.attr('opacity', 0); tip.hide(); });
    }

    // ── IC50 toggle ────────────────────────────────────────────────────────
    const ic50Btn = container.querySelector('#ic50-toggle');
    ic50Btn.addEventListener('click', () => {
      showIC50 = !showIC50;
      ic50Btn.classList.toggle('active', showIC50);
      ic50Btn.textContent = showIC50 ? 'Hide IC₅₀' : 'IC₅₀';
      if (ic50Layer) ic50Layer.style('opacity', showIC50 ? 1 : 0);
    });

    // ── Tab switching ──────────────────────────────────────────────────────
    tabBar.querySelectorAll('.chart-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        tabBar.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.tab;
        draw();
      });
    });

    let rsz;
    window.addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(draw, 150); });
    requestAnimationFrame(() => requestAnimationFrame(draw));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  ADO ROBUSTNESS CHART  (#ado-chart)
  //  IC50 (nM) vs [Adenosine] (µM) — inverted y (potent = top)
  // ═══════════════════════════════════════════════════════════════════════════
  function buildADOChart(container) {
    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.display   = 'flex';
    container.style.flexDirection = 'column';

    const svgWrap = document.createElement('div');
    svgWrap.className = 'chart-svg-wrap';
    container.appendChild(svgWrap);

    const tipDiv = document.createElement('div');
    tipDiv.className = 'chart-tooltip';
    container.appendChild(tipDiv);

    const margin = { top: 22, right: 152, bottom: 52, left: 72 };

    const svg = d3.select(svgWrap).append('svg').attr('width', '100%').attr('height', '100%');
    const g   = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const tip = makeTipFn(container, svgWrap, margin);

    function innerSize() {
      const r = svgWrap.getBoundingClientRect();
      return {
        w: Math.max(r.width  - margin.left - margin.right,  10),
        h: Math.max(r.height - margin.top  - margin.bottom, 10),
      };
    }

    function draw() {
      g.selectAll('*').remove();
      const { w, h } = innerSize();

      // Inverted y: small IC50 (potent) → y = 0 (top); large IC50 → y = h (bottom)
      const xSc = d3.scaleLog().domain([0.5, 200]).range([0, w]);
      const ySc = d3.scaleLog().domain([0.1, 300000]).range([0, h]);

      const xTicks = [1, 5, 10, 25, 100];
      const yTicks = [0.1, 1, 10, 100, 1000, 10000, 100000];

      // Axes
      const xAxis = g.append('g').attr('transform', `translate(0,${h})`)
        .call(d3.axisBottom(xSc).tickValues(xTicks).tickFormat(d => d + ' µM'));
      styleAxis(xAxis);

      const yAxis = g.append('g').call(d3.axisLeft(ySc)
        .tickValues(yTicks)
        .tickFormat(d => d >= 1000 ? (d / 1000).toFixed(0) + 'µM' : d + ''));
      styleAxis(yAxis);

      // Axis labels
      const ls = s => s.style('font-family', "'IBM Plex Mono', monospace")
        .style('font-size', '0.68rem').attr('fill', 'var(--text-secondary)').attr('text-anchor', 'middle');
      ls(g.append('text').attr('x', w / 2).attr('y', h + 44)).text('[Adenosine] (µM)');
      ls(g.append('text').attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', -60))
        .text('IC₅₀ (nM)  ←  more potent');

      // Log-log linear regression → power-law curve fit
      function logLogFit(pts) {
        const n  = pts.length;
        const lx = pts.map(p => Math.log10(p.x));
        const ly = pts.map(p => Math.log10(p.y));
        const mx = lx.reduce((a, b) => a + b) / n;
        const my = ly.reduce((a, b) => a + b) / n;
        const slope     = lx.reduce((s, x, i) => s + (x - mx) * (ly[i] - my), 0) /
                          lx.reduce((s, x)    => s + (x - mx) ** 2, 0);
        const intercept = my - slope * mx;
        return x => Math.pow(10, intercept + slope * Math.log10(x));
      }

      const curveLine = d3.line().x(d => xSc(d.x)).y(d => ySc(d.y));
      const CURVE_N   = 150;
      const logXMin   = Math.log10(0.5), logXMax = Math.log10(200);

      CD3_DATA.forEach(c => {
        const fitFn = logLogFit(c.pts);
        const curvePts = d3.range(CURVE_N).map(i => {
          const x = Math.pow(10, logXMin + (logXMax - logXMin) * i / (CURVE_N - 1));
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

      // Legend
      const lx = w + 14;
      CD3_DATA.forEach((c, i) => {
        const ly = i * 28;
        g.append('line').attr('x1', lx).attr('x2', lx + 18).attr('y1', ly + 6).attr('y2', ly + 6)
          .attr('stroke', c.color).attr('stroke-width', c.weight);
        g.append('text').attr('x', lx + 24).attr('y', ly + 10)
          .style('font-family', "'IBM Plex Mono', monospace").style('font-size', '9.5px')
          .attr('fill', 'var(--text-secondary)').text(c.name);
      });

      // Hover — snap to nearest x point
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
            const val = pt ? fmtNM(pt.y) : '—';
            return `<div class="tt-row">
              <span class="tt-dot" style="background:${c.color}"></span>
              <span>${c.name}</span>
              <span class="tt-val">${val}</span>
            </div>`;
          }).join('');
          tip.show(`<div class="tt-header">[ADO] = ${nearest} µM</div>${rows}`, xSc(nearest), 20);
        })
        .on('mouseleave', () => tip.hide());
    }

    let rsz;
    window.addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(draw, 150); });
    requestAnimationFrame(() => requestAnimationFrame(draw));
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  function init() {
    if (typeof d3 === 'undefined') return;
    const drEl  = document.getElementById('dr-curve-chart');
    const adoEl = document.getElementById('ado-chart');
    if (drEl)  buildDRChart(drEl);
    if (adoEl) buildADOChart(adoEl);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
