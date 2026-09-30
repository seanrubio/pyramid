import { sortTableEntries } from '../engine.js';

export function renderLeagueView(container, ctx) {
  const maxR = ctx.state.maxRounds || 38;
  const currentRound = Math.max(1, Math.min(ctx.state.round, maxR));
  const activeRound = ctx.viewedFixtureRound !== null ? ctx.viewedFixtureRound : currentRound;
  const div = ctx.tableDiv;

  const rawTable = ctx.state.tables[div] || [];
  const rows = sortTableEntries(rawTable);
  const roundMatches = ctx.state.fixtures[div]?.[activeRound - 1] || [];

  const divButtons = Array.from({ length: 10 }, (_, i) => i + 1).map(d => {
    const activeStyle = ctx.tableDiv === d ? 'border-color: var(--accent); color: var(--accent);' : '';
    return `<button onclick="setLeagueDiv(${d})" style="${activeStyle}">DIV ${d}</button>`;
  }).join('');

  // Collect all players active in this division
  const divTeams = Object.values(ctx.state.teams).filter(t => t.div === div);
  const allDivPlayers = [];
  divTeams.forEach(t => {
    (t.squad || []).forEach(p => {
      allDivPlayers.push({ player: p, team: t });
    });
  });

  // Calculate Leaders for this Division
  const topScorers = [...allDivPlayers]
    .filter(x => (x.player.stats?.goals || 0) > 0)
    .sort((a, b) => (b.player.stats.goals || 0) - (a.player.stats.goals || 0) || (b.player.stats.shots || 0) - (a.player.stats.shots || 0))
    .slice(0, 5);

  const topPlaymakers = [...allDivPlayers]
    .filter(x => ((x.player.stats?.assists || 0) + (x.player.stats?.keyPasses || 0)) > 0)
    .sort((a, b) => (b.player.stats.assists || 0) - (a.player.stats.assists || 0) || (b.player.stats.keyPasses || 0) - (a.player.stats.keyPasses || 0))
    .slice(0, 5);

  const topKeepers = [...allDivPlayers]
    .filter(x => x.player.isGK && (x.player.stats?.apps || 0) > 0)
    .sort((a, b) => (b.player.stats.cleanSheets || 0) - (a.player.stats.cleanSheets || 0) || (b.player.stats.saves || 0) - (a.player.stats.saves || 0))
    .slice(0, 5);

  const renderLeaderPod = (title, items, valueLabel, subLabelKey = null) => {
    if (!items.length) {
      return `
        <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--border); border-radius: 4px; padding: 8px 10px;">
          <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">${title}</div>
          <div style="font-size: 11px; color: var(--text-muted); font-style: italic;">No records yet</div>
        </div>
      `;
    }

    const rowsHtml = items.map((item, idx) => {
      const p = item.player;
      const t = item.team;
      const isUser = t.id === ctx.state.userTeamId;
      const primaryVal = typeof valueLabel === 'function' ? valueLabel(p) : (p.stats[valueLabel] || 0);
      const subVal = subLabelKey ? (typeof subLabelKey === 'function' ? subLabelKey(p) : p.stats[subLabelKey] || 0) : null;

      return `
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.03);">
          <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px;">
            <span style="color: var(--text-muted); width: 14px; display: inline-block;">${idx + 1}.</span>
            <strong style="color: ${isUser ? 'var(--accent)' : '#fff'}; cursor: pointer;" onclick="inspectTeam('${t.id}', 'squad')">${p.name}</strong>
            <span style="color: var(--text-muted); font-size: 10px; margin-left: 4px;">(${t.name})</span>
          </div>
          <div style="font-family: monospace; font-size: 11px; text-align: right;">
            <strong style="color: #fff;">${primaryVal}</strong>
            ${subVal !== null ? `<span style="color: var(--text-muted); font-size: 10px;"> (${subVal})</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--border); border-radius: 4px; padding: 8px 10px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: var(--accent); text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid var(--border); padding-bottom: 4px;">
          <span>${title}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 3px;">
          ${rowsHtml}
        </div>
      </div>
    `;
  };

  const tableRowsHtml = rows.map((r, idx) => {
    const isUser = (r.teamId === ctx.state.userTeamId);
    const rank = idx + 1;
    const totalTeams = rows.length;

    const isPromoted = (div > 1 && rank <= 3);
    const isRelegated = (div < 10 && rank > totalTeams - 3);
    const isChampion = (div === 1 && rank === 1);

    let zoneBorder = 'border-left: 3px solid transparent;';
    let zoneBg = isUser ? 'background: rgba(88, 166, 255, 0.12);' : '';

    if (isChampion) {
      zoneBorder = 'border-left: 3px solid #e3b341;';
      if (!isUser) zoneBg = 'background: rgba(227, 179, 65, 0.05);';
    } else if (isPromoted) {
      zoneBorder = 'border-left: 3px solid var(--green, #3fb950);';
      if (!isUser) zoneBg = 'background: rgba(63, 185, 80, 0.05);';
    } else if (isRelegated) {
      zoneBorder = 'border-left: 3px solid var(--red, #f85149);';
      if (!isUser) zoneBg = 'background: rgba(248, 81, 73, 0.05);';
    }

    const gdColor = r.gd > 0 ? 'var(--green)' : r.gd < 0 ? 'var(--red)' : 'var(--text-muted)';
    const gdSign = r.gd > 0 ? '+' : '';
    const xgdSign = r.xgd > 0 ? '+' : '';
    const ppg = r.p > 0 ? (r.pts / r.p).toFixed(2) : '0.00';

    return `
      <tr style="${zoneBorder} ${zoneBg}">
        <td style="text-align: center; color: var(--text-muted); font-weight: ${rank <= 3 || isRelegated ? '700' : 'normal'};">${rank}</td>
        <td><span onclick="inspectTeam('${r.teamId}', 'squad')" style="cursor: pointer; font-weight: ${isUser ? '700' : '500'};">${r.name}</span></td>
        <td style="text-align: center; color: var(--text-muted);">${r.p}</td>
        <td style="text-align: center;">${r.w}</td>
        <td style="text-align: center;">${r.d}</td>
        <td style="text-align: center;">${r.l}</td>
        <td style="text-align: center; color: ${gdColor};">${gdSign}${r.gd}</td>
        <td style="text-align: center; color: var(--text-muted);">${xgdSign}${r.xgd.toFixed(1)}</td>
        <td style="text-align: right; font-weight: 700; color: #fff;">${r.pts}</td>
        <td style="text-align: right; color: var(--text-muted); font-family: monospace;">${ppg}</td>
      </tr>
    `;
  }).join('');

  let legendHtml = '';
  if (div === 1) {
    legendHtml += `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="display: inline-block; width: 10px; height: 10px; background: #e3b341; border-radius: 2px;"></span> Champions
      </div>
    `;
  } else {
    legendHtml += `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="display: inline-block; width: 10px; height: 10px; background: var(--green, #3fb950); border-radius: 2px;"></span> Promotion (Div ${div - 1})
      </div>
    `;
  }

  if (div < 10) {
    legendHtml += `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="display: inline-block; width: 10px; height: 10px; background: var(--red, #f85149); border-radius: 2px;"></span> Relegation (Div ${div + 1})
      </div>
    `;
  }

  const fixturesHtml = roundMatches.map(m => {
    const isUserMatch = (m.home === ctx.state.userTeamId || m.away === ctx.state.userTeamId);
    const homeName = ctx.state.teams[m.home]?.name || 'Unknown';
    const awayName = ctx.state.teams[m.away]?.name || 'Unknown';

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 8px; border-radius: 4px; background: ${isUserMatch ? 'rgba(88, 166, 255, 0.08)' : '#0d1117'}; border: 1px solid var(--border);">
        <div style="flex: 1; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 6px;">
          <span onclick="inspectTeam('${m.home}', 'squad')" style="cursor: pointer;">${homeName}</span>
        </div>
        <div style="min-width: 76px; text-align: center; display: flex; flex-direction: column;">
          ${m.played ? `
            <span style="font-family: monospace; font-weight: 700; color: #fff;">${m.hg}&nbsp;–&nbsp;${m.ag}</span>
            <span style="font-family: monospace; font-size: 10px; color: var(--text-muted);">${m.hxg.toFixed(1)}&nbsp;–&nbsp;${m.axg.toFixed(1)}</span>
          ` : `<span style="font-family: monospace; font-size: 11px; color: var(--text-muted);">vs</span>`}
        </div>
        <div style="flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 6px;">
          <span onclick="inspectTeam('${m.away}', 'squad')" style="cursor: pointer;">${awayName}</span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div style="display: flex; gap: 4px; margin-bottom: 12px; overflow-x: auto;">
      ${divButtons}
    </div>

    <div style="display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 16px; align-items: start;">
      <div class="panel" style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th style="width: 28px; text-align: center;">#</th>
              <th>Club</th>
              <th style="text-align: center; width: 28px;">P</th>
              <th style="text-align: center; width: 28px;">W</th>
              <th style="text-align: center; width: 28px;">D</th>
              <th style="text-align: center; width: 28px;">L</th>
              <th style="text-align: center; width: 30px;">GD</th>
              <th style="text-align: center; width: 38px;">xGD</th>
              <th style="text-align: right; width: 34px; font-weight: 700; color: #fff;">PTS</th>
              <th style="text-align: right; width: 38px; color: var(--text-muted);">PPG</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <div style="display: flex; gap: 16px; padding: 10px 12px; font-size: 11px; border-top: 1px solid var(--border); color: var(--text-muted);">
          ${legendHtml}
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Round Fixtures Box -->
        <div class="panel" style="padding: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-bottom: 8px;">
            <strong style="color: #fff; font-size: 12px;">ROUND ${activeRound} FIXTURES</strong>
            <div style="display: flex; gap: 4px;">
              <button onclick="changeLeagueRound(-1)" style="padding: 1px 6px;" ${activeRound <= 1 ? 'disabled' : ''}>&lt;</button>
              <button onclick="changeLeagueRound(1)" style="padding: 1px 6px;" ${activeRound >= maxR ? 'disabled' : ''}>&gt;</button>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${fixturesHtml}
          </div>
        </div>

        <!-- Division Leaders Pods -->
        <div class="panel" style="padding: 12px; display: flex; flex-direction: column; gap: 10px;">
          <div style="font-size: 12px; font-weight: 700; color: #fff; border-bottom: 1px solid var(--border); padding-bottom: 4px;">
            DIV ${div} LEADERS
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${renderLeaderPod('Goals (Golden Boot)', topScorers, 'goals', (p) => `${p.stats.shots || 0} sh`)}
            ${renderLeaderPod('Playmakers (Assists / KP)', topPlaymakers, 'assists', (p) => `${p.stats.keyPasses || 0} kp`)}
            ${renderLeaderPod('Goalkeepers (Clean Sheets / SV)', topKeepers, 'cleanSheets', (p) => `${p.stats.saves || 0} sv`)}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function setLeagueDiv(d, ctx, renderLayout) {
  ctx.tableDiv = d;
  renderLayout();
}

export function changeLeagueRound(delta, ctx, renderLayout) {
  const maxR = ctx.state.maxRounds || 38;
  const currentRound = Math.max(1, Math.min(ctx.state.round, maxR));
  const curr = ctx.viewedFixtureRound !== null ? ctx.viewedFixtureRound : currentRound;
  ctx.viewedFixtureRound = Math.max(1, Math.min(maxR, curr + delta));
  renderLayout();
}
