// ─────────────────────────────────────────────────────────────────────────────
//  dr-curve.js  —  A2AR antagonist competitive profiling
//  Two-tab D3 v7 visualisation for #dr-curve-chart
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ── Data ───────────────────────────────────────────────────────────────────

  // Tab 1: Dose–response in low-adenosine conditions
  // EC50 in nM, derived from published cell-based assay data
  const drCompounds = [
    { name: 'Inupadenant (iTeos)', ec50: 0.063, hill: 1.2, emax: 100, color: '#1a8a82', weight: 2.5, dash: null },
    { name: 'Preladenant',          ec50: 1.0,   hill: 1.0, emax: 100, color: '#6366f1', weight: 1.5, dash: '6,3' },
    { name: 'Istradefylline',        ec50: 10,    hill: 0.9, emax: 100, color: '#f59e0b', weight: 1.5, dash: '4,4' },
    { name: 'CPI-444',               ec50: 100,   hill: 0.9, emax: 100, color: '#ef4444', weight: 1.5, dash: '8,3' },
    { name: 'AZD-4635',              ec50: 600,   hill: 0.9, emax: 100, color: '#a855f7', weight: 1.5, dash: '3,3' },
  ];

  // Tab 2: IC₅₀ vs [Adenosine] — low serum (solid) vs tumour (dashed)
  // IC50 in nM at each [ADO] in µM; values from Image 1 (inverted y, lower = more potent)
  const adoConc = [1, 3, 10, 100]; // µM
  const competCompounds = [
    {
      name: 'Inupadenant (iTeos)', color: '#1a8a82', weight: 2.5,
      lowSerum: [0.07, 0.08, 0.08, 0.06],
      tumor:    [3.0,  4.0,  4.5,  5.0],
    },
    {
      name: 'Etrumadenant', color: '#6366f1', weight: 1.5,
      lowSerum: [0.30, 0.50, 0.70, 0.70],
      tumor:    [3.0,  15,   80,   600],
    },
    {
      name: 'Ciforadenant', color: '#38a169', weight: 1.5,
      lowSerum: [3.0,  7.0,  20,   80],
      tumor:    [400,  2000, 8000, 80000],
    },
    {
      name: 'Imaradenant', color: '#d97706', weight: 1.5,
      lowSerum: [3.0,  8.0,  25,   100],
      tumor:    [100,  400,  2000, 10000],
    },
  ];

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  function init() {
    const container = document.getElementById('dr-curve-chart');
    if (!container || typeof d3 === 'undefined') return;

    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.padding = '0';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.className = 'chart-tabs';
    tabBar.innerHTML = `
      <button class="chart-tab active" data-tab="dr">Dose–Response</button>
      <button class="chart-tab" data-tab="compet">Adenosine Robustness</button>
    `;
    container.appendChild(tabBar);

    // SVG wrapper — takes remaining height
    const svgWrap = document.createElement('div');
    svgWrap.className = 'chart-svg-wrap';
    container.appendChild(svgWrap);

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    container.appendChild(tooltip);

    const margin = { top: 22, right: 150, bottom: 52, left: 62 };

    const svg = d3.select(svgWrap).append('svg')
      .attr('width', '100%')
      .attr('height', '100%');

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    function innerSize() {
      const r = svgWrap.getBoundingClientRect();
      return {
        w: Math.max(r.width  - margin.left - margin.right,  10),
        h: Math.max(r.height - margin.top  - margin.bottom, 10),
      };
    }

    // ── Hill equation ─────────────────────────────────────────────────────
    function hill(x, ec50, n, emax) {
      const xn = Math.pow(x, n), en = Math.pow(ec50, n);
      return emax * xn / (en + xn);
    }

    // ── Shared helpers ─────────────────────────────────────────────────────
    function fmtNM(v) {
      if (v >= 1e6) return (v / 1e6).toFixed(1) + ' mM';
      if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1) + ' µM';
      if (v < 0.1)  return v.toFixed(3) + ' nM';
      if (v < 1)    return v.toFixed(2) + ' nM';
      return v.toFixed(0) + ' nM';
    }

    function showTip(html, mx, my) {
      tooltip.innerHTML = html;
      tooltip.style.opacity = '1';
      const cRect = container.getBoundingClientRect();
      const wRect = svgWrap.getBoundingClientRect();
      const tx = wRect.left - cRect.left + margin.left + mx;
      const ty = wRect.top  - cRect.top  + margin.top  + my;
      const tipW = tooltip.offsetWidth || 200;
      const cW = container.offsetWidth;
      tooltip.style.left = (tx + tipW + 16 > cW ? tx - tipW - 6 : tx + 12) + 'px';
      tooltip.style.top  = Math.max(0, ty - 10) + 'px';
    }

    function hideTip() { tooltip.style.opacity = '0'; }

    function axisStyles(sel) {
      sel.select('.domain').attr('stroke', 'var(--border)');
      sel.selectAll('.tick line').attr('stroke', 'var(--border)');
      sel.selectAll('.tick text')
        .style('font-family', "'IBM Plex Mono', monospace")
        .style('font-size', '10px')
        .attr('fill', 'var(--text-muted)');
    }

    function gridGroup(parent) {
      return parent.append('g').attr('class', 'dr-grid');
    }

    // ── Tab 1: Dose–Response ───────────────────────────────────────────────
    function drawDR() {
      g.selectAll('*').remove();
      const { w, h } = innerSize();

      const xScale = d3.scaleLog().domain([0.001, 100000]).range([0, w]);
      const yScale = d3.scaleLinear().domain([0, 105]).range([h, 0]);

      // Grid
      const xGrid = gridGroup(g);
      xGrid.attr('transform', `translate(0,${h})`)
        .call(d3.axisBottom(xScale)
          .tickValues([0.001,0.01,0.1,1,10,100,1000,10000,100000])
          .tickSize(-h).tickFormat(''));
      xGrid.selectAll('line').attr('stroke', 'var(--border)').attr('stroke-dasharray','2,3').attr('opacity',0.5);
      xGrid.select('.domain').remove();

      const yGrid = gridGroup(g);
      yGrid.call(d3.axisLeft(yScale).ticks(5).tickSize(-w).tickFormat(''));
      yGrid.selectAll('line').attr('stroke', 'var(--border)').attr('stroke-dasharray','2,3').attr('opacity',0.5);
      yGrid.select('.domain').remove();

      // IC₅₀ reference line at 50%
      g.append('line')
        .attr('x1', 0).attr('x2', w)
        .attr('y1', yScale(50)).attr('y2', yScale(50))
        .attr('stroke', 'var(--text-muted)').attr('stroke-dasharray','3,4').attr('stroke-width', 1);
      g.append('text')
        .attr('x', 3).attr('y', yScale(50) - 4)
        .style('font-family', "'IBM Plex Mono', monospace").style('font-size', '9px')
        .attr('fill', 'var(--text-muted)').text('IC₅₀');

      // X axis
      const xAxis = g.append('g').attr('transform', `translate(0,${h})`)
        .call(d3.axisBottom(xScale)
          .tickValues([0.001,0.01,0.1,1,10,100,1000,10000,100000])
          .tickFormat(d => {
            const m = {0.001:'0.001',0.01:'0.01',0.1:'0.1',1:'1',10:'10',100:'100',1000:'1µM',10000:'10µM',100000:'100µM'};
            return m[d] || '';
          }));
      axisStyles(xAxis);

      // Y axis
      const yAxis = g.append('g').call(d3.axisLeft(yScale).ticks(5).tickFormat(d => d + '%'));
      axisStyles(yAxis);

      // Axis labels
      g.append('text').attr('class','dr-axis-label')
        .attr('x', w / 2).attr('y', h + 44).attr('text-anchor','middle')
        .attr('fill','var(--text-secondary)').text('Concentration (nM)');
      g.append('text').attr('class','dr-axis-label')
        .attr('transform','rotate(-90)').attr('x', -h / 2).attr('y', -50)
        .attr('text-anchor','middle').attr('fill','var(--text-secondary)').text('% Inhibition');

      // Curves
      const lineGen = d3.line().x(d => xScale(d.x)).y(d => yScale(d.y)).curve(d3.curveCatmullRom);
      const N = 250, x0 = Math.log10(0.001), x1 = Math.log10(100000);

      drCompounds.forEach(c => {
        const pts = d3.range(N).map(i => {
          const x = Math.pow(10, x0 + (x1 - x0) * i / (N - 1));
          return { x, y: hill(x, c.ec50, c.hill, c.emax) };
        });
        const path = g.append('path').datum(pts)
          .attr('d', lineGen).attr('fill','none')
          .attr('stroke', c.color).attr('stroke-width', c.weight);
        if (c.dash) path.attr('stroke-dasharray', c.dash);
      });

      // Legend
      drCompounds.forEach((c, i) => {
        const ly = i * 30;
        const lx = w + 14;
        const p = g.append('line')
          .attr('x1', lx).attr('x2', lx + 20).attr('y1', ly + 7).attr('y2', ly + 7)
          .attr('stroke', c.color).attr('stroke-width', c.weight);
        if (c.dash) p.attr('stroke-dasharray', c.dash);
        g.append('text').attr('x', lx + 26).attr('y', ly + 11)
          .style('font-family',"'IBM Plex Mono', monospace").style('font-size','9.5px')
          .attr('fill','var(--text-secondary)').text(c.name);
      });

      // Hover
      const crosshair = g.append('line').attr('class','dr-crosshair')
        .attr('y1', 0).attr('y2', h).attr('opacity', 0)
        .attr('stroke','var(--text-muted)').attr('stroke-dasharray','3,3').attr('stroke-width',1)
        .attr('pointer-events','none');

      g.append('rect').attr('width', w).attr('height', h).attr('fill','none').attr('pointer-events','all')
        .on('mousemove', function(event) {
          const [mx] = d3.pointer(event);
          const xVal = xScale.invert(mx);
          crosshair.attr('x1', mx).attr('x2', mx).attr('opacity', 1);
          const xLabel = xVal >= 1000 ? fmtNM(xVal) : xVal < 1 ? xVal.toFixed(3) + ' nM' : xVal.toFixed(1) + ' nM';
          const rows = drCompounds.map(c => {
            const y = hill(xVal, c.ec50, c.hill, c.emax);
            return `<div class="tt-row"><span class="tt-dot" style="background:${c.color}"></span><span>${c.name}</span><span class="tt-val">${y.toFixed(1)}%</span></div>`;
          }).join('');
          showTip(`<div class="tt-header">${xLabel}</div>${rows}`, mx, 20);
        })
        .on('mouseleave', () => { crosshair.attr('opacity', 0); hideTip(); });
    }

    // ── Tab 2: Competitiveness Profile ────────────────────────────────────
    function drawCompet() {
      g.selectAll('*').remove();
      const { w, h } = innerSize();

      const xScale = d3.scaleLog().domain([0.5, 300]).range([0, w]);
      // Inverted: small IC50 (potent) at top — matches original figure
      const yScale = d3.scaleLog().domain([0.01, 200000]).range([0, h]);

      // Grid
      const xGrid = gridGroup(g);
      xGrid.attr('transform', `translate(0,${h})`)
        .call(d3.axisBottom(xScale).tickValues(adoConc).tickSize(-h).tickFormat(''));
      xGrid.selectAll('line').attr('stroke','var(--border)').attr('stroke-dasharray','2,3').attr('opacity',0.5);
      xGrid.select('.domain').remove();

      const yTicks = [0.01, 0.1, 1, 10, 100, 1000, 10000, 100000];
      const yGrid = gridGroup(g);
      yGrid.call(d3.axisLeft(yScale).tickValues(yTicks).tickSize(-w).tickFormat(''));
      yGrid.selectAll('line').attr('stroke','var(--border)').attr('stroke-dasharray','2,3').attr('opacity',0.5);
      yGrid.select('.domain').remove();

      // Axes
      const xAxis = g.append('g').attr('transform',`translate(0,${h})`)
        .call(d3.axisBottom(xScale).tickValues(adoConc).tickFormat(d => d + ' µM'));
      axisStyles(xAxis);

      const yAxis = g.append('g').call(d3.axisLeft(yScale)
        .tickValues(yTicks)
        .tickFormat(d => d >= 1000 ? (d/1000).toFixed(0)+'µM' : d+''));
      axisStyles(yAxis);

      // Axis labels
      g.append('text').attr('class','dr-axis-label')
        .attr('x', w/2).attr('y', h+44).attr('text-anchor','middle')
        .attr('fill','var(--text-secondary)').text('[Adenosine] (µM)');
      g.append('text').attr('class','dr-axis-label')
        .attr('transform','rotate(-90)').attr('x',-h/2).attr('y',-52)
        .attr('text-anchor','middle').attr('fill','var(--text-secondary)').text('IC₅₀ (nM)  ←  more potent');

      // Lines + points
      const lineGen = d3.line()
        .x((d, i) => xScale(adoConc[i]))
        .y(d => yScale(d));

      competCompounds.forEach(c => {
        // Low serum — solid
        g.append('path').datum(c.lowSerum).attr('d', lineGen)
          .attr('fill','none').attr('stroke', c.color).attr('stroke-width', c.weight);
        // Tumor — dashed
        g.append('path').datum(c.tumor).attr('d', lineGen)
          .attr('fill','none').attr('stroke', c.color)
          .attr('stroke-width', c.weight).attr('stroke-dasharray','6,4');
        // Low serum dots (filled)
        c.lowSerum.forEach((v, i) => {
          g.append('circle').attr('cx', xScale(adoConc[i])).attr('cy', yScale(v))
            .attr('r', c.weight === 2.5 ? 5 : 4)
            .attr('fill', c.color).attr('stroke','var(--bg-surface)').attr('stroke-width',1.5);
        });
        // Tumor dots (open)
        c.tumor.forEach((v, i) => {
          g.append('circle').attr('cx', xScale(adoConc[i])).attr('cy', yScale(v))
            .attr('r', c.weight === 2.5 ? 5 : 4)
            .attr('fill','var(--bg-surface)').attr('stroke', c.color).attr('stroke-width', 2);
        });
      });

      // Legend — compounds
      const lx = w + 14;
      competCompounds.forEach((c, i) => {
        const ly = i * 28;
        g.append('line').attr('x1',lx).attr('x2',lx+18).attr('y1',ly+6).attr('y2',ly+6)
          .attr('stroke', c.color).attr('stroke-width', c.weight);
        g.append('text').attr('x', lx+24).attr('y', ly+10)
          .style('font-family',"'IBM Plex Mono', monospace").style('font-size','9.5px')
          .attr('fill','var(--text-secondary)').text(c.name);
      });
      // Condition key
      const ky = competCompounds.length * 28 + 14;
      g.append('line').attr('x1',lx).attr('x2',lx+18).attr('y1',ky+6).attr('y2',ky+6)
        .attr('stroke','var(--text-muted)').attr('stroke-width',1.5);
      g.append('text').attr('x',lx+24).attr('y',ky+10)
        .style('font-family',"'IBM Plex Mono', monospace").style('font-size','9px')
        .attr('fill','var(--text-muted)').text('Low serum');
      g.append('line').attr('x1',lx).attr('x2',lx+18).attr('y1',ky+24).attr('y2',ky+24)
        .attr('stroke','var(--text-muted)').attr('stroke-width',1.5).attr('stroke-dasharray','5,3');
      g.append('text').attr('x',lx+24).attr('y',ky+28)
        .style('font-family',"'IBM Plex Mono', monospace").style('font-size','9px')
        .attr('fill','var(--text-muted)').text('Tumour');

      // Hover — snap to nearest [ADO]
      g.append('rect').attr('width', w).attr('height', h).attr('fill','none').attr('pointer-events','all')
        .on('mousemove', function(event) {
          const [mx] = d3.pointer(event);
          const xVal = xScale.invert(mx);
          const ni = adoConc.reduce((best, c, i) =>
            Math.abs(Math.log10(c) - Math.log10(xVal)) < Math.abs(Math.log10(adoConc[best]) - Math.log10(xVal)) ? i : best, 0);
          const rows = competCompounds.map(c => {
            const ls = c.lowSerum[ni], tm = c.tumor[ni];
            const fold = Math.round(tm / ls);
            return `<div class="tt-row">
              <span class="tt-dot" style="background:${c.color}"></span>
              <span>${c.name}</span>
              <span class="tt-val">${fmtNM(ls)} <span style="color:var(--text-muted)">→</span> ${fmtNM(tm)}</span>
            </div>`;
          }).join('');
          showTip(
            `<div class="tt-header">[ADO] = ${adoConc[ni]} µM</div>`+
            `<div class="tt-sub">low serum → tumour</div>${rows}`,
            xScale(adoConc[ni]), 20
          );
        })
        .on('mouseleave', hideTip);
    }

    // ── Render + tabs ─────────────────────────────────────────────────────
    let activeTab = 'dr';

    function render() {
      if (activeTab === 'dr') drawDR();
      else drawCompet();
    }

    tabBar.querySelectorAll('.chart-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        tabBar.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.tab;
        render();
      });
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(render, 150);
    });

    // Wait two frames for layout to settle
    requestAnimationFrame(() => requestAnimationFrame(render));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
