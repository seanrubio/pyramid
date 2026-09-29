// --- SIMULATION ENGINE (8-PILLAR ARCHITECTURE) ---

const POS_GROUPS = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'LM', 'RM', 'AM', 'LW', 'RW', 'ST'];
const SECONDARY_MAP = {
  'LB': ['LWB', 'LM'], 'RB': ['RWB', 'RM'], 'CB': ['DM'],
  'DM': ['CM', 'CB'], 'CM': ['DM', 'AM'], 'AM': ['CM', 'LW', 'RW'],
  'LM': ['LW', 'LB'], 'RM': ['RW', 'RB'], 'LW': ['LM', 'ST'], 'RW': ['RM', 'ST'], 'ST': ['AM']
};

const FORMATIONS = {
  '4-4-2 Flat': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
  '4-4-2 Diamond': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'LM', 'RM', 'AM', 'ST', 'ST'],
  '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'DM', 'LW', 'AM', 'RW', 'ST'],
  '4-1-2-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'CM', 'LW', 'ST', 'RW'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'LB', 'DM', 'CM', 'CM', 'RB', 'ST', 'ST'],
  '3-4-3': ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'LW', 'ST', 'RW'],
  '4-3-2-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'DM', 'CM', 'AM', 'AM', 'ST'],
  '4-5-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'DM', 'CM', 'RM', 'ST'],
  '5-4-1': ['GK', 'LB', 'CB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST']
};

// Logical mapping of pitch positions to archetypes
const POSITION_ARCHETYPES = {
  'GK': ['gk_shot_stopper', 'gk_cross_collector', 'gk_possession_platform', 'gk_disrupter', 'gk_organizer'],
  'CB': ['target', 'soldier', 'disrupter', 'anticipator', 'steady_eddy'],
  'LB': ['two_way', 'runner_in_behind', 'soldier', 'steady_eddy'],
  'RB': ['two_way', 'runner_in_behind', 'soldier', 'steady_eddy'],
  'DM': ['disrupter', 'soldier', 'anticipator', 'two_way', 'steady_eddy'],
  'CM': ['two_way', 'artist', 'pocket_player', 'anticipator', 'steady_eddy'],
  'LM': ['dribblinho', 'runner_in_behind', 'pocket_player', 'artist', 'two_way'],
  'RM': ['dribblinho', 'runner_in_behind', 'pocket_player', 'artist', 'two_way'],
  'AM': ['pocket_player', 'artist', 'dribblinho', 'anticipator'],
  'LW': ['dribblinho', 'runner_in_behind', 'pocket_player', 'artist'],
  'RW': ['dribblinho', 'runner_in_behind', 'pocket_player', 'artist'],
  'ST': ['target', 'runner_in_behind', 'dribblinho', 'soldier', 'pocket_player']
};

// Box-Muller Gaussian Random
function randomGaussian(mean = 0, stdDev = 1) {
  let u = 1 - Math.random();
  let v = Math.random();
  let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}

function getCountry(code) {
  return DB.countries.find(c => c.code === code) || { code: 'GB-ENG', name: 'England', flag: '🇬🇧', region: 'anglo' };
}

function generatePlayerName(region = 'anglo') {
  const pool = DB.namePools[region] || DB.namePools['anglo'];
  const first = pool.first[Math.floor(Math.random() * pool.first.length)];
  const last = pool.last[Math.floor(Math.random() * pool.last.length)];
  return `${first} ${last}`;
}

// Player Generation using 8 Pillars, Morphology, and Trait Engine
function generatePlayer(pos, div, natCode = null) {
  const countryObj = natCode ? getCountry(natCode) : DB.countries[Math.floor(Math.random() * DB.countries.length)];
  
  // Select Archetype based on position
  const candidateKeys = POSITION_ARCHETYPES[pos] || ['steady_eddy'];
  const archetypeKey = candidateKeys[Math.floor(Math.random() * candidateKeys.length)];
  const archetype = DB.archetypes[archetypeKey];

  // Mathematical calibration (μ = 94 - div * 6.2)
  const tierMean = DB.tierConfig.base - (div * DB.tierConfig.slope);
  const attributes = {};
  const traits = [];
  const thresholdDelta = 1.5 * DB.tierConfig.archetypeSigma;

  // 8 Pillars generation & ±1.5σ Trait triggers
  for (const [pillar, weight] of Object.entries(archetype.weights)) {
    const rawVal = tierMean + (weight * DB.tierConfig.archetypeSigma) + randomGaussian(0, DB.tierConfig.noiseSigma);
    const score = Math.max(1, Math.min(99, Math.round(rawVal)));
    attributes[pillar] = score;

    if (score >= tierMean + thresholdDelta) {
      traits.push(`[+${DB.traits[pillar].asset}]`);
    } else if (score <= tierMean - thresholdDelta) {
      traits.push(`[-${DB.traits[pillar].liability}]`);
    }
  }

  // Morphology (Height, BMI, Weight)
  const baseMorph = archetype.isGK ? DB.morphologyBaselines.goalkeeper : DB.morphologyBaselines.outfield;
  const heightCm = Math.round(randomGaussian(baseMorph.heightMean + archetype.morph.heightDelta, baseMorph.heightStd));
  const bmi = +(randomGaussian(baseMorph.bmiMean + archetype.morph.bmiDelta, baseMorph.bmiStd)).toFixed(1);
  const weightKg = Math.round(bmi * Math.pow(heightCm / 100, 2));

  // Evaluation Phase Glyphs (Hardware, Software, OS)
  const getGlyph = (val) => (val >= tierMean + 4 ? "+" : val <= tierMean - 4 ? "-" : "✓");
  const hardwareAvg = (attributes.proprioception + attributes.dynamicPower + attributes.bioenergetics) / 3;
  const softwareAvg = (attributes.scanning + attributes.processing) / 2;
  const osAvg = (attributes.regulation + attributes.grit + attributes.stewardship) / 3;
  const profileGlyphs = `${getGlyph(hardwareAvg)} / ${getGlyph(softwareAvg)} / ${getGlyph(osAvg)}`;

  // Secondary Positions
  const positions = [pos];
  if (pos !== 'GK' && Math.random() < 0.35 && SECONDARY_MAP[pos]) {
    const potential = SECONDARY_MAP[pos];
    positions.push(potential[Math.floor(Math.random() * potential.length)]);
  }

  // Market Valuation scaled to 1–99 attributes
  const overallAvg = (hardwareAvg + softwareAvg + osAvg) / 3;
  const tierMult = Math.pow(1.5, (11 - div));
  const val = Math.round((Math.pow(overallAvg / 10, 2.5) * 1200 * tierMult) / 5000) * 5000;
  const wage = Math.max(350, Math.round((val * 0.0025) / 50) * 50);
  const morales = ['Very Low', 'Low', 'OK', 'High', 'Very High'];

  return {
    id: 'p_' + Math.random().toString(36).substr(2, 9),
    name: generatePlayerName(countryObj.region),
    nat: countryObj.code,
    positions,
    archetypeKey,
    archetypeName: archetype.name,
    age: 18 + Math.floor(Math.random() * 16),
    morphology: { heightCm, weightKg, bmi },
    attributes,
    traits,
    profileGlyphs,
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

// Lineup sorting based on position fit and comprehensive 8-pillar rating
function autoAssignLineup(team) {
  const formRoles = FORMATIONS[team.formation] || FORMATIONS['4-4-2 Flat'];
  team.squad.forEach(p => p.slot = 'RES');
  const available = [...team.squad];

  formRoles.forEach((role, idx) => {
    const slotKey = `S${idx + 1}`;
    available.sort((a, b) => {
      const aFit = a.positions.includes(role) ? 15 : 0;
      const bFit = b.positions.includes(role) ? 15 : 0;
      
      const aScore = (a.attributes.proprioception + a.attributes.dynamicPower + a.attributes.scanning + a.attributes.processing) / 4 + aFit;
      const bScore = (b.attributes.proprioception + b.attributes.dynamicPower + b.attributes.scanning + b.attributes.processing) / 4 + bFit;
      
      return bScore - aScore;
    });
    if (available.length > 0) available.shift().slot = slotKey;
  });

  for (let b = 1; b <= 9; b++) {
    if (available.length > 0) available.shift().slot = `B${b}`;
  }
}

function validateLineup(team) {
  const starters = team.squad.filter(p => p.slot.startsWith('S'));
  if (starters.length !== 11) return { valid: false, error: `Lineup incomplete: ${starters.length}/11 starters assigned.` };

  const hasGk = starters.some(p => p.positions.includes('GK'));
  if (!hasGk) return { valid: false, error: 'No goalkeeper assigned in starting XI.' };

  return { valid: true };
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

function getTacticalModifiers(tactics) {
  let attMod = 1.0;
  let defMod = 1.0;

  if (tactics.mentality === 'park the bus') { attMod *= 0.70; defMod *= 1.30; }
  else if (tactics.mentality === 'defensive') { attMod *= 0.85; defMod *= 1.15; }
  else if (tactics.mentality === 'attacking') { attMod *= 1.15; defMod *= 0.88; }
  else if (tactics.mentality === 'overload') { attMod *= 1.30; defMod *= 0.75; }

  if (tactics.press === 'high press' || tactics.press === 'gegenpress') { attMod *= 1.08; defMod *= 0.95; }
  else if (tactics.press === 'low block') { attMod *= 0.92; defMod *= 1.10; }

  return { attMod, defMod };
}

function runRoundSimulation() {
  const userTeam = state.teams[state.userTeamId];
  const validation = validateLineup(userTeam);
  if (!validation.valid) {
    alert(`[LINEUP ERROR] ${validation.error}`);
    return false;
  }

  for (let d = 1; d <= 10; d++) {
    const roundFixtures = state.fixtures[d][state.round - 1];
    if (!roundFixtures) continue;

    roundFixtures.forEach(fix => {
      const homeTeam = state.teams[fix.home];
      const awayTeam = state.teams[fix.away];

      const hStarters = homeTeam.squad.filter(p => p.slot.startsWith('S'));
      const aStarters = awayTeam.squad.filter(p => p.slot.startsWith('S'));

      // Calculate team strength across Hardware, Software, and OS
      const getTeamPower = (starters) => {
        if (starters.length === 0) return 40;
        const total = starters.reduce((acc, p) => {
          const hw = (p.attributes.proprioception + p.attributes.dynamicPower + p.attributes.bioenergetics) / 3;
          const sw = (p.attributes.scanning + p.attributes.processing) / 2;
          const os = (p.attributes.regulation + p.attributes.grit + p.attributes.stewardship) / 3;
          return acc + (hw * 0.4 + sw * 0.4 + os * 0.2);
        }, 0);
        return total / starters.length;
      };

      const hMods = getTacticalModifiers(homeTeam.tactics);
      const aMods = getTacticalModifiers(awayTeam.tactics);

      const hPwr = (getTeamPower(hStarters) * 1.06) * hMods.attMod * (1 / aMods.defMod);
      const aPwr = getTeamPower(aStarters) * aMods.attMod * (1 / hMods.defMod);
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
  return true;
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

  const numSubs = Math.min(bench.length, 3 + Math.floor(Math.random() * 3));
  for (let i = 0; i < numSubs; i++) {
    const sub = bench[i];
    sub.minutesPlayed += 25;
    let rtg = Math.max(1, Math.min(10, Math.round((6.0 + ((Math.random() * 1.5) - 0.7)) * 10) / 10));
    sub.ratingsHistory.push(rtg);
    if (sub.ratingsHistory.length > 5) sub.ratingsHistory.shift();
  }
}
