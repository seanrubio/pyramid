import { sortTableEntries } from '../engine.js';

export function renderLeagueView(container, ctx) {
  if (!ctx.activeCompetitionView) ctx.activeCompetitionView = 'league';
  if (!ctx.leagueLeaderTab) ctx.leagueLeaderTab = 'boot';

  const isRegional = (ctx.activeCompetitionView === 'regional');
  const availableCups = Object.keys(ctx.state.regionalTables || {}).sort();
  if (!ctx.selectedRegionalCup || !ctx.state.regionalTables?.[ctx.selectedRegionalCup]) {
    ctx.selectedRegionalCup = availableCups[0] || 'North American Cup';
  }

  // 1. Header Navigation Pills
  const compTabsHtml = `
    <div style="display: flex; gap: 4px; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
      <button onclick="setCompetitionView('league')" style="font-weight: 700; ${ctx.activeCompetitionView === 'league' ? 'border-color: var(--accent); color: var(--accent);' : 'color: var(--text-muted);'}">
        Pyramid League
      </button>
      <button onclick="setCompetitionView('regional')" style="font-weight: 700; ${ctx.activeCompetitionView === 'regional' ? 'border-color: var(--accent); color: var(--accent);' : 'color: var(--text-muted);'}">
        Regional Cups
      </button>
      <button onclick="setCompetitionView('cup')" style="font-weight: 700; ${ctx.activeCompetitionView === 'cup' ? 'border-color: var(--accent); color: var(--accent);' : 'color: var(--text-muted);'}">
        Universal Cup
      </button>
    </div>
  `;

  // 2. Universal Cup View
  if (ctx.activeCompetitionView === 'cup') {
    const rounds = ctx.state.cupState?.rounds || [];
    const roundLabels = [
      'Round 1',
      'Round of 128',
      'Round of 64',
      'Round of 32',
      'Round of 16',
      'Quarterfinal',
      'Semifinal',
      'Final'
    ];
    const activeCupTab = ctx.selectedCupRoundTab || 0;

    container.innerHTML = `
      ${compTabsHtml}
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px;">
          ${roundLabels.map((lbl, idx) => `
            <button onclick="selectCupRoundTab(${idx})" style="padding: 3px 10px; font-size: 11px; white-space: nowrap; ${activeCupTab === idx ? 'border-color: var(--accent); color: var(--accent); font-weight: 700;' : ''}">
              ${lbl.toUpperCase()}
            </button>
          `).join('')}
        </div>

        <div class="panel" style="padding: 12px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px;">
            ${(rounds[activeCupTab] || []).length === 0 ? `
              <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--text-muted);">
                Ties have not been drawn yet for this round.
              </div>
            ` : (rounds[activeCupTab] || []).map(m => {
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

  // 3. Resolve Scoped Matchweek Bounds
  // Regional: MW 1..12 (Calendar Weeks 5..16)
  // League: MW 1..38 (Calendar Weeks 21..51)
  const currentWeek = ctx.state.week || 1;
  const maxRounds = isRegional ? 12 : 38;

  let currentCompRound = 1;
  if (isRegional) {
    currentCompRound = Math.max(1, Math.min(12, currentWeek - 4));
  } else {
    currentCompRound = Math.max(1, Math.min(38, currentWeek - 20));
  }

  const viewedRound = ctx.viewedFixtureRound !== null ? ctx.viewedFixtureRound : currentCompRound;

  // 4. Standings Tables
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

  // 5. Gather Fixtures for the active scoped Matchweek
  const roundMatches = [];
  const calendar = ctx.state.calendar || {};

  if (isRegional) {
    // Regional matchweek N corresponds directly to Calendar week (N + 4)
    const calWeek = viewedRound + 4;
    const weekSlots = calendar[calWeek] || {};
    [1, 2, 3, 4].forEach(m => {
      const slot = weekSlots[m];
      if (slot && slot.type === 'match' && slot.matches) {
        slot.matches.forEach(fix => {
          if (fix.cupName === ctx.selectedRegionalCup) {
            roundMatches.push({ fix, week: calWeek, moment: m });
          }
        });
      }
    });
  } else {
    // Scan league fixtures matching this division and leagueRound
    for (let w = 21; w <= 51; w++) {
      const weekSlots = calendar[w] || {};
      [2, 4].forEach(m => {
        const slot = weekSlots[m];
        if (slot && slot.type === 'match' && slot.matches) {
          slot.matches.forEach(fix => {
            const matchDiv = fix.div || ctx.state.teams[fix.home]?.div;
            if (matchDiv === ctx.tableDiv && fix.leagueRound === viewedRound) {
              roundMatches.push({ fix, week: w, moment: m });
            }
          });
        }
      });
      if (roundMatches.length > 0) break; // Found the week containing this league round
    }
  }

  const fixturesHtml = roundMatches.length > 0 ? roundMatches.map(({ fix, week, moment }) => {
    const isUserMatch = (fix.home === ctx.state.userTeamId || fix.away === ctx.state.userTeamId);
    const homeName = ctx.state.teams[fix.home]?.name || 'Unknown';
    const awayName = ctx.state.teams[fix.away]?.name || 'Unknown';

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; border-radius: 3px; background: ${isUserMatch ? 'rgba(88, 166, 255, 0.08)' : '#0d1117'}; border: 1px solid var(--border);">
        <div style="flex: 1; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 6px;">
          <span onclick="inspectTeam('${fix.home}', 'squad')" style="cursor: pointer; font-size: 11px;">${homeName}</span>
        </div>
        <div style="min-width: 68px; text-align: center; display: flex; flex-direction: column; align-items: center;">
          ${fix.played ? `
            <button onclick="openMatchReport('${fix.home}', ${week},${moment})" 
                    title="View Match Report"
                    style="padding: 1px 6px; font-family: monospace; font-size: 11px; font-weight: 700; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border); color: #fff; cursor: pointer; border-radius: 3px;">
              ${fix.hg}–${fix.ag}
            </button>
            <span style="font-family: monospace; font-size: 9px; color: var(--text-muted); margin-top: 2px;">${fix.hxg.toFixed(1)}–${fix.axg.toFixed(1)}</span>
          ` : `<span style="font-family: monospace; font-size: 10px; color: var(--text-muted);">vs</span>`}
        </div>
        <div style="flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 6px;">
          <span onclick="inspectTeam('${fix.away}', 'squad')" style="cursor: pointer; font-size: 11px;">${awayName}</span>
        </div>
      </div>
    `;
  }).join('') : `
    <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 11px;">
      No fixtures scheduled for Matchweek ${viewedRound}.
    </div>
  `;

  container.innerHTML = `
    ${compTabsHtml}
    ${selectorButtons}

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

      <!-- Right Column: Scoped Matchweek Browser -->
      <div class="panel" style="padding: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-bottom: 8px;">
          <strong style="color: #fff; font-size: 12px;">MATCHWEEK ${viewedRound} OF ${maxRounds}</strong>
          <div style="display: flex; gap: 4px;">
            <button onclick="changeLeagueRound(-1)" style="padding: 1px 6px;" ${viewedRound <= 1 ? 'disabled' : ''}>&lt;</button>
            <button onclick="changeLeagueRound(1)" style="padding: 1px 6px;" ${viewedRound >= maxRounds ? 'disabled' : ''}>&gt;</button>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 3px;">
          ${fixturesHtml}
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
  const isRegional = (ctx.activeCompetitionView === 'regional');
  const maxRounds = isRegional ? 12 : 38;
  const currentWeek = ctx.state.week || 1;

  let currentCompRound = 1;
  if (isRegional) {
    currentCompRound = Math.max(1, Math.min(12, currentWeek - 4));
  } else {
    currentCompRound = Math.max(1, Math.min(38, currentWeek - 20));
  }

  const curr = ctx.viewedFixtureRound !== null ? ctx.viewedFixtureRound : currentCompRound;
  ctx.viewedFixtureRound = Math.max(1, Math.min(maxRounds, curr + delta));
  renderLayout();
}

export function setLeagueLeaderTab(cat, ctx, renderLayout) {
  ctx.leagueLeaderTab = cat;
  renderLayout();
}

export function setCompetitionView(mode, ctx, renderLayout) {
  ctx.activeCompetitionView = mode;
  ctx.viewedFixtureRound = null; // Reset navigation round when switching between league/regional/cup
  renderLayout();
}

export function setSelectedRegionalCup(cupName, ctx, renderLayout) {
  ctx.selectedRegionalCup = cupName;
  renderLayout();
}

export function selectCupRoundTab(roundIdx, ctx, renderLayout) {
  ctx.selectedCupRoundTab = roundIdx;
  renderLayout();
}
