// --- SIMULATION ENGINE (PHASE TRIAD & TACTICAL BLUEPRINT REFACTOR) ---

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

// Calculate individual player phase power
function getPlayerPhaseScores(p) {
  const a = p.attributes;
  const ip = (a.proprioception * 0.20) + (a.dynamicPower * 0.15) + (a.bioenergetics * 0.075) + (a.scanning * 0.20) + (a.processing * 0.15) + (a.regulation * 0.075) + (a.grit * 0.075) + (a.stewardship * 0.075);
  const oop = (a.proprioception * 0.075) + (a.dynamicPower * 0.20) + (a.bioenergetics * 0.15) + (a.scanning * 0.15) + (a.processing * 0.075) + (a.regulation * 0.075) + (a.grit * 0.15) + (a.stewardship * 0.125);
  const tr = (a.proprioception * 0.15) + (a.dynamicPower * 0.15) + (a.bioenergetics * 0.20) + (a.scanning * 0.075) + (a.processing * 0.20) + (a.regulation * 0.075) + (a.grit * 0.075) + (a.stewardship * 0.075);
  return { ip, oop, tr };
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

  // Delegate phase calculation
  const phaseScores = getPlayerPhaseScores({ attributes });

  const getGlyph = (val) => (val >= tierMean + 1.5 ? "+" : val <= tierMean - 0.7 ? "-" : "✓");
  const phaseGlyphs = `${getGlyph(phaseScores.ip)} / ${getGlyph(phaseScores.oop)} / ${getGlyph(phaseScores.tr)}`;

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
    condition: 90 + Math.floor(Math.random() * 11),
    minutesPlayed: 0,
    slot: 'RES'
  };
}

function createFullSquad(div, primaryCountryCode) {
  const squad = [];
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

function resolveTacticalPhaseWeights(tactics = {}) {
  const bp = (tactics.blueprint && DB.tacticalBlueprints && DB.tacticalBlueprints[tactics.blueprint])
    ? DB.tacticalBlueprints[tactics.blueprint].phaseWeights
    : { ip: 0.38, oop: 0.38, tr: 0.24 };

  let ip = bp.ip;
  let oop = bp.oop;
  let tr = bp.tr;

  if (tactics.mentality === 'park the bus') { ip -= 0.20; oop += 0.16; tr += 0.04; }
  else if (tactics.mentality === 'defensive') { ip -= 0.10; oop += 0.08; tr += 0.02; }
  else if (tactics.mentality === 'attacking') { ip += 0.10; oop -= 0.12; tr += 0.02; }
  else if (tactics.mentality === 'overload')  { ip += 0.20; oop -= 0.24; tr += 0.04; }

  if (tactics.press === 'low block')        { ip -= 0.04; oop += 0.08; tr -= 0.04; }
  else if (tactics.press === 'high press')   { ip -= 0.04; oop += 0.04; tr -= 0.00; }
  else if (tactics.press === 'gegenpress')   { ip -= 0.12; oop += 0.04; tr += 0.08; }

  if (tactics.buildGk === 'short') { ip += 0.06; tr -= 0.06; }
  else if (tactics.buildGk === 'long') { ip -= 0.08; tr += 0.06; oop += 0.02; }

  ip = Math.max(0.08, ip);
  oop = Math.max(0.08, oop);
  tr = Math.max(0.08, tr);
  const sum = ip + oop + tr;

  return {
    ip: ip / sum,
    oop: oop / sum,
    tr: tr / sum
  };
}

function evaluateSlotFit(player, role, blueprintKey) {
  const scores = getPlayerPhaseScores(player);
  const a = player.attributes;
  const arch = player.archetypeKey;
  const bp = (blueprintKey && DB.tacticalBlueprints) ? DB.tacticalBlueprints[blueprintKey] : null;

  let baseFit = 0;

  if (role === 'CB') {
    baseFit = (scores.oop * 0.70) + (scores.tr * 0.15) + (scores.ip * 0.15);
    if (['soldier', 'disrupter', 'anticipator', 'steady_eddy'].includes(arch)) baseFit += 8.0;
    if (['dribblinho', 'artist', 'pocket_player', 'runner_in_behind'].includes(arch)) baseFit -= 20.0;
    if (player.morphology.heightCm >= 188) baseFit += 3.0;
    else if (player.morphology.heightCm < 180) baseFit -= 8.0;

  } else if (role === 'LB' || role === 'RB') {
    baseFit = (scores.tr * 0.50) + (scores.oop * 0.35) + (scores.ip * 0.15);
    if (['two_way', 'runner_in_behind', 'soldier', 'steady_eddy'].includes(arch)) baseFit += 6.0;
    if (['pocket_player', 'target', 'artist'].includes(arch)) baseFit -= 12.0;

  } else if (role === 'DM') {
    baseFit = (scores.oop * 0.50) + (scores.tr * 0.30) + (scores.ip * 0.20);
    if (['disrupter', 'soldier', 'two_way', 'anticipator'].includes(arch)) baseFit += 8.0;
    if (['dribblinho', 'runner_in_behind', 'target'].includes(arch)) baseFit -= 15.0;

  } else if (role === 'CM') {
    baseFit = (scores.ip * 0.35) + (scores.tr * 0.35) + (scores.oop * 0.30);
    if (['two_way', 'pocket_player', 'anticipator', 'steady_eddy', 'artist'].includes(arch)) baseFit += 6.0;
    if (['target'].includes(arch)) baseFit -= 15.0;

  } else if (role === 'AM') {
    baseFit = (scores.ip * 0.60) + (scores.tr * 0.25) + (scores.oop * 0.15);
    if (['pocket_player', 'artist', 'dribblinho'].includes(arch)) baseFit += 8.0;
    if (['soldier', 'disrupter'].includes(arch)) baseFit -= 12.0;

  } else if (['LM', 'RM', 'LW', 'RW'].includes(role)) {
    baseFit = (scores.tr * 0.45) + (scores.ip * 0.40) + (scores.oop * 0.15);
    if (['dribblinho', 'runner_in_behind', 'two_way', 'artist'].includes(arch)) baseFit += 7.0;
    if (['soldier', 'target', 'pocket_player'].includes(arch)) baseFit -= 10.0;

  } else if (role === 'ST') {
    baseFit = (scores.ip * 0.50) + (scores.tr * 0.35) + (scores.oop * 0.15);
    if (['target', 'runner_in_behind', 'pocket_player'].includes(arch)) baseFit += 8.0;
    if (['soldier', 'disrupter', 'steady_eddy'].includes(arch)) baseFit -= 15.0;
    if (arch === 'target' && player.morphology.heightCm >= 190) baseFit += 4.0;
  }

  if (bp) {
    if (bp.favoredArchetypes && bp.favoredArchetypes.includes(arch)) baseFit += 5.0;
    if (bp.unfavoredArchetypes && bp.unfavoredArchetypes.includes(arch)) baseFit -= 5.0;

    if (bp.keyPillars) {
      bp.keyPillars.forEach(pillar => {
        if (a[pillar] >= 75) baseFit += 1.5;
        else if (a[pillar] <= 60) baseFit -= 1.5;
      });
    }
  }

  return baseFit;
}

function autoAssignLineup(team) {
  team.squad.forEach(p => p.slot = 'RES');
  const bpKey = team.tactics ? team.tactics.blueprint : null;
  const bp = (bpKey && DB.tacticalBlueprints) ? DB.tacticalBlueprints[bpKey] : null;

  // 1. Assign Goalkeeper (Slot S1)
  const availableKeepers = team.squad.filter(p => p.isGK);
  if (availableKeepers.length > 0) {
    availableKeepers.sort((a, b) => {
      let scoreA = (a.attributes.dynamicPower * 0.4) + (a.attributes.processing * 0.4) + (a.attributes.scanning * 0.2);
      let scoreB = (b.attributes.dynamicPower * 0.4) + (b.attributes.processing * 0.4) + (b.attributes.scanning * 0.2);
      if (bp && bp.favoredGk) {
        if (a.archetypeKey === bp.favoredGk) scoreA += 8.0;
        if (b.archetypeKey === bp.favoredGk) scoreB += 8.0;
      }
      return scoreB - scoreA;
    });
    availableKeepers[0].slot = 'S1';
  }

  // 2. Assign Outfield Starters (Spine First)
  const formRoles = FORMATIONS[team.formation] || FORMATIONS['4-4-2 Flat'];
  let availableOutfield = team.squad.filter(p => !p.isGK);

  const outfieldSlots = formRoles.slice(1).map((role, idx) => ({
    role,
    slotCode: `S${idx + 2}`
  }));

  const getRolePriority = (role) => {
    if (role === 'CB') return 1;
    if (role === 'ST') return 2;
    if (['DM', 'CM', 'AM'].includes(role)) return 3;
    return 4;
  };

  outfieldSlots.sort((a, b) => getRolePriority(a.role) - getRolePriority(b.role));

  for (const slot of outfieldSlots) {
    if (availableOutfield.length === 0) break;

    availableOutfield.sort((a, b) => {
      const fitA = evaluateSlotFit(a, slot.role, bpKey);
      const fitB = evaluateSlotFit(b, slot.role, bpKey);
      return fitB - fitA;
    });

    const chosen = availableOutfield.shift();
    chosen.slot = slot.slotCode;
  }

  // 3. Assign Bench (B1 to B9)
  const remainingGKs = team.squad.filter(p => p.isGK && p.slot === 'RES');
  let benchIndex = 1;
  if (remainingGKs.length > 0) {
    remainingGKs[0].slot = `B${benchIndex++}`;
  }

  const remainingOutfield = team.squad.filter(p => !p.isGK && p.slot === 'RES');
  remainingOutfield.sort((a, b) => {
    const scoreA = (a.attributes.bioenergetics * 0.4) + (a.attributes.grit * 0.3) + (a.attributes.stewardship * 0.3);
    const scoreB = (b.attributes.bioenergetics * 0.4) + (b.attributes.grit * 0.3) + (b.attributes.stewardship * 0.3);
    return scoreB - scoreA;
  });

  while (benchIndex <= 9 && remainingOutfield.length > 0) {
    remainingOutfield.shift().slot = `B${benchIndex++}`;
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
  const n = teamIds.length;
  let pool = [...teamIds];

  const rounds = [];
  const halfRounds = n - 1;
  const matchesPerRound = n / 2;

  for (let r = 0; r < halfRounds; r++) {
    const roundFixtures = [];

    for (let i = 0; i < matchesPerRound; i++) {
      let t1 = pool[i];
      let t2 = pool[n - 1 - i];

      let home = t1;
      let away = t2;

      if (i === 0) {
        if (r % 2 === 1) { home = t2; away = t1; }
      } else {
        if ((i + r) % 2 === 1) { home = t2; away = t1; }
      }

      roundFixtures.push({
        home, away, played: false,
        hg: 0, ag: 0, hxg: 0, axg: 0
      });
    }

    rounds.push(roundFixtures);

    const fixed = pool[0];
    const rest = pool.slice(1);
    const last = rest.pop();
    pool = [fixed, last, ...rest];
  }

  for (let r = 0; r < halfRounds; r++) {
    const reverseRound = rounds[r].map(fix => ({
      home: fix.away,
      away: fix.home,
      played: false,
      hg: 0, ag: 0, hxg: 0, axg: 0
    }));
    rounds.push(reverseRound);
  }

  return rounds;
}

// Helper to calculate distinct phase power breakdown for a side
function getTeamPhaseProfiles(starters) {
  if (starters.length === 0) return { ip: 40, oop: 40, tr: 40 };

  const sums = starters.reduce((acc, p) => {
    const sc = getPlayerPhaseScores(p);
    acc.ip += sc.ip;
    acc.oop += sc.oop;
    acc.tr += sc.tr;
    return acc;
  }, { ip: 0, oop: 0, tr: 0 });

  return {
    ip: sums.ip / starters.length,
    oop: sums.oop / starters.length,
    tr: sums.tr / starters.length
  };
}

function runRoundSimulation() {
  if (state.round > state.maxRounds) {
    alert("Season finished! Click 'START NEW SEASON' to begin the next campaign.");
    return false;
  }

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

      const hProfiles = getTeamPhaseProfiles(hStarters);
      const aProfiles = getTeamPhaseProfiles(aStarters);

      // Mentality and tempo modifiers
      const getTacticalMod = (tactics = {}) => {
        let attMod = 1.0;
        let defMod = 1.0;

        if (tactics.mentality === 'park the bus') { attMod -= 0.28; defMod += 0.22; }
        else if (tactics.mentality === 'defensive') { attMod -= 0.14; defMod += 0.12; }
        else if (tactics.mentality === 'attacking') { attMod += 0.14; defMod -= 0.10; }
        else if (tactics.mentality === 'overload')  { attMod += 0.28; defMod -= 0.20; }

        if (tactics.press === 'gegenpress')       { attMod += 0.08; defMod -= 0.04; }
        else if (tactics.press === 'low block')   { attMod -= 0.06; defMod += 0.08; }

        if (tactics.chanceCreation === 'shoot on sight') { attMod += 0.06; }
        else if (tactics.chanceCreation === 'work into box') { attMod += 0.04; }

        return { attMod, defMod };
      };

      const hTact = getTacticalMod(homeTeam.tactics);
      const aTact = getTacticalMod(awayTeam.tactics);

      // Dynamic match phase comparisons (Offense vs Defense + Transition battles)
      // Home advantage provides a +4% offensive bump and slight defensive edge
      const hAttackingPwr = ((hProfiles.ip * 0.60 + hProfiles.tr * 0.40) * 1.04) * hTact.attMod;
      const aDefendingPwr = (aProfiles.oop * 0.70 + aProfiles.tr * 0.30) * aTact.defMod;

      const aAttackingPwr = (aProfiles.ip * 0.60 + aProfiles.tr * 0.40) * aTact.attMod;
      const hDefendingPwr = ((hProfiles.oop * 0.70 + hProfiles.tr * 0.30) * 1.02) * hTact.defMod;

      // Net Rating Deltas determine base xG around a realistic 1.35 baseline
      // Spans realistically from ~0.4 xG to ~3.2 xG per match depending on quality and styles
      const hNetDelta = (hAttackingPwr - aDefendingPwr);
      const aNetDelta = (aAttackingPwr - hDefendingPwr);

      const homeMatchXg = 1.40 + (hNetDelta * 0.075) + randomGaussian(0, 0.35);
      const awayMatchXg = 1.15 + (aNetDelta * 0.075) + randomGaussian(0, 0.35);

      const hxg = Math.max(0.15, homeMatchXg);
      const axg = Math.max(0.12, awayMatchXg);

      // Poisson sample for discrete goals
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

      applyPlayerMinutes(homeTeam);
      applyPlayerMinutes(awayTeam);
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

function applyPlayerMinutes(team) {
  const starters = team.squad.filter(p => p.slot.startsWith('S'));
  const bench = team.squad.filter(p => p.slot.startsWith('B'));

  const subEligibleStarters = starters.filter(p => p.slot !== 'S1');
  const benchOutfield = bench.filter(p => !p.isGK);

  const maxSubs = Math.min(subEligibleStarters.length, benchOutfield.length, 3 + Math.floor(Math.random() * 3));
  const shuffledStarters = [...subEligibleStarters].sort(() => 0.5 - Math.random());
  const substitutedStarters = new Set(shuffledStarters.slice(0, maxSubs).map(p => p.id));

  starters.forEach(p => {
    const isSubbedOff = substitutedStarters.has(p.id);
    p.minutesPlayed += (isSubbedOff ? 65 : 90);
  });

  for (let i = 0; i < maxSubs; i++) {
    benchOutfield[i].minutesPlayed += 25;
  }
}

function resetSeasonClean() {
  for (let d = 1; d <= 10; d++) {
    state.tables[d].forEach(r => {
      r.p = 0; r.w = 0; r.d = 0; r.l = 0;
      r.gf = 0; r.ga = 0; r.gd = 0; r.pts = 0;
      r.xg = 0.0; r.xga = 0.0; r.xgd = 0.0;
      r.form = [];
    });
  }

  Object.values(state.teams).forEach(t => {
    t.squad.forEach(p => {
      p.minutesPlayed = 0;
    });
  });

  state.fixtures = generateFixtures(state.teams);
  state.season++;
  state.round = 1;

  saveGameState();
  return true;
}
