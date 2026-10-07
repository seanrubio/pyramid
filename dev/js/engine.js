import { FORMATIONS, GK_ARCHETYPES, OUTFIELD_ARCHETYPES, BLUEPRINT_ARCHETYPE_MAP } from './constants.js';
import { randomGaussian, sampleChoice, sigmoid } from './math.js';

export const CUP_ROUND_LABELS = [
  'Round 1',
  'Round of 128',
  'Round of 64',
  'Round of 32',
  'Round of 16',
  'Quarterfinal',
  'Semifinal',
  'Universal Cup Final'
];

const DEV_PROFILES = [
  { key: 'normal', weight: 0.82 },
  { key: 'physical_freak', weight: 0.03 },
  { key: 'late_bloomer', weight: 0.04 },
  { key: 'early_peaker', weight: 0.03 },
  { key: 'old_soul', weight: 0.03 },
  { key: 'hothead', weight: 0.05 }
];

function assignDevProfileForArchetype(archetypeKey) {
  let weights = { ...DEV_PROFILES.reduce((acc, p) => ({ ...acc, [p.key]: p.weight }), {}) };

  const technicalArchetypes = ['artist', 'pocket_player', 'anticipator', 'gk_possession_platform'];
  const physicalArchetypes = ['runner_in_behind', 'two_way', 'soldier', 'disrupter'];
  const calmArchetypes = ['steady_eddy', 'organizer'];

  if (technicalArchetypes.includes(archetypeKey)) {
    weights.late_bloomer += 0.08;
    weights.physical_freak -= 0.02;
  }
  if (physicalArchetypes.includes(archetypeKey)) {
    weights.early_peaker += 0.06;
    weights.physical_freak += 0.04;
    weights.hothead += 0.03;
  }
  if (calmArchetypes.includes(archetypeKey)) {
    weights.hothead = 0.00;
    weights.old_soul += 0.07;
  }

  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  let r = Math.random() * total;

  for (const [key, weight] of Object.entries(weights)) {
    r -= weight;
    if (r <= 0) return key;
  }
  return 'normal';
}

export function getCountry(DB, code) {
  return DB.countries.find(c => c.code === code) || { code: 'GB-ENG', name: 'England', flag: '🇬🇧', region: 'anglo' };
}

function weightedChoice(arr) {
  if (!arr || arr.length === 0) return '';
  const weights = arr.map((_, index) => 1 / (index + 2));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  
  let randomVal = Math.random() * totalWeight;
  for (let i = 0; i < arr.length; i++) {
    randomVal -= weights[i];
    if (randomVal <= 0) {
      return arr[i];
    }
  }
  return arr[0];
}

export function generatePlayerName(DB, countryCode = 'US') {
  const pool = DB.namePools[countryCode] || DB.namePools['US'] || Object.values(DB.namePools)[0];
  const first = weightedChoice(pool.first);
  const last = weightedChoice(pool.last);
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
    apps: 0, goals: 0, shots: 0, sot: 0, xg: 0.0,
    bigChancesCreated: 0, bigChancesComp: 0, bigChancesMissed: 0,
    assists: 0, xa: 0.0, passes: 0, passesComp: 0,
    keyPasses: 0, crosses: 0, crossesComp: 0,
    tackles: 0, tacklesWon: 0, interceptions: 0,
    aerialsContested: 0, aerialsWon: 0, saves: 0, shotsFaced: 0, cleanSheets: 0
  };
}

export function ensurePlayerStats(p) {
  if (!p.stats) p.stats = {};
  if (!p.stats.league) p.stats.league = createDefaultPlayerStats();
  if (!p.stats.regional) p.stats.regional = createDefaultPlayerStats();
  if (!p.stats.cup) p.stats.cup = createDefaultPlayerStats();
}

export function getCompetitionPlayerStats(p, comp = 'league') {
  ensurePlayerStats(p);
  return p.stats[comp] || p.stats.league;
}

export function generatePlayer(DB, isGK, div, natCode = null, forcedArchetypeKey = null, talentDelta = 0) {
  const countryObj = natCode ? getCountry(DB, natCode) : DB.countries[Math.floor(Math.random() * DB.countries.length)];
  const pool = isGK ? GK_ARCHETYPES : OUTFIELD_ARCHETYPES;
  const archetypeKey = forcedArchetypeKey || sampleChoice(pool);
  const archetype = DB.archetypes[archetypeKey];

  const tierMean = DB.tierConfig.base - (div * DB.tierConfig.slope);
  const potentialAbility = Math.min(99, Math.round(tierMean + randomGaussian(10, 4)));
  const devProfile = assignDevProfileForArchetype(archetypeKey);
  
  const attributes = {};
  const traits = [];

  const assetCutoff = 1.65 * DB.tierConfig.archetypeSigma;
  const liabilityCutoff = 1.25 * DB.tierConfig.archetypeSigma;

  for (const [pillar, weight] of Object.entries(archetype.weights)) {
    const rawVal = (tierMean + talentDelta) + (weight * DB.tierConfig.archetypeSigma) + randomGaussian(0, DB.tierConfig.noiseSigma);
    const score = Math.max(1, Math.min(99, Math.round(rawVal)));
    attributes[pillar] = score;

    if (score >= tierMean + assetCutoff) traits.push(`[+${DB.traits[pillar].asset}]`);
    else if (score <= tierMean - liabilityCutoff) traits.push(`[-${DB.traits[pillar].liability}]`);
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
    name: generatePlayerName(DB, countryObj.code),
    nat: countryObj.code,
    isGK,
    archetypeKey,
    archetypeName: archetype.name,
    age: 18 + Math.floor(Math.random() * 16),
    morphology: { heightCm, weightKg, bmi },
    potentialAbility,
    devProfile,
    attributes,
    traits,
    phaseGlyphs,
    condition: 90 + Math.floor(Math.random() * 11),
    minutesPlayed: 0,
    slot: null,
    stats: {
      league: createDefaultPlayerStats(),
      regional: createDefaultPlayerStats(),
      cup: createDefaultPlayerStats()
    }
  };
}

export function createFullSquad(DB, team) {
  const squad = [];
  const div = team.div || 10;
  const style = team.tactics ? (team.tactics.chanceCreation || team.tactics.buildMid) : 'mixed';
  const press = team.tactics ? team.tactics.press : 'mid block';

  const city = DB.cities?.find(c => c.id === team.id || c.name === team.name);
  const domesticNat = team.country || city?.country || 'US';

  let favoredPool = BLUEPRINT_ARCHETYPE_MAP[style];
  if (!favoredPool && press === 'gegenpress') favoredPool = BLUEPRINT_ARCHETYPE_MAP['gegenpress'];

  for (let i = 0; i < 2; i++) {
    squad.push(generatePlayer(DB, true, div, domesticNat));
  }

  for (let i = 0; i < 21; i++) {
    const archetypeKey = (favoredPool && Math.random() < 0.65) ? sampleChoice(favoredPool) : sampleChoice(OUTFIELD_ARCHETYPES);
    let talentDelta = 0;
    if (i === 0 || i === 6) talentDelta = 3.5;
    else if (i >= 17) talentDelta = -2.5;

    const player = generatePlayer(DB, false, div, domesticNat, archetypeKey, talentDelta);
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
  team.squad.forEach(p => p.slot = null);
  const bpKey = team.tactics ? team.tactics.blueprint : null;
  const bp = (bpKey && DB.tacticalBlueprints) ? DB.tacticalBlueprints[bpKey] : null;

  // Exclude injured, suspended, or severely fatigued players (condition < 50) unless desperate
  let availablePlayers = team.squad.filter(p => !p.isInjured && !p.isSuspended && !p.hasRedCard && p.condition >= 50);
  if (availablePlayers.length < 15) {
    availablePlayers = team.squad.filter(p => !p.isInjured && !p.isSuspended && !p.hasRedCard);
  }

  const availableKeepers = availablePlayers.filter(p => p.isGK);
  if (availableKeepers.length > 0) {
    availableKeepers.sort((a, b) => {
      let scoreA = (a.attributes.dynamicPower * 0.4) + (a.attributes.processing * 0.4) + (a.attributes.scanning * 0.2) + (a.condition * 0.1);
      let scoreB = (b.attributes.dynamicPower * 0.4) + (b.attributes.processing * 0.4) + (b.attributes.scanning * 0.2) + (b.condition * 0.1);
      if (bp && bp.favoredGk) {
        if (a.archetypeKey === bp.favoredGk) scoreA += 8.0;
        if (b.archetypeKey === bp.favoredGk) scoreB += 8.0;
      }
      return scoreB - scoreA;
    });
    availableKeepers[0].slot = 'S1';
  }

  const formRoles = FORMATIONS[team.formation] || FORMATIONS['4-4-2 Flat'];
  let availableOutfield = availablePlayers.filter(p => !p.isGK);

  const outfieldSlots = formRoles.slice(1).map((role, idx) => ({ role, slotCode: `S${idx + 2}` }));
  const getRolePriority = (role) => (role === 'CB' ? 1 : role === 'ST' ? 2 : ['DM', 'CM', 'AM'].includes(role) ? 3 : 4);
  outfieldSlots.sort((a, b) => getRolePriority(a.role) - getRolePriority(b.role));

  for (const slot of outfieldSlots) {
    if (availableOutfield.length === 0) break;
    // Factor condition into AI fit scoring so rested players get rotated in
    availableOutfield.sort((a, b) => {
      const fitB = evaluateSlotFit(DB, b, slot.role, bpKey) + (b.condition * 0.05);
      const fitA = evaluateSlotFit(DB, a, slot.role, bpKey) + (a.condition * 0.05);
      return fitB - fitA;
    });
    const chosen = availableOutfield.shift();
    chosen.slot = slot.slotCode;
  }

  const remainingGKs = availablePlayers.filter(p => p.isGK && !p.slot);
  let benchIndex = 1;
  if (remainingGKs.length > 0) remainingGKs[0].slot = `B${benchIndex++}`;

  const remainingOutfield = availablePlayers.filter(p => !p.isGK && !p.slot);
  remainingOutfield.sort((a, b) => {
    const scoreA = (a.attributes.bioenergetics * 0.4) + (a.condition * 0.3);
    const scoreB = (b.attributes.bioenergetics * 0.4) + (b.condition * 0.3);
    return scoreB - scoreA;
  });

  while (benchIndex <= 9 && remainingOutfield.length > 0) {
    remainingOutfield.shift().slot = `B${benchIndex++}`;
  }
}

export function validateLineup(team) {
  const starters = team.squad.filter(p => p.slot && p.slot.startsWith('S'));
  if (starters.length !== 11) return { valid: false, error: `Lineup incomplete: ${starters.length}/11 starters assigned.` };
  const hasGk = starters.some(p => p.isGK);
  if (!hasGk) return { valid: false, error: 'No goalkeeper assigned in starting XI.' };
  
  // ---> Check BOTH starters AND bench players (any active slot S# or B#)
  const allMatchDayPlayers = team.squad.filter(p => p.slot && (p.slot.startsWith('S') || p.slot.startsWith('B')));
  const unauthorizedPlayers = allMatchDayPlayers.filter(p => p.isInjured || p.isSuspended || p.hasRedCard);
  
  if (unauthorizedPlayers.length > 0) {
    const names = unauthorizedPlayers.map(p => p.name).join(', ');
    return { valid: false, error: `Cannot include unavailable players in matchday squad: ${names}` };
  }

  return { valid: true };
}

export function buildRoundRobin(teamIds) {
  let pool = [...teamIds];
  const hasGhost = (pool.length % 2 !== 0);
  if (hasGhost) pool.push('__BYE__');

  const n = pool.length;
  const halfRounds = n - 1;
  const matchesPerRound = n / 2;
  const rounds = [];

  for (let r = 0; r < halfRounds; r++) {
    const roundFixtures = [];
    for (let i = 0; i < matchesPerRound; i++) {
      let t1 = pool[i];
      let t2 = pool[n - 1 - i];
      if (t1 === '__BYE__' || t2 === '__BYE__') continue;
      let home = t1, away = t2;
      if (i === 0) {
        if (r % 2 === 1) { home = t2; away = t1; }
      } else {
        if ((i + r) % 2 === 1) { home = t2; away = t1; }
      }
      roundFixtures.push({ home, away, played: false, hg: 0, ag: 0, hxg: 0, axg: 0, comp: 'league' });
    }
    rounds.push(roundFixtures);
    const fixed = pool[0];
    const rest = pool.slice(1);
    pool = [fixed, rest.pop(), ...rest];
  }

  const secondHalf = rounds.map(r => r.map(fix => ({
    ...fix, home: fix.away, away: fix.home, played: false, hg: 0, ag: 0, hxg: 0, axg: 0
  })));

  return [...rounds, ...secondHalf];
}

export function generateUniversalCupR1(teams, prevSeasonByes = null) {
  const allIds = Object.keys(teams);
  let byeIds = [];

  if (prevSeasonByes && prevSeasonByes.length === 56) {
    byeIds = [...prevSeasonByes];
  } else {
    const div1 = allIds.filter(id => teams[id].div === 1);
    const div2 = allIds.filter(id => teams[id].div === 2);
    const div3 = allIds.filter(id => teams[id].div === 3);
    const shuffledDiv3 = [...div3].sort(() => Math.random() - 0.5);
    byeIds = [...div1, ...div2, ...shuffledDiv3.slice(0, 16)];
  }

  const byeSet = new Set(byeIds);
  const r1Pool = allIds.filter(id => !byeSet.has(id)).sort(() => Math.random() - 0.5);

  const r1Matches = [];
  for (let i = 0; i < r1Pool.length; i += 2) {
    r1Matches.push({
      id: `cup_r1_m${i/2 + 1}`,
      roundIndex: 0,
      roundName: CUP_ROUND_LABELS[0],
      home: r1Pool[i],
      away: r1Pool[i + 1],
      played: false,
      hg: 0, ag: 0, hxg: 0, axg: 0,
      winner: null,
      comp: 'cup'
    });
  }

  return {
    byes: byeIds,
    rounds: [
      r1Matches,
      [], [], [], [], [], [], []
    ]
  };
}

export function generateMasterCalendar(teams, cupState = null) {
  const calendar = {};
  for (let w = 1; w <= 52; w++) {
    calendar[w] = { 1: null, 2: null, 3: null, 4: null };
  }

  for (let w = 1; w <= 4; w++) {
    for (let m = 1; m <= 4; m++) {
      calendar[w][m] = {
        type: 'window',
        name: (w === 1) ? 'Internal Renewals' : 'Open Market Window',
        subtext: (w === 1) ? 'Negotiate squad extensions' : 'Sign free agents and finalize squad'
      };
    }
  }

  const cupGroups = {};
  Object.values(teams).forEach(t => {
    if (t.regionalCup) {
      if (!cupGroups[t.regionalCup]) cupGroups[t.regionalCup] = [];
      cupGroups[t.regionalCup].push(t.id);
    }
  });

  const regionalSchedules = {};
  for (const [cupName, memberIds] of Object.entries(cupGroups)) {
    const rr = buildRoundRobin(memberIds);
    rr.forEach(round => round.forEach(m => { m.comp = 'regional'; m.cupName = cupName; }));
    regionalSchedules[cupName] = rr;
  }

  const regionalSlots = [];
  for (let w = 5; w <= 16; w++) {
    regionalSlots.push({ week: w, moment: 2 });
    regionalSlots.push({ week: w, moment: 4 });
  }

  for (let sIdx = 0; sIdx < regionalSlots.length; sIdx++) {
    const { week, moment } = regionalSlots[sIdx];
    const fixturesInSlot = [];

    for (const [cupName, rounds] of Object.entries(regionalSchedules)) {
      if (sIdx < rounds.length && rounds[sIdx]) {
        fixturesInSlot.push(...rounds[sIdx]);
      }
    }

    if (fixturesInSlot.length > 0) {
      calendar[week][moment] = {
        type: 'match',
        comp: 'regional',
        matches: fixturesInSlot
      };
    } else {
      calendar[week][moment] = {
        type: 'training',
        comp: 'regional',
        name: 'Dedicated Training Session',
        isMoment2Slot: (moment === 2)
      };
    }
  }

  for (let w = 5; w <= 16; w++) {
    calendar[w][1] = { type: 'training', comp: 'regional', name: 'Tactical Preparation' };
    calendar[w][3] = { type: 'training', comp: 'regional', name: 'Tactical Preparation' };
  }

  for (let w = 17; w <= 20; w++) {
    for (let m = 1; m <= 4; m++) {
      calendar[w][m] = {
        type: 'window',
        name: 'Secondary Transfer Window',
        subtext: 'Mid-season market active'
      };
    }
  }

  const leagueRoundRobin = {};
  for (let d = 1; d <= 10; d++) {
    const divTeams = Object.values(teams).filter(t => t.div === d).map(t => t.id);
    leagueRoundRobin[d] = buildRoundRobin(divTeams);
  }

  const leagueMidweeks = [24, 28, 32, 37, 42, 47, 51];
  const leagueMidweekSet = new Set(leagueMidweeks);
  const cupMidweeks = [22, 26, 30, 35, 40, 45, 49];
  const cupMidweekSet = new Set(cupMidweeks);

  let leagueRoundCounter = 0;
  for (let w = 21; w <= 51; w++) {
    calendar[w][1] = { type: 'training', comp: 'league', name: 'Training Slot' };
    calendar[w][3] = { type: 'training', comp: 'league', name: 'Training Slot' };

    if (leagueMidweekSet.has(w)) {
      const currentRnd = leagueRoundCounter++;
      const matches = [];
      for (let d = 1; d <= 10; d++) {
        const rndFixtures = leagueRoundRobin[d][currentRnd] || [];
        matches.push(...rndFixtures.map(f => ({ ...f, leagueRound: currentRnd + 1, div: d })));
      }
      calendar[w][2] = { type: 'match', comp: 'league', leagueRound: currentRnd + 1, matches };
    } else if (cupMidweekSet.has(w)) {
      const cupRndIdx = cupMidweeks.indexOf(w);
      const roundLabel = CUP_ROUND_LABELS[cupRndIdx] || `Round ${cupRndIdx + 1}`;
      calendar[w][2] = {
        type: 'match',
        comp: 'cup',
        cupRoundIndex: cupRndIdx,
        cupRoundName: roundLabel,
        matches: cupState?.rounds?.[cupRndIdx] || []
      };
    } else {
      calendar[w][2] = {
        type: 'training',
        comp: 'league',
        name: 'Dedicated Training Slot',
        isMoment2Slot: true
      };
    }

    const weekendRnd = leagueRoundCounter++;
    const weekendMatches = [];
    for (let d = 1; d <= 10; d++) {
      const rndFixtures = leagueRoundRobin[d][weekendRnd] || [];
      weekendMatches.push(...rndFixtures.map(f => ({ ...f, leagueRound: weekendRnd + 1, div: d })));
    }
    calendar[w][4] = { type: 'match', comp: 'league', leagueRound: weekendRnd + 1, matches: weekendMatches };
  }

  calendar[52][1] = { type: 'training', comp: 'cup', name: 'Cup Final Preparation' };
  calendar[52][2] = { type: 'training', comp: 'cup', name: 'Cup Final Preparation' };
  calendar[52][3] = { type: 'training', comp: 'cup', name: 'Cup Final Preparation' };
  calendar[52][4] = {
    type: 'match',
    comp: 'cup',
    cupRoundIndex: 7,
    cupRoundName: CUP_ROUND_LABELS[7],
    matches: cupState?.rounds?.[7] || []
  };

  return calendar;
}

export function getCurrentCalendarSlot(state) {
  return state.calendar?.[state.week]?.[state.moment] || null;
}

export function getCalendarPhaseName(state) {
  const w = state.week;
  if (w === 1) return 'Transfer Window';
  if (w <= 4) return 'Transfer Window';
  if (w <= 16) return 'Regional Cup';
  if (w <= 20) return 'Transfer Window';
  if (w <= 51) return 'Pyramid League & Universal Cup';
  return 'Universal Cup Final';
}

export function getPitchUnits(team) {
  const formRoles = FORMATIONS[team.formation] || FORMATIONS['4-4-2 Flat'];
  const starters = team.squad.filter(p => p.slot && p.slot.startsWith('S') && !p.isInjured && !p.isSuspended);

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

export function applyMatchMinutes(team, matchSubs = [], comp = 'league') {
  const starters = team.squad.filter(p => p.slot && p.slot.startsWith('S'));
  const subbedOutIds = new Set(matchSubs.map(s => s.outgoingId));
  const subbedInIds = new Set(matchSubs.map(s => s.incomingId));

  starters.forEach(p => {
    ensurePlayerStats(p);
    const st = getCompetitionPlayerStats(p, comp);
    st.apps++;
    const subRecord = matchSubs.find(s => s.outgoingId === p.id);
    const playedMins = subRecord ? subRecord.minute : 90;
    p.minutesPlayed += playedMins;
  });

  (team.squad || []).filter(p => subbedInIds.has(p.id)).forEach(sub => {
    ensurePlayerStats(sub);
    const st = getCompetitionPlayerStats(sub, comp);
    st.apps++;
    const subRecord = matchSubs.find(s => s.incomingId === sub.id);
    const playedMins = subRecord ? (90 - subRecord.minute) : 25;
    sub.minutesPlayed += playedMins;
  });
}

export function simulateSingleFixture(homeTeam, awayTeam, comp = 'league') {
  const hUnits = getPitchUnits(homeTeam);
  const aUnits = getPitchUnits(awayTeam);

  let hMatchXg = 0.0, aMatchXg = 0.0, hGoals = 0, aGoals = 0;

  const report = {
    homeStats: { shots: 0, sot: 0, passes: 0, passesComp: 0, tackles: 0, tacklesWon: 0, saves: 0 },
    awayStats: { shots: 0, sot: 0, passes: 0, passesComp: 0, tackles: 0, tacklesWon: 0, saves: 0 },
    homePlayers: {},
    awayPlayers: {}
  };

  // Reset match-day red card flags from previous fixtures
  [homeTeam, awayTeam].forEach(team => {
    (team.squad || []).forEach(p => {
      p.hasRedCard = false;
    });
  });

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
        passes: 0, passesComp: 0, tackles: 0, tacklesWon: 0,
        aerialsContested: 0, aerialsWon: 0, saves: 0
      };
    }
  };

  (homeTeam.squad || []).filter(p => p.slot && p.slot.startsWith('S') && !p.isInjured && !p.isSuspended).forEach(p => initReportPlayer('home', p, p.slotRole, 90));
  (awayTeam.squad || []).filter(p => p.slot && p.slot.startsWith('S') && !p.isInjured && !p.isSuspended).forEach(p => initReportPlayer('away', p, p.slotRole, 90));

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

  const hTotalPossessions = Math.round(48 * getPaceMod(homeTeam) * 1.02);
  const aTotalPossessions = Math.round(48 * getPaceMod(awayTeam));
  const maxPossessions = Math.max(hTotalPossessions, aTotalPossessions);

  const subState = {
    home: { count: 0, windowsUsed: 0, lastSubMinute: -99 },
    away: { count: 0, windowsUsed: 0, lastSubMinute: -99 }
  };

  const matchSubsRecord = { home: [], away: [] };
  const homeSubbedOut = new Set();
  const homeSubbedIn = new Set();
  const awaySubbedOut = new Set();
  const awaySubbedIn = new Set();
  
  const matchEventsTimeline = [];

  const logMatchEvent = (side, type, minute, details) => {
    matchEventsTimeline.push({ side, type, minute, ...details });
  };

  const resolveTeamPossession = (attTeam, defTeam, attUnits, defUnits, isHome, currentMinute) => {
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
    const passStat = getCompetitionPlayerStats(passer, comp);

    passStat.passes++;
    report[sideKey + 'Stats'].passes++;
    recordPlayerAction(sideKey, passer, 'passes');

    const pickShooter = () => {
      const roll = Math.random();
      if (roll < 0.52 && attUnits.forwards.length) return sampleChoice(attUnits.forwards);
      if (roll < 0.78 && attUnits.wideAttackers.length) return sampleChoice(attUnits.wideAttackers);
      return sampleChoice(attUnits.midfielders);
    };

    const shooter = pickShooter();
    const shooterStat = getCompetitionPlayerStats(shooter, comp);
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

      const crosserStat = getCompetitionPlayerStats(crosser, comp);
      crosserStat.crosses++;
      const crossAccProb = 0.26 + (deliveryEdge * 0.005);
      if (Math.random() < Math.max(0.15, Math.min(0.42, crossAccProb))) crosserStat.crossesComp++;

      const defStat = getCompetitionPlayerStats(defender, comp);
      shooterStat.aerialsContested++;
      defStat.aerialsContested++;
      recordPlayerAction(sideKey, shooter, 'aerialsContested');
      recordPlayerAction(oppSideKey, defender, 'aerialsContested');

      if (aerialEdge + randomGaussian(0, 6) >= 0) {
        shooterStat.aerialsWon++;
        recordPlayerAction(sideKey, shooter, 'aerialsWon');
      } else {
        defStat.aerialsWon++;
        recordPlayerAction(oppSideKey, defender, 'aerialsWon');
      }
    } else if (creationStyle === 'balls in behind') {
      let depthDelta = 0;
      if (defPress === 'low block') depthDelta = -14.0;
      else if (defPress === 'gegenpress' || defPress === 'high press') depthDelta = 8.5;

      delta = (shooter.attributes.dynamicPower * 0.6 + shooter.attributes.bioenergetics * 0.4 + depthDelta) -
              (defender.attributes.dynamicPower * 0.5 + defender.attributes.scanning * 0.5);
    } else if (creationStyle === 'central creator') {
      if (defUnits.defensiveMidfielders.length > 0 && Math.random() < 0.65) defender = sampleChoice(defUnits.defensiveMidfielders);
      const candidate = sampleChoice(attUnits.playmakers.length ? attUnits.playmakers : attUnits.midfielders);
      creator = (candidate.id !== shooter.id) ? candidate : null;
      const playmaker = creator || passer;

      let congestionPenalty = (defPress === 'low block') ? 10.0 : (defPress === 'mid block' ? 5.0 : 0);
      const creativeForce = (playmaker.attributes.scanning * 0.5 + playmaker.attributes.processing * 0.5) - congestionPenalty;
      const defResist = (defender.attributes.scanning * 0.4 + defender.attributes.grit * 0.3 + defender.attributes.regulation * 0.3);
      delta = creativeForce - defResist;
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
      const defStat = getCompetitionPlayerStats(defender, comp);
      if (Math.random() < 0.45) {
        defStat.tackles++;
        report[oppSideKey + 'Stats'].tackles++;
        recordPlayerAction(oppSideKey, defender, 'tackles');

        const defTckPower = (defender.attributes.grit * 0.55 + defender.attributes.dynamicPower * 0.45);
        const attDribble = (shooter.attributes.proprioception * 0.65 + shooter.attributes.dynamicPower * 0.35);
        const tckWinProb = 0.60 + ((defTckPower - attDribble) * 0.008);
        if (Math.random() < Math.max(0.40, Math.min(0.80, tckWinProb))) {
          defStat.tacklesWon++;
          report[oppSideKey + 'Stats'].tacklesWon++;
          recordPlayerAction(oppSideKey, defender, 'tacklesWon');
        }

        const regulation = defender.attributes.regulation || 50;
        if (!defender.hasRedCard && Math.random() < (0.038 + (100 - regulation) * 0.007)) {
          if (!defender.hasYellowCard) {
            defender.hasYellowCard = true;
            logMatchEvent(oppSideKey, 'yellow_card', currentMinute, { player: defender.name });
          } else {
            if (Math.random() < 0.35) {
              defender.hasRedCard = true;
              defender.isSuspended = true;
              defender.suspensionMatchesRemaining = 1;
              logMatchEvent(oppSideKey, 'red_card', currentMinute, { player: defender.name });
              const oppBucket = (oppSideKey === 'home') ? report.homePlayers : report.awayPlayers;
              if (oppBucket[defender.id]) {
                oppBucket[defender.id].minutes = currentMinute;
            }
          }
        }
      } 
        
        else {
        defStat.interceptions++;
      }

      const passSuccessProb = 0.74 + ((passer.attributes.processing * 0.5 + passer.attributes.scanning * 0.5) * 0.002);
      if (Math.random() < Math.min(0.88, passSuccessProb)) {
        passStat.passesComp++;
        report[sideKey + 'Stats'].passesComp++;
        recordPlayerAction(sideKey, passer, 'passesComp');
      }
      return;
    }

    passStat.passesComp++;
    report[sideKey + 'Stats'].passesComp++;
    recordPlayerAction(sideKey, passer, 'passesComp');

    const creatorStat = creator ? getCompetitionPlayerStats(creator, comp) : null;
    if (creatorStat) creatorStat.keyPasses++;

    let shotXg = delta > 12 ? Math.min(0.38, 0.18 + ((delta - 12) * 0.006)) : (delta > 2 ? 0.12 : 0.045);
    const isBigChance = shotXg >= 0.30 || delta >= 12;
    if (isBigChance && creatorStat) creatorStat.bigChancesCreated++;

    shooterStat.shots += 1;
    shooterStat.xg = parseFloat((shooterStat.xg + shotXg).toFixed(2));
    if (creatorStat && Math.random() < 0.65) {
      creatorStat.xa = parseFloat((creatorStat.xa + shotXg).toFixed(2));
      recordPlayerAction(sideKey, creator, 'xa', shotXg);
    }

    if (isHome) hMatchXg += shotXg;
    else aMatchXg += shotXg;

    report[sideKey + 'Stats'].shots++;
    recordPlayerAction(sideKey, shooter, 'shots');
    recordPlayerAction(sideKey, shooter, 'xg', shotXg);

    const gk = defUnits.gk;
    const gkStat = gk ? getCompetitionPlayerStats(gk, comp) : null;
    const shooterComposure = (shooter.attributes.processing * 0.5 + shooter.attributes.regulation * 0.5);
    const gkSkill = (gk.attributes.dynamicPower * 0.4 + gk.attributes.processing * 0.4 + gk.attributes.regulation * 0.2);
    const finishingEdge = Math.max(0.85, Math.min(1.20, shooterComposure / Math.max(1, gkSkill)));
    const goalProb = Math.max(0.015, Math.min(0.80, shotXg * finishingEdge));

    if (Math.random() < goalProb) {
      shooterStat.goals += 1;
      shooterStat.sot += 1;
      if (isBigChance) shooterStat.bigChancesComp++;
      if (gkStat) gkStat.shotsFaced++;

      report[sideKey + 'Stats'].sot++;
      recordPlayerAction(sideKey, shooter, 'goals');
      
      logMatchEvent(sideKey, 'goal', currentMinute, { scorer: shooter.name });

      let assisterPlayer = null;
      if (creator && Math.random() < 0.65) {
        recordPlayerAction(sideKey, creator, 'assists');
        assisterPlayer = creator;
      } else if (passer && passer.id !== shooter.id && Math.random() < 0.15) {
        recordPlayerAction(sideKey, passer, 'assists');
        assisterPlayer = passer;
      }

      if (creatorStat && Math.random() < 0.65) {
        creatorStat.assists += 1;
        assisterPlayer = creator;
      } else if (passer && passer.id !== shooter.id && Math.random() < 0.15) {
        getCompetitionPlayerStats(passer, comp).assists += 1;
        assisterPlayer = passer;
      }

      if (assisterPlayer) {
        logMatchEvent(sideKey, 'assist', currentMinute, { assister: assisterPlayer.name, scorer: shooter.name });
      }

      if (isHome) hGoals += 1;
      else aGoals += 1;
    } else if (Math.random() < 0.55) {
      shooterStat.sot += 1;
      if (isBigChance) shooterStat.bigChancesMissed++;
      report[sideKey + 'Stats'].sot++;
      if (gkStat) {
        gkStat.saves += 1;
        gkStat.shotsFaced++;
        report[oppSideKey + 'Stats'].saves++;
        recordPlayerAction(oppSideKey, gk, 'saves');
      }
    } else {
      if (isBigChance) shooterStat.bigChancesMissed++;
    }
  };

  const findArchetypeSmartSub = (bench, outgoingPlayer, teamScore, oppScore, tick, maxTicks) => {
    const isWinningLate = (tick >= Math.round(maxTicks * 0.70)) && (teamScore > oppScore);
    const isChasingGoal = (tick >= Math.round(maxTicks * 0.60)) && (teamScore < oppScore);

    let subIndex = -1;

    if (outgoingPlayer.isGK) {
      subIndex = bench.findIndex(p => p.isGK && p.id !== outgoingPlayer.id);
      if (subIndex === -1 && bench.length > 0) {
        subIndex = bench.findIndex(p => !p.isGK && p.id !== outgoingPlayer.id && (p.archetypeKey === 'target' || p.archetypeKey === 'soldier' || p.archetypeKey === 'steady_eddy'));
        if (subIndex === -1) subIndex = bench.findIndex(p => !p.isGK && p.id !== outgoingPlayer.id);
        if (subIndex !== -1) bench[subIndex].isEmergencyGK = true;
      }
    } else if (isChasingGoal && (outgoingPlayer.archetypeKey === 'soldier' || outgoingPlayer.archetypeKey === 'steady_eddy')) {
      subIndex = bench.findIndex(p => !p.isGK && p.id !== outgoingPlayer.id && ['artist', 'dribblinho', 'pocket_player', 'runner_in_behind'].includes(p.archetypeKey));
    } else if (isWinningLate && ['dribblinho', 'artist', 'pocket_player'].includes(outgoingPlayer.archetypeKey)) {
      subIndex = bench.findIndex(p => !p.isGK && p.id !== outgoingPlayer.id && ['two_way', 'soldier', 'disrupter'].includes(p.archetypeKey));
    }

    if (subIndex === -1) {
      subIndex = bench.findIndex(p => !p.isGK && p.id !== outgoingPlayer.id && p.slotRole === outgoingPlayer.slotRole);
    }

    if (subIndex === -1) {
      subIndex = bench.findIndex(p => !p.isGK && p.id !== outgoingPlayer.id);
    }

    if (subIndex !== -1) {
      return bench[subIndex];
    }
    return null;
  };

  const executeSubstitution = (team, units, side, candidate, freshSub, minute, maxTicks, isHalftimeWindow = false) => {
    if (subState[side].count >= 5) return false;
    if (!isHalftimeWindow && subState[side].windowsUsed >= 3) return false;
    
    if (!candidate || !freshSub || candidate.id === freshSub.id) return false;

    let targetList = null;
    const isNowGK = candidate.isGK || freshSub.isEmergencyGK;
    const unitKeys = isNowGK ? ['gk'] : ['midfielders', 'defenders', 'wideDefenders', 'defensiveMidfielders', 'wideAttackers', 'playmakers', 'forwards'];
    
    if (isNowGK) {
      targetList = units.gk ? [units.gk] : null;
      units.gk = freshSub;
    } else {
      for (const unitKey of unitKeys) {
        if (units[unitKey]?.some(p => p.id === candidate.id)) {
          targetList = units[unitKey];
          break;
        }
      }
    }

    if (targetList || isNowGK) {
      if (!isNowGK && targetList) {
        const idx = targetList.findIndex(p => p.id === candidate.id);
        if (idx !== -1) {
          targetList[idx] = freshSub;
        }
      }

      // REMOVED: Re-assigning .slot permanently during match simulation!
      // freshSub.slot = candidate.slot;
      // candidate.slot = null;

      matchSubsRecord[side].push({ outgoingId: candidate.id, incomingId: freshSub.id, minute });
      logMatchEvent(side, 'substitution', minute, { out: candidate.name, in: freshSub.name });

      subState[side].count++;
      if (!isHalftimeWindow) subState[side].windowsUsed++;

      const bucket = side === 'home' ? report.homePlayers : report.awayPlayers;
      if (bucket[candidate.id]) bucket[candidate.id].minutes = minute;
      initReportPlayer(side, freshSub, candidate.slotRole || 'SUB', Math.round(90 - minute));
      return true;
    }
    return false;
  };

  const evaluateDynamicSub = (team, units, side, tick, maxTicks, isHalftime = false, teamScore = 0, oppScore = 0, subbedOutIds, subbedInIds) => {
    const currentMinute = Math.round((tick / maxTicks) * 90);

    const starters = team.squad.filter(p => ((p.slot && p.slot.startsWith('S')) || p.isGK || (units.gk && units.gk.id === p.id)) && !subbedOutIds.has(p.id));
    
    const bench = (team.squad || []).filter(p => p.slot && p.slot.startsWith('B') && !subbedOutIds.has(p.id) && !subbedInIds.has(p.id));
    if (!bench.length) return;

    if (subState[side].count >= 5) return;
    if (!isHalftime && subState[side].windowsUsed >= 3) return;
    if (!isHalftime && currentMinute < 10) return;

    const emergencyCandidate = (currentMinute >= 5) ? starters.find(p => p.isInjured === true) : null;
    
    const isPastHourMark = isHalftime || currentMinute >= 55;
    const canUseTacticalWindow = isHalftime || (currentMinute - subState[side].lastSubMinute >= 4);
    
    const subThreshold = team.tactics?.subThreshold || 75;
    
    let candidate = emergencyCandidate || ((isPastHourMark && canUseTacticalWindow) ? starters.find(p => p.condition <= subThreshold && !p.isInjured && !p.hasRedCard && !p.isGK) : null);

    // Increased late-game tactical rotation probability (70% instead of 35% after 70')
    if (!candidate && isPastHourMark && canUseTacticalWindow && currentMinute >= 75 && subState[side].count < 5) {
      const eligibleStarters = starters.filter(p => !p.isInjured && !p.hasRedCard).sort((a, b) => a.condition - b.condition);
      if (eligibleStarters.length > 0 && Math.random() < 0.90) {
        candidate = eligibleStarters[0];
      }
    }

    if (!candidate || subbedOutIds.has(candidate.id)) return;

    const freshSub = findArchetypeSmartSub(bench, candidate, teamScore, oppScore, tick, maxTicks);
    if (!freshSub || subbedInIds.has(freshSub.id)) return;

    subbedOutIds.add(candidate.id);
    subbedInIds.add(freshSub.id);

    if (!isHalftime && !emergencyCandidate) {
      subState[side].lastSubMinute = currentMinute;
    }

    executeSubstitution(team, units, side, candidate, freshSub, currentMinute, maxTicks, isHalftime);
  };

 const applyConditionDecayAndCheckSubs = (team, units, side, currentMinute) => {
    const starters = team.squad.filter(p => p.slot && p.slot.startsWith('S'));
    const pressStyle = team.tactics?.press || 'mid block';
    let pressMultiplier = pressStyle === 'gegenpress' ? 1.3 : (pressStyle === 'high press' ? 1.1 : 0.9);

    starters.forEach(p => {
      if (p.condition === undefined) p.condition = 95;
      const bio = p.attributes?.bioenergetics || 70;
      const bioFactor = Math.max(0.7, 1.3 - (bio / 100));
      const decayMult = p.isGK ? 0.12 : pressMultiplier;
      const decay = 0.35 * pressMultiplier * bioFactor;
      p.condition = Math.max(20, parseFloat((p.condition - decay).toFixed(2)));

      // --- CONTINUOUS INJURY RISK MODEL ---
      if (!p.isInjured) {
        // Base risk per tick + fatigue multiplier + bioenergetics vulnerability
        const fatigueSeverity = Math.max(1.0, (100 - p.condition) / 25); // Scales up as condition drops
        const bioVulnerability = Math.max(0.8, 1.8 - (bio / 70));        // Lower bio = higher risk
        const pressStrain = pressStyle === 'gegenpress' ? 1.3 : 1.0;

        // Combined probability per tick
        const injuryProbability = 0.00045 * fatigueSeverity * bioVulnerability * pressStrain;

        if (Math.random() < injuryProbability) {
          p.isInjured = true;
          // Severity scales slightly with how fatigued they were when it happened
          const maxWeeks = p.condition < 60 ? 4 : 2;
          p.injuryWeeksRemaining = Math.floor(Math.random() * maxWeeks) + 1;
          logMatchEvent(side, 'injury', currentMinute, { player: p.name });
        }
      } // <--- THIS CLOSING BRACE WAS MISSING
    });
  };
  
  const halftimeTick = Math.round(maxPossessions / 2);

  let homeRemaining = hTotalPossessions;
  let awayRemaining = aTotalPossessions;

  for (let tick = 1; tick <= maxPossessions; tick++) {
    const currentMinute = Math.round((tick / maxPossessions) * 90);

    if (tick === halftimeTick) {
      evaluateDynamicSub(homeTeam, hUnits, 'home', tick, maxPossessions, true, hGoals, aGoals, homeSubbedOut, homeSubbedIn);
      evaluateDynamicSub(awayTeam, aUnits, 'away', tick, maxPossessions, true, aGoals, hGoals, awaySubbedOut, awaySubbedIn);
    }

    if (homeRemaining > 0) {
      applyConditionDecayAndCheckSubs(homeTeam, hUnits, 'home', currentMinute);
      evaluateDynamicSub(homeTeam, hUnits, 'home', tick, maxPossessions, false, hGoals, aGoals, homeSubbedOut, homeSubbedIn);
      resolveTeamPossession(homeTeam, awayTeam, hUnits, aUnits, true, currentMinute);
      homeRemaining--;
    }
    if (awayRemaining > 0) {
      applyConditionDecayAndCheckSubs(awayTeam, hUnits, 'away', currentMinute);
      evaluateDynamicSub(awayTeam, hUnits, 'away', tick, maxPossessions, false, aGoals, hGoals, awaySubbedOut, awaySubbedIn);
      resolveTeamPossession(awayTeam, homeTeam, aUnits, hUnits, false, currentMinute);
      awayRemaining--;
    }
  }

  if (aGoals === 0) {
    (homeTeam.squad || []).filter(p => p.slot && p.slot.startsWith('S')).forEach(p => {
      if (p.isGK || ['CB', 'LB', 'RB'].includes(p.slotRole)) getCompetitionPlayerStats(p, comp).cleanSheets++;
    });
  }
  if (hGoals === 0) {
    (awayTeam.squad || []).filter(p => p.slot && p.slot.startsWith('S')).forEach(p => {
      if (p.isGK || ['CB', 'LB', 'RB'].includes(p.slotRole)) getCompetitionPlayerStats(p, comp).cleanSheets++;
    });
  }

  applyMatchMinutes(homeTeam, matchSubsRecord.home, comp);
  applyMatchMinutes(awayTeam, matchSubsRecord.away, comp);

  let winner = null;
  if (comp === 'cup') {
    if (hGoals > aGoals) winner = homeTeam.id;
    else if (aGoals > hGoals) winner = awayTeam.id;
    else {
      winner = Math.random() < 0.5 ? homeTeam.id : awayTeam.id;
      report.penaltyWinner = winner;
    }
  }

  return {
    hg: hGoals,
    ag: aGoals,
    hxg: parseFloat(Math.max(0.1, hMatchXg).toFixed(1)),
    axg: parseFloat(Math.max(0.1, aMatchXg).toFixed(1)),
    report,
    winner,
    matchEventsTimeline
  };
}

export function updateTableRecord(tables, groupKey, teamId, gf, ga, xg, xga) {
  const row = tables[groupKey]?.find(r => r.teamId === teamId);
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
    row.w++; row.pts += 3; row.form.push('W');
  } else if (gf === ga) {
    row.d++; row.pts += 1; row.form.push('D');
  } else {
    row.l++; row.form.push('L');
  }
  if (row.form.length > 5) row.form.shift();
}

export function applyRestRecovery(state) {
  Object.values(state.teams).forEach(team => {
    (team.squad || []).forEach(p => {
      if (p.isInjured) return; // Injured players recover via injury timeline
      if (p.condition === undefined) p.condition = 90;
      
      const bio = p.attributes?.bioenergetics || 70;
      const recovery = (bio / 20);
      p.condition = Math.min(100, parseFloat((p.condition + recovery).toFixed(2)));
    });
  });
}

export function advanceMomentSimulation(state, DB) {
  if (state.week > 52) {
    alert("Season complete! Start a new season to proceed.");
    return false;
  }

  const slot = getCurrentCalendarSlot(state);

  if (slot && slot.type === 'match' && slot.matches && slot.matches.length > 0) {
    const userTeam = state.teams[state.userTeamId];
    const userMatch = slot.matches.find(m => m.home === state.userTeamId || m.away === state.userTeamId);

    if (userMatch) {
      const validation = validateLineup(userTeam);
      if (!validation.valid) {
        alert(`[LINEUP ERROR] ${validation.error}`);
        return false;
      }
    }

    slot.matches.forEach(fix => {
      if (fix.played) return;
      const homeTeam = state.teams[fix.home];
      const awayTeam = state.teams[fix.away];
      if (!homeTeam || !awayTeam) return;

      if (!homeTeam.isUser) autoAssignLineup(DB, homeTeam);
      if (!awayTeam.isUser) autoAssignLineup(DB, awayTeam);

      const simRes = simulateSingleFixture(homeTeam, awayTeam, fix.comp || slot.comp);
      fix.hg = simRes.hg;
      fix.ag = simRes.ag;
      fix.hxg = simRes.hxg;
      fix.axg = simRes.axg;
      fix.report = simRes.report;
      fix.winner = simRes.winner;
      fix.matchEventsTimeline = simRes.matchEventsTimeline;
      fix.played = true;

      if (fix.comp === 'league') {
        updateTableRecord(state.tables, fix.div || homeTeam.div, homeTeam.id, fix.hg, fix.ag, fix.hxg, fix.axg);
        updateTableRecord(state.tables, fix.div || homeTeam.div, awayTeam.id, fix.ag, fix.hg, fix.axg, fix.hxg);
      } else if (fix.comp === 'regional') {
        updateTableRecord(state.regionalTables, fix.cupName, homeTeam.id, fix.hg, fix.ag, fix.hxg, fix.axg);
        updateTableRecord(state.regionalTables, fix.cupName, awayTeam.id, fix.ag, fix.hg, fix.axg, fix.hxg);
      }

      [homeTeam, awayTeam].forEach(team => {
        (team.squad || []).forEach(p => {
          if (p.isInjured) {
            p.injuryWeeksRemaining = (p.injuryWeeksRemaining || 1) - 1;
            if (p.injuryWeeksRemaining <= 0) {
              p.isInjured = false;
              p.injuryWeeksRemaining = 0;
            }
          }
          if (p.isSuspended) {
            p.suspensionMatchesRemaining = (p.suspensionMatchesRemaining || 1) - 1;
            if (p.suspensionMatchesRemaining <= 0) {
              p.isSuspended = false;
              p.suspensionMatchesRemaining = 0;
            }
          }
        });
      });
    });

    if (slot.comp === 'cup') {
      advanceUniversalCupNextRound(state, slot.cupRoundIndex);
    }
  }

applyRestRecovery(state);

  if (state.moment < 4) {
    state.moment++;
  } else {
    state.moment = 1;
    state.week++;
  }

  return true;
}

export function advanceUniversalCupNextRound(state, currentRndIdx) {
  const currentMatches = state.cupState?.rounds?.[currentRndIdx] || [];
  const winners = currentMatches.map(m => m.winner).filter(Boolean);

  if (currentRndIdx === 0) {
    const r2Teams = [...winners, ...(state.cupState.byes || [])].sort(() => Math.random() - 0.5);
    const r2Matches = [];
    for (let i = 0; i < r2Teams.length; i += 2) {
      r2Matches.push({
        id: `cup_r2_m${i/2 + 1}`,
        roundIndex: 1,
        roundName: CUP_ROUND_LABELS[1],
        home: r2Teams[i],
        away: r2Teams[i + 1],
        played: false,
        hg: 0, ag: 0, hxg: 0, axg: 0, winner: null, comp: 'cup'
      });
    }
    state.cupState.rounds[1] = r2Matches;
    if (state.calendar[26]?.[2]) state.calendar[26][2].matches = r2Matches;
  } else if (currentRndIdx < 7) {
    const nextIdx = currentRndIdx + 1;
    const nextTeams = [...winners].sort(() => Math.random() - 0.5);
    const nextMatches = [];
    const cupMidweeks = [22, 26, 30, 35, 40, 45, 49];

    for (let i = 0; i < nextTeams.length; i += 2) {
      nextMatches.push({
        id: `cup_r${nextIdx + 1}_m${i/2 + 1}`,
        roundIndex: nextIdx,
        roundName: CUP_ROUND_LABELS[nextIdx],
        home: nextTeams[i],
        away: nextTeams[i + 1],
        played: false,
        hg: 0, ag: 0, hxg: 0, axg: 0, winner: null, comp: 'cup'
      });
    }
    state.cupState.rounds[nextIdx] = nextMatches;

    if (nextIdx < 7) {
      const nextWeek = cupMidweeks[nextIdx];
      if (state.calendar[nextWeek]?.[2]) state.calendar[nextWeek][2].matches = nextMatches;
    } else {
      if (state.calendar[52]?.[4]) state.calendar[52][4].matches = nextMatches;
    }
  }
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

export function applyPlayerAgingAndProgression(player) {
  player.age += 1;
  const profile = player.devProfile || 'normal';
  const age = player.age;

  for (const [pillar, val] of Object.entries(player.attributes)) {
    let delta = 0;

    if (['dynamicPower', 'bioenergetics'].includes(pillar)) {
      if (age < 24) delta = randomGaussian(1.5, 0.4);
      else if (age >= 24 && age <= 29) delta = randomGaussian(0, 0.2);
      else {
        let decayRate = -1.5;
        if (profile === 'physical_freak') decayRate = -0.5;
        if (profile === 'early_peaker') decayRate = -2.5;
        delta = randomGaussian(decayRate, 0.4);
      }
    } else if (['scanning', 'processing', 'regulation'].includes(pillar)) {
      if (age < 32) {
        let growthRate = 1.0;
        if (profile === 'late_bloomer') growthRate = 1.8;
        if (profile === 'early_peaker') growthRate = 0.2;
        if (profile === 'old_soul' && age < 23) growthRate = 2.0;
        delta = randomGaussian(growthRate, 0.3);
      } else {
        delta = randomGaussian(0.2, 0.2);
      }
    } else {
      if (profile === 'hothead' && pillar === 'regulation') {
        delta = randomGaussian(-1.2, 0.4);
      } else {
        delta = randomGaussian(0.2, 0.3);
      }
    }

    let newScore = Math.round(val + delta);
    if (player.potentialAbility && newScore > player.potentialAbility && delta > 0) {
      newScore = player.potentialAbility;
    }
    player.attributes[pillar] = Math.max(1, Math.min(99, newScore));
  }
}

export function resetSeasonClean(state) {
  const promotions = {};
  const relegations = {};

  for (let d = 1; d <= 10; d++) {
    const sorted = sortTableEntries(state.tables[d] || []);
    if (d > 1) promotions[d] = sorted.slice(0, 4).map(e => e.teamId);
    if (d < 10) relegations[d] = sorted.slice(-4).map(e => e.teamId);
  }

  const prevSortedDiv3 = sortTableEntries(state.tables[3] || []);
  const nonPromotedDiv3 = prevSortedDiv3.slice(4).map(r => r.teamId);

  for (let d = 2; d <= 10; d++) {
    (promotions[d] || []).forEach(teamId => { 
      if (state.teams[teamId]) state.teams[teamId].div = d - 1; 
    });
  }
  for (let d = 1; d <= 9; d++) {
    (relegations[d] || []).forEach(teamId => { 
      if (state.teams[teamId]) state.teams[teamId].div = d + 1; 
    });
  }

  state.tables = {};
  for (let d = 1; d <= 10; d++) {
    state.tables[d] = Object.values(state.teams)
      .filter(t => t.div === d)
      .map(t => ({
        teamId: t.id, name: t.name,
        p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0,
        xg: 0.0, xga: 0.0, xgd: 0.0, form: []
      }));
  }

  state.regionalTables = {};
  Object.values(state.teams).forEach(t => {
    if (t.regionalCup) {
      if (!state.regionalTables[t.regionalCup]) state.regionalTables[t.regionalCup] = [];
      state.regionalTables[t.regionalCup].push({
        teamId: t.id, name: t.name,
        p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0,
        xg: 0.0, xga: 0.0, xgd: 0.0, form: []
      });
    }
  });

  const nextByes = [
    ...Object.values(state.teams).filter(t => t.div === 1).map(t => t.id),
    ...Object.values(state.teams).filter(t => t.div === 2).map(t => t.id),
    ...nonPromotedDiv3
  ];

  state.cupState = generateUniversalCupR1(state.teams, nextByes);

  Object.values(state.teams).forEach(t => {
    (t.squad || []).forEach(p => {
      if (!p.archiveStats) p.archiveStats = {};
      p.archiveStats[state.season] = {
        age: p.age,
        minutesPlayed: p.minutesPlayed,
        league: { ...p.stats.league },
        regional: { ...p.stats.regional },
        cup: { ...p.stats.cup }
      };

      applyPlayerAgingAndProgression(p);

      p.minutesPlayed = 0;
      p.stats = {
        league: createDefaultPlayerStats(),
        regional: createDefaultPlayerStats(),
        cup: createDefaultPlayerStats()
      };
    });
  });

  state.calendar = generateMasterCalendar(state.teams, state.cupState);
  state.season++;
  state.week = 1;
  state.moment = 1;
}

export function adaptLineupToFormation(DB, team, newFormation) {
  team.formation = newFormation;
  const formRoles = FORMATIONS[newFormation] || FORMATIONS['4-4-2 Flat'];
  const bpKey = team.tactics ? team.tactics.blueprint : null;

  const currentStarters = team.squad.filter(p => p.slot && p.slot.startsWith('S'));
  
  if (currentStarters.length !== 11) {
    autoAssignLineup(DB, team);
    return;
  }

  currentStarters.forEach(p => { p.slot = null; });

  const gk = currentStarters.find(p => p.isGK) || currentStarters[0];
  gk.slot = 'S1';

  const availableOutfield = currentStarters.filter(p => p.id !== gk.id);
  const outfieldSlots = formRoles.slice(1).map((role, idx) => ({
    role,
    slotCode: `S${idx + 2}`
  }));

  const getRolePriority = (role) => (role === 'CB' ? 1 : role === 'ST' ? 2 : ['DM', 'CM', 'AM'].includes(role) ? 3 : 4);
  outfieldSlots.sort((a, b) => getRolePriority(a.role) - getRolePriority(b.role));

  for (const slot of outfieldSlots) {
    if (availableOutfield.length === 0) break;
    availableOutfield.sort((a, b) => evaluateSlotFit(DB, b, slot.role, bpKey) - evaluateSlotFit(DB, a, slot.role, bpKey));
    const chosen = availableOutfield.shift();
    chosen.slot = slot.slotCode;
  }
}
