export function renderFixturesView(container, ctx) {
  const team = ctx.state.teams[ctx.viewedTeamId] || ctx.state.teams[ctx.state.userTeamId];
  const calendar = ctx.state.calendar || {};
  const currentWeek = ctx.state.week;
  const currentMoment = ctx.state.moment;

  const entries = [];

  for (let w = 1; w <= 52; w++) {
    const weekData = calendar[w];
    if (!weekData) continue;

    for (let m = 1; m <= 4; m++) {
      const slot = weekData[m];
      if (!slot) continue;

      if (slot.type === 'match' && slot.matches) {
        const match = slot.matches.find(fx => fx.home === team.id || fx.away === team.id);
        if (match) {
          const isHome = (match.home === team.id);
          const oppId = isHome ? match.away : match.home;
          const oppTeam = ctx.state.teams[oppId];
          const comp = match.comp || slot.comp;

          // 1. Resolve Competition Name
          let compName = `Division ${team.div}`;
          if (comp === 'cup') {
            compName = 'Universal Cup';
          } else if (comp === 'regional') {
            compName = team.regionalCup || match.cupName || 'Regional Cup';
          }

          // 2. Resolve Round / Matchweek Label
          let roundLabel = `W${w}.M${m}`;
          if (comp === 'cup') {
            roundLabel = slot.cupRoundName || match.roundName || 'Cup Tie';
          } else if (comp === 'regional') {
            roundLabel = `MW ${w - 4}`;
          } else if (comp === 'league') {
            const mwNum = match.leagueRound || (w - 20);
            roundLabel = `MW ${mwNum}`;
          }

          entries.push({
            week: w,
            moment: m,
            isCurrent: (w === currentWeek && m === currentMoment),
            comp,
            compName,
            roundLabel,
            isHome,
            oppName: oppTeam ? oppTeam.name : 'TBD',
            match
          });
        }
      }
    }
  }

  // Identify the target row: first unplayed match (or current match)
  const targetFixture = entries.find(e => e.isCurrent) || entries.find(e => !e.match.played);
  const targetKey = targetFixture ? `${targetFixture.week}_${targetFixture.moment}` : null;

  container.innerHTML = `
    <div style="max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
        <div>
          <strong style="color: #fff; font-size: 14px;">${team.name.toUpperCase()} CALENDAR & FIXTURES</strong>
          <span style="color: var(--text-muted); font-size: 12px; margin-left: 8px;">DIVISION ${team.div} • SEASON ${ctx.state.season}</span>
        </div>
      </div>

      <!-- Constrained height with pinned sticky headers -->
      <div class="panel" style="overflow-x: auto; max-height: calc(100vh - 160px); overflow-y: auto;">
        <table style="border-collapse: collapse; width: 100%;">
          <thead>
            <tr style="position: sticky; top: 0; background: #161b22; z-index: 2; box-shadow: 0 1px 0 var(--border);">
              <th style="width: 85px; text-align: left; padding-left: 8px; white-space: nowrap;">Round</th>
              <th style="width: 140px; white-space: nowrap;">Competition</th>
              <th style="width: 45px; text-align: center;">H/A</th>
              <th style="text-align: left;">Opponent</th>
              <th style="width: 95px; text-align: center;">Result</th>
              <th style="width: 110px; text-align: center;">xG</th>
              <th style="width: 60px; text-align: center;">Outcome</th>
            </tr>
          </thead>
          <tbody>
            ${entries.length === 0 ? `
              <tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">No scheduled fixtures found for this club.</td></tr>
            ` : entries.map(item => {
              const { week, moment, isCurrent, compName, roundLabel, isHome, oppName, match } = item;
              const isTargetRow = targetKey === `${week}_${moment}`;

              let scoreDisplay = '<span style="color: var(--text-muted);">—</span>';
              let xgDisplay = '<span style="color: var(--text-muted);">—</span>';
              let outcomeBadge = '<span style="color: var(--text-muted);">—</span>';

              if (match.played) {
                const teamG = isHome ? match.hg : match.ag;
                const oppG = isHome ? match.ag : match.hg;
                const teamXg = isHome ? match.hxg : match.axg;
                const oppXg = isHome ? match.axg : match.hxg;

                scoreDisplay = `
                  <button onclick="openMatchReport('${match.home}', ${week},${moment})" 
                          title="View Match Report"
                          style="padding: 2px 8px; font-family: monospace; font-size: 11px; font-weight: 700; background: rgba(88, 166, 255, 0.1); border: 1px solid var(--border); color: #fff; cursor: pointer; border-radius: 3px;">
                    ${teamG}&nbsp;–&nbsp;${oppG}
                  </button>
                `;
                xgDisplay = `<span style="font-family: monospace; font-size: 11px; color: var(--text-muted);">${teamXg.toFixed(1)}&nbsp;–&nbsp;${oppXg.toFixed(1)}</span>`;
                outcomeBadge = teamG > oppG ? '<span class="badge badge-asset">W</span>' : teamG === oppG ? '<span style="color: var(--amber); font-weight: 700;">D</span>' : '<span class="badge badge-liability">L</span>';
              } else if (isCurrent) {
                scoreDisplay = '<span style="color: var(--accent); font-weight: 700; font-size: 10px;">UPCOMING</span>';
              }

              return `
                <tr ${isTargetRow ? 'id="upcoming-fixture-row"' : ''} style="${isCurrent ? 'background: rgba(88, 166, 255, 0.08); font-weight: 600;' : ''}">
                  <td style="text-align: left; padding-left: 8px; color: var(--text-muted); font-family: monospace; font-size: 11px; white-space: nowrap;">${roundLabel}</td>
                  <td style="color: var(--accent); font-size: 11px;">${compName}</td>
                  <td style="text-align: center;">${isHome ? '<strong style="color: var(--accent);">H</strong>' : 'A'}</td>
                  <td><span style="color: #fff;">${oppName}</span></td>
                  <td style="text-align: center;">${scoreDisplay}</td>
                  <td style="text-align: center;">${xgDisplay}</td>
                  <td style="text-align: center;">${outcomeBadge}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Auto-scroll the upcoming match to the bottom of the visible panel
  requestAnimationFrame(() => {
    const el = document.getElementById('upcoming-fixture-row');
    if (el) {
      el.scrollIntoView({ block: 'end' });
    }
  });
}
