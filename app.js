// --- NO-FRILLS UI CONTROLLER (QUALITATIVE SCOUTING & INDIVIDUAL STATS) ---

let DB = null;
let state = null;
let activeTab = 'squad';
let tableDiv = 10;
let viewedTeamId = null; // Current scouting context
let statsMetric = 'goals'; // 'goals' | 'assists' | 'tackles' | 'saves' | 'xg'

let squadSort = { key: 'slot', asc: true };
let tableSort = { key: 'pts', asc: false };

function formatHeight(cm, units = 'metric') {
  if (units === 'imperial') {
    const totalInches = Math.round(cm / 2.54);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}'${inches}"`;
  }
  return `${cm}`;
}

function formatWeight(kg, units = 'metric') {
  if (units === 'imperial') {
    return `${Math.round(kg * 2.20462)}`;
  }
  return `${kg}`;
}

async function boot() {
  try {
    const res = await fetch('./data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DB = await res.json();

    const saved = localStorage.getItem('apex_wpm_save_v1');
    if (saved) {
      state = JSON.parse(saved);
      if (!state.config) state.config = { units: 'imperial' };
      viewedTeamId = state.userTeamId;
      tableDiv = state.teams[state.userTeamId].div;
      renderLayout();
    } else {
      initializeDefaultCareer();
    }
  } catch (err) {
    document.getElementById('app-root').innerHTML = `
      <div style="padding: 24px; color: var(--red);">
        Fatal Error loading data.json: ${err.message}
      </div>
    `;
  }
}

function saveGameState() {
  try { localStorage.setItem('apex_wpm_save_v1', JSON.stringify(state)); } catch(e) {}
}

function resetGameDatabase() {
  if (confirm("Reset current career save and restart with defaults?")) {
    localStorage.removeItem('apex_wpm_save_v1');
    location.reload();
  }
}

function initializeDefaultCareer() {
  const name = 'Oakland';
  const country = 'US';
  const stadium = 'Oakland Coliseum';
  const units = 'imperial';

  const userTeamId = 'club_oakland';
  const teams = {};

  teams[userTeamId] = {
    id: userTeamId,
    name,
    country,
    div: 10,
    stadium,
    rep: 15,
    formation: '4-4-2 Flat',
    tactics: {
      mentality: 'balanced',
      press: 'mid block',
      buildGk: 'mixed',
      buildMid: 'patient possession',
      chanceCreation: 'tiki-taka'
    },
    isUser: true,
    squad: createFullSquad({ id: userTeamId, div: 10, country, tactics: { chanceCreation: 'tiki-taka', press: 'mid block' } })
  };

  const BLUEPRINT_PRESETS = {
    heavy_metal:        { mentality: 'attacking', press: 'gegenpress', buildGk: 'mixed', buildMid: 'direct', chanceCreation: 'balls in behind' },
    possession_control: { mentality: 'attacking', press: 'high press', buildGk: 'short', buildMid: 'patient possession', chanceCreation: 'tiki-taka' },
    underdog_pressing:  { mentality: 'balanced',  press: 'gegenpress', buildGk: 'long',  buildMid: 'direct', chanceCreation: 'balls in behind' },
    direct_aerial:      { mentality: 'balanced',  press: 'mid block',  buildGk: 'long',  buildMid: 'direct', chanceCreation: 'flank play' },
    safety_first:       { mentality: 'defensive', press: 'low block',  buildGk: 'mixed', buildMid: 'patient possession', chanceCreation: 'central creator' },
    counter_attacking:  { mentality: 'defensive', press: 'low block',  buildGk: 'long',  buildMid: 'direct', chanceCreation: 'balls in behind' }
  };

  DB.cities.forEach(city => {
    const tid = 'club_' + city.id;
    const bpKey = city.blueprint || 'direct_aerial';
    const preset = BLUEPRINT_PRESETS[bpKey] || BLUEPRINT_PRESETS.direct_aerial;

    const teamTactics = {
      blueprint: bpKey,
      ...preset
    };

    teams[tid] = {
      id: tid,
      name: city.name,
      country: city.country,
      div: city.div,
      stadium: city.stadium,
      rep: city.rep,
      formation: '4-4-2 Flat',
      tactics: teamTactics,
      isUser: false,
      squad: createFullSquad({ id: tid, div: city.div, country: city.country, tactics: teamTactics })
    };
  });

  teams[userTeamId].squad.forEach(p => p.slot = 'RES');

  Object.values(teams).forEach(t => {
    if (!t.isUser) autoAssignLineup(t);
  });

  const tables = {};
  for (let d = 1; d <= 10; d++) {
    tables[d] = Object.values(teams).filter(t => t.div === d).map(t => ({
      teamId: t.id,
      name: t.name,
      p: 0,
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
      xg: 0.0,
      xga: 0.0,
      xgd: 0.0,
      form: []
    }));
  }

  tableDiv = 10;
  viewedTeamId = userTeamId;

  state = {
    season: 1,
    round: 1,
    maxRounds: 38,
    config: { units },
    userTeamId,
    teams,
    tables,
    fixtures: generateFixtures(teams)
  };

  saveGameState();
  renderLayout();
}

function getActiveContextTeam() {
  if (!viewedTeamId || !state.teams[viewedTeamId]) {
    viewedTeamId = state.userTeamId;
  }
  return state.teams[viewedTeamId];
}

function inspectTeam(teamId, targetTab = null) {
  if (!state.teams[teamId]) return;
  viewedTeamId = teamId;
  if (targetTab) activeTab = targetTab;
  renderLayout();
}

function renderLayout() {
  const userTeam = state.teams[state.userTeamId];
  const currentTeam = getActiveContextTeam();
  const isOpponent = (currentTeam.id !== state.userTeamId);
  const isSeasonOver = state.round > state.maxRounds;

  document.getElementById('app-root').innerHTML = `
    <!-- Top Global Bar -->
    <header style="background: #11151c; border-bottom: 1px solid var(--border); padding: 8px 16px;">
      <div style="max-width: 1200px; margin: auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <strong style="color: #fff; font-size: 13px;">${userTeam.name}</strong>
          <span style="color: var(--accent);">DIV ${userTeam.div}</span>
          <span style="color: var(--text-muted);">
            S${state.season} • ${isSeasonOver ? '<strong style="color: var(--accent);">SEASON COMPLETE</strong>' : `ROUND ${state.round}/${state.maxRounds}`}
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          ${isSeasonOver ? `
            <button onclick="handleStartNewSeason()" class="primary" style="background: var(--accent); color: #000; font-weight: 700;">START NEW SEASON</button>
          ` : `
            <button onclick="handleSimRound()" class="primary">${state.round === state.maxRounds ? 'PLAY FINAL ROUND' : 'PLAY ROUND'}</button>
          `}
          <button onclick="resetGameDatabase()" class="danger" title="Clear Save">RESET</button>
        </div>
      </div>
      <div style="max-width: 1200px; margin: auto; display: flex; gap: 4px; margin-top: 4px;">
        ${['squad', 'tactics', 'fixtures', 'table', 'stats'].map(tab => `
          <button onclick="switchTab('${tab}')" class="nav-btn ${activeTab === tab ? 'active' : ''}">${tab.toUpperCase()}</button>
        `).join('')}
      </div>
    </header>

    ${isOpponent ? `
      <!-- Scouting Opponent Banner -->
      <div style="background: #1f1d13; border-bottom: 1px solid #78350f; padding: 6px 16px;">
        <div style="max-width: 1200px; margin: auto; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 12px; color: #fbbf24;">
            Scouting: <strong style="color: #fff;">${currentTeam.name}</strong> (DIV${currentTeam.div}) 
            <span style="color: var(--text-muted); margin-left: 8px;">[${(currentTeam.tactics.chanceCreation \vert{}\vert{} 'MIXED').toUpperCase()} /${(currentTeam.tactics.press || 'MID BLOCK').toUpperCase()}]</span>
          </div>
          <button onclick="inspectTeam('${state.userTeamId}')" style="background: #2563eb; color: #fff; border: none; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; cursor: pointer;">
            RETURN TO MY CLUB
          </button>
        </div>
      </div>
    ` : ''}

    <main style="max-width: 1200px; margin: 16px auto; padding: 0 16px;" id="view-workspace"></main>
  `;

  renderCurrentView();
}

function switchTab(t) {
  activeTab = t;
  renderLayout();
}

function handleSimRound() {
  const success = runRoundSimulation();
  if (success) renderLayout();
}

function handleStartNewSeason() {
  if (confirm(`Conclude Season ${state.season} and begin Season ${state.season + 1}? Table and player stats will reset for a new calendar.`)) {
    resetSeasonClean();
    renderLayout();
  }
}

function renderCurrentView() {
  const ws = document.getElementById('view-workspace');
  if (activeTab === 'squad') renderSquadView(ws);
  else if (activeTab === 'tactics') renderTacticsView(ws);
  else if (activeTab === 'fixtures') renderFixturesView(ws);
  else if (activeTab === 'table') renderTableView(ws);
  else if (activeTab === 'stats') renderStatsView(ws);
}

function getSlotRank(slot) {
  if (slot.startsWith('S')) return parseInt(slot.replace('S', ''), 10);
  if (slot.startsWith('B')) return 100 + parseInt(slot.replace('B', ''), 10);
  return 999;
}

function renderTraitBadges(traits = []) {
  if (!traits.length) return '<span style="color: var(--text-muted);">-</span>';
  const sorted = [...traits].sort((a, b) => {
    const aIsPos = a.startsWith('[+');
    const bIsPos = b.startsWith('[+');
    if (aIsPos && !bIsPos) return -1;
    if (!aIsPos && bIsPos) return 1;
    return a.localeCompare(b);
  });

  return sorted.map(t => {
    const isAsset = t.startsWith('[+');
    const label = t.slice(2, -1);
    return `<span class="badge ${isAsset ? 'badge-asset' : 'badge-liability'}">${isAsset ? '+' : '-'}${label}</span>`;
  }).join('');
}

function parseGlyphs(phaseGlyphs = "✓ / ✓ / ✓") {
  const parts = phaseGlyphs.split('/').map(s => s.trim());
  return { ip: parts[0] || '✓', oop: parts[1] || '✓', tr: parts[2] || '✓' };
}

function renderGlyphCell(glyph) {
  let color = 'var(--text-muted)';
  if (glyph === '+') color = 'var(--green)';
  if (glyph === '-') color = 'var(--red)';
  return `<span style="font-size: 15px; font-weight: 700; color: ${color};">${glyph}</span>`;
}

function formatShortName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 1) {
    return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
  }
  return fullName;
}

// --- SQUAD DIRECTORY ---
function renderSquadView(container) {
  const team = getActiveContextTeam();
  const isUser = (team.id === state.userTeamId);
  const units = (state.config && state.config.units) || 'metric';
  const formRoles = FORMATIONS[team.formation] || FORMATIONS['4-4-2 Flat'];
  
  const starterSlots = formRoles.map((role, i) => ({ val: `S${i + 1}`, label: role }));
  const benchSlots = Array.from({ length: 9 }, (_, i) => ({ val: `B${i + 1}`, label: `BN ${i + 1}` }));
  const playableSlots = [...starterSlots, ...benchSlots];

  const occupantMap = {};
  team.squad.forEach(sqP => {
    if (sqP.slot && sqP.slot !== 'RES') {
      occupantMap[sqP.slot] = sqP;
    }
  });

  const startersCount = team.squad.filter(p => p.slot.startsWith('S')).length;
  const hUnit = units === 'imperial' ? 'FT' : 'CM';
  const wUnit = units === 'imperial' ? 'LB' : 'KG';

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
            <th onclick="sortSquad('heightCm')" style="cursor: pointer; text-align: center;">${hUnit}</th>
            <th onclick="sortSquad('weightKg')" style="cursor: pointer; text-align: center;">${wUnit}</th>
            <th>Traits</th>
            <th onclick="sortSquad('ip')" style="cursor: pointer; text-align: center; width: 35px;">IP</th>
            <th onclick="sortSquad('oop')" style="cursor: pointer; text-align: center; width: 35px;">OOP</th>
            <th onclick="sortSquad('tr')" style="cursor: pointer; text-align: center; width: 35px;">TR</th>
            <th onclick="sortSquad('goals')" style="cursor: pointer; text-align: center; width: 30px;" title="Goals">G</th>
            <th onclick="sortSquad('assists')" style="cursor: pointer; text-align: center; width: 30px;" title="Assists">A</th>
            <th onclick="sortSquad('xg')" style="cursor: pointer; text-align: center; width: 40px;" title="Individual xG">xG</th>
            <th onclick="sortSquad('tackles')" style="cursor: pointer; text-align: center; width: 32px;" title="Tackles">TK</th>
            <th onclick="sortSquad('saves')" style="cursor: pointer; text-align: center; width: 32px;" title="Goalkeeper Saves">SV</th>
            <th onclick="sortSquad('minutesPlayed')" style="cursor: pointer; text-align: right; width: 45px;">Min</th>
          </tr>
        </thead>
        <tbody>
          ${team.squad.map(p => {
            const glyphs = parseGlyphs(p.phaseGlyphs);
            const heightStr = formatHeight(p.morphology.heightCm, units);
            const weightStr = formatWeight(p.morphology.weightKg, units);
            const st = p.stats || { goals: 0, assists: 0, xg: 0.0, tackles: 0, saves: 0 };

            let slotDisplay = `<span style="font-size: 11px; color: var(--text-muted); font-family: monospace;">${p.slot}</span>`;

            if (isUser) {
              const optionsHtml = [
                `<option value="RES" ${p.slot === 'RES' ? 'selected' : ''}>RES</option>`,
                ...playableSlots.map(s => {
                  const isCurrent = (p.slot === s.val);
                  const occupant = occupantMap[s.val];
                  let text = s.label;
                  if (!isCurrent && occupant) {
                    text += ` (${formatShortName(occupant.name)})`;
                  }
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
                <td style="text-align: center; font-size: 11px;">${heightStr}</td>
                <td style="text-align: center; font-size: 11px;">${weightStr}</td>
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

function handleSlotChange(pid, newSlot) {
  const team = state.teams[state.userTeamId];
  const player = team.squad.find(p => p.id === pid);
  if (!player) return;

  const oldSlot = player.slot;
  if (newSlot !== 'RES') {
    const occupant = team.squad.find(p => p.id !== pid && p.slot === newSlot);
    if (occupant) {
      occupant.slot = oldSlot;
    }
  }
  player.slot = newSlot;
  saveGameState();
  renderSquadView(document.getElementById('view-workspace'));
}

function autoPickLineup() {
  const team = state.teams[state.userTeamId];
  autoAssignLineup(team);
  saveGameState();
  renderSquadView(document.getElementById('view-workspace'));
}

function sortSquad(key) {
  if (squadSort.key === key) {
    squadSort.asc = !squadSort.asc;
  } else {
    squadSort.key = key;
    squadSort.asc = (key === 'name' || key === 'slot');
  }

  const team = getActiveContextTeam();
  const GLYPH_WEIGHTS = { '+': 2, '✓': 1, '-': 0 };

  const getLastName = (fullName) => {
    const parts = fullName.trim().split(/\s+/);
    return parts[parts.length - 1].toLowerCase();
  };

  team.squad.sort((a, b) => {
    if (squadSort.key === 'slot') {
      const rankA = getSlotRank(a.slot);
      const rankB = getSlotRank(b.slot);
      return squadSort.asc ? rankA - rankB : rankB - rankA;
    }

    if (squadSort.key === 'name') {
      const cmp = getLastName(a.name).localeCompare(getLastName(b.name));
      return squadSort.asc ? cmp : -cmp;
    }

    if (['ip', 'oop', 'tr'].includes(squadSort.key)) {
      const gA = parseGlyphs(a.phaseGlyphs)[squadSort.key];
      const gB = parseGlyphs(b.phaseGlyphs)[squadSort.key];
      const valA = GLYPH_WEIGHTS[gA] ?? 1;
      const valB = GLYPH_WEIGHTS[gB] ?? 1;
      if (valA !== valB) return squadSort.asc ? valA - valB : valB - valA;
      return getLastName(a.name).localeCompare(getLastName(b.name));
    }

    if (['goals', 'assists', 'xg', 'tackles', 'saves'].includes(squadSort.key)) {
      const valA = (a.stats && a.stats[squadSort.key]) || 0;
      const valB = (b.stats && b.stats[squadSort.key]) || 0;
      return squadSort.asc ? valA - valB : valB - valA;
    }

    if (squadSort.key === 'heightCm') {
      return squadSort.asc ? a.morphology.heightCm - b.morphology.heightCm : b.morphology.heightCm - a.morphology.heightCm;
    }
    if (squadSort.key === 'weightKg') {
      return squadSort.asc ? a.morphology.weightKg - b.morphology.weightKg : b.morphology.weightKg - a.morphology.weightKg;
    }

    let valA = a[squadSort.key];
    let valB = b[squadSort.key];
    if (typeof valA === 'string') return squadSort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    return squadSort.asc ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
  });

  renderSquadView(document.getElementById('view-workspace'));
}

// --- TACTICS VIEW ---
function renderTacticsView(container) {
  const team = getActiveContextTeam();
  const isUser = (team.id === state.userTeamId);

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

function updateFormation(f) {
  const team = state.teams[state.userTeamId];
  team.formation = f;
  autoAssignLineup(team);
  saveGameState();
  renderTacticsView(document.getElementById('view-workspace'));
}

function setTactics(k, v) {
  state.teams[state.userTeamId].tactics[k] = v;
  saveGameState();
  renderTacticsView(document.getElementById('view-workspace'));
}

// --- CLUB FIXTURES VIEW ---
function renderFixturesView(container) {
  const team = getActiveContextTeam();
  const divFixtures = state.fixtures[team.div] || [];

  const clubSchedule = [];
  divFixtures.forEach((roundMatches, idx) => {
    const match = roundMatches.find(m => m.home === team.id || m.away === team.id);
    if (match) {
      clubSchedule.push({
        round: idx + 1,
        match,
        isHome: match.home === team.id,
        opponent: state.teams[match.home === team.id ? match.away : match.home]
      });
    }
  });

  container.innerHTML = `
    <div style="max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px;">
      
      <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
        <div>
          <strong style="color: #fff; font-size: 14px;">${team.name.toUpperCase()} FIXTURES & RESULTS</strong>
          <span style="color: var(--text-muted); font-size: 12px; margin-left: 8px;">DIVISION ${team.div} • SEASON ${state.season}</span>
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
              const isCurrent = (round === state.round && !match.played);

              let venueBadge = isHome 
                ? '<span style="color: var(--accent); font-weight: 700;">H</span>' 
                : '<span style="color: var(--text-muted);">A</span>';

              let scoreDisplay = '<span style="color: var(--text-muted);">-</span>';
              let xgDisplay = '<span style="color: var(--text-muted);">-</span>';
              let outcomeBadge = '<span style="color: var(--text-muted);">-</span>';

              if (match.played) {
                const teamGoals = isHome ? match.hg : match.ag;
                const oppGoals = isHome ? match.ag : match.hg;
                const teamXg = isHome ? match.hxg : match.axg;
                const oppXg = isHome ? match.axg : match.hxg;

                scoreDisplay = `
                  <span style="font-family: var(--font-mono, monospace); font-weight: 700; font-size: 13px; letter-spacing: 0.05em; color: #fff;">
                    ${teamGoals}&nbsp;–&nbsp;${oppGoals}
                  </span>
                `;

                xgDisplay = `
                  <span style="font-family: var(--font-mono, monospace); font-size: 11px; color: var(--text-muted); letter-spacing: 0.02em;">
                    ${teamXg.toFixed(1)}&nbsp;–&nbsp;${oppXg.toFixed(1)}
                  </span>
                `;

                if (teamGoals > oppGoals) {
                  outcomeBadge = '<span class="badge badge-asset" style="padding: 1px 6px;">W</span>';
                } else if (teamGoals === oppGoals) {
                  outcomeBadge = '<span style="color: var(--amber); font-weight: 700; font-size: 11px;">D</span>';
                } else {
                  outcomeBadge = '<span class="badge badge-liability" style="padding: 1px 6px;">L</span>';
                }
              } else if (isCurrent) {
                scoreDisplay = '<span style="color: var(--accent); font-weight: 700; font-size: 11px;">NEXT UP</span>';
              }

              return `
                <tr style="${isCurrent ? 'background: rgba(88, 166, 255, 0.08);' : ''}">
                  <td style="text-align: center; color: var(--text-muted); font-family: monospace;">${round}</td>
                  <td style="text-align: center;">${venueBadge}</td>
                  <td>
                    ${opponent ? `
                      <span onclick="inspectTeam('${opponent.id}', 'squad')" style="cursor: pointer; font-weight: 600; color: var(--accent); text-decoration: underline;">
                        ${opponent.name}
                      </span>
                    ` : 'Unknown Club'}
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

// --- LEAGUE TABLE ---
function renderTableView(container) {
  const rows = [...state.tables[tableDiv]].sort((a, b) => 
    b.pts - a.pts || 
    b.gd - a.gd || 
    b.gf - a.gf || 
    b.xgd - a.xgd || 
    a.name.localeCompare(b.name)
  );

  container.innerHTML = `
    <div style="display: flex; gap: 4px; margin-bottom: 8px; overflow-x: auto;">
      ${Array.from({ length: 10 }, (_, i) => i + 1).map(d => `
        <button onclick="setTableDiv(${d})" style="${tableDiv === d ? 'border-color: var(--accent); color: var(--accent);' : ''}">DIV ${d}</button>
      `).join('')}
    </div>

    <div class="panel" style="overflow-x: auto;">
      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th>Club</th>
            <th style="text-align: center;">P</th>
            <th style="text-align: center;">W</th>
            <th style="text-align: center;">D</th>
            <th style="text-align: center;">L</th>
            <th style="text-align: center;">GF</th>
            <th style="text-align: center;">GA</th>
            <th style="text-align: center;">GD</th>
            <th style="text-align: center;">xG</th>
            <th style="text-align: center;">xGA</th>
            <th style="text-align: right;">PTS</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, idx) => `
            <tr style="background: ${r.teamId === state.userTeamId ? 'rgba(88, 166, 255, 0.08)' : 'transparent'}">
              <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
              <td>
                <span onclick="inspectTeam('${r.teamId}', 'squad')" style="cursor: pointer; font-weight: 600; color: var(--accent); text-decoration: underline;">
                  ${r.name}
                </span>
                ${r.teamId === state.userTeamId ? '<span style="font-size: 10px; color: var(--accent); margin-left: 4px;">(YOU)</span>' : ''}
              </td>
              <td style="text-align: center;">${r.p}</td>
              <td style="text-align: center;">${r.w}</td>
              <td style="text-align: center;">${r.d}</td>
              <td style="text-align: center;">${r.l}</td>
              <td style="text-align: center;">${r.gf}</td>
              <td style="text-align: center;">${r.ga}</td>
              <td style="text-align: center;">${r.gd}</td>
              <td style="text-align: center; color: var(--text-muted);">${r.xg.toFixed(1)}</td>
              <td style="text-align: center; color: var(--text-muted);">${r.xga.toFixed(1)}</td>
              <td style="text-align: right; font-weight: 700; color: #fff;">${r.pts}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function setTableDiv(d) {
  tableDiv = d;
  renderTableView(document.getElementById('view-workspace'));
}

// --- LEAGUE STATS & LEADERBOARDS VIEW ---
function setStatsMetric(metric) {
  statsMetric = metric;
  renderStatsView(document.getElementById('view-workspace'));
}

function setStatsDiv(d) {
  tableDiv = d;
  renderStatsView(document.getElementById('view-workspace'));
}

function renderStatsView(container) {
  const divTeams = Object.values(state.teams).filter(t => t.div === tableDiv);
  const allPlayers = [];

  divTeams.forEach(t => {
    t.squad.forEach(p => {
      if (p.minutesPlayed > 0) {
        allPlayers.push({
          ...p,
          teamName: t.name,
          teamId: t.id
        });
      }
    });
  });

  allPlayers.sort((a, b) => {
    const valA = (a.stats && a.stats[statsMetric]) || 0;
    const valB = (b.stats && b.stats[statsMetric]) || 0;
    if (valB !== valA) return valB - valA;
    return (a.minutesPlayed || 0) - (b.minutesPlayed || 0);
  });

  const topPlayers = allPlayers.slice(0, 20);

  const metricConfigs = [
    { id: 'goals', label: 'TOP SCORERS', statKey: 'goals', col: 'G' },
    { id: 'assists', label: 'MOST ASSISTS', statKey: 'assists', col: 'A' },
    { id: 'xg', label: 'EXPECTED GOALS', statKey: 'xg', col: 'xG', format: v => (v || 0).toFixed(1) },
    { id: 'tackles', label: 'TOP TACKLERS', statKey: 'tackles', col: 'TK' },
    { id: 'saves', label: 'MOST SAVES', statKey: 'saves', col: 'SV' }
  ];

  const currentConfig = metricConfigs.find(m => m.id === statsMetric) || metricConfigs[0];

  container.innerHTML = `
    <!-- Division Selector -->
    <div style="display: flex; gap: 4px; margin-bottom: 8px; overflow-x: auto;">
      ${Array.from({ length: 10 }, (_, i) => i + 1).map(d => `
        <button onclick="setStatsDiv(${d})" style="${tableDiv === d ? 'border-color: var(--accent); color: var(--accent);' : ''}">DIV ${d}</button>
      `).join('')}
    </div>

    <!-- Category Selector -->
    <div style="display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap;">
      ${metricConfigs.map(m => `
        <button onclick="setStatsMetric('${m.id}')" style="${statsMetric === m.id ? 'border-color: var(--accent); color: var(--accent); font-weight: 700;' : ''}">
          ${m.label}
        </button>
      `).join('')}
    </div>

    <!-- Leaderboard Table -->
    <div class="panel" style="overflow-x: auto;">
      <table>
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">#</th>
            <th>Player</th>
            <th>Club</th>
            <th>Archetype</th>
            <th style="text-align: center; width: 45px;">Age</th>
            <th style="text-align: center; width: 50px;">Apps</th>
            <th style="text-align: right; width: 60px;">Min</th>
            <th style="text-align: right; width: 60px; font-weight: 700; color: #fff;">${currentConfig.col}</th>
          </tr>
        </thead>
        <tbody>
          ${topPlayers.length === 0 ? `
            <tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 16px;">No match data recorded yet.</td></tr>
          ` : topPlayers.map((p, idx) => {
            const rawVal = p.stats ? p.stats[currentConfig.statKey] : 0;
            const displayVal = currentConfig.format ? currentConfig.format(rawVal) : rawVal;
            const isUserClub = p.teamId === state.userTeamId;
            const approxApps = Math.ceil(p.minutesPlayed / 90);

            return `
              <tr style="background: ${isUserClub ? 'rgba(88, 166, 255, 0.08)' : 'transparent'};">
                <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
                <td style="font-weight: 600; color: #fff;">
                  ${p.name}${p.isGK ? '<span style="color: var(--accent); font-size: 10px; margin-left: 4px;">[GK]</span>' : ''}
                </td>
                <td>
                  <span onclick="inspectTeam('${p.teamId}', 'squad')" style="cursor: pointer; color: var(--accent); text-decoration: underline;">
                    ${p.teamName}
                  </span>
                  ${isUserClub ? '<span style="font-size: 10px; color: var(--accent); margin-left: 4px;">(YOU)</span>' : ''}
                </td>
                <td style="color: var(--text-muted); font-size: 12px;">${p.archetypeName}</td>
                <td style="text-align: center; color: var(--text-muted);">${p.age}</td>
                <td style="text-align: center; color: var(--text-muted);">${approxApps}</td>
                <td style="text-align: right; color: var(--text-muted); font-size: 11px;">${p.minutesPlayed}'</td>
                <td style="text-align: right; font-weight: 700; font-size: 14px; color: var(--accent);">${displayVal}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

window.addEventListener('DOMContentLoaded', boot);
