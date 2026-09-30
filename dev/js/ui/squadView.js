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
  if (!traits.length) return '<span style="color: var(--text-muted);">—</span>';
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

  if (!ctx.squadViewMode) ctx.squadViewMode = 'general';
  if (!ctx.squadSort) ctx.squadSort = { key: 'slot', asc: true };
  const mode = ctx.squadViewMode;
  const sortKey = ctx.squadSort.key;

  const starterSlots = formRoles.map((role, i) => ({ val: `S${i + 1}`, label: role }));
  const benchSlots = Array.from({ length: 9 }, (_, i) => ({ val: `B${i + 1}`, label: `BN ${i + 1}` }));
  const playableSlots = [...starterSlots, ...benchSlots];

  const occupantMap = {};
  team.squad.forEach(sqP => { if (sqP.slot && sqP.slot !== 'RES') occupantMap[sqP.slot] = sqP; });

  const startersCount = team.squad.filter(p => p.slot.startsWith('S')).length;

  // Formatters: Convert 0 / 0.0 to em dash
  const formatVal = (val, isDecimal = false) => {
    if (!val || val === 0 || val === '0' || val === '0.0' || val === '0.00') return '—';
    return isDecimal ? Number(val).toFixed(1) : `${val}`;
  };

  const pct = (num, den) => {
    if (!den || den === 0 || !num || num === 0) return '—';
    const val = Math.round((num / den) * 100);
    return val > 0 ? `${val}%` : '—';
  };

  const p90 = (val, mins, isDecimal = true) => {
    if (!mins || mins === 0 || !val || val === 0) return '—';
    const res = (val / mins) * 90;
    if (res < 0.05) return '—';
    return isDecimal ? res.toFixed(2) : Math.round(res).toString();
  };

  const thStyle = (key, width, align = 'center') => {
    const isSorted = sortKey === key;
    return `cursor: pointer; width: ${width}; text-align: ${align}; color: ${isSorted ? 'var(--accent)' : 'var(--text-muted)'};`;
  };

  const tdStyle = (key, align = 'center') => {
    const isSorted = sortKey === key;
    return `text-align: ${align}; color: ${isSorted ? 'var(--accent)' : 'var(--text-muted)'}; font-family: monospace; font-size: 11px;`;
  };

  let tableHeaderHtml = '';
  if (mode === 'general') {
    tableHeaderHtml = `
      <tr>
        <th onclick="sortSquad('slot')" style="${thStyle('slot', '68px', 'left')}">Slot</th>
        <th onclick="sortSquad('name')" style="${thStyle('name', 'auto', 'left')}">Player</th>
        <th onclick="sortSquad('age')" style="${thStyle('age', '36px')}">Age</th>
        <th onclick="sortSquad('heightCm')" style="${thStyle('heightCm', '44px')}">${units === 'imperial' ? 'FT' : 'CM'}</th>
        <th onclick="sortSquad('weightKg')" style="${thStyle('weightKg', '44px')}">${units === 'imperial' ? 'LB' : 'KG'}</th>
        <th onclick="sortSquad('archetypeName')" style="${thStyle('archetypeName', 'auto', 'left')}">Archetype</th>
        <th style="color: var(--text-muted);">Traits</th>
        <th onclick="sortSquad('ip')" style="${thStyle('ip', '35px')}">IP</th>
        <th onclick="sortSquad('oop')" style="${thStyle('oop', '35px')}">OOP</th>
        <th onclick="sortSquad('tr')" style="${thStyle('tr', '35px')}">TR</th>
        <th onclick="sortSquad('minutesPlayed')" style="${thStyle('minutesPlayed', '48px', 'right')}">Min</th>
      </tr>
    `;
  } else {
    tableHeaderHtml = `
      <tr>
        <th onclick="sortSquad('slot')" style="${thStyle('slot', '68px', 'left')}">Slot</th>
        <th onclick="sortSquad('name')" style="${thStyle('name', 'auto', 'left')}">Player</th>
        <th onclick="sortSquad('minutesPlayed')" style="${thStyle('minutesPlayed', '48px', 'right')}">Min</th>
        <th onclick="sortSquad('goals')" style="${thStyle('goals', '36px')}">G</th>
        <th onclick="sortSquad('xg')" style="${thStyle('xg', '40px')}">xG</th>
        <th onclick="sortSquad('shots')" style="${thStyle('shots', '36px')}">SH</th>
        <th onclick="sortSquad('assists')" style="${thStyle('assists', '36px')}">A</th>
        <th onclick="sortSquad('xa')" style="${thStyle('xa', '40px')}">xA</th>
        <th onclick="sortSquad('keyPasses')" style="${thStyle('keyPasses', '36px')}">KP</th>
        <th onclick="sortSquad('cmpPct')" style="${thStyle('cmpPct', '46px')}">CMP%</th>
        <th onclick="sortSquad('crsPct')" style="${thStyle('crsPct', '46px')}">CRS%</th>
        <th onclick="sortSquad('tckPct')" style="${thStyle('tckPct', '46px')}">TCK%</th>
        <th onclick="sortSquad('aerPct')" style="${thStyle('aerPct', '46px')}">AER%</th>
        <th onclick="sortSquad('svPct')" style="${thStyle('svPct', '46px')}">SV%</th>
      </tr>
    `;
  }

  const tableBodyRows = team.squad.map(p => {
    const glyphs = parseGlyphs(p.phaseGlyphs);
    const st = p.stats || {};
    const mins = p.minutesPlayed || 0;

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

    if (mode === 'general') {
      return `
        <tr>
          <td>${slotDisplay}</td>
          <td style="font-weight: 600; color: var(--text);">
            ${p.name}${p.isGK ? '<span style="color: var(--accent); font-size: 10px; margin-left: 4px;">[GK]</span>' : ''}
          </td>
          <td style="${tdStyle('age')}">${p.age}</td>
          <td style="${tdStyle('heightCm')}">${formatHeight(p.morphology.heightCm, units)}</td>
          <td style="${tdStyle('weightKg')}">${formatWeight(p.morphology.weightKg, units)}</td>
          <td style="color: var(--text);">${p.archetypeName}</td>
          <td>${renderTraitBadges(p.traits)}</td>
          <td style="text-align: center;">${renderGlyphCell(glyphs.ip)}</td>
          <td style="text-align: center;">${renderGlyphCell(glyphs.oop)}</td>
          <td style="text-align: center;">${renderGlyphCell(glyphs.tr)}</td>
          <td style="${tdStyle('minutesPlayed', 'right')}">${mins > 0 ? `${mins}'` : '—'}</td>
        </tr>
      `;
    }

    // STATS (OVR)
    if (mode === 'ovr') {
      return `
        <tr>
          <td>${slotDisplay}</td>
          <td style="font-weight: 600; color: var(--text);">
            ${p.name}${p.isGK ? '<span style="color: var(--accent); font-size: 10px; margin-left: 4px;">[GK]</span>' : ''}
          </td>
          <td style="${tdStyle('minutesPlayed', 'right')}">${mins > 0 ? `${mins}'` : '—'}</td>
          <td style="${tdStyle('goals')}">${formatVal(st.goals)}</td>
          <td style="${tdStyle('xg')}">${formatVal(st.xg, true)}</td>
          <td style="${tdStyle('shots')}">${formatVal(st.shots)}</td>
          <td style="${tdStyle('assists')}">${formatVal(st.assists)}</td>
          <td style="${tdStyle('xa')}">${formatVal(st.xa, true)}</td>
          <td style="${tdStyle('keyPasses')}">${formatVal(st.keyPasses)}</td>
          <td style="${tdStyle('cmpPct')}">${pct(st.passesComp, st.passes)}</td>
          <td style="${tdStyle('crsPct')}">${pct(st.crossesComp, st.crosses)}</td>
          <td style="${tdStyle('tckPct')}">${pct(st.tacklesWon, st.tackles)}</td>
          <td style="${tdStyle('aerPct')}">${pct(st.aerialsWon, st.aerialsContested)}</td>
          <td style="${tdStyle('svPct')}">${p.isGK ? pct(st.saves, st.shotsFaced) : '—'}</td>
        </tr>
      `;
    }

    // STATS (p90)
    return `
      <tr>
        <td>${slotDisplay}</td>
        <td style="font-weight: 600; color: var(--text);">
          ${p.name}${p.isGK ? '<span style="color: var(--accent); font-size: 10px; margin-left: 4px;">[GK]</span>' : ''}
        </td>
        <td style="${tdStyle('minutesPlayed', 'right')}">${mins > 0 ? `${mins}'` : '—'}</td>
        <td style="${tdStyle('goals')}">${p90(st.goals, mins)}</td>
        <td style="${tdStyle('xg')}">${p90(st.xg, mins)}</td>
        <td style="${tdStyle('shots')}">${p90(st.shots, mins)}</td>
        <td style="${tdStyle('assists')}">${p90(st.assists, mins)}</td>
        <td style="${tdStyle('xa')}">${p90(st.xa, mins)}</td>
        <td style="${tdStyle('keyPasses')}">${p90(st.keyPasses, mins)}</td>
        <td style="${tdStyle('cmpPct')}">${pct(st.passesComp, st.passes)}</td>
        <td style="${tdStyle('crsPct')}">${pct(st.crossesComp, st.crosses)}</td>
        <td style="${tdStyle('tckPct')}">${pct(st.tacklesWon, st.tackles)}</td>
        <td style="${tdStyle('aerPct')}">${pct(st.aerialsWon, st.aerialsContested)}</td>
        <td style="${tdStyle('svPct')}">${p.isGK ? pct(st.saves, st.shotsFaced) : '—'}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="display: flex; gap: 3px;">
          ${[
            { key: 'general', label: 'GENERAL' },
            { key: 'ovr', label: 'STATS (OVR)' },
            { key: 'p90', label: 'STATS (P90)' }
          ].map(tab => `
            <button onclick="setSquadViewMode('${tab.key}')" style="padding: 2px 8px; font-size: 11px; font-weight: 700; ${ctx.squadViewMode === tab.key ? 'border-color: var(--accent); color: var(--accent);' : 'color: var(--text-muted);'}">
              ${tab.label}
            </button>
          `).join('')}
        </div>
        <span style="font-size: 11px; color: var(--text-muted);">
          Lineup: <strong style="color: ${startersCount === 11 ? 'var(--green)' : 'var(--amber)'}">${startersCount}/11 Starters</strong> • Formation: ${team.formation}
        </span>
      </div>
      ${isUser ? `<button onclick="autoPickLineup()">AUTO-PICK XI</button>` : ''}
    </div>

    <div class="panel" style="overflow-x: auto;">
      <table>
        <thead>
          ${tableHeaderHtml}
        </thead>
        <tbody>
          ${tableBodyRows}
        </tbody>
      </table>
    </div>
  `;
}

export function setSquadViewMode(mode, ctx, renderLayout) {
  ctx.squadViewMode = mode;
  renderLayout();
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

  const getMetricVal = (p, k) => {
    const st = p.stats || {};
    const mins = p.minutesPlayed || 0;
    const isP90 = ctx.squadViewMode === 'p90';

    if (k === 'cmpPct') return (st.passes || 0) > 0 ? (st.passesComp / st.passes) : -1;
    if (k === 'crsPct') return (st.crosses || 0) > 0 ? (st.crossesComp / st.crosses) : -1;
    if (k === 'tckPct') return (st.tackles || 0) > 0 ? (st.tacklesWon / st.tackles) : -1;
    if (k === 'aerPct') return (st.aerialsContested || 0) > 0 ? (st.aerialsWon / st.aerialsContested) : -1;
    if (k === 'svPct') return (st.shotsFaced || 0) > 0 ? (st.saves / st.shotsFaced) : -1;

    let baseVal = st[k] || 0;
    if (isP90) return mins > 0 ? (baseVal / mins) * 90 : 0;
    return baseVal;
  };

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
    if (['goals', 'xg', 'shots', 'assists', 'xa', 'keyPasses', 'cmpPct', 'crsPct', 'tckPct', 'aerPct', 'svPct'].includes(s.key)) {
      const valA = getMetricVal(a, s.key);
      const valB = getMetricVal(b, s.key);
      return s.asc ? valA - valB : valB - valA;
    }
    if (s.key === 'minutesPlayed') return s.asc ? (a.minutesPlayed || 0) - (b.minutesPlayed || 0) : (b.minutesPlayed || 0) - (a.minutesPlayed || 0);
    if (s.key === 'age') return s.asc ? a.age - b.age : b.age - a.age;
    if (s.key === 'heightCm') return s.asc ? a.morphology.heightCm - b.morphology.heightCm : b.morphology.heightCm - a.morphology.heightCm;
    if (s.key === 'weightKg') return s.asc ? a.morphology.weightKg - b.morphology.weightKg : b.morphology.weightKg - a.morphology.weightKg;

    let valA = a[s.key] || 0;
    let valB = b[s.key] || 0;
    if (typeof valA === 'string') return s.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    return s.asc ? valA - valB : valB - valA;
  });

  renderLayout();
}
