import { FORMATIONS } from '../constants.js';

export function renderMatchView(container, ctx) {
  const userTeamId = ctx.state.userTeamId;
  const userTeam = ctx.state.teams[userTeamId];
  const userDiv = userTeam.div;
  const maxR = ctx.state.maxRounds || 38;
  const currentRound = Math.max(1, Math.min(ctx.state.round, maxR));
  const activeRound = ctx.viewedMatchRound !== null ? ctx.viewedMatchRound : currentRound;

  // Locate the user's specific fixture for this round
  const roundFixtures = ctx.state.fixtures[userDiv]?.[activeRound - 1] || [];
  const userFixture = roundFixtures.find(m => m.home === userTeamId || m.away === userTeamId);

  if (!userFixture) {
    container.innerHTML = `<div class="panel" style="padding: 20px; text-align: center; color: var(--text-muted);">No fixture found for Round ${activeRound}.</div>`;
    return;
  }

  const isHome = userFixture.home === userTeamId;
  const oppId = isHome ? userFixture.away : userFixture.home;
  const homeTeam = ctx.state.teams[userFixture.home] || {};
  const oppTeam = ctx.state.teams[oppId] || { name: 'Unknown Club', tactics: {}, squad: [], formation: '4-4-2 Flat' };
  const oppTableEntry = ctx.state.tables[userDiv]?.find(r => r.teamId === oppId) || { p: 0, w: 0, d: 0, l: 0, gd: 0, pts: 0, form: [] };

  // Tactical Breakdown & Controls
  const tactics = oppTeam.tactics || {};
  const formation = oppTeam.formation || '4-4-2 Flat';
  const blueprintName = (tactics.blueprint || 'Custom').replace(/_/g, ' ');
  const mentality = tactics.mentality || 'balanced';
  const press = tactics.press || 'mid block';
  const buildGk = tactics.buildGk || 'mixed';
  const buildMid = tactics.buildMid || 'mixed';
  const creation = tactics.chanceCreation || 'mixed';

  // Helper to map slot codes (S1..S11) to actual pitch positions based on formation
  const formRoles = FORMATIONS[oppTeam.formation] || FORMATIONS['4-4-2 Flat'];
  const getSlotRoleName = (p) => {
    if (!p.slot || p.slot === 'RES') return 'Reserve';
    if (p.slot.startsWith('B')) return `Bench (${p.slot})`;
    if (p.slot === 'S1') return 'GK';
    const slotIdx = parseInt(p.slot.replace('S', ''), 10) - 1;
    return formRoles[slotIdx] || 'Starter';
  };

  // Select Top 3 Players by highest average across all 8 core attributes
  const calculatePillarAvg = (p) => {
    if (!p.attributes) return 0;
    const vals = Object.values(p.attributes);
    return vals.length ? (vals.reduce((sum, v) => sum + v, 0) / vals.length) : 0;
  };

  const top3Players = [...(oppTeam.squad || [])]
    .sort((a, b) => calculatePillarAvg(b) - calculatePillarAvg(a))
    .slice(0, 3);

  // Form Badges
  const formList = oppTableEntry.form && oppTableEntry.form.length > 0 ? oppTableEntry.form : ['-'];
  const formBadges = formList.map(res => {
    let color = 'var(--text-muted)';
    let bg = 'rgba(255, 255, 255, 0.05)';
    if (res === 'W') { color = 'var(--green, #3fb950)'; bg = 'rgba(63, 185, 80, 0.15)'; }
    else if (res === 'D') { color = '#e3b341'; bg = 'rgba(227, 179, 65, 0.15)'; }
    else if (res === 'L') { color = 'var(--red, #f85149)'; bg = 'rgba(248, 81, 73, 0.15)'; }
    return `<span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 4px; font-size: 11px; font-weight: 700; color: ${color}; background: ${bg};">${res}</span>`;
  }).join(' ');

  container.innerHTML = `
    <!-- Round Navigation Bar -->
    <div class="panel" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <button onclick="changeMatchRound(-1)" style="padding: 2px 10px;" ${activeRound <= 1 ? 'disabled' : ''}>&lt;</button>
        <strong style="color: #fff; font-size: 13px;">ROUND ${activeRound} OF ${maxR}</strong>
        <button onclick="changeMatchRound(1)" style="padding: 2px 10px;" ${activeRound >= maxR ? 'disabled' : ''}>&gt;</button>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        ${activeRound !== currentRound ? `
          <button onclick="resetToCurrentMatchRound()" class="primary" style="padding: 2px 10px; font-size: 11px; font-weight: 700;">
            RETURN TO UPCOMING MATCH
          </button>
        ` : `
          <span style="font-size: 11px; color: ${userFixture.played ? 'var(--text-muted)' : 'var(--accent)'}; font-weight: 700; text-transform: uppercase;">
            ${userFixture.played ? 'Match Concluded' : 'Upcoming Match'}
          </span>
        `}
      </div>
    </div>

    <!-- Main Match Banner -->
    <div class="panel" style="padding: 20px; margin-bottom: 16px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px;">
      <div style="text-align: right;">
        <h2 style="font-size: 20px; margin: 0; color: ${isHome ? 'var(--accent)' : '#fff'}; cursor: pointer;" onclick="inspectTeam('${userFixture.home}', 'squad')">
          ${homeTeam.name || 'Unknown'}
        </h2>
        <span style="font-size: 11px; color: var(--text-muted);">HOME</span>
      </div>

      <div style="text-align: center; min-width: 160px; padding: 8px 16px; background: rgba(0,0,0,0.25); border-radius: 6px; border: 1px solid var(--border);">
        ${userFixture.played ? `
          <div style="font-size: 24px; font-weight: 800; font-family: monospace; color: #fff;">${userFixture.hg}&nbsp;–&nbsp;${userFixture.ag}</div>
          <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">xG: ${userFixture.hxg.toFixed(1)} –${userFixture.axg.toFixed(1)}</div>
        ` : `
          <div style="font-size: 16px; font-weight: 700; color: var(--text-muted); letter-spacing: 1px;">VS</div>
          <div style="font-size: 11px; color: var(--accent); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;" title="${homeTeam.stadium || 'Stadium'}">
            ${homeTeam.stadium || 'Stadium'}
          </div>
        `}
      </div>

      <div style="text-align: left;">
        <h2 style="font-size: 20px; margin: 0; color: ${!isHome ? 'var(--accent)' : '#fff'}; cursor: pointer;" onclick="inspectTeam('${userFixture.away}', 'squad')">
          ${ctx.state.teams[userFixture.away]?.name || 'Unknown'}
        </h2>
        <span style="font-size: 11px; color: var(--text-muted);">AWAY</span>
      </div>
    </div>

    ${userFixture.played ? `
      <!-- Post-Match Report Placeholder -->
      <div class="panel" style="padding: 18px; text-align: center;">
        <h3 style="margin-top: 0; color: #fff; font-size: 14px;">POST-MATCH REPORT</h3>
        <p style="color: var(--text-muted); font-size: 12px; margin-bottom: 0;">
          This match has concluded. Full match event log and player match ratings will appear here in the next update.
        </p>
      </div>
    ` : `
      <!-- Opposition Scouting Report -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="panel" style="padding: 16px;">
          <h3 style="margin-top: 0; font-size: 13px; color: #fff; border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-bottom: 12px;">
            OPPOSITION TACTICAL PROFILE
          </h3>
          <div style="display: flex; flex-direction: column; gap: 9px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Blueprint:</span>
              <strong style="color: var(--accent); text-transform: capitalize;">${blueprintName}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Formation:</span>
              <strong style="color: #fff;">${formation}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Mentality:</span>
              <strong style="color: #fff; text-transform: capitalize;">${mentality}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Defensive Line & Press:</span>
              <strong style="color: #fff; text-transform: capitalize;">${press}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Build From GK:</span>
              <strong style="color: #fff; text-transform: capitalize;">${buildGk}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Build Through Midfield:</span>
              <strong style="color: #fff; text-transform: capitalize;">${buildMid}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Chance Creation:</span>
              <strong style="color: #fff; text-transform: capitalize;">${creation}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 8px; margin-top: 2px;">
              <span style="color: var(--text-muted);">Recent Form:</span>
              <div style="display: flex; gap: 4px;">${formBadges}</div>
            </div>
          </div>
        </div>

        <div class="panel" style="padding: 16px;">
          <h3 style="margin-top: 0; font-size: 13px; color: #fff; border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-bottom: 12px;">
            KEY PLAYERS TO WATCH
          </h3>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${top3Players.map((p, idx) => {
              const posRole = getSlotRoleName(p);
              const archName = p.archetypeName || p.archetypeKey || 'Universal';
              const avgScore = calculatePillarAvg(p).toFixed(1);

              return `
                <div style="padding: 9px 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 4px; display: flex; flex-direction: column; gap: 3px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="color: #fff; font-size: 13px;">${idx + 1}. ${p.name}</strong>
                    <span style="font-family: monospace; font-size: 11px; color: var(--accent); font-weight: 700;">${avgScore} OVR</span>
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

export function changeMatchRound(delta, ctx, renderLayout) {
  const maxR = ctx.state.maxRounds || 38;
  const currentRound = Math.max(1, Math.min(ctx.state.round, maxR));
  const curr = ctx.viewedMatchRound !== null ? ctx.viewedMatchRound : currentRound;
  ctx.viewedMatchRound = Math.max(1, Math.min(maxR, curr + delta));
  renderLayout();
}

export function resetToCurrentMatchRound(ctx, renderLayout) {
  ctx.viewedMatchRound = null;
  renderLayout();
}
