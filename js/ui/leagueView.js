export function renderLeagueView(container, ctx) {
  const maxR = ctx.state.maxRounds || 38;
  const currentRound = Math.max(1, Math.min(ctx.state.round, maxR));
  const activeRound = ctx.viewedFixtureRound !== null ? ctx.viewedFixtureRound : currentRound;

  const rows = [...ctx.state.tables[ctx.tableDiv]].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.xgd - a.xgd || a.name.localeCompare(b.name));
  const roundMatches = ctx.state.fixtures[ctx.tableDiv]?.[activeRound - 1] || [];

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
              <th style="width: 24px; text-align: center;">#</th>
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
              return `
                <tr style="background: ${isUser ? 'rgba(88, 166, 255, 0.08)' : 'transparent'};">
                  <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
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
