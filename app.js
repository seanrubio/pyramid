// --- APPLICATION CONTROLLER (90s DATA-DRIVEN DOS/AMIGA STYLE) ---

let DB = null;
let state = null;
let activeTab = 'squad';
let tableDiv = 10;
let inspectedPlayerId = null;

let squadSort = { key: 'slot', asc: true };
let tableSort = { key: 'pts', asc: false };
let transferSort = { key: 'val', asc: false };

let transferFilters = { positions: [], maxVal: null, minAttr: null, search: '' };

const AudioFX = {
  ctx: null,
  init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
  beep(freq = 520, dur = 0.04) {
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + dur);
    } catch(e) {}
  },
  click() { this.beep(650, 0.02); },
  success() { this.beep(840, 0.07); setTimeout(() => this.beep(1050, 0.07), 40); },
  whistle() { this.beep(1400, 0.12); setTimeout(() => this.beep(1750, 0.16), 100); }
};

async function boot() {
  try {
    const res = await fetch('./data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DB = await res.json();

    const saved = localStorage.getItem('apex_wpm_save_v1');
    if (saved) {
      state = JSON.parse(saved);
      inspectedPlayerId = state.teams[state.userTeamId].squad[0].id;
      renderLayout();
    } else {
      renderClubCreator();
    }
  } catch (err) {
    document.getElementById('app-root').innerHTML = `
      <div class="p-8 text-rose-400 font-mono text-center">
        Error mounting database: ${err.message}. Ensure data.json and index.html are in the same folder.
      </div>
    `;
  }
}

function saveGameState() {
  try { localStorage.setItem('apex_wpm_save_v1', JSON.stringify(state)); } catch(e) {}
}

// --- INITIAL ONBOARDING ---
function renderClubCreator() {
  document.getElementById('app-root').innerHTML = `
    <div class="flex-1 flex items-center justify-center p-4">
      <div class="w-full max-w-lg retro-box">
        <div class="retro-box-header">
          <span>Inaugural Club Registration</span>
          <span style="color: var(--c-amber)">DIVISION 10 ENTRY</span>
        </div>
        <form onsubmit="handleCreateClub(event)" class="p-6 space-y-5 text-xs">
          <div>
            <label class="block uppercase font-bold text-slate-400 mb-1">City / Club Name</label>
            <input id="create-name" required placeholder="e.g. Halifax, Kyoto, Casablanca..." class="w-full">
          </div>
          <div>
            <label class="block uppercase font-bold text-slate-400 mb-1">Country Heritage (Linguistic Pool)</label>
            <select id="create-country" class="w-full">
              ${DB.countries.map(c => `<option value="${c.code}">${c.flag}${c.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block uppercase font-bold text-slate-400 mb-1">Home Stadium</label>
            <input id="create-ground" placeholder="e.g. Meadow Park, Waterfront Arena..." class="w-full">
          </div>
          <div class="p-3 bg-[#080c10] border border-[#1e293b] space-y-1.5 text-[11px]">
            <div class="flex justify-between"><span class="text-slate-400">Initial Division:</span><span class="font-bold text-emerald-400">Division 10 (Protected Tier)</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Starting Transfer Budget:</span><span class="text-slate-200">£450,000</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Weekly Wage Ceiling:</span><span class="text-slate-200">£18,000/wk</span></div>
          </div>
          <button type="submit" class="w-full py-3 action-btn action-btn-primary">
            Found Club & Launch Campaign
          </button>
        </form>
      </div>
    </div>
  `;
}

function handleCreateClub(e) {
  e.preventDefault();
  AudioFX.success();
  const name = document.getElementById('create-name').value.trim();
  const country = document.getElementById('create-country').value;
  const stadium = document.getElementById('create-ground').value.trim() || `${name} Stadium`;

  const userTeamId = 'club_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const teams = {};

  teams[userTeamId] = {
    id: userTeamId, name, country, div: 10, stadium,
    rep: 15, budget: 450000, wageBudget: 18000,
    formation: '4-4-2 Flat',
    tactics: { mentality: 'balanced', press: 'mid block', buildGk: 'mixed', buildMid: 'mixed', chanceCreation: 'mixed' },
    trainingIntensity: 'normal', trainingRegimen: 'balanced',
    isUser: true, squad: createFullSquad(10, country)
  };

  DB.cities.forEach(city => {
    const tid = 'club_' + city.id;
    teams[tid] = {
      id: tid, name: city.name, country: city.country, div: city.div, stadium: city.stadium,
      rep: city.rep, budget: Math.round(Math.pow(1.5, 11 - city.div) * 200000),
      wageBudget: Math.round(Math.pow(1.5, 11 - city.div) * 12000),
      formation: '4-4-2 Flat',
      tactics: { mentality: 'balanced', press: 'mid block', buildGk: 'mixed', buildMid: 'mixed', chanceCreation: 'mixed' },
      trainingIntensity: 'normal', trainingRegimen: 'balanced',
      isUser: false, squad: createFullSquad(city.div, city.country)
    };
  });

  Object.values(teams).forEach(t => autoAssignLineup(t));

  const tables = {};
  for (let d = 1; d <= 10; d++) {
    tables[d] = Object.values(teams).filter(t => t.div === d).map(t => ({
      teamId: t.id, name: t.name,
      p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0,
      xg: 0.0, xga: 0.0, xgd: 0.0, form: []
    }));
  }

  state = {
    season: 1, round: 1, maxRounds: 38,
    userTeamId, teams, tables,
    fixtures: generateFixtures(teams)
  };

  inspectedPlayerId = teams[userTeamId].squad[0].id;
  saveGameState();
  renderLayout();
}

// --- MAIN WRAPPER LAYOUT ---
function renderLayout() {
  const userTeam = state.teams[state.userTeamId];

  document.getElementById('app-root').innerHTML = `
    <!-- Top Control Bar -->
    <header class="bg-[#0f151e] border-b border-[#1e293b] sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-base font-bold text-slate-100 uppercase">${userTeam.name}</span>
            <span class="text-[10px] px-1.5 py-0.5 bg-[#1e293b] text-cyan-400 font-bold border border-[#334155]">DIVISION ${userTeam.div}</span>
          </div>
          <div class="text-[11px] text-slate-400 mt-0.5">ROUND ${state.round} OF ${state.maxRounds} • SEASON ${state.season}</div>
        </div>

        <!-- Search Bar -->
        <div class="flex-1 max-w-xs relative">
          <input type="text" id="global-search" oninput="handleSearch(event)" placeholder="Search players or clubs..." 
            class="w-full text-xs bg-[#080c10] border border-[#1e293b] px-3 py-1.5 focus:border-cyan-400">
          <div id="search-results" class="hidden absolute top-full left-0 right-0 mt-1 bg-[#0f151e] border border-[#1e293b] shadow-2xl max-h-60 overflow-y-auto z-50"></div>
        </div>

        <!-- Financial Status & Advance Button -->
        <div class="flex items-center gap-4 text-xs">
          <div class="text-right">
            <span class="text-slate-400 text-[11px] block">TRANSFER FUNDS</span>
            <span class="font-bold text-amber-400">£${(userTeam.budget / 1000).toFixed(0)}k</span>
          </div>
          <button onclick="handleSimRound()" class="action-btn action-btn-primary">
            Play Round ${state.round}
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <nav class="max-w-7xl mx-auto px-4 flex gap-1 border-t border-[#1e293b]/70 overflow-x-auto">
        ${['squad', 'tactics', 'table', 'transfers', 'training'].map(tab => `
          <button onclick="switchTab('${tab}')" class="nav-pill ${activeTab === tab ? 'active' : ''}">
            ${tab}
          </button>
        `).join('')}
      </nav>
    </header>

    <main class="flex-1 max-w-7xl w-full mx-auto p-4" id="view-workspace"></main>
  `;

  renderCurrentView();
}

function switchTab(tab) {
  AudioFX.click();
  activeTab = tab;
  renderLayout();
}

function handleSimRound() {
  AudioFX.whistle();
  runRoundSimulation();
  renderLayout();
}

function renderCurrentView() {
  const ws = document.getElementById('view-workspace');
  if (activeTab === 'squad') renderSquadView(ws);
  else if (activeTab === 'tactics') renderTacticsView(ws);
  else if (activeTab === 'table') renderTableView(ws);
  else if (activeTab === 'transfers') renderTransfersView(ws);
  else if (activeTab === 'training') renderTrainingView(ws);
}

// --- TWO-COLUMN SQUAD & PLAYER DOSSIER VIEW (GOAL 94 / 1-0 STYLE) ---
function renderSquadView(container) {
  const team = state.teams[state.userTeamId];
  const formSlots = FORMATIONS[team.formation] || FORMATIONS['4-4-2 Flat'];
  const starterOpts = formSlots.map((s, i) => ({ val: `S${i + 1}`, label: `XI: ${s.role}` }));
  const benchOpts = Array.from({ length: 9 }, (_, i) => ({ val: `B${i + 1}`, label: `Bench ${i + 1}` }));
  const allOpts = [{ val: 'RES', label: 'Reserves' }, ...starterOpts, ...benchOpts];

  const inspected = team.squad.find(p => p.id === inspectedPlayerId) || team.squad[0];

  container.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 font-mono text-xs">
      
      <!-- Left Column: Squad Directory Table -->
      <div class="lg:col-span-8 space-y-3">
        <div class="retro-box">
          <div class="retro-box-header">
            <span>First Team Roster (${team.squad.length} Players)</span>
            <button onclick="autoPickLineup()" class="action-btn text-[10px] py-1 px-2.5">Auto-Pick XI & Bench</button>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left whitespace-nowrap">
              <thead class="bg-[#080c10] text-slate-400 border-b border-[#1e293b] text-[10px] uppercase">
                <tr>
                  <th class="p-2.5">Slot</th>
                  <th onclick="sortSquad('name')" class="p-2.5 cursor-pointer hover:text-slate-200">Name</th>
                  <th class="p-2.5">Role</th>
                  <th onclick="sortSquad('technique')" class="p-2.5 text-center cursor-pointer hover:text-slate-200">TEC</th>
                  <th onclick="sortSquad('decisionMaking')" class="p-2.5 text-center cursor-pointer hover:text-slate-200">DEC</th>
                  <th onclick="sortSquad('athleticism')" class="p-2.5 text-center cursor-pointer hover:text-slate-200">ATH</th>
                  <th class="p-2.5">Morale</th>
                  <th class="p-2.5 text-center">Form</th>
                  <th class="p-2.5 text-right">Min</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#1e293b]/60">
                ${team.squad.map(p => {
                  const isSelected = p.id === inspected.id;
                  const isStarter = p.slot.startsWith('S');
                  const isBench = p.slot.startsWith('B');
                  const form = p.ratingsHistory.length ? (p.ratingsHistory.reduce((a, b) => a + b, 0) / p.ratingsHistory.length).toFixed(1) : '-';

                  return `
                    <tr class="transition ${isSelected ? 'bg-[#182333] border-l-2 border-cyan-400' : 'hover:bg-[#131b26]'}" 
                      onclick="selectInspectedPlayer('${p.id}')" style="cursor: pointer;">
                      <td class="p-2" onclick="event.stopPropagation()">
                        <select onchange="handleSlotChange('${p.id}', this.value)" class="text-[11px] py-0.5">
                          ${allOpts.map(o => `<option value="${o.val}" ${p.slot === o.val ? 'selected' : ''}>${o.label}</option>`).join('')}
                        </select>
                      </td>
                      <td class="p-2.5 font-bold ${isStarter ? 'text-slate-100' : isBench ? 'text-amber-200' : 'text-slate-400'}">
                        ${p.name}
                      </td>
                      <td class="p-2.5 text-cyan-400 font-semibold">${p.positions.join('/')}</td>
                      <td class="p-2.5 text-center font-bold text-slate-200">${p.technique}</td>
                      <td class="p-2.5 text-center font-bold text-slate-200">${p.decisionMaking}</td>
                      <td class="p-2.5 text-center font-bold text-slate-200">${p.athleticism}</td>
                      <td class="p-2.5 ${getMoraleColor(p.morale)}">${p.morale}</td>
                      <td class="p-2.5 text-center text-slate-300 font-semibold">${form}</td>
                      <td class="p-2.5 text-right text-slate-400">${p.minutesPlayed}'</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Right Column: Dedicated Player Dossier Card (Visual Attribute Bars) -->
      <div class="lg:col-span-4 space-y-4">
        <div class="retro-box">
          <div class="retro-box-header">
            <span>Player Dossier</span>
            <span class="text-amber-400">${inspected.slot}</span>
          </div>

          <div class="p-4 space-y-4">
            <div>
              <h2 class="text-base font-bold text-slate-100 uppercase">${inspected.name}</h2>
              <p class="text-cyan-400 text-xs mt-0.5">${inspected.positions.join(' / ')} • Age ${inspected.age}</p>
            </div>

            <!-- Attribute Meters -->
            <div class="space-y-2 border-t border-b border-[#1e293b] py-3">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Skill Profile (1 - 10)</span>
              ${[
                { label: 'Technique', val: inspected.technique },
                { label: 'Decision Making', val: inspected.decisionMaking },
                { label: 'Body Control', val: inspected.bodyControl },
                { label: 'Athleticism', val: inspected.athleticism },
                { label: 'Character', val: inspected.character }
              ].map(attr => `
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-300">${attr.label}</span>
                  <div class="flex items-center">
                    <span class="bar-meter-bg">
                      <span class="bar-meter-fill block" style="width: ${attr.val * 10}%;"></span>
                    </span>
                    <span class="w-4 text-right font-bold text-slate-100">${attr.val}</span>
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- Contract & Fitness Status -->
            <div class="space-y-2 text-xs">
              <div class="flex justify-between"><span class="text-slate-400">Condition:</span><span class="text-emerald-400 font-bold">${inspected.condition}%</span></div>
              <div class="flex justify-between"><span class="text-slate-400">Valuation:</span><span class="text-amber-400 font-bold">£${(inspected.val / 1000).toFixed(0)}k</span></div>
              <div class="flex justify-between"><span class="text-slate-400">Wage Demands:</span><span class="text-slate-200">£${inspected.wage} / wk</span></div>
              <div class="flex justify-between"><span class="text-slate-400">Contract Length:</span><span class="text-slate-200">${inspected.contractYrs} Years</span></div>
              <div class="flex justify-between"><span class="text-slate-400">Morale Rating:</span><span class="${getMoraleColor(inspected.morale)}">${inspected.morale}</span></div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `;
}

function selectInspectedPlayer(pid) {
  AudioFX.click();
  inspectedPlayerId = pid;
  renderSquadView(document.getElementById('view-workspace'));
}

function sortSquad(key) {
  if (squadSort.key === key) squadSort.asc = !squadSort.asc;
  else { squadSort.key = key; squadSort.asc = true; }
  const team = state.teams[state.userTeamId];
  team.squad.sort((a, b) => {
    let valA = a[squadSort.key];
    let valB = b[squadSort.key];
    if (typeof valA === 'string') return squadSort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    return squadSort.asc ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
  });
  renderSquadView(document.getElementById('view-workspace'));
}

function handleSlotChange(pid, newSlot) {
  AudioFX.click();
  const team = state.teams[state.userTeamId];
  const player = team.squad.find(p => p.id === pid);
  if (!player) return;

  const oldSlot = player.slot;
  if (newSlot !== 'RES') {
    const occupant = team.squad.find(p => p.id !== pid && p.slot === newSlot);
    if (occupant) occupant.slot = oldSlot;
  }
  player.slot = newSlot;
  saveGameState();
  renderSquadView(document.getElementById('view-workspace'));
}

function autoPickLineup() {
  AudioFX.success();
  const team = state.teams[state.userTeamId];
  autoAssignLineup(team);
  saveGameState();
  renderSquadView(document.getElementById('view-workspace'));
}

// --- TACTICS VIEW ---
function renderTacticsView(container) {
  const team = state.teams[state.userTeamId];
  const formSlots = FORMATIONS[team.formation] || FORMATIONS['4-4-2 Flat'];

  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5 font-mono text-xs">
      
      <!-- Formation Board -->
      <div class="retro-box p-4 flex flex-col items-center">
        <div class="w-full flex justify-between items-center mb-4">
          <span class="text-cyan-400 font-bold uppercase">Formation Preset</span>
          <select onchange="updateFormation(this.value)">
            ${Object.keys(FORMATIONS).map(f => `<option value="${f}" ${team.formation === f ? 'selected' : ''}>${f}</option>`).join('')}
          </select>
        </div>

        <div class="w-full max-w-sm aspect-[3/4] bg-[#080c10] border border-[#1e293b] relative p-3">
          <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 border-b border-[#1e293b]"></div>
          <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-[#1e293b] rounded-full"></div>

          ${formSlots.map((node, i) => {
            const p = team.squad.find(x => x.slot === `S${i + 1}`);
            return `
              <div style="left: ${node.x}\%; top:${node.y}%;" class="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                <div class="w-7 h-7 bg-[#1e293b] border border-cyan-400 text-cyan-300 font-bold flex items-center justify-center text-[10px] rounded-sm">
                  ${node.role}
                </div>
                <span class="text-[9px] text-slate-200 mt-0.5 truncate max-w-[70px] bg-[#0a0e14] px-1 border border-[#1e293b]">
                  ${p ? p.name.split(' ').pop() : 'Empty'}
                </span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Tactical Directives -->
      <div class="retro-box">
        <div class="retro-box-header">System Directives</div>
        <div class="p-5 space-y-4">
          ${[
            { label: 'Team Mentality', key: 'mentality', opts: ['park the bus', 'defensive', 'balanced', 'attacking', 'overload'] },
            { label: 'Defensive Line & Press', key: 'press', opts: ['low block', 'mid block', 'high press', 'gegenpress'] },
            { label: 'Build Up from GK', key: 'buildGk', opts: ['short', 'mixed', 'long'] },
            { label: 'Build Up from Midfield', key: 'buildMid', opts: ['tiki-taka', 'mixed', 'direct'] },
            { label: 'Chance Creation', key: 'chanceCreation', opts: ['wide areas', 'mixed', 'central areas'] }
          ].map(sec => `
            <div>
              <label class="block text-slate-400 text-[11px] uppercase mb-1.5">${sec.label}</label>
              <div class="flex flex-wrap gap-1.5">
                ${sec.opts.map(opt => `
                  <button onclick="setDirective('${sec.key}', '${opt}')" 
                    class="px-2.5 py-1 text-xs border ${team.tactics[sec.key] === opt ? 'bg-cyan-500/10 border-cyan-400 text-cyan-400 font-bold' : 'bg-[#080c10] border-[#1e293b] text-slate-400'}">
                    ${opt}
                  </button>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

    </div>
  `;
}

function updateFormation(f) {
  AudioFX.click();
  const team = state.teams[state.userTeamId];
  team.formation = f;
  autoAssignLineup(team);
  saveGameState();
  renderTacticsView(document.getElementById('view-workspace'));
}

function setDirective(key, val) {
  AudioFX.click();
  state.teams[state.userTeamId].tactics[key] = val;
  saveGameState();
  renderTacticsView(document.getElementById('view-workspace'));
}

// --- LEAGUE TABLE VIEW ---
function renderTableView(container) {
  const rows = [...state.tables[tableDiv]].sort((a, b) => b.pts - a.pts || b.gd - a.gd);

  container.innerHTML = `
    <div class="space-y-4 font-mono text-xs">
      <!-- Division Switcher -->
      <div class="flex gap-1.5 overflow-x-auto pb-1">
        ${Array.from({ length: 10 }, (_, i) => i + 1).map(d => `
          <button onclick="setTableDiv(${d})" 
            class="px-3.5 py-1.5 border text-xs uppercase ${tableDiv === d ? 'bg-cyan-500/10 border-cyan-400 text-cyan-400 font-bold' : 'bg-[#080c10] border-[#1e293b] text-slate-400'}">
            Division ${d}
          </button>
        `).join('')}
      </div>

      <div class="retro-box overflow-x-auto">
        <table class="w-full text-left whitespace-nowrap">
          <thead class="bg-[#080c10] text-slate-400 border-b border-[#1e293b] text-[10px] uppercase">
            <tr>
              <th class="p-2.5 text-center w-8">Pos</th>
              <th class="p-2.5">Club</th>
              <th class="p-2.5 text-center">Played</th>
              <th class="p-2.5 text-center">Won</th>
              <th class="p-2.5 text-center">Drawn</th>
              <th class="p-2.5 text-center">Lost</th>
              <th class="p-2.5 text-center">Goal Diff</th>
              <th class="p-2.5 text-center">xG</th>
              <th class="p-2.5 text-center">xGA</th>
              <th class="p-2.5 text-right">Points</th>
              <th class="p-2.5 text-center">Form</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#1e293b]/60">
            ${rows.map((r, i) => `
              <tr class="${r.teamId === state.userTeamId ? 'bg-cyan-500/5 font-bold' : 'hover:bg-[#131b26]'}">
                <td class="p-2.5 text-center font-bold ${i < 3 && tableDiv > 1 ? 'text-emerald-400' : i >= 17 && tableDiv < 10 ? 'text-rose-400' : 'text-slate-400'}">${i + 1}</td>
                <td class="p-2.5 font-bold text-slate-200 hover:text-cyan-400 cursor-pointer" onclick="openTeamModal('${r.teamId}')">${r.name}</td>
                <td class="p-2.5 text-center text-slate-400">${r.p}</td>
                <td class="p-2.5 text-center text-slate-300">${r.w}</td>
                <td class="p-2.5 text-center text-slate-300">${r.d}</td>
                <td class="p-2.5 text-center text-slate-300">${r.l}</td>
                <td class="p-2.5 text-center font-semibold ${r.gd > 0 ? 'text-emerald-400' : r.gd < 0 ? 'text-rose-400' : 'text-slate-400'}">${r.gd}</td>
                <td class="p-2.5 text-center text-slate-400">${r.xg.toFixed(1)}</td>
                <td class="p-2.5 text-center text-slate-400">${r.xga.toFixed(1)}</td>
                <td class="p-2.5 text-right font-bold text-slate-100">${r.pts}</td>
                <td class="p-2.5 text-center">
                  ${(r.form || []).slice(-5).map(f => `
                    <span class="inline-block w-4 text-center border font-bold text-[9px] ${f === 'W' ? 'border-emerald-500/50 text-emerald-400' : f === 'D' ? 'border-amber-500/50 text-amber-400' : 'border-rose-500/50 text-rose-400'}">${f}</span>
                  `).join('')}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function setTableDiv(d) {
  AudioFX.click();
  tableDiv = d;
  renderTableView(document.getElementById('view-workspace'));
}

// --- TRANSFERS VIEW ---
function renderTransfersView(container) {
  const all = [];
  Object.values(state.teams).forEach(t => {
    if (t.id !== state.userTeamId) {
      t.squad.forEach(p => all.push({ ...p, club: t.name, div: t.div, clubId: t.id }));
    }
  });

  let topTargets = all.filter(p => {
    if (transferFilters.positions.length > 0 && !p.positions.some(pos => transferFilters.positions.includes(pos))) return false;
    if (transferFilters.maxVal && p.val > transferFilters.maxVal) return false;
    if (transferFilters.minAttr && (p.technique < transferFilters.minAttr || p.decisionMaking < transferFilters.minAttr)) return false;
    if (transferFilters.search && !p.name.toLowerCase().includes(transferFilters.search.toLowerCase()) && !p.club.toLowerCase().includes(transferFilters.search.toLowerCase())) return false;
    return true;
  }).slice(0, 60);

  container.innerHTML = `
    <div class="space-y-4 font-mono text-xs">
      <div class="retro-box p-4 space-y-3">
        <div>
          <span class="text-slate-400 uppercase text-[10px] block mb-1">Filter by Position:</span>
          <div class="flex flex-wrap gap-1">
            ${POS_GROUPS.map(pos => `
              <button onclick="toggleTransferPos('${pos}')" 
                class="px-2 py-1 text-xs border ${transferFilters.positions.includes(pos) ? 'bg-cyan-500/10 border-cyan-400 text-cyan-400 font-bold' : 'bg-[#080c10] border-[#1e293b] text-slate-400'}">
                ${pos}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input type="number" placeholder="Max Fee (£)" oninput="setTransferFilter('maxVal', this.value)" value="${transferFilters.maxVal || ''}">
          <input type="number" placeholder="Min Attribute (1-10)" oninput="setTransferFilter('minAttr', this.value)" value="${transferFilters.minAttr || ''}">
          <input type="text" placeholder="Search Target / Club" oninput="setTransferFilter('search', this.value)" value="${transferFilters.search || ''}">
        </div>
      </div>

      <div class="retro-box overflow-x-auto">
        <table class="w-full text-left whitespace-nowrap">
          <thead class="bg-[#080c10] text-slate-400 border-b border-[#1e293b] text-[10px] uppercase">
            <tr>
              <th class="p-2.5">Player</th>
              <th class="p-2.5">Position</th>
              <th class="p-2.5">Club</th>
              <th class="p-2.5 text-center">Division</th>
              <th class="p-2.5 text-center">TEC</th>
              <th class="p-2.5 text-center">DEC</th>
              <th class="p-2.5 text-center">BOD</th>
              <th class="p-2.5 text-center">ATH</th>
              <th class="p-2.5 text-center">CHA</th>
              <th class="p-2.5 text-right">Fee</th>
              <th class="p-2.5 text-right">Wage</th>
              <th class="p-2.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#1e293b]/60">
            ${topTargets.map(p => `
              <tr class="hover:bg-[#131b26]">
                <td class="p-2.5 font-bold text-slate-200 hover:text-cyan-400 cursor-pointer" onclick="openPlayerModal('${p.id}')">${p.name}</td>
                <td class="p-2.5 text-cyan-400">${p.positions.join('/')}</td>
                <td class="p-2.5 text-slate-400 hover:underline cursor-pointer" onclick="openTeamModal('${p.clubId}')">${p.club}</td>
                <td class="p-2.5 text-center text-slate-400">${p.div}</td>
                <td class="p-2.5 text-center font-bold text-slate-200">${p.technique}</td>
                <td class="p-2.5 text-center font-bold text-slate-200">${p.decisionMaking}</td>
                <td class="p-2.5 text-center font-bold text-slate-200">${p.bodyControl}</td>
                <td class="p-2.5 text-center font-bold text-slate-200">${p.athleticism}</td>
                <td class="p-2.5 text-center font-bold text-slate-200">${p.character}</td>
                <td class="p-2.5 text-right text-amber-400 font-bold">£${(p.val / 1000).toFixed(0)}k</td>
                <td class="p-2.5 text-right text-slate-400">£${p.wage}/wk</td>
                <td class="p-2 text-center">
                  <button onclick="signTarget('${p.id}', '${p.clubId}')" class="action-btn text-[10px] py-1 px-3">
                    Sign
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function toggleTransferPos(pos) {
  if (transferFilters.positions.includes(pos)) transferFilters.positions = transferFilters.positions.filter(p => p !== pos);
  else transferFilters.positions.push(pos);
  renderTransfersView(document.getElementById('view-workspace'));
}

function setTransferFilter(key, val) {
  transferFilters[key] = val ? (key === 'search' ? val : Number(val)) : null;
  renderTransfersView(document.getElementById('view-workspace'));
}

function signTarget(pid, cid) {
  const userTeam = state.teams[state.userTeamId];
  const seller = state.teams[cid];
  const player = seller.squad.find(p => p.id === pid);

  if (!player || userTeam.budget < player.val) {
    alert('Insufficient transfer budget to meet player valuation.');
    return;
  }

  AudioFX.success();
  userTeam.budget -= player.val;
  seller.budget += player.val;
  seller.squad = seller.squad.filter(p => p.id !== pid);
  player.slot = 'RES';
  userTeam.squad.push(player);

  saveGameState();
  renderTransfersView(document.getElementById('view-workspace'));
}

// --- TRAINING VIEW ---
function renderTrainingView(container) {
  const team = state.teams[state.userTeamId];
  container.innerHTML = `
    <div class="retro-box p-5 font-mono text-xs space-y-4">
      <div class="retro-box-header px-0 pt-0">Training Center Directives</div>
      <div class="flex items-center gap-6">
        <div>
          <span class="text-slate-400 uppercase text-[11px] block">Training Intensity:</span>
          <span class="font-bold text-amber-400 uppercase text-sm">${team.trainingIntensity}</span>
        </div>
        <div>
          <span class="text-slate-400 uppercase text-[11px] block">Weekly Focus Regimen:</span>
          <span class="font-bold text-cyan-400 uppercase text-sm">${team.trainingRegimen}</span>
        </div>
      </div>
    </div>
  `;
}

// --- SEARCH & MODALS ---
function handleSearch(e) {
  const q = e.target.value.trim().toLowerCase();
  const box = document.getElementById('search-results');
  if (!q) { box.classList.add('hidden'); return; }

  const matchedTeams = Object.values(state.teams).filter(t => t.name.toLowerCase().includes(q)).slice(0, 3);
  let matchedPlayers = [];
  for (const t of Object.values(state.teams)) {
    for (const p of t.squad) {
      if (p.name.toLowerCase().includes(q)) {
        matchedPlayers.push({ ...p, clubName: t.name });
        if (matchedPlayers.length >= 5) break;
      }
    }
    if (matchedPlayers.length >= 5) break;
  }

  if (matchedTeams.length === 0 && matchedPlayers.length === 0) {
    box.innerHTML = `<div class="p-3 text-xs text-slate-500">No matching targets found.</div>`;
  } else {
    box.innerHTML = `
      ${matchedTeams.map(t => `
        <div onclick="openTeamModal('${t.id}')" class="p-2.5 hover:bg-[#182333] cursor-pointer flex justify-between border-b border-[#1e293b]">
          <span class="text-slate-100 font-bold">${t.name}</span>
          <span class="text-cyan-400">Division ${t.div}</span>
        </div>
      `).join('')}
      ${matchedPlayers.map(p => `
        <div onclick="openPlayerModal('${p.id}')" class="p-2.5 hover:bg-[#182333] cursor-pointer flex justify-between border-b border-[#1e293b]">
          <span class="text-slate-200 font-bold">${p.name}</span>
          <span class="text-slate-400">${p.clubName}</span>
        </div>
      `).join('')}
    `;
  }
  box.classList.remove('hidden');
}

function openPlayerModal(pid) {
  AudioFX.click();
  let player = null, club = null;
  for (const t of Object.values(state.teams)) {
    const f = t.squad.find(p => p.id === pid);
    if (f) { player = f; club = t; break; }
  }
  if (!player) return;

  const modal = document.getElementById('modal-container');
  modal.innerHTML = `
    <div class="w-full max-w-md retro-box p-6 font-mono text-xs space-y-4">
      <div class="flex justify-between border-b border-[#1e293b] pb-2">
        <span class="font-bold text-slate-100 text-sm uppercase">${player.name}</span>
        <button onclick="closeModal()" class="text-slate-400 hover:text-white font-bold">[Close]</button>
      </div>
      <div class="text-slate-400">Club: <strong class="text-slate-200">${club.name}</strong> • Role: <strong class="text-cyan-400">${player.positions.join('/')}</strong></div>
      
      <div class="space-y-1.5 border-t border-b border-[#1e293b] py-3">
        ${[
          { label: 'Technique', val: player.technique },
          { label: 'Decision Making', val: player.decisionMaking },
          { label: 'Body Control', val: player.bodyControl },
          { label: 'Athleticism', val: player.athleticism },
          { label: 'Character', val: player.character }
        ].map(attr => `
          <div class="flex items-center justify-between">
            <span class="text-slate-300">${attr.label}</span>
            <div class="flex items-center">
              <span class="bar-meter-bg"><span class="bar-meter-fill block" style="width: ${attr.val * 10}%;"></span></span>
              <span class="w-4 text-right font-bold text-slate-100">${attr.val}</span>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="flex justify-between"><span class="text-slate-400">Valuation:</span><span class="text-amber-400 font-bold">£${(player.val / 1000).toFixed(0)}k</span></div>
      <div class="flex justify-between"><span class="text-slate-400">Wage Demands:</span><span class="text-slate-200">£${player.wage}/wk</span></div>
    </div>
  `;
  modal.classList.remove('hidden');
}

function openTeamModal(tid) {
  AudioFX.click();
  const club = state.teams[tid];
  if (!club) return;

  const modal = document.getElementById('modal-container');
  modal.innerHTML = `
    <div class="w-full max-w-lg retro-box p-6 font-mono text-xs space-y-4">
      <div class="flex justify-between border-b border-[#1e293b] pb-2">
        <span class="font-bold text-slate-100 text-sm uppercase">${club.name}</span>
        <button onclick="closeModal()" class="text-slate-400 hover:text-white font-bold">[Close]</button>
      </div>
      <div class="text-slate-400">Tier: <strong class="text-cyan-400">Division ${club.div}</strong> • Ground: <strong class="text-slate-200">${club.stadium}</strong></div>
      <div class="max-h-60 overflow-y-auto divide-y divide-[#1e293b] border border-[#1e293b]">
        ${club.squad.map(p => `
          <div class="p-2 flex justify-between hover:bg-[#131b26]">
            <span>${p.name} (${p.positions.join('/')})</span>
            <span class="text-amber-400 font-semibold">£${(p.val / 1000).toFixed(0)}k</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-container').classList.add('hidden');
}

function getMoraleColor(morale) {
  if (morale === 'Very High') return 'text-emerald-400 font-bold';
  if (morale === 'High') return 'text-emerald-300';
  if (morale === 'OK') return 'text-slate-300';
  if (morale === 'Low') return 'text-amber-400';
  return 'text-rose-400 font-bold';
}

window.addEventListener('DOMContentLoaded', boot);