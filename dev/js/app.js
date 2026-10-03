import { BLUEPRINT_PRESETS } from './constants.js';
import { 
  createFullSquad, 
  autoAssignLineup, 
  generateMasterCalendar, 
  generateUniversalCupR1, 
  advanceMomentSimulation, 
  resetSeasonClean, 
  getCurrentCalendarSlot 
} from './engine.js';
import { renderSquadView, sortSquad, handleSlotChange, autoPickLineup, setSquadViewMode } from './ui/squadView.js';
import { renderTacticsView, updateFormation, setTactics } from './ui/tacticsView.js';
import { renderMatchView, changeMatchRound, resetToCurrentMatchRound, setMatchReportSide } from './ui/matchView.js';
import { renderFixturesView } from './ui/fixturesView.js';
import { renderLeagueView, setLeagueDiv, changeLeagueRound, setLeagueLeaderTab, setCompetitionView, setSelectedRegionalCup, selectCupRoundTab } from './ui/leagueView.js';
import { renderStatsView, setStatsViewMode, sortStatsView, setStatsPage, toggleStatsDropdown, toggleStatsMetric, resetStatsMetrics, toggleStatsDiv, setAllStatsDivs, toggleStatsTrait, setStatsTraitMode, clearStatsTraits, toggleStatsPhase, toggleStatsArchetype, clearStatsArchetypes, setStatsMinMinutes, setStatsAgeRange, resetAllStatsFilters } from './ui/statsView.js';

export const context = {
  DB: null,
  state: null,
  activeTab: 'squad',
  squadViewMode: 'general',
  matchReportSide: 'home',
  tableDiv: 10,
  activeCompetitionView: 'league',
  selectedRegionalCup: 'North American Cup',
  selectedCupRoundTab: 0,
  viewedTeamId: null,
  viewedFixtureRound: null,
  viewedMatchRound: null,
  viewedMatchMoment: null,
  viewedMatchNavIndex: null,
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
  context.viewedMatchRound = null;
  context.viewedMatchMoment = null;
  context.viewedMatchNavIndex = null;
  context.viewedFixtureRound = null;
  renderLayout();
}

export function openMatchReport(homeTeamId, week, moment = null) {
  context.viewedTeamId = homeTeamId;
  context.viewedMatchRound = week;
  context.viewedMatchMoment = moment;
  context.viewedMatchNavIndex = null;
  context.activeTab = 'match';
  renderLayout();
}

export function switchTab(tab) {
  context.activeTab = tab;
  if (tab === 'league') context.viewedFixtureRound = null;
  renderLayout();
}

export function getScheduleStripModel(state) {
  const userTeam = state.teams[state.userTeamId];
  const w = state.week;
  const m = state.moment;
  const weekSlots = state.calendar?.[w] || {};

  // 1. Gather all user matches scheduled this calendar week
  const userMatches = [];
  for (let slotMoment = 1; slotMoment <= 4; slotMoment++) {
    const slot = weekSlots[slotMoment];
    if (slot && slot.type === 'match' && slot.matches) {
      const match = slot.matches.find(fx => fx.home === userTeam.id || fx.away === userTeam.id);
      if (match) {
        userMatches.push({ moment: slotMoment, match, slot });
      }
    }
  }

  // 2. Resolve Stage Title & Matchweek Label
  let stageTitle = '';
  let flag = '';

  if (w <= 4) {
    stageTitle = `Transfer Window • Week ${w}`;
  } else if (w <= 16) {
    const mwNum = w - 4;
    const cupName = userTeam.regionalCup || 'Regional Cup';
    stageTitle = `${cupName} • Matchweek ${mwNum}`;
    if (userMatches.length >= 2) flag = ' [DGW]';
    else if (userMatches.length === 0) flag = ' [BYE]';
  } else if (w <= 20) {
    stageTitle = `Transfer Window • Week ${w - 16}`;
  } else if (w <= 51) {
    const mwNum = w - 20;
    const cupMatch = userMatches.find(item => item.match.comp === 'cup' || item.slot.comp === 'cup');
    if (cupMatch) {
      const cupRoundLabel = cupMatch.slot.cupRoundName || 'Cup Tie';
      stageTitle = `Division ${userTeam.div} / ${cupRoundLabel} [DGW]`;
    } else {
      stageTitle = `Division ${userTeam.div} • Matchweek ${mwNum}`;
      if (userMatches.length >= 2) flag = ' [DGW]';
    }
  } else {
    stageTitle = 'Universal Cup Final';
  }

  // 3. Resolve the 4 Slot Labels
  const slots = [1, 2, 3, 4].map(slotMoment => {
    const isCurrent = (slotMoment === m);
    const isPast = (slotMoment < m);
    const slotData = weekSlots[slotMoment] || {};
    let label = 'Training';

    if (w === 52) {
      const finalMatch = slotData.matches?.[0];
      const isUserInFinal = finalMatch && (finalMatch.home === userTeam.id || finalMatch.away === userTeam.id);

      if (isUserInFinal) {
        if (slotMoment === 4) {
          const isHome = finalMatch.home === userTeam.id;
          const opp = state.teams[isHome ? finalMatch.away : finalMatch.home]?.name || 'TBD';
          label = `UC Final: ${isHome ? 'vs' : '@'} ${opp}`;
        }
      } else {
        if (slotMoment === 1) label = 'Exit Medicals';
        else if (slotMoment === 2) label = 'Clean Out Lockers';
        else if (slotMoment === 3) label = 'Say Goodbyes';
        else if (slotMoment === 4) {
          const hName = state.teams[finalMatch?.home]?.name || 'TBD';
          const aName = state.teams[finalMatch?.away]?.name || 'TBD';
          label = `UC Final: ${hName} vs ${aName}`;
        }
      }
    } else if (w === 1) {
      label = 'Re-sign Players';
    } else if ((w >= 2 && w <= 4) || (w >= 17 && w <= 20)) {
      label = 'Window Open';
    } else {
      const matchItem = userMatches.find(item => item.moment === slotMoment);
      if (matchItem) {
        const isHome = matchItem.match.home === userTeam.id;
        const oppId = isHome ? matchItem.match.away : matchItem.match.home;
        const oppName = state.teams[oppId]?.name || 'Opponent';
        label = `${isHome ? 'vs' : '@'} ${oppName}`;
      }
    }

    return { moment: slotMoment, label, isCurrent, isPast };
  });

  return { stageTitle: `S${state.season} • ${stageTitle}${flag}`, slots };
}

export function handleSimRound() {
  const currentSlot = getCurrentCalendarSlot(context.state);
  const userTeamId = context.state.userTeamId;
  let userFixture = null;

  if (currentSlot && currentSlot.type === 'match' && currentSlot.matches) {
    userFixture = currentSlot.matches.find(m => m.home === userTeamId || m.away === userTeamId);
  }

  const prevW = context.state.week;
  const prevM = context.state.moment;

  // Advancing past "Say Goodbyes" in Week 52 routes non-finalist to the bracket
  if (prevW === 52 && prevM === 3) {
    const finalMatch = context.state.calendar[52]?.[4]?.matches?.[0];
    const isUserInFinal = finalMatch && (finalMatch.home === userTeamId || finalMatch.away === userTeamId);
    if (!isUserInFinal) {
      context.activeTab = 'league';
      context.activeCompetitionView = 'cup';
      context.selectedCupRoundTab = 7; // Universal Cup Final tab index
    }
  }

  if (advanceMomentSimulation(context.state)) {
    if (userFixture && userFixture.played) {
      context.viewedMatchRound = prevW;
      context.viewedMatchMoment = prevM;
      context.viewedMatchNavIndex = null;
      context.activeTab = 'match';
    }

    saveGameState();
    context.viewedFixtureRound = null;
    renderLayout();
  }
}

export function handleStartNewSeason() {
  if (confirm(`Conclude Season ${context.state.season} and begin Season ${context.state.season + 1}?`)) {
    resetSeasonClean(context.state);
    saveGameState();
    context.viewedFixtureRound = null;
    context.viewedMatchRound = null;
    context.viewedMatchMoment = null;
    context.viewedMatchNavIndex = null;
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
    region: 'north_america',
    regionalCup: 'North American Cup',
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
      region: city.region || 'anglo',
      regionalCup: city.regional_cup || 'Universal Cup',
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

  const regionalTables = {};
  Object.values(teams).forEach(t => {
    if (t.regionalCup) {
      if (!regionalTables[t.regionalCup]) regionalTables[t.regionalCup] = [];
      regionalTables[t.regionalCup].push({
        teamId: t.id, name: t.name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, xg: 0.0, xga: 0.0, xgd: 0.0, form: []
      });
    }
  });

  const cupState = generateUniversalCupR1(teams);
  const calendar = generateMasterCalendar(teams, cupState);

  context.tableDiv = 10;
  context.viewedTeamId = userTeamId;
  context.viewedFixtureRound = null;
  context.viewedMatchRound = null;
  context.viewedMatchMoment = null;
  context.viewedMatchNavIndex = null;

  context.state = {
    season: 1,
    week: 1,
    moment: 1,
    config: { units: 'imperial' },
    userTeamId,
    teams,
    tables,
    regionalTables,
    cupState,
    calendar
  };

  saveGameState();
}

export function renderLayout() {
  const userTeam = context.state.teams[context.state.userTeamId];
  const activeTeam = context.state.teams[context.viewedTeamId] || userTeam;
  const isViewingOtherClub = (activeTeam.id !== context.state.userTeamId);
  const isSeasonOver = context.state.week > 52;
  const currentSlot = getCurrentCalendarSlot(context.state);

  const hasUserMatch = currentSlot && currentSlot.type === 'match' && currentSlot.matches &&
    currentSlot.matches.some(m => m.home === context.state.userTeamId || m.away === context.state.userTeamId);

  const weekSlots = context.state.calendar?.[context.state.week] || {};
  const nextMoment = context.state.moment + 1;
  const nextSlot = weekSlots[nextMoment];
  const hasMatchNext = nextSlot && nextSlot.type === 'match' && nextSlot.matches &&
    nextSlot.matches.some(m => m.home === context.state.userTeamId || m.away === context.state.userTeamId);

  let buttonText = 'ADVANCE';
  if (isSeasonOver) buttonText = 'START NEW SEASON';
  else if (hasUserMatch) buttonText = 'PLAY MATCH';
  else if (hasMatchNext) buttonText = 'ADVANCE TO MATCHDAY';
  else if (context.state.week === 52 && context.state.moment === 3) buttonText = 'ADVANCE TO UC FINAL';

  const strip = getScheduleStripModel(context.state);

  document.getElementById('app-root').innerHTML = `
    <header style="background: #11151c; border-bottom: 1px solid var(--border); padding: 8px 16px;">
      <!-- Single Unified Top Bar: Left (Club & Stage) | Center (4 Ticks) | Right (Action & Reset) -->
      <div style="max-width: 1200px; margin: auto; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 12px;">
        
        <!-- Left: Club Identifier & Stage Title -->
        <div style="display: flex; align-items: center; gap: 10px; overflow: hidden; white-space: nowrap;">
          <strong style="color: #fff; font-size: 14px; letter-spacing: 0.5px;">${activeTeam.name}</strong>
          ${isViewingOtherClub ? `
            <button onclick="inspectTeam('${context.state.userTeamId}')" style="background: rgba(88, 166, 255, 0.15); border: 1px solid var(--accent); color: var(--accent); padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 700; cursor: pointer;">
              RETURN TO ${userTeam.name.toUpperCase()}
            </button>
          ` : ''}
          <span style="color: var(--border);">|</span>
          <span style="color: var(--text-muted); font-size: 11px; font-weight: 600; text-overflow: ellipsis; overflow: hidden;">
            ${strip.stageTitle}
          </span>
        </div>

        <!-- Center: 4 Microcycle Ticks -->
        <div style="display: flex; align-items: center; gap: 6px; justify-content: center; background: rgba(0,0,0,0.3); padding: 3px 8px; border: 1px solid rgba(255,255,255,0.06); border-radius: 4px;">
          ${strip.slots.map(s => {
            let style = 'color: var(--text-muted); padding: 2px 6px; border-radius: 3px; font-size: 11px; font-family: monospace;';
            if (s.isCurrent) {
              style = 'background: rgba(88, 166, 255, 0.15); border: 1px solid var(--accent); color: #fff; font-weight: 700; padding: 2px 8px; font-family: monospace;';
            } else if (s.isPast) {
              style = 'color: rgba(255, 255, 255, 0.3); text-decoration: line-through; padding: 2px 6px; font-family: monospace;';
            }
            return `<span style="${style}">${s.label}</span>`;
          }).join('<span style="color: var(--border); font-size: 10px;">|</span>')}
        </div>

        <!-- Right: Primary Sim Button & Reset -->
        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
          ${isSeasonOver ? `
            <button onclick="handleStartNewSeason()" class="primary" style="background: var(--accent); color: #000; font-weight: 700;">START NEW SEASON</button>
          ` : `
            <button onclick="handleSimRound()" class="primary" style="${hasUserMatch ? 'background: #238636; border-color: #2ea043;' : ''}">${buttonText}</button>
          `}
          <button onclick="resetGameDatabase()" class="danger" title="Clear Save">RESET</button>
        </div>
      </div>
      
      <!-- Nav Tabs Bar -->
      <div style="max-width: 1200px; margin: auto; display: flex; gap: 4px; margin-top: 8px;">
        ${['squad', 'tactics', 'match', 'fixtures', 'league', 'stats'].map(tab => `
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
  else if (context.activeTab === 'stats') renderStatsView(ws, context);
}

Object.assign(window, {
  context,
  renderLayout,
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
  setLeagueLeaderTab: (cat) => setLeagueLeaderTab(cat, context, renderLayout),
  setCompetitionView: (mode) => setCompetitionView(mode, context, renderLayout),
  setSelectedRegionalCup: (cup) => setSelectedRegionalCup(cup, context, renderLayout),
  selectCupRoundTab: (idx) => selectCupRoundTab(idx, context, renderLayout),
  setStatsViewMode: (mode) => setStatsViewMode(mode, context, renderLayout),
  sortStatsView: (key) => sortStatsView(key, context, renderLayout),
  setStatsPage: (p) => setStatsPage(p, context, renderLayout),
  toggleStatsDropdown: (name) => toggleStatsDropdown(name, context, renderLayout),
  toggleStatsMetric: (mId) => toggleStatsMetric(mId, context, renderLayout),
  resetStatsMetrics: () => resetStatsMetrics(context, renderLayout),
  toggleStatsDiv: (d) => toggleStatsDiv(d, context, renderLayout),
  setAllStatsDivs: (all) => setAllStatsDivs(all, context, renderLayout),
  toggleStatsTrait: (t) => toggleStatsTrait(t, context, renderLayout),
  setStatsTraitMode: (m) => setStatsTraitMode(m, context, renderLayout),
  clearStatsTraits: () => clearStatsTraits(context, renderLayout),
  toggleStatsPhase: (ph, q) => toggleStatsPhase(ph, q, context, renderLayout),
  toggleStatsArchetype: (arc) => toggleStatsArchetype(arc, context, renderLayout),
  clearStatsArchetypes: () => clearStatsArchetypes(context, renderLayout),
  setStatsMinMinutes: (val) => setStatsMinMinutes(val, context, renderLayout),
  setStatsAgeRange: (min, max) => setStatsAgeRange(min, max, context, renderLayout),
  resetAllStatsFilters: () => resetAllStatsFilters(context, renderLayout)
});

async function boot() {
  try {
    const res = await fetch('../data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    context.DB = await res.json();

    const saved = localStorage.getItem('apex_wpm_save_dev');
    if (saved) {
      context.state = JSON.parse(saved);
      if (!context.state.calendar || !context.state.cupState) {
        initializeDefaultCareer();
      } else {
        context.viewedTeamId = context.state.userTeamId;
        context.tableDiv = context.state.teams[context.state.userTeamId].div;
      }
    } else {
      initializeDefaultCareer();
    }
    renderLayout();
  } catch (err) {
    console.error(err);
    document.getElementById('app-root').innerHTML = `
      <div style="padding: 24px; color: var(--red); font-family: monospace;">
        <strong>Fatal Error:</strong> ${err.message}
        <pre style="margin-top: 12px; font-size: 11px; white-space: pre-wrap; color: #fff;">${err.stack}</pre>
      </div>
    `;
  }
}

window.addEventListener('DOMContentLoaded', boot);
