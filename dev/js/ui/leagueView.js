import { sortTableEntries } from '../engine.js';

export function renderLeagueView(container, ctx) {
  const maxR = ctx.state.maxRounds || 38;
  const currentRound = Math.max(1, Math.min(ctx.state.round, maxR));
  const activeRound = ctx.viewedFixtureRound !== null ? ctx.viewedFixtureRound : currentRound;
  const div = ctx.tableDiv;

  const rawTable = ctx.state.tables[div] || [];
  const rows = sortTableEntries(rawTable);
  const roundMatches = ctx.state.fixtures[div]?.[activeRound - 1] || [];

  container.innerHTML = `
    <div style="display: flex; gap: 4px; margin-bottom: 12px; overflow-x: auto;">
      ${Array.from({ length: 10 }, (_, i) => i + 1).map(d => `
        <button onclick="setLeagueDiv(${d})" style="${ctx.tableDiv === d ? 'border-color: var(--accent); color: var(--accent);' : ''}">DIV ${d}</button>
      `).join('')}
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
            ${rows.map((r, idx) => {
              const isUser = (r.teamId === ctx.state.userTeamId);
              const rank = idx + 1;
              const totalTeams = rows.length;

              // Pro / Rel Zone Indicators
              const isPromoted = div > 1 && rank <= 3;
              const isRelegated = div < 10 && rank > totalTeams - 3;
              const isChampion = div === 1 && rank === 1;

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

              return `
                <tr style="${zoneBorder}${zoneBg}">
                  <td style="text-align: center; color: var(--text-muted); font-weight: ${rank <= 3 \vert{}\vert{} isRelegated ? '700' : 'normal'};">${rank}</td>
                  <td><span onclick="inspectTeam('${r.teamId}', 'squad')" style="cursor: pointer; font-weight: ${isUser ? '700' : '500'};">${r.name}</span></td>
                  <td style="text-align: center; color: var(--text-muted);">${r.p}</td>
                  <td style="text-align: center;">${r.w}</td>
                  <td style="text-align: center;">${r.d}</td>
                  <td style="text-align: center;">${r.l}</td>
                  <td style="text-align: center; color: ${r.gd > 0 ? 'var(--green)' : r.gd < 0 ? 'var(--red)' : 'var(--text-muted)'};">${r.gd > 0 ? '+' : ''}${r.gd}</td>
                  <td style="text-align: center; color: var(--text-muted);">${r.xgd > 0 ? '+' : ''}${r.xgd.toFixed(1)}</td>
                  <td style="text-align: right; font-weight: 700; color: #fff;">${r.pts}</td>
                  <td style="text-align: right; color: var(--text-muted); font-family: monospace;">${r.p > 0 ? (r.pts / r.p).toFixed(2) : '0.00'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- Pro / Rel Legend -->
        <div style="display: flex; gap: 16px; padding: 10px 12px; font-size: 11px; border-top: 1px solid var(--border); color: var(--text-muted);">
          ${div === 1 ? `
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 10px; height: 10px; background: #e3b341; border-radius: 2px;"></span> Champions
            </div>
          ` : `
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 10px; height: 10px; background: var(--green, #3fb950); border-radius: 2px;"></span> Promotion (Div ${div - 1})
            </div>
          `}
          ${div < 10 ? `
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 10px; height: 10px; background: var(--red, #f85149); border-radius: 2px;"></span> Relegation (Div ${div + 1})
            </div>
          ` : ''}
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
        <div style="display: flex; flex-direction: column; gap: 4px;">
          ${roundMatches.map(m => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 8px; border-radius: 4px; background: ${m.home === ctx.state.userTeamId || m.away === ctx.state.userTeamId ? 'rgba(88, 166, 255, 0.08)' : '#0d1117'}; border: 1px solid var(--border);">
              <div style="flex: 1; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 6px;">
                <span onclick="inspectTeam('${m.home}', 'squad')" style="cursor: pointer;">${ctx.state.teams[m.home]?.name || 'Unknown'}</span>
              </div>
              <div style="min-width: 76px; text-align: center; display: flex; flex-direction: column;">
                ${m.played ? `
                  <span style="font-family: monospace; font-weight: 700; color: #fff;">${m.hg}&nbsp;–&nbsp;${m.ag}</span>
                  <span style="font-family: monospace; font-size: 10px; color: var(--text-muted);">${m.hxg.toFixed(1)}&nbsp;–&nbsp;${m.axg.toFixed(1)}</span>
                ` : `<span style="font-family: monospace; font-size: 11px; color: var(--text-muted);">vs</span>`}
              </div>
              <div style="flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 6px;">
                <span onclick="inspectTeam('${m.away}', 'squad')" style="cursor: pointer;">${ctx.state.teams[m.away]?.name || 'Unknown'}</span>
              </div>
            </div>
          `).join('')}
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
