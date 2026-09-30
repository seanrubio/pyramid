// --- NO-FRILLS UI CONTROLLER (QUALITATIVE SCOUTING LAYOUT V2) ---

let DB = null;
let state = null;
let activeTab = 'squad';
let tableDiv = 10;
let fixturesDiv = null;

let squadSort = { key: 'slot', asc: true };
let tableSort = { key: 'pts', asc: false };

// Unit conversion helpers
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
      if (!state.config.units) state.config.units = 'imperial';
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
      buildMid: 'mixed',
      chanceCreation: 'mixed'
    },
    isUser: true,
    squad: createFullSquad(10, country)
  };

  DB.cities.forEach(city => {
    const tid = 'club_' + city.id;
    teams[tid] = {
      id: tid,
      name: city.name,
      country: city.country,
      div: city.div,
      stadium: city.stadium,
      rep: city.rep,
      formation: '4-4-2 Flat',
      tactics: { 
        blueprint: city.blueprint || 'direct_aerial',
        mentality: 'balanced', 
        press: 'mid block', 
        buildGk: 'mixed', 
        buildMid: 'mixed', 
        chanceCreation: 'mixed' 
      },
      isUser: false,
      squad: createFullSquad(city.div, city.country)
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

function renderLayout() {
  const userTeam = state.teams[state.userTeamId];
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
      <!-- Tab Strip -->
      <div style="max-width: 1200px; margin: auto; display: flex; gap: 4px; margin-top: 4px;">
        ${['squad', 'tactics', 'fixtures', 'table'].map(tab => `
          <button onclick="switchTab('${tab}')" class="nav-btn ${activeTab === tab ? 'active' : ''}">${tab.toUpperCase()}</button>
        `).join('')}
      </div>
    </header>

    <!-- Main Content Shell -->
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
  if (confirm(`Conclude Season ${state.season} and begin Season ${state.season + 1}? All table records will reset for a fresh fixture calendar.`)) {
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
    const label = t.replace(/[\[\]\+\-]/g, '');
    return `<span class="badge ${isAsset ? 'badge-asset' : 'badge-liability'}">${isAsset ? '+' : '-'}${label}</span>`;
  }).join('');
}

function parseGlyphs(phaseGlyphs = "✓ / ✓ / ✓") {
  const parts = phaseGlyphs.split('/').map(s => s.trim());
  return {
    ip: parts[0] || '✓',
    oop: parts[1] || '✓',
    tr: parts[2] || '✓'
  };
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
  const team = state.teams[state.userTeamId];
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
      <button onclick="autoPickLineup()">AUTO-PICK XI</button>
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
            <th onclick="sortSquad('ip')" style="cursor: pointer; text-align: center; width: 44px;" title="Sort In Possession">IP</th>
            <th onclick="sortSquad('oop')" style="cursor: pointer; text-align: center; width: 44px;" title="Sort Out of Possession">OOP</th>
            <th onclick="sortSquad('tr')" style="cursor: pointer; text-align: center; width: 44px;" title="Sort Transitions">TR</th>
            <th onclick="sortSquad('minutesPlayed')" style="cursor: pointer; text-align: right;">Min</th>
          </tr>
        </thead>
        <tbody>
          ${team.squad.map(p => {
            const glyphs = parseGlyphs(p.phaseGlyphs);
            const heightStr = formatHeight(p.morphology.heightCm, units);
            const weightStr = formatWeight(p.morphology.weightKg, units);

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

            return `
              <tr>
                <td>
                  <select onchange="handleSlotChange('${p.id}', this.value)" style="width: auto; max-width: 65px; padding: 2px 4px; font-size: 11px;">
                    ${optionsHtml}
                  </select>
                </td>
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

  const team = state.teams[state.userTeamId];
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
      
      if (valA !== valB) {
        return squadSort.asc ? valA - valB : valB - valA;
      }
      
      return getLastName(a.name).localeCompare(getLastName(b.name));
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
  const team = state.teams[state.userTeamId];

  container.innerHTML = `
    <div class="panel" style="padding: 16px; max-width: 600px; display: flex; flex-direction: column; gap: 16px;">
      <div>
        <label style="display: block; margin-bottom: 4px; color: var(--text-muted);">Formation Preset:</label>
        <select onchange="updateFormation(this.value)" style="width: 100%;">
          ${Object.keys(FORMATIONS).map(f => `<option value="${f}" ${team.formation === f ? 'selected' : ''}>${f}</option>`).join('')}
        </select>
      </div>

      ${[
        { label: 'Mentality (Affects Goals & Defense):', key: 'mentality', opts: ['park the bus', 'defensive', 'balanced', 'attacking', 'overload'] },
        { label: 'Pressing Strategy:', key: 'press', opts: ['low block', 'mid block', 'high press', 'gegenpress'] },
        { label: 'Goalkeeper Distribution:', key: 'buildGk', opts: ['short', 'mixed', 'long'] },
        { label: 'Midfield Build-up:', key: 'buildMid', opts: ['short', 'mixed', 'direct'] },
        { label: 'Chance Creation:', key: 'chanceCreation', opts: ['work into box', 'mixed', 'cross heavy', 'shoot on sight'] }
      ].map(sec => `
        <div>
          <label style="display: block; margin-bottom: 4px; color: var(--text-muted);">${sec.label}</label>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${sec.opts.map(opt => `
              <button onclick="setTactics('${sec.key}', '${opt}')" style="${team.tactics[sec.key] === opt ? 'border-color: var(--accent); color: var(--accent);' : ''}">
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
  const userTeam = state.teams[state.userTeamId];
  const divFixtures = state.fixtures[userTeam.div] || [];

  const clubSchedule = [];
  divFixtures.forEach((roundMatches, idx) => {
    const match = roundMatches.find(m => m.home === state.userTeamId || m.away === state.userTeamId);
    if (match) {
      clubSchedule.push({
        round: idx + 1,
        match,
        isHome: match.home === state.userTeamId,
        opponent: state.teams[match.home === state.userTeamId ? match.away : match.home]
      });
    }
  });

  container.innerHTML = `
    <div style="max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px;">
      
      <!-- Fixture Header -->
      <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
        <div>
          <strong style="color: #fff; font-size: 14px;">${userTeam.name.toUpperCase()} FIXTURES & RESULTS</strong>
          <span style="color: var(--text-muted); font-size: 12px; margin-left: 8px;">DIVISION ${userTeam.div} • SEASON ${state.season}</span>
        </div>
      </div>

      <!-- Schedule Table -->
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
                  <td style="font-weight: 600; color: var(--text);">
                    ${opponent ? opponent.name : 'Unknown Club'}
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
              <td style="font-weight: 600;">${r.name}</td>
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

window.addEventListener('DOMContentLoaded', boot);
