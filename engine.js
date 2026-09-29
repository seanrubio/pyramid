// --- SIMULATION & RULES ENGINE ---

const POS_GROUPS = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'LM', 'RM', 'AM', 'LW', 'RW', 'ST'];
const SECONDARY_MAP = {
  'LB': ['LWB', 'LM'], 'RB': ['RWB', 'RM'], 'CB': ['DM'],
  'DM': ['CM', 'CB'], 'CM': ['DM', 'AM'], 'AM': ['CM', 'LW', 'RW'],
  'LM': ['LW', 'LB'], 'RM': ['RW', 'RB'], 'LW': ['LM', 'ST'], 'RW': ['RM', 'ST'], 'ST': ['AM']
};

const FORMATIONS = {
  '4-4-2 Flat': [
    { role: 'GK', x: 50, y: 88 },
    { role: 'LB', x: 15, y: 70 }, { role: 'CB1', x: 38, y: 72 }, { role: 'CB2', x: 62, y: 72 }, { role: 'RB', x: 85, y: 70 },
    { role: 'LM', x: 15, y: 46 }, { role: 'CM1', x: 38, y: 48 }, { role: 'CM2', x: 62, y: 48 }, { role: 'RM', x: 85, y: 46 },
    { role: 'ST1', x: 38, y: 22 }, { role: 'ST2', x: 62, y: 22 }
  ],
  '4-4-2 Diamond': [
    { role: 'GK', x: 50, y: 88 },
    { role: 'LB', x: 15, y: 70 }, { role: 'CB1', x: 38, y: 72 }, { role: 'CB2', x: 62, y: 72 }, { role: 'RB', x: 85, y: 70 },
    { role: 'DM', x: 50, y: 58 }, { role: 'LM', x: 20, y: 45 }, { role: 'RM', x: 80, y: 45 }, { role: 'AM', x: 50, y: 35 },
    { role: 'ST1', x: 38, y: 18 }, { role: 'ST2', x: 62, y: 18 }
  ],
  '4-2-3-1': [
    { role: 'GK', x: 50, y: 88 },
    { role: 'LB', x: 15, y: 70 }, { role: 'CB1', x: 38, y: 72 }, { role: 'CB2', x: 62, y: 72 }, { role: 'RB', x: 85, y: 70 },
    { role: 'DM1', x: 38, y: 55 }, { role: 'DM2', x: 62, y: 55 },
    { role: 'LW', x: 18, y: 34 }, { role: 'AM', x: 50, y: 32 }, { role: 'RW', x: 82, y: 34 },
    { role: 'ST', x: 50, y: 18 }
  ],
  '4-1-2-3': [
    { role: 'GK', x: 50, y: 88 },
    { role: 'LB', x: 15, y: 70 }, { role: 'CB1', x: 38, y: 72 }, { role: 'CB2', x: 62, y: 72 }, { role: 'RB', x: 85, y: 70 },
    { role: 'DM', x: 50, y: 56 }, { role: 'CM1', x: 35, y: 44 }, { role: 'CM2', x: 65, y: 44 },
    { role: 'LW', x: 18, y: 22 }, { role: 'ST', x: 50, y: 18 }, { role: 'RW', x: 82, y: 22 }
  ],
  '3-5-2': [
    { role: 'GK', x: 50, y: 88 },
    { role: 'CB1', x: 25, y: 72 }, { role: 'CB2', x: 50, y: 74 }, { role: 'CB3', x: 75, y: 72 },
    { role: 'LWB', x: 12, y: 48 }, { role: 'DM', x: 50, y: 56 }, { role: 'CM1', x: 36, y: 44 }, { role: 'CM2', x: 64, y: 44 }, { role: 'RWB', x: 88, y: 48 },
    { role: 'ST1', x: 38, y: 20 }, { role: 'ST2', x: 62, y: 20 }
  ],
  '3-4-3': [
    { role: 'GK', x: 50, y: 88 },
    { role: 'CB1', x: 25, y: 72 }, { role: 'CB2', x: 50, y: 74 }, { role: 'CB3', x: 75, y: 72 },
    { role: 'LM', x: 15, y: 48 }, { role: 'CM1', x: 38, y: 50 }, { role: 'CM2', x: 62, y: 50 }, { role: 'RM', x: 85, y: 48 },
    { role: 'LW', x: 20, y: 22 }, { role: 'ST', x: 50, y: 18 }, { role: 'RW', x: 80, y: 22 }
  ],
  '4-3-2-1': [
    { role: 'GK', x: 50, y: 88 },
    { role: 'LB', x: 15, y: 70 }, { role: 'CB1', x: 38, y: 72 }, { role: 'CB2', x: 62, y: 72 }, { role: 'RB', x: 85, y: 70 },
    { role: 'CM1', x: 25, y: 50 }, { role: 'DM', x: 50, y: 54 }, { role: 'CM2', x: 75, y: 50 },
    { role: 'AM1', x: 35, y: 32 }, { role: 'AM2', x: 65, y: 32 },
    { role: 'ST', x: 50, y: 18 }
  ],
  '4-5-1': [
    { role: 'GK', x: 50, y: 88 },
    { role: 'LB', x: 15, y: 70 }, { role: 'CB1', x: 38, y: 72 }, { role: 'CB2', x: 62, y: 72 }, { role: 'RB', x: 85, y: 70 },
    { role: 'LM', x: 15, y: 45 }, { role: 'CM1', x: 35, y: 48 }, { role: 'DM', x: 50, y: 54 }, { role: 'CM2', x: 65, y: 48 }, { role: 'RM', x: 85, y: 45 },
    { role: 'ST', x: 50, y: 18 }
  ],
  '5-4-1': [
    { role: 'GK', x: 50, y: 88 },
    { role: 'LWB', x: 12, y: 68 }, { role: 'CB1', x: 30, y: 72 }, { role: 'CB2', x: 50, y: 74 }, { role: 'CB3', x: 70, y: 72 }, { role: 'RWB', x: 88, y: 68 },
    { role: 'LM', x: 18, y: 44 }, { role: 'CM1', x: 38, y: 46 }, { role: 'CM2', x: 62, y: 46 }, { role: 'RM', x: 82, y: 44 },
    { role: 'ST', x: 50, y: 18 }
  ]
};

function getCountry(code) {
  return DB.countries.find(c => c.code === code) || { code: 'GB-ENG', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', region: 'anglo' };
}

function generatePlayerName(region = 'anglo') {
  const pool = DB.namePools[region] || DB.namePools['anglo'];
  const first = pool.first[Math.floor(Math.random() * pool.first.length)];
  const last = pool.last[Math.floor(Math.random() * pool.last.length)];
  return `${first} ${last}`;
}

function generatePlayer(pos, div, natCode = null) {
  const countryObj = natCode ? getCountry(natCode) : DB.countries[Math.floor(Math.random() * DB.countries.length)];
  const targetBase = Math.max(1, Math.min(10, Math.round(11 - (div * 0.9))));
  const randAttr = () => Math.max(1, Math.min(10, targetBase + Math.floor(Math.random() * 3) - 1));

  const technique = randAttr();
  const decisionMaking = randAttr();
  const bodyControl = randAttr();
  const athleticism = randAttr();
  const character = randAttr();

  const avgAttr = (technique + decisionMaking + bodyControl + athleticism + character) / 5;
  const positions = [pos];
  if (pos !== 'GK' && Math.random() < 0.35 && SECONDARY_MAP[pos]) {
    const potential = SECONDARY_MAP[pos];
    positions.push(potential[Math.floor(Math.random() * potential.length)]);
  }

  const tierMult = Math.pow(1.6, (11 - div));
  const val = Math.round((Math.pow(avgAttr, 2.5) * 1200 * tierMult) / 5000) * 5000;
  const wage = Math.max(350, Math.round((val * 0.0028) / 50) * 50);
  const morales = ['Very Low', 'Low', 'OK', 'High', 'Very High'];

  return {
    id: 'p_' + Math.random().toString(36).substr(2, 9),
    name: generatePlayerName(countryObj.region),
    nat: countryObj.code,
    positions,
    age: 18 + Math.floor(Math.random() * 16),
    technique, decisionMaking, bodyControl, athleticism, character,
    val, wage,
    contractYrs: 1 + Math.floor(Math.random() * 4),
    morale: morales[Math.floor(Math.random() * morales.length)],
    condition: 90 + Math.floor(Math.random() * 11),
    minutesPlayed: 0,
    ratingsHistory: [],
    slot: 'RES',
    trainingFocus: 'balanced'
  };
}

function createFullSquad(div, primaryCountryCode) {
  const squad = [];
  const roles = ['GK', 'GK', 'CB', 'CB', 'CB', 'CB', 'LB', 'LB', 'RB', 'RB', 'DM', 'DM', 'CM', 'CM', 'CM', 'LM', 'RM', 'AM', 'LW', 'RW', 'ST', 'ST', 'ST'];
  roles.forEach(pos => {
    const nat = (Math.random() < 0.7) ? primaryCountryCode : null;
    squad.push(generatePlayer(pos, div, nat));
  });
  return squad;
}

function autoAssignLineup(team) {
  const formSlots = FORMATIONS[team.formation] || FORMATIONS['4-4-2 Flat'];
  team.squad.forEach(p => p.slot = 'RES');
  const available = [...team.squad];

  formSlots.forEach((slotInfo, index) => {
    const slotKey = `S${index + 1}`;
    const baseRole = slotInfo.role.replace(/[0-9]/g, '');

    available.sort((a, b) => {
      const aFit = a.positions.includes(baseRole) ? 10 : 0;
      const bFit = b.positions.includes(baseRole) ? 10 : 0;
      return ((b.technique + b.decisionMaking + b.athleticism) + bFit) - ((a.technique + a.decisionMaking + a.athleticism) + aFit);
    });

    if (available.length > 0) {
      available.shift().slot = slotKey;
    }
  });

  for (let b = 1; b <= 9; b++) {
    if (available.length > 0) available.shift().slot = `B${b}`;
  }
}

function generateFixtures(teams) {
  const fixtures = {};
  for (let d = 1; d <= 10; d++) {
    const divTeams = Object.values(teams).filter(t => t.div === d).map(t => t.id);
    fixtures[d] = buildRoundRobin(divTeams);
  }
  return fixtures;
}

function buildRoundRobin(teamIds) {
  const rounds = [];
  const n = teamIds.length;
  const pool = [...teamIds];

  for (let r = 0; r < (n - 1) * 2; r++) {
    const roundFixtures = [];
    const isSecondHalf = r >= (n - 1);
    const shift = r % (n - 1);

    for (let i = 0; i < n / 2; i++) {
      let home = pool[(shift + i) % (n - 1)];
      let away = pool[(n - 1 - i + shift) % (n - 1)];
      if (i === 0) home = pool[n - 1];

      roundFixtures.push({
        home: isSecondHalf ? away : home,
        away: isSecondHalf ? home : away,
        played: false, hg: 0, ag: 0, hxg: 0, axg: 0
      });
    }
    rounds.push(roundFixtures);
  }
  return rounds;
}

function runRoundSimulation() {
  if (state.round > state.maxRounds) {
    handleSeasonEnd();
    return;
  }

  for (let d = 1; d <= 10; d++) {
    const roundFixtures = state.fixtures[d][state.round - 1];
    if (!roundFixtures) continue;

    roundFixtures.forEach(fix => {
      const homeTeam = state.teams[fix.home];
      const awayTeam = state.teams[fix.away];

      const hStarters = homeTeam.squad.filter(p => p.slot.startsWith('S'));
      const aStarters = awayTeam.squad.filter(p => p.slot.startsWith('S'));

      const getPower = (starters) => starters.length === 0 ? 20 : starters.reduce((acc, p) => acc + p.technique + p.decisionMaking + p.athleticism, 0) / starters.length;

      const hPwr = getPower(hStarters) * 1.08;
      const aPwr = getPower(aStarters);
      const hRatio = hPwr / (hPwr + aPwr);

      const hxg = Math.max(0.2, (hRatio * 2.8) + (Math.random() * 0.8 - 0.4));
      const axg = Math.max(0.2, ((1 - hRatio) * 2.4) + (Math.random() * 0.8 - 0.4));

      const sampleGoals = (lambda) => {
        let l = Math.exp(-lambda), k = 0, p = 1;
        do { k++; p *= Math.random(); } while (p > l);
        return k - 1;
      };

      const hg = sampleGoals(hxg);
      const ag = sampleGoals(axg);

      fix.hg = hg;
      fix.ag = ag;
      fix.hxg = parseFloat(hxg.toFixed(2));
      fix.axg = parseFloat(axg.toFixed(2));
      fix.played = true;

      updateTableRecord(d, homeTeam.id, hg, ag, fix.hxg, fix.axg);
      updateTableRecord(d, awayTeam.id, ag, hg, fix.axg, fix.hxg);

      applyPlayerMinutesAndRatings(homeTeam, hg, ag);
      applyPlayerMinutesAndRatings(awayTeam, ag, hg);
    });
  }

  state.round++;
  saveGameState();
}

function updateTableRecord(div, teamId, gf, ga, xg, xga) {
  const row = state.tables[div].find(r => r.teamId === teamId);
  if (!row) return;

  row.p++;
  row.gf += gf;
  row.ga += ga;
  row.gd = row.gf - row.ga;
  row.xg = parseFloat((row.xg + xg).toFixed(1));
  row.xga = parseFloat((row.xga + xga).toFixed(1));
  row.xgd = parseFloat((row.xg - row.xga).toFixed(1));

  if (gf > ga) { row.w++; row.pts += 3; row.form.push('W'); }
  else if (gf === ga) { row.d++; row.pts += 1; row.form.push('D'); }
  else { row.l++; row.form.push('L'); }
}

function applyPlayerMinutesAndRatings(team, gf, ga) {
  const starters = team.squad.filter(p => p.slot.startsWith('S'));
  const bench = team.squad.filter(p => p.slot.startsWith('B'));

  starters.forEach(p => {
    p.minutesPlayed += 90;
    let rtg = Math.max(1, Math.min(10, Math.round((6.0 + (gf * 0.4) - (ga * 0.3) + ((Math.random() * 2) - 1)) * 10) / 10));
    p.ratingsHistory.push(rtg);
    if (p.ratingsHistory.length > 5) p.ratingsHistory.shift();
  });

  const subsUsed = bench.slice(0, 3 + Math.floor(Math.random() * 3));
  subsUsed.forEach(p => {
    p.minutesPlayed += 25;
    let rtg = Math.max(1, Math.min(10, Math.round((6.0 + ((Math.random() * 1.5) - 0.7)) * 10) / 10));
    p.ratingsHistory.push(rtg);
    if (p.ratingsHistory.length > 5) p.ratingsHistory.shift();
  });
}

function handleSeasonEnd() {
  alert(`Season ${state.season} Complete! Processing pyramid promotions & relegations.`);
  for (let d = 1; d <= 9; d++) {
    const topTier = [...state.tables[d]].sort((a, b) => b.pts - a.pts || b.gd - a.gd);
    const bottomTier = [...state.tables[d + 1]].sort((a, b) => b.pts - a.pts || b.gd - a.gd);

    topTier.slice(17, 20).forEach(r => state.teams[r.teamId].div = d + 1);
    bottomTier.slice(0, 3).forEach(p => state.teams[p.teamId].div = d);
  }

  state.season++;
  state.round = 1;

  for (let d = 1; d <= 10; d++) {
    const divTeams = Object.values(state.teams).filter(t => t.div === d);
    state.tables[d] = divTeams.map(t => ({
      teamId: t.id, name: t.name,
      p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0,
      xg: 0.0, xga: 0.0, xgd: 0.0, form: []
    }));
  }

  state.fixtures = generateFixtures(state.teams);
  saveGameState();
}