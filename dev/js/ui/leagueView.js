import { sortTableEntries } from '../engine.js';

export function renderLeagueView(container, ctx) {
  const maxR = ctx.state.maxRounds || 38;
  const currentRound = Math.max(1, Math.min(ctx.state.round, maxR));
  const activeRound = ctx.viewedFixtureRound !== null ? ctx.viewedFixtureRound : currentRound;
  const div = ctx.tableDiv;

  if (!ctx.leagueLeaderTab) ctx.leagueLeaderTab = 'boot';

  const rawTable = ctx.state.tables[div] || [];
  const rows = sortTableEntries(rawTable);
  const roundMatches = ctx.state.fixtures[div]?.[activeRound - 1] || [];

  const divButtons = Array.from({ length: 10 }, (_, i) => i + 1).map(d => {
    const activeStyle = ctx.tableDiv === d ? 'border-color: var(--accent); color: var(--accent);' : '';
    return `<button onclick="setLeagueDiv(${d})" style="${activeStyle}">DIV ${d}</button>`;
  }).join('');

  const divTeams = Object.values(ctx.state.teams).filter(t => t.div === div);
  const allDivPlayers = [];
  divTeams.forEach(t => {
    (t.squad || []).forEach(p => {
      allDivPlayers.push({ player: p, team: t });
    });
  });

  const formatShortName = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
  };

  let leaderList = [];
  let primaryGetter = (p) => p.stats?.goals || 0;
  let subGetter = (p) => `${(p.stats?.xg || 0).toFixed(1)} xG`;

  if (ctx.leagueLeaderTab === 'assist') {
    leaderList = [...allDivPlayers]
      .filter(x => ((x.player.stats?.assists || 0) + (x.player.stats?.xa || 0)) > 0)
      .sort((a, b) => 
        (b.player.stats?.assists || 0) - (a.player.stats?.assists || 0) || 
        (b.player.stats?.xa || 0) - (a.player.stats?.xa || 0)
      )
      .slice(0, 5);
    primaryGetter = (p) => p.stats?.assists || 0;
    subGetter = (p) => `${(p.stats?.xa || 0).toFixed(1)} xA`;

  } else if (ctx.leagueLeaderTab === 'glove') {
    leaderList = [...allDivPlayers]
      .filter(x => x.player.isGK && (x.player.stats?.apps || 0) > 0)
      .sort((a, b) => 
        (b.player.stats?.cleanSheets || 0) - (a.player.stats?.cleanSheets || 0) || 
        (b.player.stats?.saves || 0) - (a.player.stats?.saves || 0)
      )
      .slice(0, 5);
    primaryGetter = (p) => p.stats?.cleanSheets || 0;
    subGetter = (p) => {
      const sf = p.stats?.shotsFaced || 0;
      const sv = p.stats?.saves || 0;
      const pct = sf > 0 ? ((sv / sf) * 100).toFixed(0) : '0';
      return `${pct}% sv`;
    };

  } else {
    leaderList = [...allDivPlayers]
      .filter(x => (x.player.stats?.goals || 0) > 0)
      .sort((a, b) => 
        (b.player.stats?.goals || 0) - (a.player.stats?.goals || 0) || 
        (b.player.stats?.xg || 0) - (a.player.stats?.xg || 0)
      )
      .slice(0, 5);
  }

  const leaderRowsHtml = leaderList.length ? leaderList.map((item, idx) => {
    const p = item.player;
    const t = item.team;
    const isUser = t.id === ctx.state.userTeamId;
    const shortName = formatShortName(p.name);

    return `
      <div style="display: grid; grid-template-columns: 18px 1fr 100px auto; align-items: center; gap: 8px; font-size: 11px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
        <span style="color: var(--text-muted); font-weight: 700;">${idx + 1}.</span>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <strong style="color: ${isUser ? 'var(--accent)' : '#fff'}; cursor: pointer;" onclick="inspectTeam('${t.id}', 'squad')">${shortName}</strong>
        </span>
        <span style="color: var(--text-muted); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left;">
          ${t.name}
        </span>
        <div style="font-family: monospace; font-size: 11px; text-align: right; min-width: 70px;">
          <strong style="color: #fff;">${primaryGetter(p)}</strong>
          <span style="color: var(--text-muted); font-size: 10px;"> (${subGetter(p)})</span>
        </div>
      </div>
    `;
  }).join('') : `
    <div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 11px; font-style: italic;">
      No qualifying records yet this campaign.
    </div>
  `;

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
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; border-radius: 3px; background: ${isUserMatch ? 'rgba(88, 166, 255, 0.08)' : '#0d1117'}; border: 1px solid var(--border);">
        <div style="flex: 1; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 6px;">
          <span onclick="inspectTeam('${m.home}', 'squad')" style="cursor: pointer; font-size: 11px;">${homeName}</span>
        </div>
        <div style="min-width: 68px; text-align: center; display: flex; flex-direction: column; align-items: center;">
          ${m.played ? `
            <button onclick="openMatchReport('${m.home}',${activeRound})" 
                    title="View Match Report"
                    style="padding: 1px 6px; font-family: monospace; font-size: 11px; font-weight: 700; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border); color: #fff; cursor: pointer; border-radius: 3px;">
              ${m.hg}–${m.ag}
            </button>
            <span style="font-family: monospace; font-size: 9px; color: var(--text-muted); margin-top: 2px;">${m.hxg.toFixed(1)}–${m.axg.toFixed(1)}</span>
          ` : `<span style="font-family: monospace; font-size: 10px; color: var(--text-muted);">vs</span>`}
        </div>
        <div style="flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 6px;">
          <span onclick="inspectTeam('${m.away}', 'squad')" style="cursor: pointer; font-size: 11px;">${awayName}</span>
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

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div class="panel" style="padding: 10px 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="color: #fff; font-size: 12px;">LEADERS</strong>
            <div style="display: flex; gap: 3px;">
              ${[
                { key: 'boot', label: 'GOLDEN BOOT' },
                { key: 'assist', label: 'ASSIST KING' },
                { key: 'glove', label: 'GOLDEN GLOVE' }
              ].map(tab => `
                <button onclick="setLeagueLeaderTab('${tab.key}')" style="padding: 1px 6px; font-size: 10px; font-weight: 600; text-transform: uppercase; ${ctx.leagueLeaderTab === tab.key ? 'border-color: var(--accent); color: var(--accent);' : 'color: var(--text-muted);'}">
                  ${tab.label}
                </button>
              `).join('')}
            </div>
          </div>
          <div style="display: flex; flex-direction: column;">
            ${leaderRowsHtml}
          </div>
        </div>

        <div class="panel" style="padding: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-bottom: 8px;">
            <strong style="color: #fff; font-size: 12px;">ROUND ${activeRound} FIXTURES</strong>
            <div style="display: flex; gap: 4px;">
              <button onclick="changeLeagueRound(-1)" style="padding: 1px 6px;" ${activeRound <= 1 ? 'disabled' : ''}>&lt;</button>
              <button onclick="changeLeagueRound(1)" style="padding: 1px 6px;" ${activeRound >= maxR ? 'disabled' : ''}>&gt;</button>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 3px;">
            ${fixturesHtml}
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

export function setLeagueLeaderTab(cat, ctx, renderLayout) {
  ctx.leagueLeaderTab = cat;
  renderLayout();
}

export function changeLeagueRound(delta, ctx, renderLayout) {
  const maxR = ctx.state.maxRounds || 38;
  const currentRound = Math.max(1, Math.min(ctx.state.round, maxR));
  const curr = ctx.viewedFixtureRound !== null ? ctx.viewedFixtureRound : currentRound;
  ctx.viewedFixtureRound = Math.max(1, Math.min(maxR, curr + delta));
  renderLayout();
}
