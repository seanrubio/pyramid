// --- SIMULATION ENGINE (PHASE TRIAD & POSITIONLESS REFACTOR) ---

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

const GK_ARCHETYPES = [
  'gk_shot_stopper', 'gk_cross_collector', 'gk_possession_platform', 'gk_disrupter', 'gk_organizer'
];

const OUTFIELD_ARCHETYPES = [
  'runner_in_behind', 'pocket_player', 'target', 'dribblinho', 'artist', 
  'anticipator', 'disrupter', 'soldier', 'two_way', 'steady_eddy'
];

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

// Generate Player without explicit position strings
function generatePlayer(isGK, div, natCode = null) {
  const countryObj = natCode ? getCountry(natCode) : DB.countries[Math.floor(Math.random() * DB.countries.length)];
  
  const pool = isGK ? GK_ARCHETYPES : OUTFIELD_ARCHETYPES;
  const archetypeKey = pool[Math.floor(Math.random() * pool.length)];
  const archetype = DB.archetypes[archetypeKey];

  const tierMean = DB.tierConfig.base - (div * DB.tierConfig.slope);
  const attributes = {};
  const traits = [];

  // Asymmetric thresholds matching the survival floor (+1.75 peak / -1.25 floor)
  const assetCutoff = 1.65 * DB.tierConfig.archetypeSigma;
  const liabilityCutoff = 1.25 * DB.tierConfig.archetypeSigma;

  // 8 MECE Pillars
  for (const [pillar, weight] of Object.entries(archetype.weights)) {
    const rawVal = tierMean + (weight * DB.tierConfig.archetypeSigma) + randomGaussian(0, DB.tierConfig.noiseSigma);
    const score = Math.max(1, Math.min(99, Math.round(rawVal)));
    attributes[pillar] = score;

    if (score >= tierMean + assetCutoff) {
      traits.push(`[+${DB.traits[pillar].asset}]`);
    } else if (score <= tierMean - liabilityCutoff) {
      traits.push(`[-${DB.traits[pillar].liability}]`);
    }
  }

  // Morphology
  const baseMorph = isGK ? DB.morphologyBaselines.goalkeeper : DB.morphologyBaselines.outfield;
  const heightCm = Math.round(randomGaussian(baseMorph.heightMean + archetype.morph.heightDelta, baseMorph.heightStd));
  const bmi = +(randomGaussian(baseMorph.bmiMean + archetype.morph.bmiDelta, baseMorph.bmiStd)).toFixed(1);
  const weightKg = Math.round(bmi * Math.pow(heightCm / 100, 2));

  // Phase Composites across all 8 pillars (Calibrated Mid-Contrast Matrix)
  const ipScore = 
    (attributes.proprioception * 0.20) +
    (attributes.dynamicPower   * 0.15) +
    (attributes.bioenergetics  * 0.075) +
    (attributes.scanning       * 0.20) +
    (attributes.processing     * 0.15) +
    (attributes.regulation     * 0.075) +
    (attributes.grit           * 0.075) +
    (attributes.stewardship    * 0.075);

  const oopScore = 
    (attributes.proprioception * 0.075) +
    (attributes.dynamicPower   * 0.20) +
    (attributes.bioenergetics  * 0.15) +
    (attributes.scanning       * 0.15) +
    (attributes.processing     * 0.075) +
    (attributes.regulation     * 0.075) +
    (attributes.grit           * 0.15) +
    (attributes.stewardship    * 0.125);

  const trScore = 
    (attributes.proprioception * 0.15) +
    (attributes.dynamicPower   * 0.15) +
    (attributes.bioenergetics  * 0.20) +
    (attributes.scanning       * 0.075) +
    (attributes.processing     * 0.20) +
    (attributes.regulation     * 0.075) +
    (attributes.grit           * 0.075) +
    (attributes.stewardship    * 0.075);

 // Glyphs trigger symmetrically around the true tier mean (±1.4 points)
  const getGlyph = (val) => (val >= tierMean + 1.4 ? "+" : val <= tierMean - 1.4 ? "-" : "✓");
  const phaseGlyphs = `${getGlyph(ipScore)} / ${getGlyph(oopScore)} / ${getGlyph(trScore)}`;

  // Market Valuation
  const overallAvg = (ipScore + oopScore + trScore) / 3;
  const tierMult = Math.pow(1.5, (11 - div));
  const val = Math.round((Math.pow(overallAvg / 10, 2.5) * 1200 * tierMult) / 5000) * 5000;
  const wage = Math.max(350, Math.round((val * 0.0025) / 50) * 50);

  return {
    id: 'p_' + Math.random().toString(36).substr(2, 9),
    name: generatePlayerName(countryObj.region),
    nat: countryObj.code,
    isGK,
    archetypeKey,
    archetypeName: archetype.name,
    age: 18 + Math.floor(Math.random() * 16),
    morphology: { heightCm, weightKg, bmi },
    attributes,
    traits,
    phaseGlyphs,
    val, wage,
    contractYrs: 1 + Math.floor(Math.random() * 4),
    condition: 90 + Math.floor(Math.random() * 11),
    minutesPlayed: 0,
    ratingsHistory: [],
    slot: 'RES'
  };
}

function createFullSquad(div, primaryCountryCode) {
  const squad = [];
  // 3 Keepers, 20 Outfielders
  for (let i = 0; i < 3; i++) {
    const nat = (Math.random() < 0.7) ? primaryCountryCode : null;
    squad.push(generatePlayer(true, div, nat));
  }
  for (let i = 0; i < 20; i++) {
    const nat = (Math.random() < 0.7) ? primaryCountryCode : null;
    squad.push(generatePlayer(false, div, nat));
  }
  return squad;
}

// Auto-assign based on tactical phase fit rather than rigid position strings
function autoAssignLineup(team) {
  team.squad.forEach(p => p.slot = 'RES');
  
  // Assign Goalkeeper (Slot S1)
  const availableKeepers = team.squad.filter(p => p.isGK);
  availableKeepers.sort((a, b) => {
    const scoreA = a.attributes.dynamicPower + a.attributes.processing;
    const scoreB = b.attributes.dynamicPower + b.attributes.processing;
    return scoreB - scoreA;
  });
  if (availableKeepers.length > 0) {
    availableKeepers[0].slot = 'S1';
  }

  // Assign Outfield Starters (S2 through S11)
  const availableOutfield = team.squad.filter(p => !p.isGK);
  availableOutfield.sort((a, b) => {
    const scoreA = Object.values(a.attributes).reduce((acc, v) => acc + v, 0);
    const scoreB = Object.values(b.attributes).reduce((acc, v) => acc + v, 0);
    return scoreB - scoreA;
  });

  for (let i = 2; i <= 11; i++) {
    if (availableOutfield.length > 0) {
      availableOutfield.shift().slot = `S${i}`;
    }
  }

  // Assign Bench (B1 to B9)
  const remaining = team.squad.filter(p => p.slot === 'RES');
  for (let b = 1; b <= 9; b++) {
    if (remaining.length > 0) {
      remaining.shift().slot = `B${b}`;
    }
  }
}

function validateLineup(team) {
  const starters = team.squad.filter(p => p.slot.startsWith('S'));
  if (starters.length !== 11) return { valid: false, error: `Lineup incomplete: ${starters.length}/11 starters assigned.` };

  const hasGk = starters.some(p => p.isGK);
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

      const getPhasePower = (starters) => {
        if (starters.length === 0) return 40;
        const total = starters.reduce((acc, p) => {
          const a = p.attributes;
          const ip = (a.proprioception * 0.20) + (a.dynamicPower * 0.15) + (a.bioenergetics * 0.075) + (a.scanning * 0.20) + (a.processing * 0.15) + (a.regulation * 0.075) + (a.grit * 0.075) + (a.stewardship * 0.075);
          const oop = (a.proprioception * 0.075) + (a.dynamicPower * 0.20) + (a.bioenergetics * 0.15) + (a.scanning * 0.15) + (a.processing * 0.075) + (a.regulation * 0.075) + (a.grit * 0.15) + (a.stewardship * 0.125);
          const tr = (a.proprioception * 0.15) + (a.dynamicPower * 0.15) + (a.bioenergetics * 0.20) + (a.scanning * 0.075) + (a.processing * 0.20) + (a.regulation * 0.075) + (a.grit * 0.075) + (a.stewardship * 0.075);
          return acc + (ip * 0.38 + oop * 0.38 + tr * 0.24);
        }, 0);
        return total / starters.length;
      };

      const hMods = getTacticalModifiers(homeTeam.tactics);
      const aMods = getTacticalModifiers(awayTeam.tactics);

      const hPwr = (getPhasePower(hStarters) * 1.06) * hMods.attMod * (1 / aMods.defMod);
      const aPwr = getPhasePower(aStarters) * aMods.attMod * (1 / hMods.defMod);
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
