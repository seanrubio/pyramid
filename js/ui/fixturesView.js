export function renderFixturesView(container, ctx) {
  const team = ctx.state.teams[ctx.viewedTeamId] || ctx.state.teams[ctx.state.userTeamId];
  const divFixtures = ctx.state.fixtures[team.div] || [];

  const clubSchedule = [];
  divFixtures.forEach((roundMatches, idx) => {
    const match = roundMatches.find(m => m.home === team.id || m.away === team.id);
    if (match) {
      clubSchedule.push({
        round: idx + 1,
        match,
        isHome: match.home === team.id,
        opponent: ctx.state.teams[match.home === team.id ? match.away : match.home]
      });
    }
  });

  container.innerHTML = `
    <div style="max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
        <div>
          <strong style="color: #fff; font-size: 14px;">${team.name.toUpperCase()} FIXTURES & RESULTS</strong>
          <span style="color: var(--text-muted); font-size: 12px; margin-left: 8px;">DIVISION ${team.div} • SEASON ${ctx.state.season}</span>
        </div>
      </div>

      <div class="panel" style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">Rnd</th>
              <th style="width: 55px; text-align: center;">Venue</th>
              <th>Opponent</th>
              <th style="width: 95px; text-align: center;">Result</th>
              <th style="width: 110px; text-align: center;">xG</th>
              <th style="width: 60px; text-align: center;">Outcome</th>
            </tr>
          </thead>
          <tbody>
            ${clubSchedule.map(item => {
              const { round, match, isHome, opponent } = item;
              const isCurrent = (round === ctx.state.round && !match.played);
              let scoreDisplay = '<span style="color: var(--text-muted);">-</span>';
              let xgDisplay = '<span style="color: var(--text-muted);">-</span>';
              let outcomeBadge = '<span style="color: var(--text-muted);">-</span>';

              if (match.played) {
                const teamGoals = isHome ? match.hg : match.ag;
                const oppGoals = isHome ? match.ag : match.hg;
                scoreDisplay = `<span style="font-family: monospace; font-weight: 700; color: #fff;">${teamGoals}&nbsp;–&nbsp;${oppGoals}</span>`;
                xgDisplay = `<span style="font-family: monospace; font-size: 11px; color: var(--text-muted);">${(isHome ? match.hxg : match.axg).toFixed(1)}&nbsp;–&nbsp;${(isHome ? match.axg : match.hxg).toFixed(1)}</span>`;
                outcomeBadge = teamGoals > oppGoals ? '<span class="badge badge-asset">W</span>' : teamGoals === oppGoals ? '<span style="color: var(--amber); font-weight: 700;">D</span>' : '<span class="badge badge-liability">L</span>';
              } else if (isCurrent) {
                scoreDisplay = '<span style="color: var(--accent); font-weight: 700;">NEXT UP</span>';
              }

              return `
                <tr style="${isCurrent ? 'background: rgba(88, 166, 255, 0.08)' : ''}">
                  <td style="text-align: center; color: var(--text-muted);">${round}</td>
                  <td style="text-align: center;">${isHome ? '<strong style="color: var(--accent);">H</strong>' : 'A'}</td>
                  <td>
                    ${opponent ? `<span onclick="inspectTeam('${opponent.id}', 'squad')" style="cursor: pointer; font-weight: 600; color: var(--accent); text-decoration: underline;">${opponent.name}</span>` : 'Unknown'}
                  </td>
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
}
