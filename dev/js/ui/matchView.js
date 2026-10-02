import { FORMATIONS } from '../constants.js';
import { getCurrentCalendarSlot } from '../engine.js';

export function renderMatchView(container, ctx) {
  const activeTeamId = ctx.viewedTeamId || ctx.state.userTeamId;
  const activeTeam = ctx.state.teams[activeTeamId];
  const calendar = ctx.state.calendar || {};

  if (!ctx.matchReportSide) ctx.matchReportSide = 'home';

  // 1. Check if viewing a specific past match report (e.g., clicked scoreline from fixtures/league)
  let targetFixture = null;
  let targetCompName = '';
  let matchWeekNumber = ctx.viewedMatchRound;

  if (ctx.viewedMatchRound !== null) {
    const weekSlots = calendar[ctx.viewedMatchRound] || {};
    for (let m = 1; m <= 4; m++) {
      const slot = weekSlots[m];
      if (slot && slot.type === 'match' && slot.matches) {
        const fix = slot.matches.find(f => f.home === activeTeamId || f.away === activeTeamId);
        if (fix) {
          targetFixture = fix;
          targetCompName = fix.cupName || slot.cupRoundName || `Division ${activeTeam.div}`;
          break;
        }
      }
    }
  }

  // 2. If not viewing a past match, check current moment slot
  const currentSlot = getCurrentCalendarSlot(ctx.state);
  if (!targetFixture && currentSlot && currentSlot.type === 'match' && currentSlot.matches) {
    targetFixture = currentSlot.matches.find(f => f.home === activeTeamId || f.away === activeTeamId);
    if (targetFixture) {
      targetCompName = targetFixture.cupName || currentSlot.cupRoundName || `Division ${activeTeam.div}`;
      matchWeekNumber = ctx.state.week;
    }
  }

  // 3. If no active match in the current tick (transfer window, training, or bye),
  // locate the NEXT upcoming match on the calendar for scouting
  let nextMatchMeta = null;
  if (!targetFixture) {
    for (let w = ctx.state.week; w <= 52; w++) {
      const weekSlots = calendar[w] || {};
      for (let m = (w === ctx.state.week ? ctx.state.moment : 1); m <= 4; m++) {
        const slot = weekSlots[m];
        if (slot && slot.type === 'match' && slot.matches) {
          const fix = slot.matches.find(f => f.home === activeTeamId || f.away === activeTeamId);
          if (fix && !fix.played) {
            targetFixture = fix;
            targetCompName = fix.cupName || slot.cupRoundName || `Division ${activeTeam.div}`;
            nextMatchMeta = { week: w, moment: m };
            matchWeekNumber = w;
            break;
          }
        }
      }
      if (targetFixture) break;
    }
  }

  // 4. Render transfer window banner if in window and no upcoming match found
  if (!targetFixture && currentSlot && currentSlot.type === 'window') {
    container.innerHTML = `
      <div class="panel" style="padding: 32px; text-align: center;">
        <h2 style="color: var(--accent); margin-top: 0;">${currentSlot.name.toUpperCase()}</h2>
        <p style="color: var(--text-muted); font-size: 13px;">${currentSlot.subtext}</p>
        <span style="display: inline-block; margin-top: 12px; font-size: 11px; color: var(--text-muted);">
          Advance moments to complete window operations. Live fixtures begin in Week 5.
        </span>
      </div>
    `;
    return;
  }

  if (!targetFixture) {
    container.innerHTML = `
      <div class="panel" style="padding: 24px; text-align: center; color: var(--text-muted);">
        No upcoming fixtures scheduled for ${activeTeam.name}.
      </div>
    `;
    return;
  }

  const isHome = (targetFixture.home === activeTeamId);
  const homeTeam = ctx.state.teams[targetFixture.home] || { name: 'Home Club' };
  const awayTeam = ctx.state.teams[targetFixture.away] || { name: 'Away Club' };
  const oppId = isHome ? targetFixture.away : targetFixture.home;
  const oppTeam = isHome ? awayTeam : homeTeam;

  const tactics = oppTeam.tactics || {};
  const formation = oppTeam.formation || '4-4-2 Flat';
  const blueprintName = (tactics.blueprint || 'Custom').replace(/_/g, ' ');

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
          WEEK ${matchWeekNumber} FINAL RESULT
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

        <!-- Box Score Column with Side Switcher -->
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
    <!-- Top Return Bar (if inspecting past fixture) -->
    ${ctx.viewedMatchRound !== null ? `
      <div class="panel" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; margin-bottom: 16px;">
        <span style="font-size: 11px; color: var(--text-muted);">VIEWING HISTORICAL MATCH REPORT: WEEK ${ctx.viewedMatchRound}</span>
        <button onclick="resetToCurrentMatchRound()" class="primary" style="padding: 2px 8px; font-size: 10px; font-weight: 700;">
          RETURN TO CURRENT / NEXT FIXTURE
        </button>
      </div>
    ` : ''}

    <!-- Match Header Banner -->
    <div class="panel" style="padding: 20px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 4px;">
          ${targetCompName} • ${isHome ? 'HOME FIXTURE' : 'AWAY FIXTURE'} ${nextMatchMeta ? `<span style="color: var(--accent); margin-left: 6px;">[SCHEDULED: WEEK ${nextMatchMeta.week}]</span>` : ''}
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
      <!-- Opposition Tactical Scouting Report -->
      <div class="panel" style="padding: 16px; max-width: 600px;">
        <h3 style="margin-top: 0; font-size: 13px; color: #fff; border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-bottom: 12px;">
          OPPOSITION TACTICAL SCOUTING
        </h3>
        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between;">
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
    `}
  `;
}

export function setMatchReportSide(side, ctx, renderLayout) {
  ctx.matchReportSide = side;
  renderLayout();
}

export function changeMatchRound() {}
export function resetToCurrentMatchRound(ctx, renderLayout) {
  ctx.viewedMatchRound = null;
  renderLayout();
}
