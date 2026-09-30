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
  const oppTeam = ctx.state.teams[oppId] || { name: 'Unknown Club', tactics: {}, squad: [], formation: '4-4-2 Flat' };
  const oppTableEntry = ctx.state.tables[userDiv]?.find(r => r.teamId === oppId) || { p: 0, w: 0, d: 0, l: 0, gd: 0, pts: 0, form: [] };

  // Tactical Breakdown
  const tactics = oppTeam.tactics || {};
  const formation = oppTeam.formation || '4-4-2 Flat';
  const mentality = tactics.mentality || 'balanced';
  const creation = tactics.chanceCreation || tactics.buildMid || 'mixed';
  const press = tactics.press || 'mid block';

  // Find Star Player / Danger Man (Top Scorer or highest-rated outfield)
  const sortedSquad = [...oppTeam.squad].filter(p => !p.isGK).sort((a, b) => {
    if ((b.stats?.goals || 0) !== (a.stats?.goals || 0)) {
      return (b.stats?.goals || 0) - (a.stats?.goals || 0);
    }
    const scoreA = a.attributes ? Object.values(a.attributes).reduce((acc, v) => acc + v, 0) : 0;
    const scoreB = b.attributes ? Object.values(b.attributes).reduce((acc, v) => acc + v, 0) : 0;
    return scoreB - scoreA;
  });
  const dangerMan = sortedSquad[0] || null;

  // Contextual Matchup Advice
  let tacticalAdvice = "Balanced contest expected. Maintain your team's tactical identity and capitalize on transitions.";
  if (creation === 'flank play') {
    tacticalAdvice = "Opponent relies heavily on crossing and aerial deliveries. Consider strengthening fullbacks and defensive aerial presence.";
  } else if (creation === 'balls in behind') {
    tacticalAdvice = "Opponent targets quick runners in behind. A lower defensive block will deny them the depth they thrive on.";
  } else if (creation === 'central creator') {
    tacticalAdvice = "Opponent channels play through a central playmaker. Deploying an active defensive midfielder (DM) will disrupt their distribution.";
  }

  if (press === 'gegenpress' || press === 'high press') {
    tacticalAdvice += " They press aggressively high up the pitch; rapid vertical balls can catch them overcommitted.";
  } else if (press === 'low block') {
    tacticalAdvice += " They defend deep in a structured low block; patient wide circulation and crosses will test their resolve.";
  }

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
      <div>
        <span style="font-size: 11px; color: ${userFixture.played ? 'var(--text-muted)' : 'var(--accent)'}; font-weight: 700; text-transform: uppercase;">
          ${userFixture.played ? 'Match Concluded' : (activeRound === currentRound ? 'Upcoming Match' : 'Future Fixture')}
        </span>
      </div>
    </div>

    <!-- Main Match Banner -->
    <div class="panel" style="padding: 20px; margin-bottom: 16px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px;">
      <div style="text-align: right;">
        <h2 style="font-size: 20px; margin: 0; color: ${isHome ? 'var(--accent)' : '#fff'}; cursor: pointer;" onclick="inspectTeam('${userFixture.home}', 'squad')">
          ${ctx.state.teams[userFixture.home]?.name || 'Unknown'}
        </h2>
        <span style="font-size: 11px; color: var(--text-muted);">${isHome ? 'HOME (Your Club)' : 'HOME'}</span>
      </div>

      <div style="text-align: center; min-width: 140px; padding: 8px 16px; background: rgba(0,0,0,0.25); border-radius: 6px; border: 1px solid var(--border);">
        ${userFixture.played ? `
          <div style="font-size: 24px; font-weight: 800; font-family: monospace; color: #fff;">${userFixture.hg}&nbsp;–&nbsp;${userFixture.ag}</div>
          <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">xG: ${userFixture.hxg.toFixed(1)} –${userFixture.axg.toFixed(1)}</div>
        ` : `
          <div style="font-size: 16px; font-weight: 700; color: var(--text-muted); letter-spacing: 1px;">VS</div>
          <div style="font-size: 11px; color: var(--accent); margin-top: 2px;">${isHome ? 'Home Advantage' : 'Away Fixture'}</div>
        `}
      </div>

      <div style="text-align: left;">
        <h2 style="font-size: 20px; margin: 0; color: ${!isHome ? 'var(--accent)' : '#fff'}; cursor: pointer;" onclick="inspectTeam('${userFixture.away}', 'squad')">
          ${ctx.state.teams[userFixture.away]?.name || 'Unknown'}
        </h2>
        <span style="font-size: 11px; color: var(--text-muted);">${!isHome ? 'AWAY (Your Club)' : 'AWAY'}</span>
      </div>
    </div>

    ${userFixture.played ? `
      <!-- Retrospective Placeholder until Event Log pass -->
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
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Formation:</span>
              <strong style="color: #fff;">${formation}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Mentality:</span>
              <strong style="color: #fff; text-transform: capitalize;">${mentality}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Chance Creation:</span>
              <strong style="color: #fff; text-transform: capitalize;">${creation}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Defensive Line & Press:</span>
              <strong style="color: #fff; text-transform: capitalize;">${press}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 8px;">
              <span style="color: var(--text-muted);">Recent Form:</span>
              <div style="display: flex; gap: 4px;">${formBadges}</div>
            </div>
          </div>
        </div>

        <div class="panel" style="padding: 16px;">
          <h3 style="margin-top: 0; font-size: 13px; color: #fff; border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-bottom: 12px;">
            SCOUTING INTEL & THREAT ASSESSMENT
          </h3>
          ${dangerMan ? `
            <div style="margin-bottom: 12px; padding: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 4px;">
              <div style="font-size: 11px; color: var(--accent); font-weight: 700;">KEY PLAYER TO WATCH</div>
              <div style="color: #fff; font-weight: 700; font-size: 14px; margin-top: 2px;">${dangerMan.name}</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                Archetype: <span style="color: #fff;">${dangerMan.archetypeName || dangerMan.archetypeKey}</span> |
                Goals This Season: <span style="color: #fff; font-weight: 700;">${dangerMan.stats?.goals || 0}</span>
              </div>
            </div>
          ` : ''}

          <div style="padding: 10px; border-left: 3px solid var(--accent); background: rgba(88, 166, 255, 0.05); font-size: 12px; line-height: 1.5; color: #c9d1d9;">
            <strong style="color: #fff; display: block; margin-bottom: 4px;">Tactical Recommendation:</strong>
            ${tacticalAdvice}
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
