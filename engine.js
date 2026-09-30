// --- SIMULATION ENGINE (DISCRETE PLAYER-LEVEL DUEL ENGINE) ---

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

function getPlayerPhaseScores(p) {
  const a = p.attributes;
  const ip = (a.proprioception * 0.20) + (a.dynamicPower * 0.15) + (a.bioenergetics * 0.075) + (a.scanning * 0.20) + (a.processing * 0.15) + (a.regulation * 0.075) + (a.grit * 0.075) + (a.stewardship * 0.075);
  const oop = (a.proprioception * 0.075) + (a.dynamicPower * 0.20) + (a.bioenergetics * 0.15) + (a.scanning * 0.15) + (a.processing * 0.075) + (a.regulation * 0.075) + (a.grit * 0.15) + (a.stewardship * 0.125);
  const tr = (a.proprioception * 0.15) + (a.dynamicPower * 0.15) + (a.bioenergetics * 0.20) + (a.scanning * 0.075) + (a.processing * 0.20) + (a.regulation * 0.075) + (a.grit * 0.075) + (a.stewardship * 0.075);
  return { ip, oop, tr };
}

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

  const baseMorph = isGK ? DB.morphologyBaselines.goalkeeper : DB.morphologyBaselines.outfield;
  const heightCm = Math.round(randomGaussian(baseMorph.heightMean + archetype.morph.heightDelta, baseMorph.heightStd));
  const bmi = +(randomGaussian(baseMorph.bmiMean + archetype.morph.bmiDelta, baseMorph.bmiStd)).toFixed(1);
  const weightKg = Math.round(bmi * Math.pow(heightCm / 100, 2));

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
    slot: 'RES',
    stats: {
      goals: 0,
      assists: 0,
      shots: 0,
      xg: 0.0,
      xa: 0.0,
      tackles: 0,
      saves: 0
    }
  };
}

// --- engine.js (Blueprint-Aware Squad Generation) ---

const BLUEPRINT_ARCHETYPE_PREFERENCES = {
  'flank play': {
    WING: ['speed_merchant', 'direct_winger'],
    ST: ['target', 'poacher'],
    FB: ['wing_back', 'inverted_fullback'],
    MID: ['box_to_box', 'deep_lying_creator']
  },
  'balls in behind': {
    ST: ['runner_in_behind', 'pressing_forward'],
    WING: ['speed_merchant', 'inside_forward'],
    MID: ['artist', 'deep_lying_creator'],
    CB: ['sweeper_stopper', 'ball_playing_cb']
  },
  'central creator': {
    MID: ['artist', 'deep_lying_creator', 'tempo_dictator'],
    ST: ['false_nine', 'poacher'],
    WING: ['inside_forward', 'wide_target'],
    CB: ['ball_playing_cb', 'stopper']
  },
  'patient possession': {
    MID: ['tempo_dictator', 'artist', 'deep_lying_creator'],
    CB: ['ball_playing_cb'],
    FB: ['inverted_fullback'],
    ST: ['false_nine', 'target']
  },
  'gegenpress': {
    MID: ['engine', 'ball_winner', 'box_to_box'],
    ST: ['pressing_forward', 'runner_in_behind'],
    WING: ['pressing_winger', 'direct_winger'],
    CB: ['stopper', 'aggressive_stopper']
  }
};

function createFullSquad(team) {
  const squad = [];
  const div = team.div || 10;
  const baseMean = DB.tierConfig.base - (div * DB.tierConfig.slope);

  // Positional skeleton for 23-man squad
  const squadPlan = [
    { role: 'GK', count: 2 },
    { role: 'CB', count: 4 },
    { role: 'FB', count: 4 },
    { role: 'MID', count: 6 },
    { role: 'WING', count: 4 },
    { role: 'ST', count: 3 }
  ];

  // Tactical bias mapping
  const style = team.tactics ? (team.tactics.chanceCreation || team.tactics.buildMid) : 'mixed';
  const press = team.tactics ? team.tactics.press : 'mid block';
  const targetPrefs = BLUEPRINT_ARCHETYPE_PREFERENCES[style] || 
                      (press === 'gegenpress' ? BLUEPRINT_ARCHETYPE_PREFERENCES['gegenpress'] : null);

  // Club recruitment coherence (70% well-aligned, 30% mixed/mismatched)
  const recruitmentCoherence = 0.35 + (Math.random() * 0.45);

  let squadIndex = 0;

  squadPlan.forEach(group => {
    for (let i = 0; i < group.count; i++) {
      let chosenArchetype = null;

      // Check if blueprint favors specific archetypes for this position
      const favoredList = targetPrefs && targetPrefs[group.role];
      if (favoredList && Math.random() < recruitmentCoherence) {
        const matchingArchetypes = favoredList.filter(key => DB.archetypes[key]);
        if (matchingArchetypes.length) {
          chosenArchetype = sampleChoice(matchingArchetypes);
        }
      }

      // Fallback: pick any archetype valid for this role
      if (!chosenArchetype) {
        const available = Object.keys(DB.archetypes).filter(key => DB.archetypes[key].pos === group.role);
        chosenArchetype = available.length ? sampleChoice(available) : Object.keys(DB.archetypes)[0];
      }

      // Natural talent spine: assign 2-3 marquee players, core starters, and raw depth
      let talentModifier = 0;
      if (squadIndex === 2 || squadIndex === 10 || squadIndex === 20) {
        // Spine standouts (Star striker / playmaker / defender)
        talentModifier = 3.5; 
      } else if (squadIndex >= 16) {
        // Bench depth / developing reserves
        talentModifier = -2.5;
      }

      const playerTierMean = baseMean + talentModifier;
      const player = generatePlayer(chosenArchetype, playerTierMean, team.id);
      squad.push(player);
      squadIndex++;
    }
  });

  return squad;
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

function getPitchUnits(team) {
  const formRoles = FORMATIONS[team.formation] || FORMATIONS['4-4-2 Flat'];
  const starters = team.squad.filter(p => p.slot.startsWith('S'));

  const units = {
    gk: null,
    defenders: [],
    wideDefenders: [],
    midfielders: [],
    wideAttackers: [],
    playmakers: [],
    forwards: []
  };

  starters.forEach(p => {
    const slotIdx = parseInt(p.slot.replace('S', ''), 10) - 1;
    const role = formRoles[slotIdx] || 'CM';

    if (role === 'GK') units.gk = p;
    else if (role === 'CB') units.defenders.push(p);
    else if (['LB', 'RB'].includes(role)) {
      units.defenders.push(p);
      units.wideDefenders.push(p);
    } else if (['LM', 'RM', 'LW', 'RW'].includes(role)) {
      units.wideAttackers.push(p);
      units.midfielders.push(p);
    } else if (role === 'AM') {
      units.playmakers.push(p);
      units.midfielders.push(p);
    } else if (role === 'ST') {
      units.forwards.push(p);
    } else {
      units.midfielders.push(p);
    }
  });

  if (!units.gk) units.gk = starters.find(p => p.isGK) || starters[0];
  if (!units.forwards.length) units.forwards.push(units.midfielders[0] || starters[1]);
  if (!units.playmakers.length) units.playmakers.push(units.midfielders[0] || units.forwards[0]);
  if (!units.wideAttackers.length) units.wideAttackers.push(units.wideDefenders[0] || units.forwards[0]);

  return units;
}

function sampleChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- engine.js (Empirical Rate-Anchored Match Loop) ---

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
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

      const hUnits = getPitchUnits(homeTeam);
      const aUnits = getPitchUnits(awayTeam);

      let hMatchXg = 0.0;
      let aMatchXg = 0.0;
      let hGoals = 0;
      let aGoals = 0;

      // Base: 48 possessions per team, modulated +/- 10% by tactical mentality
      const getPaceMod = (t) => {
        let p = 1.0;
        if (t.tactics.mentality === 'attacking') p += 0.08;
        if (t.tactics.mentality === 'overload') p += 0.15;
        if (t.tactics.mentality === 'defensive') p -= 0.08;
        if (t.tactics.mentality === 'park the bus') p -= 0.15;
        if (t.tactics.press === 'gegenpress') p += 0.05;
        if (t.tactics.press === 'low block') p -= 0.05;
        return p;
      };

      const hPossessions = Math.round(48 * getPaceMod(homeTeam) * 1.02); // 2% home territory
      const aPossessions = Math.round(48 * getPaceMod(awayTeam));

      const resolveTeamPossession = (attTeam, defTeam, attUnits, defUnits, isHome) => {
        const passer = sampleChoice(attUnits.midfielders);
        const defender = sampleChoice(defUnits.defenders);

        const pickShooter = () => {
          const roll = Math.random();
          if (roll < 0.52 && attUnits.forwards.length) return sampleChoice(attUnits.forwards);
          if (roll < 0.78 && attUnits.wideAttackers.length) return sampleChoice(attUnits.wideAttackers);
          return sampleChoice(attUnits.midfielders);
        };

        const shooter = pickShooter();
        let creator = (passer.id !== shooter.id) ? passer : null;
        const creationStyle = attTeam.tactics.chanceCreation || 'mixed';

        // 1. DUEL ADVANTAGE DELTA (Attacker vs Defender)
        let delta = 0;

        if (creationStyle === 'flank play') {
          const winger = sampleChoice(attUnits.wideAttackers.length ? attUnits.wideAttackers : attUnits.midfielders);
          const fullback = sampleChoice(defUnits.wideDefenders.length ? defUnits.wideDefenders : defUnits.defenders);
          creator = winger;

          const deliveryEdge = (winger.attributes.proprioception + winger.attributes.dynamicPower) -
                               (fullback.attributes.dynamicPower + fullback.attributes.grit);
          const aerialEdge = (shooter.morphology.heightCm * 0.25 + shooter.attributes.dynamicPower * 0.4) -
                             (defender.morphology.heightCm * 0.25 + defender.attributes.dynamicPower * 0.4);
          delta = (deliveryEdge * 0.4 + aerialEdge * 0.6);

        } else if (creationStyle === 'balls in behind') {
          let lowBlockShield = (defTeam.tactics.press === 'low block') ? 12 : 0;
          delta = (shooter.attributes.dynamicPower * 0.6 + shooter.attributes.bioenergetics * 0.4) -
                  (defender.attributes.dynamicPower * 0.5 + defender.attributes.scanning * 0.5 + lowBlockShield);

        } else if (creationStyle === 'central creator') {
          const playmaker = sampleChoice(attUnits.playmakers.length ? attUnits.playmakers : attUnits.midfielders);
          creator = (playmaker.id !== shooter.id) ? playmaker : null;
          delta = (playmaker.attributes.scanning * 0.5 + playmaker.attributes.processing * 0.5) -
                  (defender.attributes.scanning * 0.6 + defender.attributes.grit * 0.4);

        } else {
          // Tiki-Taka / Combination
          const creatorMid = sampleChoice(attUnits.midfielders);
          creator = (creatorMid.id !== shooter.id) ? creatorMid : null;
          delta = (creatorMid.attributes.processing * 0.5 + shooter.attributes.proprioception * 0.5) -
                  (defender.attributes.scanning * 0.5 + defender.attributes.regulation * 0.5);
        }

        // Add random in-match duel noise
        delta += randomGaussian(0, 10);

        // 2. SHOT PROBABILITY (Real-world baseline = 18% of possessions result in a shot)
        // Sigmoid mapping: delta = 0 -> 18% shot rate; delta = +15 -> 28% shot rate; delta = -15 -> 10% shot rate
        const shotProb = 0.18 * sigmoid(delta * 0.08) / 0.5;

        if (Math.random() > shotProb) {
          defender.stats.tackles += 1;
          return; // Tackled, intercepted, or cleared. NO SHOT.
        }

        // 3. SHOT QUALITY (xG anchored to real-world 0.105 baseline)
        let shotXg = 0.04; // Contested baseline
        if (delta > 12) {
          shotXg = Math.min(0.38, 0.18 + ((delta - 12) * 0.006)); // Clear-cut breakaway / open box header
        } else if (delta > 2) {
          shotXg = 0.12; // Solid box attempt
        } else {
          shotXg = 0.045; // Pressed attempt under heavy coverage
        }

        // Record individual player stats
        shooter.stats.shots += 1;
        shooter.stats.xg = parseFloat((shooter.stats.xg + shotXg).toFixed(2));
        if (creator) {
          creator.stats.xa = parseFloat((creator.stats.xa + shotXg).toFixed(2));
        }

        if (isHome) hMatchXg += shotXg;
        else aMatchXg += shotXg;

        // 4. GOALKEEPER DUEL & FINISHING
        const gk = defUnits.gk;
        const shooterComposure = (shooter.attributes.processing * 0.5 + shooter.attributes.regulation * 0.5);
        const gkSkill = (gk.attributes.dynamicPower * 0.4 + gk.attributes.processing * 0.4 + gk.attributes.regulation * 0.2);
        const finishingEdge = Math.max(0.85, Math.min(1.20, shooterComposure / Math.max(1, gkSkill)));

        const goalProb = Math.max(0.015, Math.min(0.80, shotXg * finishingEdge));

        if (Math.random() < goalProb) {
          shooter.stats.goals += 1;
          if (creator) creator.stats.assists += 1;
          if (isHome) hGoals += 1;
          else aGoals += 1;
        } else {
          gk.stats.saves += 1;
        }
      };

      // Run home and away possessions
      for (let i = 0; i < hPossessions; i++) {
        resolveTeamPossession(homeTeam, awayTeam, hUnits, aUnits, true);
      }
      for (let i = 0; i < aPossessions; i++) {
        resolveTeamPossession(awayTeam, homeTeam, aUnits, hUnits, false);
      }

      fix.hg = hGoals;
      fix.ag = aGoals;
      fix.hxg = parseFloat(Math.max(0.1, hMatchXg).toFixed(1));
      fix.axg = parseFloat(Math.max(0.1, aMatchXg).toFixed(1));
      fix.played = true;

      updateTableRecord(d, homeTeam.id, hGoals, aGoals, fix.hxg, fix.axg);
      updateTableRecord(d, awayTeam.id, aGoals, hGoals, fix.axg, fix.hxg);

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
      p.stats = { goals: 0, assists: 0, shots: 0, xg: 0.0, xa: 0.0, tackles: 0, saves: 0 };
    });
  });

  state.fixtures = generateFixtures(state.teams);
  state.season++;
  state.round = 1;

  saveGameState();
  return true;
}
