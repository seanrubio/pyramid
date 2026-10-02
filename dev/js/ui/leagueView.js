import { sortTableEntries } from '../engine.js';

export function renderLeagueView(container, ctx) {
  if (!ctx.activeCompetitionView) ctx.activeCompetitionView = 'league';
  if (!ctx.leagueLeaderTab) ctx.leagueLeaderTab = 'boot';

  // Discover available regional cup names dynamically from state
  const availableCups = Object.keys(ctx.state.regionalTables || {}).sort();
  if (!ctx.selectedRegionalCup || !ctx.state.regionalTables?.[ctx.selectedRegionalCup]) {
    ctx.selectedRegionalCup = availableCups[0] || 'North American Cup';
  }

  const compTabsHtml = `
    <div style="display: flex; gap: 4px; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
      <button onclick="setCompetitionView('league')" style="font-weight: 700; ${ctx.activeCompetitionView === 'league' ? 'border-color: var(--accent); color: var(--accent);' : 'color: var(--text-muted);'}">
        LEAGUE DIVISIONS (1–10)
      </button>
      <button onclick="setCompetitionView('regional')" style="font-weight: 700; ${ctx.activeCompetitionView === 'regional' ? 'border-color: var(--accent); color: var(--accent);' : 'color: var(--text-muted);'}">
        REGIONAL CUPS (${availableCups.length})
      </button>
      <button onclick="setCompetitionView('cup')" style="font-weight: 700; ${ctx.activeCompetitionView === 'cup' ? 'border-color: var(--accent); color: var(--accent);' : 'color: var(--text-muted);'}">
        UNIVERSAL CUP BRACKET
      </button>
    </div>
  `;

  // 1. Universal Cup Knockout View
  if (ctx.activeCompetitionView === 'cup') {
    const rounds = ctx.state.cupState?.rounds || [];
    const roundLabels = ['Round 1', 'Round 2', 'Round 3', 'Round 4', 'Quarterfinals', 'Semifinals', 'Final'];

    container.innerHTML = `
      ${compTabsHtml}
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px;">
          ${roundLabels.map((lbl, idx) => `
            <button onclick="selectCupRoundTab(${idx})" style="padding: 3px 10px; font-size: 11px; ${(ctx.selectedCupRoundTab || 0) === idx ? 'border-color: var(--accent); color: var(--accent); font-weight: 700;' : ''}">
              ${lbl.toUpperCase()}
            </button>
          `).join('')}
        </div>

        <div class="panel" style="padding: 12px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px;">
            ${(rounds[ctx.selectedCupRoundTab || 0] || []).length === 0 ? `
              <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--text-muted);">
                Ties have not been drawn yet for this round.
              </div>
            ` : (rounds[ctx.selectedCupRoundTab || 0] || []).map(m => {
              const hTeam = ctx.state.teams[m.home];
              const aTeam = ctx.state.teams[m.away];
              const hName = hTeam ? hTeam.name : 'TBD';
              const aName = aTeam ? aTeam.name : 'TBD';

              return `
                <div style="padding: 8px 10px; border: 1px solid var(--border); border-radius: 4px; background: #0d1117;">
                  <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                    <span style="color: ${m.winner === m.home ? 'var(--green)' : '#fff'}; font-weight: ${m.winner === m.home ? '700' : 'normal'};">${hName}</span>
                    <strong style="font-family: monospace;">${m.played ? m.hg : '—'}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 11px;">
                    <span style="color: ${m.winner === m.away ? 'var(--green)' : '#fff'}; font-weight: ${m.winner === m.away ? '700' : 'normal'};">${aName}</span>
                    <strong style="font-family: monospace;">${m.played ? m.ag : '—'}</strong>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
    return;
  }

  // 2. Standings Tables (League or Regional)
  const isRegional = (ctx.activeCompetitionView === 'regional');
  let tableKey = isRegional ? ctx.selectedRegionalCup : ctx.tableDiv;
  let rawTable = isRegional ? (ctx.state.regionalTables?.[tableKey] || []) : (ctx.state.tables?.[tableKey] || []);
  let sortedRows = sortTableEntries(rawTable);

  let selectorButtons = '';
  if (isRegional) {
    selectorButtons = `
      <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <span style="color: var(--text-muted); font-size: 11px; font-weight: 600;">SELECT CUP:</span>
        <select onchange="setSelectedRegionalCup(this.value)" style="font-weight: 700; padding: 4px 8px;">
          ${availableCups.map(cName => `
            <option value="${cName}" ${ctx.selectedRegionalCup === cName ? 'selected' : ''}>${cName}</option>
          `).join('')}
        </select>
      </div>
    `;
  } else {
    selectorButtons = `
      <div style="display: flex; gap: 4px; margin-bottom: 12px; overflow-x: auto;">
        ${Array.from({ length: 10 }, (_, i) => i + 1).map(d => `
          <button onclick="setLeagueDiv(${d})" style="${ctx.tableDiv === d ? 'border-color: var(--accent); color: var(--accent);' : ''}">DIV ${d}</button>
        `).join('')}
      </div>
    `;
  }

  const tableRowsHtml = sortedRows.map((r, idx) => {
    const isUser = (r.teamId === ctx.state.userTeamId);
    const rank = idx + 1;
    const totalTeams = sortedRows.length;

    // Promotion & Relegation rules (4 up / 4 down)
    const isPromoted = (!isRegional && ctx.tableDiv > 1 && rank <= 4);
    const isRelegated = (!isRegional && ctx.tableDiv < 10 && rank > totalTeams - 4);
    const isChampion = (rank === 1);

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
        <td style="text-align: center; color: var(--text-muted); font-weight: ${rank <= 4 || isRelegated ? '700' : 'normal'};">${rank}</td>
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

  container.innerHTML = `
    ${compTabsHtml}
    ${selectorButtons}

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

      ${!isRegional ? `
        <div style="display: flex; gap: 16px; padding: 10px 12px; font-size: 11px; border-top: 1px solid var(--border); color: var(--text-muted);">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 10px; height: 10px; background: #e3b341; border-radius: 2px;"></span> Champion
          </div>
          ${ctx.tableDiv > 1 ? `
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 10px; height: 10px; background: var(--green, #3fb950); border-radius: 2px;"></span> Promotion (Top 4)
            </div>
          ` : ''}
          ${ctx.tableDiv < 10 ? `
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 10px; height: 10px; background: var(--red, #f85149); border-radius: 2px;"></span> Relegation (Bottom 4)
            </div>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

export function setLeagueDiv(d, ctx, renderLayout) {
  ctx.tableDiv = d;
  renderLayout();
}

export function setCompetitionView(mode) {
  window.context.activeCompetitionView = mode;
  window.renderLayout();
}

export function setSelectedRegionalCup(cupName) {
  window.context.selectedRegionalCup = cupName;
  window.renderLayout();
}

export function selectCupRoundTab(roundIdx) {
  window.context.selectedCupRoundTab = roundIdx;
  window.renderLayout();
}

Object.assign(window, {
  setCompetitionView,
  setSelectedRegionalCup,
  selectCupRoundTab
});
