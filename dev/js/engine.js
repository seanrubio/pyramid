import { FORMATIONS, GK_ARCHETYPES, OUTFIELD_ARCHETYPES, BLUEPRINT_ARCHETYPE_MAP } from './constants.js';
import { randomGaussian, sampleChoice, sigmoid } from './math.js';

export function getCountry(DB, code) {
  return DB.countries.find(c => c.code === code) || { code: 'GB-ENG', name: 'England', flag: '🇬🇧', region: 'anglo' };
}

export function generatePlayerName(DB, region = 'anglo') {
  const pool = DB.namePools[region] || DB.namePools['anglo'];
  const first = pool.first[Math.floor(Math.random() * pool.first.length)];
  const last = pool.last[Math.floor(Math.random() * pool.last.length)];
  return `${first} ${last}`;
}

export function getPlayerPhaseScores(p) {
  const a = p.attributes;
  const ip = (a.proprioception * 0.20) + (a.dynamicPower * 0.15) + (a.bioenergetics * 0.075) + (a.scanning * 0.20) + (a.processing * 0.15) + (a.regulation * 0.075) + (a.grit * 0.075) + (a.stewardship * 0.075);
  const oop = (a.proprioception * 0.075) + (a.dynamicPower * 0.20) + (a.bioenergetics * 0.15) + (a.scanning * 0.15) + (a.processing * 0.075) + (a.regulation * 0.075) + (a.grit * 0.15) + (a.stewardship * 0.125);
  const tr = (a.proprioception * 0.15) + (a.dynamicPower * 0.15) + (a.bioenergetics * 0.20) + (a.scanning * 0.075) + (a.processing * 0.20) + (a.regulation * 0.075) + (a.grit * 0.075) + (a.stewardship * 0.075);
  return { ip, oop, tr };
}

export function createDefaultPlayerStats() {
  return {
    apps: 0,
    goals: 0,
    shots: 0,
    sot: 0,
    xg: 0.0,
    bigChancesCreated: 0,
    bigChancesComp: 0,
    bigChancesMissed: 0,
    assists: 0,
    xa: 0.0,
    passes: 0,
    passesComp: 0,
    keyPasses: 0,
    crosses: 0,
    crossesComp: 0,
    tackles: 0,
    tacklesWon: 0,
    interceptions: 0,
    aerialsContested: 0,
    aerialsWon: 0,
    saves: 0,
    shotsFaced: 0,
    cleanSheets: 0
  };
}

export function ensurePlayerStats(p) {
  if (!p.stats) p.stats = {};
  const defaults = createDefaultPlayerStats();
  for (const [k, v] of Object.entries(defaults)) {
    if (p.stats[k] === undefined) p.stats[k] = v;
  }
}

export function generatePlayer(DB, isGK, div, natCode = null) {
  const countryObj = natCode ? getCountry(DB, natCode) : DB.countries[Math.floor(Math.random() * DB.countries.length)];
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
    name: generatePlayerName(DB, countryObj.region),
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
    stats: createDefaultPlayerStats()
  };
}

export function createFullSquad(DB, team) {
  const squad = [];
  const div = team.div || 10;
  const style = team.tactics ? (team.tactics.chanceCreation || team.tactics.buildMid) : 'mixed';
  const press = team.tactics ? team.tactics.press : 'mid block';

  let favoredPool = BLUEPRINT_ARCHETYPE_MAP[style];
  if (!favoredPool && press === 'gegenpress') favoredPool = BLUEPRINT_ARCHETYPE_MAP['gegenpress'];

  for (let i = 0; i < 2; i++) squad.push(generatePlayer(DB, true, div));

  for (let i = 0; i < 21; i++) {
    const archetypeKey = (favoredPool && Math.random() < 0.65)
      ? sampleChoice(favoredPool)
      : sampleChoice(OUTFIELD_ARCHETYPES);

    const player = generatePlayer(DB, false, div);
    player.archetypeKey = archetypeKey;
    const arch = DB.archetypes[archetypeKey];
    player.archetypeName = arch.name;

    const tierMean = DB.tierConfig.base - (div * DB.tierConfig.slope);
    const assetCutoff = 1.65 * DB.tierConfig.archetypeSigma;
    const liabilityCutoff = 1.25 * DB.tierConfig.archetypeSigma;
    
    let talentDelta = 0;
    if (i === 0 || i === 6) talentDelta = 3.5;
    else if (i >= 17) talentDelta = -2.5;

    player.traits = [];
    for (const [pillar, weight] of Object.entries(arch.weights)) {
      const rawVal = (tierMean + talentDelta) + (weight * DB.tierConfig.archetypeSigma) + randomGaussian(0, DB.tierConfig.noiseSigma);
      const score = Math.max(1, Math.min(99, Math.round(rawVal)));
      player.attributes[pillar] = score;

      if (score >= tierMean + assetCutoff) player.traits.push(`[+${DB.traits[pillar].asset}]`);
      else if (score <= tierMean - liabilityCutoff) player.traits.push(`[-${DB.traits[pillar].liability}]`);
    }

    const baseMorph = DB.morphologyBaselines.outfield;
    player.morphology.heightCm = Math.round(randomGaussian(baseMorph.heightMean + arch.morph.heightDelta, baseMorph.heightStd));
    player.morphology.bmi = +(randomGaussian(baseMorph.bmiMean + arch.morph.bmiDelta, baseMorph.bmiStd)).toFixed(1);
    player.morphology.weightKg = Math.round(player.morphology.bmi * Math.pow(player.morphology.heightCm / 100, 2));

    const phaseScores = getPlayerPhaseScores(player);
    const getGlyph = (val) => (val >= tierMean + 1.5 ? "+" : val <= tierMean - 0.7 ? "-" : "✓");
    player.phaseGlyphs = `${getGlyph(phaseScores.ip)} / ${getGlyph(phaseScores.oop)} / ${getGlyph(phaseScores.tr)}`;

    squad.push(player);
  }

  return squad;
}

export function evaluateSlotFit(DB, player, role, blueprintKey) {
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
    if (bp.favoredArchetypes?.includes(arch)) baseFit += 5.0;
    if (bp.unfavoredArchetypes?.includes(arch)) baseFit -= 5.0;
    bp.keyPillars?.forEach(pillar => {
      if (a[pillar] >= 75) baseFit += 1.5;
      else if (a[pillar] <= 60) baseFit -= 1.5;
    });
  }
  return baseFit;
}

export function autoAssignLineup(DB, team) {
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

  const outfieldSlots = formRoles.slice(1).map((role, idx) => ({ role, slotCode: `S${idx + 2}` }));
  const getRolePriority = (role) => (role === 'CB' ? 1 : role === 'ST' ? 2 : ['DM', 'CM', 'AM'].includes(role) ? 3 : 4);
  outfieldSlots.sort((a, b) => getRolePriority(a.role) - getRolePriority(b.role));

  for (const slot of outfieldSlots) {
    if (availableOutfield.length === 0) break;
    availableOutfield.sort((a, b) => evaluateSlotFit(DB, b, slot.role, bpKey) - evaluateSlotFit(DB, a, slot.role, bpKey));
    const chosen = availableOutfield.shift();
    chosen.slot = slot.slotCode;
  }

  const remainingGKs = team.squad.filter(p => p.isGK && p.slot === 'RES');
  let benchIndex = 1;
  if (remainingGKs.length > 0) remainingGKs[0].slot = `B${benchIndex++}`;

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

export function validateLineup(team) {
  const starters = team.squad.filter(p => p.slot.startsWith('S'));
  if (starters.length !== 11) return { valid: false, error: `Lineup incomplete: ${starters.length}/11 starters assigned.` };
  const hasGk = starters.some(p => p.isGK);
  if (!hasGk) return { valid: false, error: 'No goalkeeper assigned in starting XI.' };
  return { valid: true };
}

export function generateFixtures(teams) {
  const fixtures = {};
  for (let d = 1; d <= 10; d++) {
    const divTeams = Object.values(teams).filter(t => t.div === d).map(t => t.id);
    fixtures[d] = buildRoundRobin(divTeams);
  }
  return fixtures;
}

export function buildRoundRobin(teamIds) {
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
      roundFixtures.push({ home, away, played: false, hg: 0, ag: 0, hxg: 0, axg: 0 });
    }
    rounds.push(roundFixtures);
    const fixed = pool[0];
    const rest = pool.slice(1);
    pool = [fixed, rest.pop(), ...rest];
  }

  for (let r = 0; r < halfRounds; r++) {
    const reverseRound = rounds[r].map(fix => ({
      home: fix.away, away: fix.home, played: false, hg: 0, ag: 0, hxg: 0, axg: 0
    }));
    rounds.push(reverseRound);
  }
  return rounds;
}

export function getPitchUnits(team) {
  const formRoles = FORMATIONS[team.formation] || FORMATIONS['4-4-2 Flat'];
  const starters = team.squad.filter(p => p.slot.startsWith('S'));

  const units = {
    gk: null, defenders: [], wideDefenders: [], defensiveMidfielders: [],
    midfielders: [], wideAttackers: [], playmakers: [], forwards: []
  };

  starters.forEach(p => {
    ensurePlayerStats(p);
    const slotIdx = parseInt(p.slot.replace('S', ''), 10) - 1;
    const role = formRoles[slotIdx] || 'CM';
    p.slotRole = role;

    if (role === 'GK') units.gk = p;
    else if (role === 'CB') units.defenders.push(p);
    else if (['LB', 'RB'].includes(role)) { units.defenders.push(p); units.wideDefenders.push(p); }
    else if (role === 'DM') { units.defensiveMidfielders.push(p); units.midfielders.push(p); }
    else if (['LM', 'RM', 'LW', 'RW'].includes(role)) { units.wideAttackers.push(p); units.midfielders.push(p); }
    else if (role === 'AM') { units.playmakers.push(p); units.midfielders.push(p); }
    else if (role === 'ST') units.forwards.push(p);
    else units.midfielders.push(p);
  });

  if (!units.gk) units.gk = starters.find(p => p.isGK) || starters[0];
  if (!units.forwards.length) units.forwards.push(units.midfielders[0] || starters[1]);
  if (!units.playmakers.length) units.playmakers.push(units.midfielders[0] || units.forwards[0]);
  if (!units.wideAttackers.length) units.wideAttackers.push(units.wideDefenders[0] || units.forwards[0]);

  return units;
}

export function runRoundSimulation(state) {
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

      let hMatchXg = 0.0, aMatchXg = 0.0, hGoals = 0, aGoals = 0;

      // Fixture-level report container (serialized directly on fix)
      const report = {
        homeStats: { shots: 0, sot: 0, passes: 0, passesComp: 0, tackles: 0, tacklesWon: 0, saves: 0 },
        awayStats: { shots: 0, sot: 0, passes: 0, passesComp: 0, tackles: 0, tacklesWon: 0, saves: 0 },
        homePlayers: {},
        awayPlayers: {}
      };

      const initReportPlayer = (side, player, slotRole, defaultMins = 90) => {
        if (!player) return;
        const bucket = side === 'home' ? report.homePlayers : report.awayPlayers;
        if (!bucket[player.id]) {
          bucket[player.id] = {
            id: player.id,
            name: player.name,
            slot: player.slot || '',
            slotRole: slotRole || 'SUB',
            isGK: !!player.isGK,
            minutes: defaultMins,
            goals: 0, assists: 0, shots: 0, xg: 0.0, xa: 0.0,
            passes: 0, passesComp: 0,
            tackles: 0, tacklesWon: 0,
            aerialsContested: 0, aerialsWon: 0,
            saves: 0
          };
        }
      };

      (homeTeam.squad || []).filter(p => p.slot && p.slot.startsWith('S')).forEach(p => initReportPlayer('home', p, p.slotRole, 90));
      (awayTeam.squad || []).filter(p => p.slot && p.slot.startsWith('S')).forEach(p => initReportPlayer('away', p, p.slotRole, 90));

      const recordPlayerAction = (side, player, actionKey, delta = 1) => {
        if (!player) return;
        const bucket = side === 'home' ? report.homePlayers : report.awayPlayers;
        if (!bucket[player.id]) initReportPlayer(side, player, player.slotRole || 'SUB', 25);
        if (actionKey === 'xg' || actionKey === 'xa') {
          bucket[player.id][actionKey] = parseFloat((bucket[player.id][actionKey] + delta).toFixed(2));
        } else {
          bucket[player.id][actionKey] = (bucket[player.id][actionKey] || 0) + delta;
        }
      };

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

      const hPossessions = Math.round(48 * getPaceMod(homeTeam) * 1.02);
      const aPossessions = Math.round(48 * getPaceMod(awayTeam));

      const resolveTeamPossession = (attTeam, defTeam, attUnits, defUnits, isHome) => {
        const sideKey = isHome ? 'home' : 'away';
        const oppSideKey = isHome ? 'away' : 'home';

        const pickPasser = () => {
          const r = Math.random();
          if (r < 0.25 && attUnits.defenders.length) return sampleChoice(attUnits.defenders);
          if (r < 0.82 && attUnits.midfielders.length) return sampleChoice(attUnits.midfielders);
          if (attUnits.forwards.length) return sampleChoice(attUnits.forwards);
          return sampleChoice(attUnits.midfielders);
        };

        const passer = pickPasser();
        let defender = sampleChoice(defUnits.defenders);

        passer.stats.passes++;
        report[sideKey + 'Stats'].passes++;
        recordPlayerAction(sideKey, passer, 'passes');

        const pickShooter = () => {
          const roll = Math.random();
          if (roll < 0.52 && attUnits.forwards.length) return sampleChoice(attUnits.forwards);
          if (roll < 0.78 && attUnits.wideAttackers.length) return sampleChoice(attUnits.wideAttackers);
          return sampleChoice(attUnits.midfielders);
        };

        const shooter = pickShooter();
        let creator = (passer.id !== shooter.id) ? passer : null;
        const creationStyle = attTeam.tactics.chanceCreation || 'mixed';
        const defPress = defTeam.tactics.press || 'mid block';
        let delta = 0;

        const hasWideOutlet = attUnits.wideAttackers.length > 0 || attUnits.wideDefenders.length > 0;
        const crossChance = (creationStyle === 'flank play') ? 0.65 : (hasWideOutlet ? 0.30 : 0.10);
        const isCrossDelivery = Math.random() < crossChance;

        if (isCrossDelivery && hasWideOutlet) {
          const widePool = attUnits.wideAttackers.length ? attUnits.wideAttackers : attUnits.wideDefenders;
          const crosser = sampleChoice(widePool);
          const fullback = defUnits.wideDefenders.length ? sampleChoice(defUnits.wideDefenders) : defender;
          creator = (crosser.id !== shooter.id) ? crosser : null;

          let flankBonus = (defPress === 'low block') ? 6.0 : (defPress === 'mid block' ? 3.0 : 0);
          const deliveryEdge = (crosser.attributes.proprioception + crosser.attributes.dynamicPower + flankBonus) -
                               (fullback.attributes.dynamicPower + fullback.attributes.grit);
          
          const aerialEdge = (shooter.morphology.heightCm * 0.25 + shooter.attributes.dynamicPower * 0.4) -
                             (defender.morphology.heightCm * 0.25 + defender.attributes.dynamicPower * 0.4);
          
          delta = (deliveryEdge * 0.4 + aerialEdge * 0.6);

          crosser.stats.crosses++;
          const crossAccProb = 0.26 + (deliveryEdge * 0.005);
          if (Math.random() < Math.max(0.15, Math.min(0.42, crossAccProb))) {
            crosser.stats.crossesComp++;
          }

          shooter.stats.aerialsContested++;
          defender.stats.aerialsContested++;
          recordPlayerAction(sideKey, shooter, 'aerialsContested');
          recordPlayerAction(oppSideKey, defender, 'aerialsContested');

          if (aerialEdge + randomGaussian(0, 6) >= 0) {
            shooter.stats.aerialsWon++;
            recordPlayerAction(sideKey, shooter, 'aerialsWon');
          } else {
            defender.stats.aerialsWon++;
            recordPlayerAction(oppSideKey, defender, 'aerialsWon');
          }

        } else if (creationStyle === 'balls in behind') {
          let depthDelta = 0;
          if (defPress === 'low block') depthDelta = -14.0;
          else if (defPress === 'gegenpress' || defPress === 'high press') depthDelta = 8.5;

          delta = (shooter.attributes.dynamicPower * 0.6 + shooter.attributes.bioenergetics * 0.4 + depthDelta) -
                  (defender.attributes.dynamicPower * 0.5 + defender.attributes.scanning * 0.5);

        } else if (creationStyle === 'central creator') {
          if (defUnits.defensiveMidfielders.length > 0 && Math.random() < 0.65) {
            defender = sampleChoice(defUnits.defensiveMidfielders);
          }

          const playmakerPool = (Math.random() < 0.65 && attUnits.playmakers.length) 
            ? attUnits.playmakers 
            : attUnits.midfielders;
          const candidate = sampleChoice(playmakerPool);
          creator = (candidate.id !== shooter.id) ? candidate : null;
          const playmaker = creator || passer;

          let congestionPenalty = (defPress === 'low block') ? 10.0 : (defPress === 'mid block' ? 5.0 : 0);
          const playmakerCreativeForce = (playmaker.attributes.scanning * 0.5 + playmaker.attributes.processing * 0.5) - congestionPenalty;
          const defenderResistance = (defender.attributes.scanning * 0.4 + defender.attributes.grit * 0.3 + defender.attributes.regulation * 0.3);
          delta = (playmakerCreativeForce - defenderResistance);

        } else {
          const creatorMid = sampleChoice(attUnits.midfielders);
          creator = (creatorMid.id !== shooter.id) ? creatorMid : null;
          let pressFriction = (defPress === 'gegenpress') ? 4.0 : 0;
          delta = (creatorMid.attributes.processing * 0.5 + shooter.attributes.proprioception * 0.5) -
                  (defender.attributes.scanning * 0.5 + defender.attributes.regulation * 0.5 + pressFriction);
        }

        delta += randomGaussian(0, 10);
        const shotProb = 0.18 * sigmoid(delta * 0.08) / 0.5;

        if (Math.random() > shotProb) {
          if (Math.random() < 0.45) {
            defender.stats.tackles++;
            report[oppSideKey + 'Stats'].tackles++;
            recordPlayerAction(oppSideKey, defender, 'tackles');

            const defTacklePower = (defender.attributes.grit * 0.55 + defender.attributes.dynamicPower * 0.45);
            const attDribblePower = (shooter.attributes.proprioception * 0.65 + shooter.attributes.dynamicPower * 0.35);
            const tckDelta = defTacklePower - attDribblePower;
            const tackleWinProb = 0.60 + (tckDelta * 0.008);
            if (Math.random() < Math.max(0.40, Math.min(0.80, tackleWinProb))) {
              defender.stats.tacklesWon++;
              report[oppSideKey + 'Stats'].tacklesWon++;
              recordPlayerAction(oppSideKey, defender, 'tacklesWon');
            }
          } else {
            defender.stats.interceptions++;
          }

          const passSuccessProb = 0.74 + ((passer.attributes.processing * 0.5 + passer.attributes.scanning * 0.5) * 0.002);
          if (Math.random() < Math.min(0.88, passSuccessProb)) {
            passer.stats.passesComp++;
            report[sideKey + 'Stats'].passesComp++;
            recordPlayerAction(sideKey, passer, 'passesComp');
          }
          return;
        }

        passer.stats.passesComp++;
        report[sideKey + 'Stats'].passesComp++;
        recordPlayerAction(sideKey, passer, 'passesComp');

        if (creator) creator.stats.keyPasses++;

        let shotXg = delta > 12 ? Math.min(0.38, 0.18 + ((delta - 12) * 0.006)) : (delta > 2 ? 0.12 : 0.045);
        const isBigChance = shotXg >= 0.30 || delta >= 12;

        if (isBigChance && creator) creator.stats.bigChancesCreated++;

        shooter.stats.shots += 1;
        shooter.stats.xg = parseFloat((shooter.stats.xg + shotXg).toFixed(2));
        if (creator && Math.random() < 0.65) {
          creator.stats.xa = parseFloat((creator.stats.xa + shotXg).toFixed(2));
          recordPlayerAction(sideKey, creator, 'xa', shotXg);
        }

        if (isHome) hMatchXg += shotXg;
        else aMatchXg += shotXg;

        report[sideKey + 'Stats'].shots++;
        recordPlayerAction(sideKey, shooter, 'shots');
        recordPlayerAction(sideKey, shooter, 'xg', shotXg);

        const gk = defUnits.gk;
        const shooterComposure = (shooter.attributes.processing * 0.5 + shooter.attributes.regulation * 0.5);
        const gkSkill = (gk.attributes.dynamicPower * 0.4 + gk.attributes.processing * 0.4 + gk.attributes.regulation * 0.2);
        const finishingEdge = Math.max(0.85, Math.min(1.20, shooterComposure / Math.max(1, gkSkill)));
        const goalProb = Math.max(0.015, Math.min(0.80, shotXg * finishingEdge));

        if (Math.random() < goalProb) {
          shooter.stats.goals += 1;
          shooter.stats.sot += 1;
          if (isBigChance) shooter.stats.bigChancesComp++;
          if (gk) gk.stats.shotsFaced++;

          report[sideKey + 'Stats'].sot++;
          recordPlayerAction(sideKey, shooter, 'goals');
          if (creator && Math.random() < 0.65) recordPlayerAction(sideKey, creator, 'assists');
          else if (passer && passer.id !== shooter.id && Math.random() < 0.15) recordPlayerAction(sideKey, passer, 'assists');

          if (creator && Math.random() < 0.65) creator.stats.assists += 1;
          else if (passer && passer.id !== shooter.id && Math.random() < 0.15) passer.stats.assists += 1;
          
          if (isHome) hGoals += 1;
          else aGoals += 1;
        } else if (Math.random() < 0.55) {
          shooter.stats.sot += 1;
          if (isBigChance) shooter.stats.bigChancesMissed++;

          report[sideKey + 'Stats'].sot++;
          if (gk) {
            gk.stats.saves += 1;
            gk.stats.shotsFaced++;
            report[oppSideKey + 'Stats'].saves++;
            recordPlayerAction(oppSideKey, gk, 'saves');
          }
        } else {
          if (isBigChance) shooter.stats.bigChancesMissed++;
        }
      };

      const performPitchSubstitutions = (team, units, side) => {
        const bench = (team.squad || []).filter(p => p.slot && p.slot.startsWith('B') && !p.isGK);
        if (!bench.length) return;
        const numSubs = Math.min(bench.length, 2);
        for (let s = 0; s < numSubs; s++) {
          const freshSub = bench[s];
          ensurePlayerStats(freshSub);

          let outgoing = null;
          if (units.midfielders.length > 2) outgoing = units.midfielders.pop();
          else if (units.defenders.length > 3) outgoing = units.defenders.pop();
          else if (units.forwards.length > 1) outgoing = units.forwards.pop();

          if (outgoing) {
            units.midfielders.push(freshSub);
            const bucket = side === 'home' ? report.homePlayers : report.awayPlayers;
            if (bucket[outgoing.id]) bucket[outgoing.id].minutes = 65;
            initReportPlayer(side, freshSub, 'SUB', 25);
          }
        }
      };

      // PHASE 1: Minutes 0 - 65
      const hPhase1 = Math.round(hPossessions * 0.70);
      const aPhase1 = Math.round(aPossessions * 0.70);
      for (let i = 0; i < hPhase1; i++) resolveTeamPossession(homeTeam, awayTeam, hUnits, aUnits, true);
      for (let i = 0; i < aPhase1; i++) resolveTeamPossession(awayTeam, homeTeam, aUnits, hUnits, false);

      // PHASE 2: Substitutions
      performPitchSubstitutions(homeTeam, hUnits, 'home');
      performPitchSubstitutions(awayTeam, aUnits, 'away');

      // PHASE 3: Minutes 65 - 90
      for (let i = hPhase1; i < hPossessions; i++) resolveTeamPossession(homeTeam, awayTeam, hUnits, aUnits, true);
      for (let i = aPhase1; i < aPossessions; i++) resolveTeamPossession(awayTeam, homeTeam, aUnits, hUnits, false);

      fix.hg = hGoals;
      fix.ag = aGoals;
      fix.hxg = parseFloat(Math.max(0.1, hMatchXg).toFixed(1));
      fix.axg = parseFloat(Math.max(0.1, aMatchXg).toFixed(1));
      fix.played = true;
      fix.report = report; // Stamped directly on the fixture object

      if (aGoals === 0) {
        (homeTeam.squad || []).filter(p => p.slot && p.slot.startsWith('S')).forEach(p => {
          if (p.isGK || ['CB', 'LB', 'RB'].includes(p.slotRole)) p.stats.cleanSheets++;
        });
      }
      if (hGoals === 0) {
        (awayTeam.squad || []).filter(p => p.slot && p.slot.startsWith('S')).forEach(p => {
          if (p.isGK || ['CB', 'LB', 'RB'].includes(p.slotRole)) p.stats.cleanSheets++;
        });
      }

      updateTableRecord(state, d, homeTeam.id, hGoals, aGoals, fix.hxg, fix.axg);
      updateTableRecord(state, d, awayTeam.id, aGoals, hGoals, fix.axg, fix.hxg);

      applyPlayerMinutes(homeTeam);
      applyPlayerMinutes(awayTeam);
    });
  }

  state.round++;
  return true;
}

export function sortTableEntries(entries) {
  return [...entries].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    if (b.w !== a.w) return b.w - a.w;
    return a.name.localeCompare(b.name);
  });
}

export function updateTableRecord(state, div, teamId, gf, ga, xg, xga) {
  const row = state.tables[div]?.find(r => r.teamId === teamId);
  if (!row) return;

  row.p++;
  row.gf += gf;
  row.ga += ga;
  row.gd = row.gf - row.ga;
  row.xg = parseFloat((row.xg + xg).toFixed(1));
  row.xga = parseFloat((row.xga + xga).toFixed(1));
  row.xgd = parseFloat((row.xg - row.xga).toFixed(1));

  if (!Array.isArray(row.form)) row.form = [];

  if (gf > ga) {
    row.w++;
    row.pts += 3;
    row.form.push('W');
  } else if (gf === ga) {
    row.d++;
    row.pts += 1;
    row.form.push('D');
  } else {
    row.l++;
    row.form.push('L');
  }

  if (row.form.length > 5) {
    row.form.shift();
  }
}

export function applyPlayerMinutes(team) {
  const starters = team.squad.filter(p => p.slot.startsWith('S'));
  const bench = team.squad.filter(p => p.slot.startsWith('B'));
  const subEligibleStarters = starters.filter(p => p.slot !== 'S1');
  const benchOutfield = bench.filter(p => !p.isGK);

  const maxSubs = Math.min(subEligibleStarters.length, benchOutfield.length, 3 + Math.floor(Math.random() * 3));
  const shuffledStarters = [...subEligibleStarters].sort(() => 0.5 - Math.random());
  const substitutedStarters = new Set(shuffledStarters.slice(0, maxSubs).map(p => p.id));

  starters.forEach(p => {
    ensurePlayerStats(p);
    p.stats.apps++;
    p.minutesPlayed += (substitutedStarters.has(p.id) ? 65 : 90);
  });

  for (let i = 0; i < maxSubs; i++) {
    const sub = benchOutfield[i];
    ensurePlayerStats(sub);
    sub.stats.apps++;
    sub.minutesPlayed += 25;
  }
}

export function resetSeasonClean(state) {
  // 1. Identify Promoted & Relegated Clubs via Tiebreakers
  const promotions = {};
  const relegations = {};

  for (let d = 1; d <= 10; d++) {
    const sorted = sortTableEntries(state.tables[d]);
    if (d > 1) {
      promotions[d] = sorted.slice(0, 3).map(e => e.teamId);
    }
    if (d < 10) {
      relegations[d] = sorted.slice(-3).map(e => e.teamId);
    }
  }

  // 2. Reassign Team Division Properties
  for (let d = 2; d <= 10; d++) {
    (promotions[d] || []).forEach(teamId => {
      state.teams[teamId].div = d - 1;
    });
  }
  for (let d = 1; d <= 9; d++) {
    (relegations[d] || []).forEach(teamId => {
      state.teams[teamId].div = d + 1;
    });
  }

  // 3. Dynamically Reconstruct Standings Tables for New Division Alignments
  state.tables = {};
  for (let d = 1; d <= 10; d++) {
    state.tables[d] = Object.values(state.teams)
      .filter(t => t.div === d)
      .map(t => ({
        teamId: t.id,
        name: t.name,
        p: 0, w: 0, d: 0, l: 0,
        gf: 0, ga: 0, gd: 0,
        pts: 0,
        xg: 0.0, xga: 0.0, xgd: 0.0,
        form: []
      }));
  }

  // 4. Reset Player Seasonal Minutes & Outings
  Object.values(state.teams).forEach(t => {
    t.squad.forEach(p => {
      p.minutesPlayed = 0;
      p.stats = createDefaultPlayerStats();
    });
  });

  // 5. Generate Fresh 38-Round Balanced Schedule & Increment Season
  state.fixtures = generateFixtures(state.teams);
  state.season++;
  state.round = 1;
}
