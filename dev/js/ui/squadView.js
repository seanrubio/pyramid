import { FORMATIONS } from '../constants.js';
import { autoAssignLineup } from '../engine.js';

export function formatHeight(cm, units = 'metric') {
  if (units === 'imperial') {
    const totalInches = Math.round(cm / 2.54);
    return `${Math.floor(totalInches / 12)}'${totalInches % 12}"`;
  }
  return `${cm}`;
}

export function formatWeight(kg, units = 'metric') {
  return units === 'imperial' ? `${Math.round(kg * 2.20462)}` : `${kg}`;
}

export function parseGlyphs(phaseGlyphs = "✓ / ✓ / ✓") {
  const parts = phaseGlyphs.split('/').map(s => s.trim());
  return { ip: parts[0] || '✓', oop: parts[1] || '✓', tr: parts[2] || '✓' };
}

export function renderGlyphCell(glyph) {
  let color = 'var(--text-muted)';
  if (glyph === '+') color = 'var(--green)';
  if (glyph === '-') color = 'var(--red)';
  return `<span style="font-size: 15px; font-weight: 700; color: ${color};">${glyph}</span>`;
}

export function renderTraitBadges(traits = []) {
  if (!traits.length) return '<span style="color: var(--text-muted);">-</span>';
  return [...traits].sort((a, b) => (b.startsWith('[+') ? 1 : -1)).map(t => {
    const isAsset = t.startsWith('[+');
    return `<span class="badge ${isAsset ? 'badge-asset' : 'badge-liability'}">${isAsset ? '+' : '-'}${t.slice(2, -1)}</span>`;
  }).join('');
}

export function formatShortName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : fullName;
}

export function renderSquadView(container, ctx) {
  const team = ctx.state.teams[ctx.viewedTeamId] || ctx.state.teams[ctx.state.userTeamId];
  const isUser = (team.id === ctx.state.userTeamId);
  const units = ctx.state.config?.units || 'metric';
  const formRoles = FORMATIONS[team.formation] || FORMATIONS['4-4-2 Flat'];

  const starterSlots = formRoles.map((role, i) => ({ val: `S${i + 1}`, label: role }));
  const benchSlots = Array.from({ length: 9 }, (_, i) => ({ val: `B${i + 1}`, label: `BN ${i + 1}` }));
  const playableSlots = [...starterSlots, ...benchSlots];

  const occupantMap = {};
  team.squad.forEach(sqP => { if (sqP.slot && sqP.slot !== 'RES') occupantMap[sqP.slot] = sqP; });

  const startersCount = team.squad.filter(p => p.slot.startsWith('S')).length;

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <div>
        <span>Lineup: <strong style="color: ${startersCount === 11 ? 'var(--green)' : 'var(--amber)'}">${startersCount}/11 Starters</strong></span>
        <span style="color: var(--text-muted); margin-left: 12px;">Formation: ${team.formation}</span>
      </div>
      ${isUser ? `<button onclick="autoPickLineup()">AUTO-PICK XI</button>` : ''}
    </div>

    <div class="panel" style="overflow-x: auto;">
      <table>
        <thead>
          <tr>
            <th onclick="sortSquad('slot')" style="cursor: pointer; width: 68px;">Slot</th>
            <th onclick="sortSquad('name')" style="cursor: pointer;">Player</th>
            <th onclick="sortSquad('archetypeName')" style="cursor: pointer;">Archetype</th>
            <th onclick="sortSquad('age')" style="cursor: pointer; text-align: center;">Age</th>
            <th onclick="sortSquad('heightCm')" style="cursor: pointer; text-align: center;">${units === 'imperial' ? 'FT' : 'CM'}</th>
            <th onclick="sortSquad('weightKg')" style="cursor: pointer; text-align: center;">${units === 'imperial' ? 'LB' : 'KG'}</th>
            <th>Traits</th>
            <th onclick="sortSquad('ip')" style="cursor: pointer; text-align: center; width: 35px;">IP</th>
            <th onclick="sortSquad('oop')" style="cursor: pointer; text-align: center; width: 35px;">OOP</th>
            <th onclick="sortSquad('tr')" style="cursor: pointer; text-align: center; width: 35px;">TR</th>
            <th onclick="sortSquad('goals')" style="cursor: pointer; text-align: center; width: 30px;">G</th>
            <th onclick="sortSquad('assists')" style="cursor: pointer; text-align: center; width: 30px;">A</th>
            <th onclick="sortSquad('xg')" style="cursor: pointer; text-align: center; width: 40px;">xG</th>
            <th onclick="sortSquad('tackles')" style="cursor: pointer; text-align: center; width: 32px;">TK</th>
            <th onclick="sortSquad('saves')" style="cursor: pointer; text-align: center; width: 32px;">SV</th>
            <th onclick="sortSquad('minutesPlayed')" style="cursor: pointer; text-align: right; width: 45px;">Min</th>
          </tr>
        </thead>
        <tbody>
          ${team.squad.map(p => {
            const glyphs = parseGlyphs(p.phaseGlyphs);
            const st = p.stats || { goals: 0, assists: 0, xg: 0.0, tackles: 0, saves: 0 };

            let slotDisplay = `<span style="font-size: 11px; color: var(--text-muted); font-family: monospace;">${p.slot}</span>`;

            if (isUser) {
              const optionsHtml = [
                `<option value="RES" ${p.slot === 'RES' ? 'selected' : ''}>RES</option>`,
                ...playableSlots.map(s => {
                  const isCurrent = (p.slot === s.val);
                  const occupant = occupantMap[s.val];
                  let text = s.label + (!isCurrent && occupant ? ` (${formatShortName(occupant.name)})` : '');
                  return `<option value="${s.val}" ${isCurrent ? 'selected' : ''}>${text}</option>`;
                })
              ].join('');

              slotDisplay = `
                <select onchange="handleSlotChange('${p.id}', this.value)" style="width: auto; max-width: 65px; padding: 2px 4px; font-size: 11px;">
                  ${optionsHtml}
                </select>
              `;
            }

            return `
              <tr>
                <td>${slotDisplay}</td>
                <td style="font-weight: 600; color: var(--text);">
                  ${p.name}${p.isGK ? '<span style="color: var(--accent); font-size: 10px; margin-left: 4px;">[GK]</span>' : ''}
                </td>
                <td style="color: var(--text);">${p.archetypeName}</td>
                <td style="text-align: center; color: var(--text-muted);">${p.age}</td>
                <td style="text-align: center; font-size: 11px;">${formatHeight(p.morphology.heightCm, units)}</td>
                <td style="text-align: center; font-size: 11px;">${formatWeight(p.morphology.weightKg, units)}</td>
                <td>${renderTraitBadges(p.traits)}</td>
                <td style="text-align: center;">${renderGlyphCell(glyphs.ip)}</td>
                <td style="text-align: center;">${renderGlyphCell(glyphs.oop)}</td>
                <td style="text-align: center;">${renderGlyphCell(glyphs.tr)}</td>
                <td style="text-align: center; font-weight: 700; color: #fff;">${st.goals}</td>
                <td style="text-align: center; color: var(--accent);">${st.assists}</td>
                <td style="text-align: center; color: var(--text-muted); font-size: 11px;">${(st.xg || 0).toFixed(1)}</td>
                <td style="text-align: center; color: var(--text-muted); font-size: 11px;">${st.tackles || 0}</td>
                <td style="text-align: center; color: ${p.isGK ? 'var(--accent)' : 'var(--text-muted)'}; font-size: 11px;">${p.isGK ? (st.saves || 0) : '-'}</td>
                <td style="text-align: right; color: var(--text-muted);">${p.minutesPlayed}'</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function handleSlotChange(pid, newSlot, ctx, renderLayout, saveGameState) {
  const team = ctx.state.teams[ctx.state.userTeamId];
  const player = team.squad.find(p => p.id === pid);
  if (!player) return;

  const oldSlot = player.slot;
  if (newSlot !== 'RES') {
    const occupant = team.squad.find(p => p.id !== pid && p.slot === newSlot);
    if (occupant) occupant.slot = oldSlot;
  }
  player.slot = newSlot;
  saveGameState();
  renderLayout();
}

export function autoPickLineup(ctx, renderLayout, saveGameState) {
  const team = ctx.state.teams[ctx.state.userTeamId];
  autoAssignLineup(ctx.DB, team);
  saveGameState();
  renderLayout();
}

export function sortSquad(key, ctx, renderLayout) {
  const s = ctx.squadSort;
  if (s.key === key) s.asc = !s.asc;
  else { s.key = key; s.asc = (key === 'name' || key === 'slot'); }

  const team = ctx.state.teams[ctx.viewedTeamId] || ctx.state.teams[ctx.state.userTeamId];
  const GLYPH_WEIGHTS = { '+': 2, '✓': 1, '-': 0 };
  const getLastName = (fullName) => fullName.trim().split(/\s+/).pop().toLowerCase();
  const getSlotRank = (slot) => slot.startsWith('S') ? parseInt(slot.slice(1), 10) : slot.startsWith('B') ? 100 + parseInt(slot.slice(1), 10) : 999;

  team.squad.sort((a, b) => {
    if (s.key === 'slot') return s.asc ? getSlotRank(a.slot) - getSlotRank(b.slot) : getSlotRank(b.slot) - getSlotRank(a.slot);
    if (s.key === 'name') {
      const cmp = getLastName(a.name).localeCompare(getLastName(b.name));
      return s.asc ? cmp : -cmp;
    }
    if (['ip', 'oop', 'tr'].includes(s.key)) {
      const valA = GLYPH_WEIGHTS[parseGlyphs(a.phaseGlyphs)[s.key]] ?? 1;
      const valB = GLYPH_WEIGHTS[parseGlyphs(b.phaseGlyphs)[s.key]] ?? 1;
      return valA !== valB ? (s.asc ? valA - valB : valB - valA) : getLastName(a.name).localeCompare(getLastName(b.name));
    }
    if (['goals', 'assists', 'xg', 'tackles', 'saves'].includes(s.key)) {
      return s.asc ? (a.stats?.[s.key] || 0) - (b.stats?.[s.key] || 0) : (b.stats?.[s.key] || 0) - (a.stats?.[s.key] || 0);
    }
    if (s.key === 'heightCm') return s.asc ? a.morphology.heightCm - b.morphology.heightCm : b.morphology.heightCm - a.morphology.heightCm;
    if (s.key === 'weightKg') return s.asc ? a.morphology.weightKg - b.morphology.weightKg : b.morphology.weightKg - a.morphology.weightKg;

    let valA = a[s.key] || 0;
    let valB = b[s.key] || 0;
    if (typeof valA === 'string') return s.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    return s.asc ? valA - valB : valB - valA;
  });

  renderLayout();
}
