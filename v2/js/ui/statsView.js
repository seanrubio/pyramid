export function renderStatsView(container, ctx) {
  const divTeams = Object.values(ctx.state.teams).filter(t => t.div === ctx.tableDiv);
  const allPlayers = [];

  divTeams.forEach(t => {
    t.squad.forEach(p => {
      if (p.minutesPlayed > 0) allPlayers.push({ ...p, teamName: t.name, teamId: t.id });
    });
  });

  allPlayers.sort((a, b) => (b.stats?.[ctx.statsMetric] || 0) - (a.stats?.[ctx.statsMetric] || 0) || (b.minutesPlayed || 0) - (a.minutesPlayed || 0));
  const topPlayers = allPlayers.slice(0, 20);

  const metricConfigs = [
    { id: 'goals', label: 'TOP SCORERS', statKey: 'goals', col: 'G' },
    { id: 'assists', label: 'MOST ASSISTS', statKey: 'assists', col: 'A' },
    { id: 'xg', label: 'EXPECTED GOALS', statKey: 'xg', col: 'xG', format: v => (v || 0).toFixed(1) },
    { id: 'tackles', label: 'TOP TACKLERS', statKey: 'tackles', col: 'TK' },
    { id: 'saves', label: 'MOST SAVES', statKey: 'saves', col: 'SV' }
  ];
  const currentConfig = metricConfigs.find(m => m.id === ctx.statsMetric) || metricConfigs[0];

  container.innerHTML = `
    <div style="display: flex; gap: 4px; margin-bottom: 8px; overflow-x: auto;">
      ${Array.from({ length: 10 }, (_, i) => i + 1).map(d => `
        <button onclick="setStatsDiv(${d})" style="${ctx.tableDiv === d ? 'border-color: var(--accent); color: var(--accent);' : ''}">DIV ${d}</button>
      `).join('')}
    </div>

    <div style="display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap;">
      ${metricConfigs.map(m => `
        <button onclick="setStatsMetric('${m.id}')" style="${ctx.statsMetric === m.id ? 'border-color: var(--accent); color: var(--accent); font-weight: 700;' : ''}">
          ${m.label}
        </button>
      `).join('')}
    </div>

    <div class="panel" style="overflow-x: auto;">
      <table>
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">#</th>
            <th>Player</th>
            <th>Club</th>
            <th>Archetype</th>
            <th style="text-align: center; width: 45px;">Age</th>
            <th style="text-align: center; width: 50px;">Apps</th>
            <th style="text-align: right; width: 60px;">Min</th>
            <th style="text-align: right; width: 60px; font-weight: 700; color: #fff;">${currentConfig.col}</th>
          </tr>
        </thead>
        <tbody>
          ${topPlayers.map((p, idx) => `
            <tr style="background: ${p.teamId === ctx.state.userTeamId ? 'rgba(88, 166, 255, 0.08)' : 'transparent'};">
              <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
              <td style="font-weight: 600; color: #fff;">${p.name}${p.isGK ? ' <span style="color: var(--accent); font-size: 10px;">[GK]</span>' : ''}</td>
              <td><span onclick="inspectTeam('${p.teamId}', 'squad')" style="cursor: pointer;">${p.teamName}</span></td>
              <td style="color: var(--text-muted);">${p.archetypeName}</td>
              <td style="text-align: center; color: var(--text-muted);">${p.age}</td>
              <td style="text-align: center; color: var(--text-muted);">${Math.ceil(p.minutesPlayed / 90)}</td>
              <td style="text-align: right; color: var(--text-muted);">${p.minutesPlayed}'</td>
              <td style="text-align: right; font-weight: 700; color: var(--accent);">${currentConfig.format ? currentConfig.format(p.stats?.[currentConfig.statKey]) : (p.stats?.[currentConfig.statKey] || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function setStatsMetric(m, ctx, renderLayout) {
  ctx.statsMetric = m;
  renderLayout();
}

export function setStatsDiv(d, ctx, renderLayout) {
  ctx.tableDiv = d;
  renderLayout();
}
