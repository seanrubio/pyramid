import { FORMATIONS } from '../constants.js';
import { getCurrentCalendarSlot } from '../engine.js';

export function renderMatchView(container, ctx) {
  const activeTeamId = ctx.viewedTeamId || ctx.state.userTeamId;
  const activeTeam = ctx.state.teams[activeTeamId];
  const calendar = ctx.state.calendar || {};

  // 1. If viewing a specific past match report (e.g. clicked scoreline from fixtures/league)
  let targetFixture = null;
  let targetCompName = '';

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
    }
  }

  // 3. If still no active match in the current tick (e.g. transfer window, training, or bye),
  // automatically locate the NEXT upcoming match on the calendar so scouting report works!
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
          Advance moments to complete window operations. Fixtures begin in Week 5.
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

  container.innerHTML = `
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

    ${targetFixture.played ? `
      <!-- Result Banner -->
      <div class="panel" style="padding: 20px; margin-bottom: 16px; text-align: center;">
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">FINAL RESULT</div>
        <div style="font-size: 32px; font-weight: 800; font-family: monospace; color: #fff; margin-bottom: 6px;">
          ${targetFixture.hg} –${targetFixture.ag}
        </div>
        <div style="font-size: 12px; color: var(--text-muted); font-family: monospace;">
          xG: ${targetFixture.hxg.toFixed(1)} –${targetFixture.axg.toFixed(1)}
        </div>
      </div>
    ` : `
      <!-- Opposition Scouting Report -->
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
