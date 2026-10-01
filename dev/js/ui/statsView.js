import { OUTFIELD_ARCHETYPES, GK_ARCHETYPES } from '../constants.js';
import { parseGlyphs, renderGlyphCell, renderTraitBadges } from './squadView.js';

// --- CONFIGURATION & CATALOG OF ALL AVAILABLE STAT METRICS ---
export const STAT_CATALOG = {
  goals:               { id: 'goals', label: 'Goals', short: 'G', type: 'count', defaultOvr: true, defaultP90: true },
  xg:                  { id: 'xg', label: 'Expected Goals', short: 'xG', type: 'decimal', defaultOvr: true, defaultP90: true },
  assists:             { id: 'assists', label: 'Assists', short: 'A', type: 'count', defaultOvr: true, defaultP90: true },
  xa:                  { id: 'xa', label: 'Expected Assists', short: 'xA', type: 'decimal', defaultOvr: true, defaultP90: true },
  shots:               { id: 'shots', label: 'Shots', short: 'SH', type: 'count' },
  sot:                 { id: 'sot', label: 'Shots on Target', short: 'SoT', type: 'count' },
  bigChancesCreated:   { id: 'bigChancesCreated', label: 'Big Chances Created', short: 'BCC', type: 'count' },
  bigChancesComp:      { id: 'bigChancesComp', label: 'Big Chances Converted', short: 'BCG', type: 'count' },
  bigChancesMissed:    { id: 'bigChancesMissed', label: 'Big Chances Missed', short: 'BCM', type: 'count' },
  passes:              { id: 'passes', label: 'Passes Attempted', short: 'P', type: 'count' },
  passesComp:          { id: 'passesComp', label: 'Passes Completed', short: 'PC', type: 'count' },
  keyPasses:           { id: 'keyPasses', label: 'Key Passes', short: 'KP', type: 'count' },
  crosses:             { id: 'crosses', label: 'Crosses Attempted', short: 'CR', type: 'count' },
  crossesComp:         { id: 'crossesComp', label: 'Crosses Completed', short: 'CRC', type: 'count' },
  tackles:             { id: 'tackles', label: 'Tackles Attempted', short: 'TK', type: 'count' },
  tacklesWon:          { id: 'tacklesWon', label: 'Tackles Won', short: 'TKW', type: 'count' },
  interceptions:       { id: 'interceptions', label: 'Interceptions', short: 'INT', type: 'count' },
  aerialsContested:    { id: 'aerialsContested', label: 'Aerial Duels Contested', short: 'AER', type: 'count' },
  aerialsWon:          { id: 'aerialsWon', label: 'Aerial Duels Won', short: 'AW', type: 'count' },
  cleanSheets:         { id: 'cleanSheets', label: 'Clean Sheets', short: 'CS', type: 'count' },
  saves:               { id: 'saves', label: 'Saves', short: 'SV', type: 'count' },
  shotsFaced:          { id: 'shotsFaced', label: 'Shots Faced', short: 'SF', type: 'count' },
  // Calculated Ratios
  cmpPct:              { id: 'cmpPct', label: 'Pass Comp %', short: 'CMP%', type: 'ratio', num: 'passesComp', den: 'passes', defaultOvr: true, defaultP90: true },
  crsPct:              { id: 'crsPct', label: 'Cross Comp %', short: 'CRS%', type: 'ratio', num: 'crossesComp', den: 'crosses' },
  tckPct:              { id: 'tckPct', label: 'Tackle Win %', short: 'TCK%', type: 'ratio', num: 'tacklesWon', den: 'tackles', defaultOvr: true, defaultP90: true },
  aerPct:              { id: 'aerPct', label: 'Aerial Win %', short: 'AER%', type: 'ratio', num: 'aerialsWon', den: 'aerialsContested', defaultOvr: true, defaultP90: true },
  svPct:               { id: 'svPct', label: 'Save %', short: 'SV%', type: 'ratio', num: 'saves', den: 'shotsFaced' }
};

const DEFAULT_METRIC_KEYS = ['goals', 'xg', 'assists', 'xa', 'cmpPct', 'tckPct', 'aerPct'];

export function initStatsViewState(ctx) {
  if (!ctx.statsViewState) {
    ctx.statsViewState = {
      mode: 'ovr', // 'ovr' | 'p90'
      selectedMetrics: [...DEFAULT_METRIC_KEYS],
      divisions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // all by default
      traits: [],
      traitMode: 'or', // 'or' | 'and'
      phases: {
        ip: ['+', '✓', '-'],
        oop: ['+', '✓', '-'],
        tr: ['+', '✓', '-']
      },
      minMinutes: 1,
      minAge: 16,
      maxAge: 45,
      archetypes: [], // empty = all
      sort: { key: 'goals', asc: false },
      page: 1,
      pageSize: 25,
      openDropdown: null // id of currently opened multi-select popover
    };
  }
}

// Format helpers
function formatValue(val, isDecimal = false) {
  if (val === null || val === undefined || val === 0 || val === '0' || val === '0.0' || val === '0.00') return '—';
  return isDecimal ? Number(val).toFixed(2) : `${val}`;
}

function formatPct(num, den) {
  if (!den || den === 0 || !num || num === 0) return '—';
  const val = Math.round((num / den) * 100);
  return val > 0 ? `${val}%` : '—';
}

function calculateMetric(p, metricKey, isP90) {
  const metric = STAT_CATALOG[metricKey];
  if (!metric) return 0;
  const st = p.stats || {};
  const mins = p.minutesPlayed || 0;

  if (metric.type === 'ratio') {
    const den = st[metric.den] || 0;
    const num = st[metric.num] || 0;
    return den > 0 ? (num / den) : -1;
  }

  const raw = st[metricKey] || 0;
  if (isP90) {
    return mins > 0 ? (raw / mins) * 90 : 0;
  }
  return raw;
}

export function renderStatsView(container, ctx) {
  initStatsViewState(ctx);
  const svs = ctx.statsViewState;
  const isP90 = svs.mode === 'p90';

  // 1. Gather all players across selected divisions
  const selectedDivSet = new Set(svs.divisions);
  const players = [];

  Object.values(ctx.state.teams).forEach(t => {
    if (selectedDivSet.has(t.div)) {
      (t.squad || []).forEach(p => {
        players.push({
          ...p,
          teamName: t.name,
          teamId: t.id,
          teamDiv: t.div
        });
      });
    }
  });

  // 2. Filter Players
  const filtered = players.filter(p => {
    const mins = p.minutesPlayed || 0;
    if (mins < svs.minMinutes) return false;
    if (p.age < svs.minAge || p.age > svs.maxAge) return false;
    if (svs.archetypes.length > 0 && !svs.archetypes.includes(p.archetypeKey)) return false;

    // Phase Exact Filtering
    const glyphs = parseGlyphs(p.phaseGlyphs);
    if (!svs.phases.ip.includes(glyphs.ip)) return false;
    if (!svs.phases.oop.includes(glyphs.oop)) return false;
    if (!svs.phases.tr.includes(glyphs.tr)) return false;

    // Trait Filtering
    if (svs.traits.length > 0) {
      const pTraits = p.traits || [];
      if (svs.traitMode === 'and') {
        const hasAll = svs.traits.every(t => pTraits.includes(t));
        if (!hasAll) return false;
      } else {
        const hasAny = svs.traits.some(t => pTraits.includes(t));
        if (!hasAny) return false;
      }
    }

    return true;
  });

  // 3. Sort Players
  filtered.sort((a, b) => {
    const k = svs.sort.key;
    let valA, valB;

    if (k === 'name') {
      const cmp = a.name.localeCompare(b.name);
      return svs.sort.asc ? cmp : -cmp;
    } else if (k === 'minutesPlayed') {
      valA = a.minutesPlayed || 0;
      valB = b.minutesPlayed || 0;
    } else if (k === 'age') {
      valA = a.age || 0;
      valB = b.age || 0;
    } else if (k === 'div') {
      valA = a.teamDiv;
      valB = b.teamDiv;
    } else {
      valA = calculateMetric(a, k, isP90);
      valB = calculateMetric(b, k, isP90);
    }

    return svs.sort.asc ? valA - valB : valB - valA;
  });

  // 4. Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filtered.length / svs.pageSize));
  if (svs.page > totalPages) svs.page = totalPages;
  const startIdx = (svs.page - 1) * svs.pageSize;
  const visiblePlayers = filtered.slice(startIdx, startIdx + svs.pageSize);

  // Available traits collection from DB
  const allTraits = [];
  if (ctx.DB?.traits) {
    Object.values(ctx.DB.traits).forEach(t => {
      allTraits.push(`[+${t.asset}]`);
      allTraits.push(`[-${t.liability}]`);
    });
  }

  // All Archetypes
  const allArchetypes = [...OUTFIELD_ARCHETYPES, ...GK_ARCHETYPES].map(key => ({
    key,
    name: ctx.DB?.archetypes?.[key]?.name || key
  }));

  // Build UI
  container.innerHTML = `
    <!-- Top Controls: Mode Switch & Result Counter -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; gap: 4px; align-items: center;">
        <button onclick="setStatsViewMode('ovr')" style="padding: 4px 12px; font-weight: 700; ${svs.mode === 'ovr' ? 'border-color: var(--accent); color: var(--accent);' : 'color: var(--text-muted);'}">
          TOTAL (OVR)
        </button>
        <button onclick="setStatsViewMode('p90')" style="padding: 4px 12px; font-weight: 700; ${svs.mode === 'p90' ? 'border-color: var(--accent); color: var(--accent);' : 'color: var(--text-muted);'}">
          PER 90 (P90)
        </button>
      </div>

      <div style="font-size: 11px; color: var(--text-muted);">
        Found <strong style="color: #fff;">${filtered.length}</strong> players • Page <strong style="color: #fff;">${svs.page}</strong> of <strong style="color: #fff;">${totalPages}</strong>
      </div>
    </div>

    <!-- Filter Control Bar -->
    <div class="panel" style="padding: 12px; margin-bottom: 14px; position: relative;">
      <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
        
        <!-- Multi-Select: Columns / Metrics -->
        <div style="position: relative;">
          <button onclick="toggleStatsDropdown('metrics')" style="display: flex; align-items: center; gap: 6px;">
            <span>Columns (${svs.selectedMetrics.length})</span>
            <span style="font-size: 8px;">▼</span>
          </button>
          <div id="popover-metrics" style="display: ${svs.openDropdown === 'metrics' ? 'block' : 'none'}; position: absolute; top: 100%; left: 0; z-index: 100; background: #161b22; border: 1px solid var(--border); border-radius: 4px; padding: 8px; width: 280px; max-height: 320px; overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.5); margin-top: 4px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid var(--border);">
              <span style="font-size: 10px; color: var(--text-muted); font-weight: 700;">METRICS CATALOG</span>
              <a href="javascript:void(0)" onclick="resetStatsMetrics()" style="font-size: 10px; color: var(--accent); text-decoration: none;">Reset Default</a>
            </div>
            ${Object.values(STAT_CATALOG).map(m => `
              <label style="display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 11px; cursor: pointer;">
                <input type="checkbox" value="${m.id}" ${svs.selectedMetrics.includes(m.id) ? 'checked' : ''} onchange="toggleStatsMetric('${m.id}')">
                <span>${m.label} <span style="color: var(--text-muted); font-size: 9px;">(${m.short})</span></span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Multi-Select: Divisions -->
        <div style="position: relative;">
          <button onclick="toggleStatsDropdown('divs')" style="display: flex; align-items: center; gap: 6px;">
            <span>Divisions (${svs.divisions.length === 10 ? 'All' : svs.divisions.length})</span>
            <span style="font-size: 8px;">▼</span>
          </button>
          <div id="popover-divs" style="display: ${svs.openDropdown === 'divs' ? 'block' : 'none'}; position: absolute; top: 100%; left: 0; z-index: 100; background: #161b22; border: 1px solid var(--border); border-radius: 4px; padding: 8px; width: 180px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); margin-top: 4px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; border-bottom: 1px solid var(--border); padding-bottom: 4px;">
              <a href="javascript:void(0)" onclick="setAllStatsDivs(true)" style="font-size: 10px; color: var(--accent); text-decoration: none;">Select All</a>
              <a href="javascript:void(0)" onclick="setAllStatsDivs(false)" style="font-size: 10px; color: var(--text-muted); text-decoration: none;">Clear</a>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
              ${Array.from({ length: 10 }, (_, i) => i + 1).map(d => `
                <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                  <input type="checkbox" ${svs.divisions.includes(d) ? 'checked' : ''} onchange="toggleStatsDiv(${d})">
                  <span>DIV ${d}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Multi-Select: Traits & Match Logic (OR / AND) -->
        <div style="position: relative;">
          <button onclick="toggleStatsDropdown('traits')" style="display: flex; align-items: center; gap: 6px;">
            <span>Traits (${svs.traits.length === 0 ? 'Any' : svs.traits.length})</span>
            <span style="font-size: 8px;">▼</span>
          </button>
          <div id="popover-traits" style="display: ${svs.openDropdown === 'traits' ? 'block' : 'none'}; position: absolute; top: 100%; left: 0; z-index: 100; background: #161b22; border: 1px solid var(--border); border-radius: 4px; padding: 8px; width: 250px; max-height: 320px; overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.5); margin-top: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; border-bottom: 1px solid var(--border); padding-bottom: 4px;">
              <div style="display: flex; gap: 4px; align-items: center;">
                <span style="font-size: 10px; color: var(--text-muted);">Match:</span>
                <button onclick="setStatsTraitMode('or')" style="padding: 1px 5px; font-size: 9px; ${svs.traitMode === 'or' ? 'color: var(--accent); border-color: var(--accent);' : ''}">OR</button>
                <button onclick="setStatsTraitMode('and')" style="padding: 1px 5px; font-size: 9px; ${svs.traitMode === 'and' ? 'color: var(--accent); border-color: var(--accent);' : ''}">AND</button>
              </div>
              <a href="javascript:void(0)" onclick="clearStatsTraits()" style="font-size: 10px; color: var(--text-muted); text-decoration: none;">Clear</a>
            </div>
            ${allTraits.map(t => {
              const isAsset = t.startsWith('[+');
              const checked = svs.traits.includes(t);
              return `
                <label style="display: flex; align-items: center; gap: 6px; padding: 2px 0; font-size: 11px; cursor: pointer;">
                  <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleStatsTrait('${t}')">
                  <span class="badge ${isAsset ? 'badge-asset' : 'badge-liability'}">${isAsset ? '+' : '-'}${t.slice(2, -1)}</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Multi-Select: Archetype Filter -->
        <div style="position: relative;">
          <button onclick="toggleStatsDropdown('archetypes')" style="display: flex; align-items: center; gap: 6px;">
            <span>Archetype (${svs.archetypes.length === 0 ? 'All' : svs.archetypes.length})</span>
            <span style="font-size: 8px;">▼</span>
          </button>
          <div id="popover-archetypes" style="display: ${svs.openDropdown === 'archetypes' ? 'block' : 'none'}; position: absolute; top: 100%; left: 0; z-index: 100; background: #161b22; border: 1px solid var(--border); border-radius: 4px; padding: 8px; width: 220px; max-height: 280px; overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.5); margin-top: 4px;">
            <div style="display: flex; justify-content: flex-end; margin-bottom: 6px; border-bottom: 1px solid var(--border); padding-bottom: 4px;">
              <a href="javascript:void(0)" onclick="clearStatsArchetypes()" style="font-size: 10px; color: var(--text-muted); text-decoration: none;">Clear All</a>
            </div>
            ${allArchetypes.map(arc => `
              <label style="display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 11px; cursor: pointer;">
                <input type="checkbox" ${svs.archetypes.includes(arc.key) ? 'checked' : ''} onchange="toggleStatsArchetype('${arc.key}')">
                <span>${arc.name}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Numeric Filter: Min Minutes -->
        <div style="display: flex; align-items: center; gap: 4px; font-size: 11px;">
          <span style="color: var(--text-muted);">Min':</span>
          <input type="number" min="0" max="4000" step="50" value="${svs.minMinutes}" onchange="setStatsMinMinutes(this.value)" style="width: 58px; text-align: right;">
        </div>

        <!-- Numeric Filter: Age Range -->
        <div style="display: flex; align-items: center; gap: 4px; font-size: 11px;">
          <span style="color: var(--text-muted);">Age:</span>
          <input type="number" min="16" max="45" value="${svs.minAge}" onchange="setStatsAgeRange(this.value, ${svs.maxAge})" style="width: 44px; text-align: center;">
          <span style="color: var(--text-muted);">-</span>
          <input type="number" min="16" max="45" value="${svs.maxAge}" onchange="setStatsAgeRange(${svs.minAge}, this.value)" style="width: 44px; text-align: center;">
        </div>

        <!-- Reset All Filters -->
        <button onclick="resetAllStatsFilters()" style="margin-left: auto; color: var(--text-muted); font-size: 10px;">
          RESET FILTERS
        </button>
      </div>

      <!-- Phase Exact Multi-Select Row -->
      <div style="display: flex; gap: 16px; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border); font-size: 11px; align-items: center; flex-wrap: wrap;">
        <span style="font-size: 10px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Possession Phases:</span>
        
        <!-- IP -->
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="color: #fff; font-weight: 600;">IP:</span>
          ${['+', '✓', '-'].map(q => `
            <button onclick="toggleStatsPhase('ip', '${q}')" style="padding: 1px 6px; font-size: 11px; ${svs.phases.ip.includes(q) ? 'border-color: var(--accent); color: var(--accent); font-weight: 700;' : 'color: var(--text-muted);'}">
              ${q}
            </button>
          `).join('')}
        </div>

        <!-- OOP -->
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="color: #fff; font-weight: 600;">OOP:</span>
          ${['+', '✓', '-'].map(q => `
            <button onclick="toggleStatsPhase('oop', '${q}')" style="padding: 1px 6px; font-size: 11px; ${svs.phases.oop.includes(q) ? 'border-color: var(--accent); color: var(--accent); font-weight: 700;' : 'color: var(--text-muted);'}">
              ${q}
            </button>
          `).join('')}
        </div>

        <!-- TR -->
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="color: #fff; font-weight: 600;">TR:</span>
          ${['+', '✓', '-'].map(q => `
            <button onclick="toggleStatsPhase('tr', '${q}')" style="padding: 1px 6px; font-size: 11px; ${svs.phases.tr.includes(q) ? 'border-color: var(--accent); color: var(--accent); font-weight: 700;' : 'color: var(--text-muted);'}">
              ${q}
            </button>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Stats Table -->
    <div class="panel" style="overflow-x: auto; margin-bottom: 12px;">
      <table>
        <thead>
          <tr>
            <th style="width: 32px; text-align: center;">#</th>
            <th onclick="sortStatsView('name')" style="cursor: pointer; ${svs.sort.key === 'name' ? 'color: var(--accent);' : ''}">Player</th>
            <th onclick="sortStatsView('div')" style="cursor: pointer; width: 44px; text-align: center; ${svs.sort.key === 'div' ? 'color: var(--accent);' : ''}">Div</th>
            <th style="width: 140px;">Club</th>
            <th onclick="sortStatsView('age')" style="cursor: pointer; width: 40px; text-align: center; ${svs.sort.key === 'age' ? 'color: var(--accent);' : ''}">Age</th>
            <th style="width: 110px;">Archetype</th>
            <th style="width: 75px; text-align: center;">Phases</th>
            <th onclick="sortStatsView('minutesPlayed')" style="cursor: pointer; width: 55px; text-align: right; ${svs.sort.key === 'minutesPlayed' ? 'color: var(--accent);' : ''}">Min</th>
            ${svs.selectedMetrics.map(mKey => {
              const meta = STAT_CATALOG[mKey];
              const isSorted = svs.sort.key === mKey;
              return `
                <th onclick="sortStatsView('${mKey}')" style="cursor: pointer; width: 55px; text-align: right; ${isSorted ? 'color: var(--accent); font-weight: 700;' : ''}" title="${meta.label}">
                  ${meta.short}${isSorted ? (svs.sort.asc ? ' ▲' : ' ▼') : ''}
                </th>
              `;
            }).join('')}
          </tr>
        </thead>
        <tbody>
          ${visiblePlayers.length === 0 ? `
            <tr>
              <td colspan="${8 + svs.selectedMetrics.length}" style="text-align: center; padding: 24px; color: var(--text-muted);">
                No players match the selected filters.
              </td>
            </tr>
          ` : visiblePlayers.map((p, idx) => {
            const glyphs = parseGlyphs(p.phaseGlyphs);
            const isUserClub = (p.teamId === ctx.state.userTeamId);
            return `
              <tr style="background: ${isUserClub ? 'rgba(88, 166, 255, 0.08)' : 'transparent'};">
                <td style="text-align: center; color: var(--text-muted); font-size: 10px;">${startIdx + idx + 1}</td>
                <td style="font-weight: 600; color: #fff;">
                  ${p.name}${p.isGK ? '<span style="color: var(--accent); font-size: 10px; margin-left: 4px;">[GK]</span>' : ''}
                </td>
                <td style="text-align: center; font-size: 10px; color: var(--text-muted);">D${p.teamDiv}</td>
                <td><span onclick="inspectTeam('${p.teamId}', 'squad')" style="cursor: pointer; color: var(--text);">${p.teamName}</span></td>
                <td style="text-align: center; color: var(--text-muted);">${p.age}</td>
                <td style="color: var(--text-muted); font-size: 11px;">${p.archetypeName}</td>
                <td style="text-align: center; font-size: 11px; white-space: nowrap;">
                  ${renderGlyphCell(glyphs.ip)} ${renderGlyphCell(glyphs.oop)}${renderGlyphCell(glyphs.tr)}
                </td>
                <td style="text-align: right; color: var(--text-muted); font-family: monospace;">${p.minutesPlayed}'</td>${svs.selectedMetrics.map(mKey => {
                  const meta = STAT_CATALOG[mKey];
                  const val = calculateMetric(p, mKey, isP90);
                  let display = '—';
                  if (meta.type === 'ratio') {
                    display = formatPct(p.stats?.[meta.num], p.stats?.[meta.den]);
                  } else {
                    display = formatValue(val, meta.type === 'decimal' || isP90);
                  }
                  const isSorted = svs.sort.key === mKey;
                  return `
                    <td style="text-align: right; font-family: monospace; font-size: 11px; ${isSorted ? 'color: var(--accent); font-weight: 600;' : 'color: var(--text);'}">
                      ${display}
                    </td>
                  `;
                }).join('')}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Pagination Controls (25 per page) -->
    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-muted);">
      <div>
        Showing ${filtered.length > 0 ? startIdx + 1 : 0} - ${Math.min(startIdx + svs.pageSize, filtered.length)} of ${filtered.length}
      </div>
      <div style="display: flex; gap: 4px; align-items: center;">
        <button onclick="setStatsPage(1)" ${svs.page === 1 ? 'disabled style="opacity: 0.4;"' : ''}>« First</button>
        <button onclick="setStatsPage(${svs.page - 1})" ${svs.page === 1 ? 'disabled style="opacity: 0.4;"' : ''}>‹ Prev</button>
        <span style="padding: 0 8px; color: #fff; font-weight: 700;">${svs.page} / ${totalPages}</span>
        <button onclick="setStatsPage(${svs.page + 1})" ${svs.page >= totalPages ? 'disabled style="opacity: 0.4;"' : ''}>Next ›</button>
        <button onclick="setStatsPage(${totalPages})" ${svs.page >= totalPages ? 'disabled style="opacity: 0.4;"' : ''}>Last »</button>
      </div>
    </div>
  `;
}

// --- STATE MANIPULATORS ---

export function setStatsViewMode(mode, ctx, renderLayout) {
  ctx.statsViewState.mode = mode;
  renderLayout();
}

export function sortStatsView(key, ctx, renderLayout) {
  const s = ctx.statsViewState.sort;
  if (s.key === key) {
    s.asc = !s.asc;
  } else {
    s.key = key;
    s.asc = (key === 'name' || key === 'div');
  }
  ctx.statsViewState.page = 1;
  renderLayout();
}

export function setStatsPage(p, ctx, renderLayout) {
  ctx.statsViewState.page = Math.max(1, p);
  renderLayout();
}

export function toggleStatsDropdown(name, ctx, renderLayout) {
  ctx.statsViewState.openDropdown = (ctx.statsViewState.openDropdown === name) ? null : name;
  renderLayout();
}

export function toggleStatsMetric(mId, ctx, renderLayout) {
  const arr = ctx.statsViewState.selectedMetrics;
  const idx = arr.indexOf(mId);
  if (idx > -1) {
    if (arr.length > 1) arr.splice(idx, 1);
  } else {
    arr.push(mId);
  }
  renderLayout();
}

export function resetStatsMetrics(ctx, renderLayout) {
  ctx.statsViewState.selectedMetrics = [...DEFAULT_METRIC_KEYS];
  renderLayout();
}

export function toggleStatsDiv(d, ctx, renderLayout) {
  const arr = ctx.statsViewState.divisions;
  const idx = arr.indexOf(d);
  if (idx > -1) {
    if (arr.length > 1) arr.splice(idx, 1);
  } else {
    arr.push(d);
    arr.sort((a, b) => a - b);
  }
  ctx.statsViewState.page = 1;
  renderLayout();
}

export function setAllStatsDivs(all, ctx, renderLayout) {
  ctx.statsViewState.divisions = all ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [1];
  ctx.statsViewState.page = 1;
  renderLayout();
}

export function toggleStatsTrait(trait, ctx, renderLayout) {
  const arr = ctx.statsViewState.traits;
  const idx = arr.indexOf(trait);
  if (idx > -1) arr.splice(idx, 1);
  else arr.push(trait);
  ctx.statsViewState.page = 1;
  renderLayout();
}

export function setStatsTraitMode(mode, ctx, renderLayout) {
  ctx.statsViewState.traitMode = mode;
  ctx.statsViewState.page = 1;
  renderLayout();
}

export function clearStatsTraits(ctx, renderLayout) {
  ctx.statsViewState.traits = [];
  ctx.statsViewState.page = 1;
  renderLayout();
}

export function toggleStatsPhase(phaseKey, quality, ctx, renderLayout) {
  const pList = ctx.statsViewState.phases[phaseKey];
  const idx = pList.indexOf(quality);
  if (idx > -1) {
    if (pList.length > 1) pList.splice(idx, 1);
  } else {
    pList.push(quality);
  }
  ctx.statsViewState.page = 1;
  renderLayout();
}

export function toggleStatsArchetype(arcKey, ctx, renderLayout) {
  const arr = ctx.statsViewState.archetypes;
  const idx = arr.indexOf(arcKey);
  if (idx > -1) arr.splice(idx, 1);
  else arr.push(arcKey);
  ctx.statsViewState.page = 1;
  renderLayout();
}

export function clearStatsArchetypes(ctx, renderLayout) {
  ctx.statsViewState.archetypes = [];
  ctx.statsViewState.page = 1;
  renderLayout();
}

export function setStatsMinMinutes(val, ctx, renderLayout) {
  ctx.statsViewState.minMinutes = Math.max(0, parseInt(val, 10) || 0);
  ctx.statsViewState.page = 1;
  renderLayout();
}

export function setStatsAgeRange(min, max, ctx, renderLayout) {
  ctx.statsViewState.minAge = parseInt(min, 10) || 16;
  ctx.statsViewState.maxAge = parseInt(max, 10) || 45;
  ctx.statsViewState.page = 1;
  renderLayout();
}

export function resetAllStatsFilters(ctx, renderLayout) {
  ctx.statsViewState = null;
  initStatsViewState(ctx);
  renderLayout();
}
