import { BLUEPRINT_PRESETS } from './constants.js';
import { createFullSquad, autoAssignLineup, generateFixtures, runRoundSimulation, resetSeasonClean } from './engine.js';
import { renderSquadView, sortSquad, handleSlotChange, autoPickLineup } from './ui/squadView.js';
import { renderTacticsView, updateFormation, setTactics } from './ui/tacticsView.js';
import { renderMatchView, changeMatchRound } from './ui/matchView.js';
import { renderFixturesView } from './ui/fixturesView.js';
import { renderLeagueView, setLeagueDiv, changeLeagueRound } from './ui/leagueView.js';
import { renderStatsView, setStatsDiv, setStatsMetric } from './ui/statsView.js';

export const context = {
  DB: null,
  state: null,
  activeTab: 'squad',
  tableDiv: 10,
  viewedTeamId: null,
  viewedFixtureRound: null,
  viewedMatchRound: null,
  statsMetric: 'goals',
  squadSort: { key: 'slot', asc: true },
  tableSort: { key: 'pts', asc: false }
};

export function saveGameState() {
  try { localStorage.setItem('apex_wpm_save_dev', JSON.stringify(context.state)); } catch(e) {}
}

export function inspectTeam(teamId, targetTab = null) {
  if (!context.state.teams[teamId]) return;
  context.viewedTeamId = teamId;
  if (targetTab) context.activeTab = targetTab;
  renderLayout();
}

export function switchTab(tab) {
  context.activeTab = tab;
  if (tab === 'league') context.viewedFixtureRound = null;
  if (tab === 'match') context.viewedMatchRound = null;
  renderLayout();
}

export function handleSimRound() {
  if (runRoundSimulation(context.state)) {
    saveGameState();
    context.viewedFixtureRound = null;
    context.viewedMatchRound = null;
    renderLayout();
  }
}

export function handleStartNewSeason() {
  if (confirm(`Conclude Season ${context.state.season} and begin Season ${context.state.season + 1}?`)) {
    resetSeasonClean(context.state);
    saveGameState();
    context.viewedFixtureRound = null;
    context.viewedMatchRound = null;
    renderLayout();
  }
}

export function resetGameDatabase() {
  if (confirm("Reset current career save and restart with defaults?")) {
    localStorage.removeItem('apex_wpm_save_dev');
    location.reload();
  }
}

function initializeDefaultCareer() {
  const userTeamId = 'club_oakland';
  const teams = {};

  teams[userTeamId] = {
    id: userTeamId,
    name: 'Oakland',
    country: 'US',
    div: 10,
    stadium: 'Oakland Coliseum',
    rep: 15,
    formation: '4-4-2 Flat',
    tactics: { mentality: 'balanced', press: 'mid block', buildGk: 'mixed', buildMid: 'mixed', chanceCreation: 'mixed' },
    isUser: true,
    squad: createFullSquad(context.DB, { id: userTeamId, div: 10, country: 'US', tactics: {} })
  };

  context.DB.cities.forEach(city => {
    const tid = 'club_' + city.id;
    const bpKey = city.blueprint || 'direct_aerial';
    const preset = BLUEPRINT_PRESETS[bpKey] || BLUEPRINT_PRESETS.direct_aerial;
    const teamTactics = { blueprint: bpKey, ...preset };

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
      squad: createFullSquad(context.DB, { id: tid, div: city.div, country: city.country, tactics: teamTactics })
    };
  });

  teams[userTeamId].squad.forEach(p => p.slot = 'RES');
  Object.values(teams).forEach(t => {
    if (!t.isUser) autoAssignLineup(context.DB, t);
  });

  const tables = {};
  for (let d = 1; d <= 10; d++) {
    tables[d] = Object.values(teams).filter(t => t.div === d).map(t => ({
      teamId: t.id, name: t.name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, xg: 0.0, xga: 0.0, xgd: 0.0, form: []
    }));
  }

  context.tableDiv = 10;
  context.viewedTeamId = userTeamId;
  context.viewedFixtureRound = null;
  context.viewedMatchRound = null;

  context.state = {
    season: 1,
    round: 1,
    maxRounds: 38,
    config: { units: 'imperial' },
    userTeamId,
    teams,
    tables,
    fixtures: generateFixtures(teams)
  };

  saveGameState();
}

export function renderLayout() {
  const userTeam = context.state.teams[context.state.userTeamId];
  const currentTeam = context.state.teams[context.viewedTeamId] || userTeam;
  const isOpponent = (currentTeam.id !== context.state.userTeamId);
  const isSeasonOver = context.state.round > context.state.maxRounds;

  const styleLabel = ((currentTeam?.tactics?.chanceCreation) || 'mixed').toUpperCase();
  const pressLabel = ((currentTeam?.tactics?.press) || 'mid block').toUpperCase();

  document.getElementById('app-root').innerHTML = `
    <header style="background: #11151c; border-bottom: 1px solid var(--border); padding: 8px 16px;">
      <div style="max-width: 1200px; margin: auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <strong style="color: #fff; font-size: 13px;">${userTeam.name}</strong>
          <span style="color: var(--accent);">DIV ${userTeam.div}</span>
          <span style="color: var(--text-muted);">
            S${context.state.season} • ${isSeasonOver ? '<strong style="color: var(--accent);">SEASON COMPLETE</strong>' : `ROUND ${context.state.round}/${context.state.maxRounds}`}
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          ${isSeasonOver ? `
            <button onclick="handleStartNewSeason()" class="primary" style="background: var(--accent); color: #000; font-weight: 700;">START NEW SEASON</button>
          ` : `
            <button onclick="handleSimRound()" class="primary">${context.state.round === context.state.maxRounds ? 'PLAY FINAL ROUND' : 'PLAY ROUND'}</button>
          `}
          <button onclick="resetGameDatabase()" class="danger" title="Clear Save">RESET</button>
        </div>
      </div>
      <div style="max-width: 1200px; margin: auto; display: flex; gap: 4px; margin-top: 4px;">
        ${['squad', 'tactics', 'match', 'fixtures', 'league', 'stats'].map(tab => `
          <button onclick="switchTab('${tab}')" class="nav-btn ${context.activeTab === tab ? 'active' : ''}">${tab.toUpperCase()}</button>
        `).join('')}
      </div>
    </header>

    ${isOpponent ? `
      <div style="background: #1f1d13; border-bottom: 1px solid #78350f; padding: 6px 16px;">
        <div style="max-width: 1200px; margin: auto; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 12px; color: #fbbf24;">
            Scouting: <strong style="color: #fff;">${currentTeam.name}</strong> (DIV${currentTeam.div}) 
            <span style="color: var(--text-muted); margin-left: 8px;">[${styleLabel} /${pressLabel}]</span>
          </div>
          <button onclick="inspectTeam('${context.state.userTeamId}')" style="background: #2563eb; color: #fff; border: none; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; cursor: pointer;">
            RETURN TO MY CLUB
          </button>
        </div>
      </div>
    ` : ''}

    <main style="max-width: 1200px; margin: 16px auto; padding: 0 16px;" id="view-workspace"></main>
  `;

  const ws = document.getElementById('view-workspace');
  if (context.activeTab === 'squad') renderSquadView(ws, context);
  else if (context.activeTab === 'tactics') renderTacticsView(ws, context);
  else if (context.activeTab === 'match') renderMatchView(ws, context);
  else if (context.activeTab === 'fixtures') renderFixturesView(ws, context);
  else if (context.activeTab === 'league') renderLeagueView(ws, context);
  else if (context.activeTab === 'stats') renderStatsView(ws, context);
}

// Expose click-handlers to the window so inline HTML onclicks work without a bundler
Object.assign(window, {
  switchTab,
  inspectTeam,
  handleSimRound,
  handleStartNewSeason,
  resetGameDatabase,
  sortSquad: (key) => sortSquad(key, context, renderLayout),
  handleSlotChange: (pid, slot) => handleSlotChange(pid, slot, context, renderLayout, saveGameState),
  autoPickLineup: () => autoPickLineup(context, renderLayout, saveGameState),
  updateFormation: (form) => updateFormation(form, context, renderLayout, saveGameState),
  setTactics: (k, v) => setTactics(k, v, context, renderLayout, saveGameState),
  changeMatchRound: (delta) => changeMatchRound(delta, context, renderLayout),
  setLeagueDiv: (d) => setLeagueDiv(d, context, renderLayout),
  changeLeagueRound: (delta) => changeLeagueRound(delta, context, renderLayout),
  setStatsMetric: (m) => setStatsMetric(m, context, renderLayout),
  setStatsDiv: (d) => setStatsDiv(d, context, renderLayout)
});

async function boot() {
  try {
    const res = await fetch('../data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    context.DB = await res.json();

    const saved = localStorage.getItem('apex_wpm_save_dev');
    if (saved) {
      context.state = JSON.parse(saved);
      if (!context.state.config) context.state.config = { units: 'imperial' };
      context.viewedTeamId = context.state.userTeamId;
      context.tableDiv = context.state.teams[context.state.userTeamId].div;
    } else {
      initializeDefaultCareer();
    }
    renderLayout();
  } catch (err) {
    document.getElementById('app-root').innerHTML = `
      <div style="padding: 24px; color: var(--red);">Fatal Error: ${err.message}</div>
    `;
  }
}

window.addEventListener('DOMContentLoaded', boot);
