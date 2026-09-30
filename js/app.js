import { BLUEPRINT_PRESETS } from './constants.js';
import { createFullSquad, autoAssignLineup, generateFixtures, runRoundSimulation, resetSeasonClean } from './engine.js';
import { renderSquadView, sortSquad, handleSlotChange, autoPickLineup, setSquadViewMode } from './ui/squadView.js';
import { renderTacticsView, updateFormation, setTactics } from './ui/tacticsView.js';
import { renderMatchView, changeMatchRound, resetToCurrentMatchRound, setMatchReportSide } from './ui/matchView.js';
import { renderFixturesView } from './ui/fixturesView.js';
import { renderLeagueView, setLeagueDiv, changeLeagueRound, setLeagueLeaderTab } from './ui/leagueView.js';

export const context = {
  DB: null,
  state: null,
  activeTab: 'squad',
  squadViewMode: 'general',
  matchReportSide: 'home',
  tableDiv: 10,
  viewedTeamId: null,
  viewedFixtureRound: null,
  viewedMatchRound: null,
  squadSort: { key: 'slot', asc: true },
  tableSort: { key: 'pts', asc: false }
};

export function saveGameState() {
  try { localStorage.setItem('apex_wpm_save', JSON.stringify(context.state)); } catch(e) {}
}

export function inspectTeam(teamId, targetTab = null) {
  if (!context.state.teams[teamId]) return;
  context.viewedTeamId = teamId;
  if (targetTab) context.activeTab = targetTab;
  context.viewedMatchRound = null;
  context.viewedFixtureRound = null;
  renderLayout();
}

export function openMatchReport(homeTeamId, round) {
  context.viewedTeamId = homeTeamId;
  context.viewedMatchRound = round;
  context.activeTab = 'match';
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
    localStorage.removeItem('apex_wpm_save');
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

  teams[userTeamId].squad.forEach(p => p.slot = null);
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
  const activeTeam = context.state.teams[context.viewedTeamId] || userTeam;
  const isViewingOtherClub = (activeTeam.id !== context.state.userTeamId);
  const isSeasonOver = context.state.round > context.state.maxRounds;

  document.getElementById('app-root').innerHTML = `
    <header style="background: #11151c; border-bottom: 1px solid var(--border); padding: 8px 16px;">
      <div style="max-width: 1200px; margin: auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <strong style="color: #fff; font-size: 14px;">${activeTeam.name}</strong>
          <span style="color: var(--accent); font-size: 12px; font-weight: 700;">DIV ${activeTeam.div}</span>
          ${isViewingOtherClub ? `
            <button onclick="inspectTeam('${context.state.userTeamId}')" style="background: rgba(88, 166, 255, 0.15); border: 1px solid var(--accent); color: var(--accent); padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 700; cursor: pointer;">
              RETURN TO ${userTeam.name.toUpperCase()}
            </button>
          ` : ''}
          <span style="color: var(--text-muted); font-size: 12px; margin-left: 6px;">
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
      <div style="max-width: 1200px; margin: auto; display: flex; gap: 4px; margin-top: 6px;">
        ${['squad', 'tactics', 'match', 'fixtures', 'league'].map(tab => `
          <button onclick="switchTab('${tab}')" class="nav-btn ${context.activeTab === tab ? 'active' : ''}">${tab.toUpperCase()}</button>
        `).join('')}
      </div>
    </header>

    <main style="max-width: 1200px; margin: 16px auto; padding: 0 16px;" id="view-workspace"></main>
  `;

  const ws = document.getElementById('view-workspace');
  if (context.activeTab === 'squad') renderSquadView(ws, context);
  else if (context.activeTab === 'tactics') renderTacticsView(ws, context);
  else if (context.activeTab === 'match') renderMatchView(ws, context);
  else if (context.activeTab === 'fixtures') renderFixturesView(ws, context);
  else if (context.activeTab === 'league') renderLeagueView(ws, context);
}

Object.assign(window, {
  switchTab,
  inspectTeam,
  openMatchReport,
  handleSimRound,
  handleStartNewSeason,
  resetGameDatabase,
  sortSquad: (key) => sortSquad(key, context, renderLayout),
  setSquadViewMode: (mode) => setSquadViewMode(mode, context, renderLayout),
  handleSlotChange: (pid, slot) => handleSlotChange(pid, slot, context, renderLayout, saveGameState),
  autoPickLineup: () => autoPickLineup(context, renderLayout, saveGameState),
  updateFormation: (form) => updateFormation(form, context, renderLayout, saveGameState),
  setTactics: (k, v) => setTactics(k, v, context, renderLayout, saveGameState),
  changeMatchRound: (delta) => changeMatchRound(delta, context, renderLayout),
  resetToCurrentMatchRound: () => resetToCurrentMatchRound(context, renderLayout),
  setMatchReportSide: (side) => setMatchReportSide(side, context, renderLayout),
  setLeagueDiv: (d) => setLeagueDiv(d, context, renderLayout),
  changeLeagueRound: (delta) => changeLeagueRound(delta, context, renderLayout),
  setLeagueLeaderTab: (cat) => setLeagueLeaderTab(cat, context, renderLayout)
});

async function boot() {
  try {
    const res = await fetch('./data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    context.DB = await res.json();

    const saved = localStorage.getItem('apex_wpm_save');
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
