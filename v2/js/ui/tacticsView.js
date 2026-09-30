import { FORMATIONS } from '../constants.js';
import { autoAssignLineup } from '../engine.js';

export function renderTacticsView(container, ctx) {
  const team = ctx.state.teams[ctx.viewedTeamId] || ctx.state.teams[ctx.state.userTeamId];
  const isUser = (team.id === ctx.state.userTeamId);

  container.innerHTML = `
    <div class="panel" style="padding: 16px; max-width: 650px; display: flex; flex-direction: column; gap: 16px;">
      <div>
        <label style="display: block; margin-bottom: 4px; color: var(--text-muted);">Formation Preset:</label>
        <select onchange="updateFormation(this.value)" ${!isUser ? 'disabled' : ''} style="width: 100%;">
          ${Object.keys(FORMATIONS).map(f => `<option value="${f}" ${team.formation === f ? 'selected' : ''}>${f}</option>`).join('')}
        </select>
      </div>

      ${[
        { label: 'Mentality (Affects Event Volume & Numbers Forward):', key: 'mentality', opts: ['park the bus', 'defensive', 'balanced', 'attacking', 'overload'] },
        { label: 'Pressing Strategy (Where Duels Occur):', key: 'press', opts: ['low block', 'mid block', 'high press', 'gegenpress'] },
        { label: 'Goalkeeper Distribution:', key: 'buildGk', opts: ['short', 'mixed', 'long'] },
        { label: 'Midfield Build-up:', key: 'buildMid', opts: ['patient possession', 'mixed', 'direct'] },
        { label: 'Chance Creation Style (Phase 3 Duel Routing):', key: 'chanceCreation', opts: ['tiki-taka', 'flank play', 'balls in behind', 'central creator'] }
      ].map(sec => `
        <div>
          <label style="display: block; margin-bottom: 4px; color: var(--text-muted);">${sec.label}</label>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${sec.opts.map(opt => `
              <button ${isUser ? `onclick="setTactics('${sec.key}', '${opt}')"` : 'disabled'} 
                      style="${team.tactics[sec.key] === opt ? 'border-color: var(--accent); color: var(--accent);' : ''} ${!isUser ? 'opacity: 0.85; cursor: default;' : ''}">
                ${opt.toUpperCase()}
              </button>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

export function updateFormation(form, ctx, renderLayout, saveGameState) {
  const team = ctx.state.teams[ctx.state.userTeamId];
  team.formation = form;
  autoAssignLineup(ctx.DB, team);
  saveGameState();
  renderLayout();
}

export function setTactics(k, v, ctx, renderLayout, saveGameState) {
  ctx.state.teams[ctx.state.userTeamId].tactics[k] = v;
  saveGameState();
  renderLayout();
}
