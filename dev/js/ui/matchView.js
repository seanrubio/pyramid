import { FORMATIONS } from '../constants.js';
import { sortTableEntries } from '../engine.js';

function getClubChronologicalMatches(calendar, activeTeamId, activeTeamDiv) {
  const clubMatches = [];
  for (let w = 1; w <= 52; w++) {
    const weekSlots = calendar[w] || {};
    for (let m = 1; m <= 4; m++) {
      const slot = weekSlots[m];
      if (slot && slot.type === 'match' && slot.matches) {
        const fix = slot.matches.find(f => f.home === activeTeamId || f.away === activeTeamId);
        if (fix) {
          clubMatches.push({
            idx: clubMatches.length,
            week: w,
            moment: m,
            fixture: fix,
            played: fix.played,
            comp: fix.comp || slot.comp,
            compName: fix.cupName || slot.cupRoundName || `Division ${activeTeamDiv}`
          });
        }
      }
    }
  }
  return clubMatches;
}

export function renderMatchView(container, ctx) {
  const activeTeamId = ctx.viewedTeamId || ctx.state.userTeamId;
  const activeTeam = ctx.state.teams[activeTeamId];
  const calendar = ctx.state.calendar || {};

  if (!ctx.matchReportSide) ctx.matchReportSide = 'home';

  // 1. Compile the complete, ordered chronological match ledger for this club
  const clubMatches = getClubChronologicalMatches(calendar, activeTeamId, activeTeam.div);

  if (clubMatches.length === 0) {
    container.innerHTML = `
      <div class="panel" style="padding: 32px; text-align: center; color: var(--text-muted);">
        No scheduled matches found across the calendar for ${activeTeam.name}.
      </div>
    `;
    return;
  }

  // 2. Identify the active / upcoming match index
  let defaultIdx = clubMatches.findIndex(item => !item.played);
  if (defaultIdx === -1) defaultIdx = clubMatches.length - 1;

  // If navigated via openMatchReport(homeTeamId, week, moment)
  if (ctx.viewedMatchRound !== null && (ctx.viewedMatchNavIndex === null || ctx.viewedMatchNavIndex === undefined)) {
    const foundIdx = clubMatches.findIndex(item => item.week === ctx.viewedMatchRound && (ctx.viewedMatchMoment === null || item.moment === ctx.viewedMatchMoment));
    if (foundIdx !== -1) ctx.viewedMatchNavIndex = foundIdx;
  }

  const currentNavIdx = (ctx.viewedMatchNavIndex !== null && ctx.viewedMatchNavIndex !== undefined)
    ? Math.max(0, Math.min(clubMatches.length - 1, ctx.viewedMatchNavIndex))
    : defaultIdx;

  const currentItem = clubMatches[currentNavIdx];
  const targetFixture = currentItem.fixture;
  const isHome = (targetFixture.home === activeTeamId);
  const homeTeam = ctx.state.teams[targetFixture.home] || { name: 'Home Club' };
  const awayTeam = ctx.state.teams[targetFixture.away] || { name: 'Away Club' };
  const oppId = isHome ? targetFixture.away : targetFixture.home;
  const oppTeam = isHome ? awayTeam : homeTeam;

  // Opposition profile and standings for scouting
  const isRegional = (currentItem.comp === 'regional' && currentItem.fixture.cupName);
  const rawTable = isRegional
    ? (ctx.state.regionalTables?.[currentItem.fixture.cupName] || [])
    : (ctx.state.tables?.[oppTeam.div] || []);
  const sortedTable = sortTableEntries(rawTable);
  const oppRank = sortedTable.findIndex(r => r.teamId === oppId) + 1;
  const oppRow = sortedTable.find(r => r.teamId === oppId) || { p: 0, w: 0, d: 0, l: 0, pts: 0, xg: 0, xga: 0, form: [] };

  const oppP = Math.max(1, oppRow.p);
  const oppXgPerGame = oppRow.p > 0 ? (oppRow.xg / oppP).toFixed(2) : '0.00';
  const oppXgaPerGame = oppRow.p > 0 ? (oppRow.xga / oppP).toFixed(2) : '0.00';

  const xgSorted = [...rawTable].sort((a, b) => (b.p > 0 ? b.xg / b.p : 0) - (a.p > 0 ? a.xg / a.p : 0));
  const xgRank = xgSorted.findIndex(r => r.teamId === oppId) + 1;

  const xgaSorted = [...rawTable].sort((a, b) => (a.p > 0 ? a.xga / a.p : 999) - (b.p > 0 ? b.xga / b.p : 999));
  const xgaRank = xgaSorted.findIndex(r => r.teamId === oppId) + 1;

  const formList = oppRow.form && oppRow.form.length > 0 ? oppRow.form : ['-'];
  const formBadges = formList.map(res => {
    let color = 'var(--text-muted)';
    let bg = 'rgba(255, 255, 255, 0.05)';
    if (res === 'W') { color = 'var(--green, #3fb950)'; bg = 'rgba(63, 185, 80, 0.15)'; }
    else if (res === 'D') { color = '#e3b341'; bg = 'rgba(227, 179, 65, 0.15)'; }
    else if (res === 'L') { color = 'var(--red, #f85149)'; bg = 'rgba(248, 81, 73, 0.15)'; }
    return `<span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 4px; font-size: 11px; font-weight: 700; color: ${color}; background: ${bg};">${res}</span>`;
  }).join(' ');

  const tactics = oppTeam.tactics || {};
  const formation = oppTeam.formation || '4-4-2 Flat';
  const blueprintName = (tactics.blueprint || 'Custom').replace(/_/g, ' ');

  const formRoles = FORMATIONS[oppTeam.formation] || FORMATIONS['4-4-2 Flat'];
  const getSlotRoleName = (p) => {
    if (!p.slot) return 'Reserve';
    if (p.slot.startsWith('B')) return `Bench (${p.slot})`;
    if (p.slot === 'S1') return 'GK';
    const slotIdx = parseInt(p.slot.replace('S', ''), 10) - 1;
    return formRoles[slotIdx] || 'Starter';
  };

  const calculatePillarAvg = (p) => {
    if (!p.attributes) return 0;
    const vals = Object.values(p.attributes);
    return vals.length ? (vals.reduce((sum, v) => sum + v, 0) / vals.length) : 0;
  };

  const top3Players = [...(oppTeam.squad || [])]
    .sort((a, b) => calculatePillarAvg(b) - calculatePillarAvg(a))
    .slice(0, 3);

  // Full Post-Match Report Renderer
  const renderPostMatchSection = () => {
    const rep = targetFixture.report;
    if (!rep) {
      return `
        <div class="panel" style="padding: 24px; text-align: center; margin-bottom: 16px;">
          <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">FINAL RESULT</div>
          <div style="font-size: 32px; font-weight: 800; font-family: monospace; color: #fff; margin-bottom: 4px;">
            ${targetFixture.hg} – ${targetFixture.ag}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); font-family: monospace;">
            xG: ${targetFixture.hxg.toFixed(1)} – ${targetFixture.axg.toFixed(1)}
          </div>
        </div>
      `;
    }

    const hStats = rep.homeStats;
    const aStats = rep.awayStats;
    const totalP = (hStats.passes + aStats.passes) || 1;
    const hPoss = Math.round((hStats.passes / totalP) * 100);
    const aPoss = 100 - hPoss;
    const hCmp = hStats.passes > 0 ? Math.round((hStats.passesComp / hStats.passes) * 100) : 0;
    const aCmp = aStats.passes > 0 ? Math.round((aStats.passesComp / aStats.passes) * 100) : 0;

    const renderStatLine = (label, hVal, aVal) => `
      <div style="display: grid; grid-template-columns: 45px 1fr 45px; align-items: center; gap: 8px; font-size: 11px; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
        <span style="font-family: monospace; font-weight: 700; text-align: left; color: ${hVal > aVal ? '#fff' : 'var(--text-muted)'};">${hVal}</span>
        <span style="color: var(--text-muted); text-align: center; font-size: 10px; text-transform: uppercase;">${label}</span>
        <span style="font-family: monospace; font-weight: 700; text-align: right; color: ${aVal > hVal ? '#fff' : 'var(--text-muted)'};">${aVal}</span>
      </div>
    `;

    const getPosOrder = (p) => {
      if (p.slot && p.slot.startsWith('S')) return parseInt(p.slot.slice(1), 10);
      if (p.slot && p.slot.startsWith('B')) return 100 + parseInt(p.slot.slice(1), 10);
      const roleWeights = { 'GK': 1, 'LB': 2, 'CB': 3, 'RB': 4, 'LM': 5, 'CM': 6, 'RM': 7, 'ST': 8, 'SUB': 90 };
      return roleWeights[p.slotRole] || 99;
    };

    const pct = (num, den) => (den > 0 && num > 0 ? `${Math.round((num / den) * 100)}%` : '—');
    const fmt = (v, isDec = false) => (!v || v === 0 || v === '0.0' ? '—' : (isDec ? Number(v).toFixed(1) : v));

    const activePlayersMap = (ctx.matchReportSide === 'home' ? rep.homePlayers : rep.awayPlayers) || {};
    const sortedPlayers = Object.values(activePlayersMap).sort((a, b) => getPosOrder(a) - getPosOrder(b));

    const rowsHtml = sortedPlayers.map(p => `
      <tr>
        <td style="color: var(--text-muted); font-size: 10px; width: 32px; font-weight: 600;">${p.slotRole || '—'}</td>
        <td style="font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name}</td>
        <td style="text-align: right; font-family: monospace; font-size: 11px; color: var(--text-muted);">${p.minutes || 0}'</td>
        <td style="text-align: center; font-family: monospace; font-size: 11px; color: ${p.goals > 0 ? 'var(--green)' : 'var(--text-muted)'}; font-weight: ${p.goals > 0 ? '700' : 'normal'};">${fmt(p.goals)}</td>
        <td style="text-align: center; font-family: monospace; font-size: 11px; color: var(--text-muted);">${fmt(p.xg, true)}</td>
        <td style="text-align: center; font-family: monospace; font-size: 11px; color: ${p.assists > 0 ? 'var(--accent)' : 'var(--text-muted)'}; font-weight: ${p.assists > 0 ? '700' : 'normal'};">${fmt(p.assists)}</td>
        <td style="text-align: center; font-family: monospace; font-size: 11px; color: var(--text-muted);">${fmt(p.xa, true)}</td>
        <td style="text-align: center; font-family: monospace; font-size: 11px; color: var(--text-muted);">${pct(p.passesComp, p.passes)}</td>
        <td style="text-align: center; font-family: monospace; font-size: 11px; color: var(--text-muted);">${pct(p.tacklesWon, p.tackles)}</td>
        <td style="text-align: center; font-family: monospace; font-size: 11px; color: var(--text-muted);">${pct(p.aerialsWon, p.aerialsContested)}</td>
        <td style="text-align: center; font-family: monospace; font-size: 11px; color: ${p.isGK ? 'var(--accent)' : 'var(--text-muted)'};">${fmt(p.saves)}</td>
      </tr>
    `).join('');

    return `
      <!-- Result Banner -->
      <div class="panel" style="padding: 16px; margin-bottom: 16px; text-align: center; background: rgba(0,0,0,0.25);">
        <div style="font-size: 10px; color: var(--text-muted); font-weight: 700; letter-spacing: 1px; margin-bottom: 6px;">
          FINAL RESULT
        </div>
        <div style="display: flex; justify-content: center; align-items: center; gap: 24px; margin-bottom: 6px;">
          <div style="flex: 1; text-align: right;">
            <strong style="font-size: 17px; color: ${homeTeam.id === activeTeamId ? 'var(--accent)' : '#fff'}; cursor: pointer;" onclick="inspectTeam('${homeTeam.id}', 'match')">${homeTeam.name}</strong>
          </div>
          <div style="min-width: 90px; text-align: center;">
            <span style="font-family: monospace; font-size: 26px; font-weight: 800; color: #fff; letter-spacing: 2px;">
              ${targetFixture.hg} – ${targetFixture.ag}
            </span>
          </div>
          <div style="flex: 1; text-align: left;">
            <strong style="font-size: 17px; color: ${awayTeam.id === activeTeamId ? 'var(--accent)' : '#fff'}; cursor: pointer;" onclick="inspectTeam('${awayTeam.id}', 'match')">${awayTeam.name}</strong>
          </div>
        </div>
        <div style="font-family: monospace; font-size: 11px; color: var(--text-muted);">
          ${targetFixture.hxg.toFixed(1)} xG &nbsp;—&nbsp; ${targetFixture.axg.toFixed(1)} xG
        </div>
      </div>

      <!-- Match Breakdown: Comparison Bar on Left, Single Box Score on Right -->
      <div style="display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 16px; align-items: start;">
        <div class="panel" style="padding: 12px;">
          <div style="font-size: 11px; font-weight: 700; color: var(--accent); text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid var(--border); padding-bottom: 4px;">
            MATCH TOTALS
          </div>
          <div style="display: flex; flex-direction: column;">
            ${renderStatLine('Possession', `${hPoss}%`, `${aPoss}%`)}
            ${renderStatLine('Total Shots', hStats.shots, aStats.shots)}
            ${renderStatLine('Shots on Target', hStats.sot, aStats.sot)}
            ${renderStatLine('Expected Goals (xG)', targetFixture.hxg.toFixed(1), targetFixture.axg.toFixed(1))}
            ${renderStatLine('Passing Accuracy', `${hCmp}%`, `${aCmp}%`)}
            ${renderStatLine('Tackles Won', hStats.tacklesWon, aStats.tacklesWon)}
            ${renderStatLine('GK Saves', hStats.saves, aStats.saves)}
          </div>
        </div>

        <div class="panel" style="overflow-x: auto; padding: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid var(--border); padding-bottom: 6px;">
            <strong style="color: #fff; font-size: 12px; text-transform: uppercase;">PLAYER PERFORMANCE</strong>
            <div style="display: flex; gap: 4px;">
              <button onclick="setMatchReportSide('home')" style="padding: 2px 8px; font-size: 10px; font-weight: 700; ${ctx.matchReportSide === 'home' ? 'border-color: var(--accent); color: var(--accent);' : 'color: var(--text-muted);'}">
                ${homeTeam.name}
              </button>
              <button onclick="setMatchReportSide('away')" style="padding: 2px 8px; font-size: 10px; font-weight: 700; ${ctx.matchReportSide === 'away' ? 'border-color: var(--accent); color: var(--accent);' : 'color: var(--text-muted);'}">
                ${awayTeam.name}
              </button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 32px;">Pos</th>
                <th>Player</th>
                <th style="text-align: right; width: 36px;">Min</th>
                <th style="text-align: center; width: 26px;">G</th>
                <th style="text-align: center; width: 32px;">xG</th>
                <th style="text-align: center; width: 26px;">A</th>
                <th style="text-align: center; width: 32px;">xA</th>
                <th style="text-align: center; width: 38px;">CMP%</th>
                <th style="text-align: center; width: 38px;">TK%</th>
                <th style="text-align: center; width: 38px;">AER%</th>
                <th style="text-align: center; width: 26px;">SV</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  container.innerHTML = `
    <!-- Top Interactive Fixture Navigation Bar -->
    <div class="panel" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <button onclick="changeMatchRound(-1)" style="padding: 2px 10px;" ${currentNavIdx <= 0 ? 'disabled' : ''}>&lt;</button>
        <strong style="color: #fff; font-size: 13px;">MATCH ${currentNavIdx + 1} OF ${clubMatches.length} <span style="color: var(--text-muted); font-size: 11px; margin-left: 4px;">(W${currentItem.week}.M${currentItem.moment})</span></strong>
        <button onclick="changeMatchRound(1)" style="padding: 2px 10px;" ${currentNavIdx >= clubMatches.length - 1 ? 'disabled' : ''}>&gt;</button>
      </div>

      <div style="display: flex; align-items: center; gap: 10px;">
        ${currentNavIdx !== defaultIdx ? `
          <button onclick="resetToCurrentMatchRound()" class="primary" style="padding: 2px 10px; font-size: 11px; font-weight: 700;">
            RETURN TO NEXT UP FIXTURE
          </button>
        ` : `
          <span style="font-size: 11px; color: ${targetFixture.played ? 'var(--text-muted)' : 'var(--accent)'}; font-weight: 700; text-transform: uppercase;">
            ${targetFixture.played ? 'MATCH CONCLUDED' : 'UPCOMING FIXTURE'}
          </span>
        `}
      </div>
    </div>

    <!-- Match Header Banner -->
    <div class="panel" style="padding: 20px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 4px;">
          ${currentItem.compName} • ${isHome ? 'HOME FIXTURE' : 'AWAY FIXTURE'}
        </div>
        <h2 style="font-size: 24px; margin: 0; color: #fff; cursor: pointer;" onclick="inspectTeam('${oppId}', 'squad')">
          ${oppTeam.name}
        </h2>
      </div>

      <div style="text-align: right;">
        <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Venue</div>
        <div style="font-size: 14px; font-weight: 600; color: var(--accent);">
          ${homeTeam.stadium || 'Coliseum'}
        </div>
      </div>
    </div>

    ${targetFixture.played ? renderPostMatchSection() : `
      <!-- Complete Opposition Scouting Report -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="panel" style="padding: 16px;">
          <h3 style="margin-top: 0; font-size: 13px; color: #fff; border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-bottom: 12px;">
            OPPOSITION PROFILE & STANDINGS
          </h3>
          <div style="display: flex; flex-direction: column; gap: 9px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Current Standing:</span>
              <strong style="color: #fff;">#${oppRank || '—'} (${oppRow.w}-${oppRow.d}-${oppRow.l} •${oppRow.pts} PTS)</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Avg xG / Game:</span>
              <strong style="color: #fff; font-family: monospace;">${oppXgPerGame} <span style="color: var(--text-muted); font-weight: normal; font-family: sans-serif;">(#${xgRank || '—'})</span></strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Avg xGA / Game:</span>
              <strong style="color: #fff; font-family: monospace;">${oppXgaPerGame} <span style="color: var(--text-muted); font-weight: normal; font-family: sans-serif;">(#${xgaRank || '—'})</span></strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 9px;">
              <span style="color: var(--text-muted);">Recent Form:</span>
              <div style="display: flex; gap: 4px;">${formBadges}</div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 4px;">
              <span style="color: var(--text-muted);">Blueprint:</span>
              <strong style="color: #fff; text-transform: capitalize;">${blueprintName}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Formation:</span>
              <strong style="color: #fff;">${formation}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Defensive Line & Press:</span>
              <strong style="color: #fff; text-transform: capitalize;">${tactics.press || 'mid block'}</strong>
            </div>
          </div>
        </div>

        <div class="panel" style="padding: 16px;">
          <h3 style="margin-top: 0; font-size: 13px; color: #fff; border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-bottom: 12px;">
            KEY PLAYERS TO WATCH
          </h3>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${top3Players.map((p) => {
              const posRole = getSlotRoleName(p);
              const archName = p.archetypeName || p.archetypeKey || 'Universal';

              return `
                <div style="padding: 10px 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 4px; display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="color: #fff; font-size: 13px;">${p.name}</strong>
                  </div>
                  <div style="font-size: 11px; color: var(--text-muted);">
                    Last Position: <span style="color: #fff; font-weight: 600;">${posRole}</span>
                    <span style="margin: 0 6px; color: var(--border);">|</span>
                    Archetype: <span style="color: #fff; font-weight: 600;">${archName}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `}
  `;
}

export function setMatchReportSide(side, ctx, renderLayout) {
  ctx.matchReportSide = side;
  renderLayout();
}

export function changeMatchRound(delta, ctx, renderLayout) {
  const activeTeamId = ctx.viewedTeamId || ctx.state.userTeamId;
  const activeTeam = ctx.state.teams[activeTeamId];
  const calendar = ctx.state.calendar || {};

  const clubMatches = getClubChronologicalMatches(calendar, activeTeamId, activeTeam.div);
  if (clubMatches.length === 0) return;

  let defaultIdx = clubMatches.findIndex(item => !item.played);
  if (defaultIdx === -1) defaultIdx = clubMatches.length - 1;

  const currentIdx = (ctx.viewedMatchNavIndex !== null && ctx.viewedMatchNavIndex !== undefined)
    ? ctx.viewedMatchNavIndex
    : defaultIdx;

  ctx.viewedMatchNavIndex = Math.max(0, Math.min(clubMatches.length - 1, currentIdx + delta));
  ctx.viewedMatchRound = null;
  ctx.viewedMatchMoment = null;
  renderLayout();
}

export function resetToCurrentMatchRound(ctx, renderLayout) {
  ctx.viewedMatchNavIndex = null;
  ctx.viewedMatchRound = null;
  ctx.viewedMatchMoment = null;
  renderLayout();
}
