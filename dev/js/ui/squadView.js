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
  return parts.length > 1 ? `${parts[0][0]}.${parts.slice(1).join(' ')}` : fullName;
}

export function getSlotRank(slot) {
  if (!slot) return 999;
  if (slot.startsWith('S')) return parseInt(slot.slice(1), 10);
  if (slot.startsWith('B')) return 100 + parseInt(slot.slice(1), 10);
  return 999;
}

export function renderSquadView(container, ctx) {
  const team = ctx.state.teams[ctx.viewedTeamId] || ctx.state.teams[ctx.state.userTeamId];
  const isUser = (team.id === ctx.state.userTeamId);
  const units = ctx.state.config?.units || 'metric';
  const formRoles = FORMATIONS[team.formation] || FORMATIONS['4-4-2 Flat'];

  if (!ctx.squadViewMode) ctx.squadViewMode = 'general';
  if (!ctx.squadSort) ctx.squadSort = { key: 'slot', asc: true };
  if (!ctx.squadSeasonFilter) ctx.squadSeasonFilter = 'current';
  if (!ctx.squadCompFilter) ctx.squadCompFilter = 'all';

  const mode = ctx.squadViewMode;
  const sortKey = ctx.squadSort.key;
  const seasonFilter = ctx.squadSeasonFilter;
  const compFilter = ctx.squadCompFilter;

  const starterSlots = formRoles.map((role, i) => ({ val: `S${i + 1}`, label: role }));
  const benchSlots = Array.from({ length: 9 }, (_, i) => ({ val: `B${i + 1}`, label: `BN ${i + 1}` }));
  const playableSlots = [...starterSlots, ...benchSlots];

  const occupantMap = {};
  team.squad.forEach(sqP => { if (sqP.slot) occupantMap[sqP.slot] = sqP; });

  // Gather available seasons from archiveStats + current season
  const availableSeasons = [{ val: 'current', label: `Season ${ctx.state.season} (Current)` }];
  const maxArchivedSeason = Math.max(0, ...team.squad.map(p => Object.keys(p.archiveStats || {}).map(Number)).flat());
  for (let s = 1; s <= maxArchivedSeason; s++) {
    availableSeasons.push({ val: String(s), label: `Season ${s} (Archive)` });
  }

  // Helper to extract stats based on season & comp filters
  const getFilteredStatsAndMins = (p) => {
    let rawStats = { apps: 0, goals: 0, shots: 0, sot: 0, xg: 0.0, bigChancesCreated: 0, bigChancesComp: 0, bigChancesMissed: 0, assists: 0, xa: 0.0, passes: 0, passesComp: 0, keyPasses: 0, crosses: 0, crossesComp: 0, tackles: 0, tacklesWon: 0, interceptions: 0, aerialsContested: 0, aerialsWon: 0, saves: 0, shotsFaced: 0, cleanSheets: 0 };
    let mins = 0;

    if (seasonFilter === 'current') {
      mins = p.minutesPlayed || 0;
      const comps = compFilter === 'all' ? ['league', 'regional', 'cup'] : [compFilter];
      comps.forEach(c => {
        const st = p.stats?.[c];
        if (st) {
          Object.keys(rawStats).forEach(k => { rawStats[k] += (st[k] || 0); });
        }
      });
    } else {
      const arch = p.archiveStats?.[seasonFilter];
      if (arch) {
        mins = arch.minutesPlayed || 0;
        const comps = compFilter === 'all' ? ['league', 'regional', 'cup'] : [compFilter];
        comps.forEach(c => {
          const st = arch[c];
          if (st) {
            Object.keys(rawStats).forEach(k => { rawStats[k] += (st[k] || 0); });
          }
        });
      }
    }
    return { st: rawStats, mins };
  };

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
    return `cursor: pointer; width: ${width}; text-align: ${align}; color:${isSorted ? 'var(--accent)' : 'var(--text-muted)'};`;
  };

  const tdStyle = (key, align = 'center') => {
    const isSorted = sortKey === key;
    return `text-align: ${align}; color:${isSorted ? 'var(--accent)' : 'var(--text-muted)'}; font-family: monospace; font-size: 11px;`;
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
    const { st, mins } = getFilteredStatsAndMins(p);

    let displaySlotLabel = '—';
    if (p.slot) {
      if (p.slot.startsWith('S')) {
        const slotIdx = parseInt(p.slot.replace('S', ''), 10) - 1;
        displaySlotLabel = formRoles[slotIdx] || 'SUB';
      } else if (p.slot.startsWith('B')) {
        displaySlotLabel = `BN ${p.slot.replace('B', '')}`;
      }
    }

    let slotDisplay = `<span style="font-size: 11px; color: var(--text-muted); font-family: monospace;">${displaySlotLabel}</span>`;

    if (isUser) {
      const optionsHtml = [
        `<option value="" ${!p.slot ? 'selected' : ''}>—</option>`,
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
      <div style="display: flex; gap: 3px; align-items: center;">
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

      <!-- Multi-Competition & Season Filters -->
      <div style="display: flex; gap: 6px; align-items: center;">
        <select onchange="setSquadSeasonFilter(this.value)" style="padding: 2px 6px; font-size: 11px; background: #161b22; color: #fff; border: 1px solid var(--border);">
          ${availableSeasons.map(s => `<option value="${s.val}" ${seasonFilter === s.val ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
        <select onchange="setSquadCompFilter(this.value)" style="padding: 2px 6px; font-size: 11px; background: #161b22; color: #fff; border: 1px solid var(--border);">
          <option value="all" ${compFilter === 'all' ? 'selected' : ''}>All Competitions</option>
