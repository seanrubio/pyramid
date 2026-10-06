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

  // Filter out injured or suspended players from auto-assignment
  const availablePlayers = team.squad.filter(p => !p.isInjured && !p.isSuspended);

  const availableKeepers = availablePlayers.filter(p => p.isGK);
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
  let availableOutfield = availablePlayers.filter(p => !p.isGK);

  const outfieldSlots = formRoles.slice(1).map((role, idx) => ({ role, slotCode: `S${idx + 2}` }));
  const getRolePriority = (role) => (role === 'CB' ? 1 : role === 'ST' ? 2 : ['DM', 'CM', 'AM'].includes(role) ? 3 : 4);
  outfieldSlots.sort((a, b) => getRolePriority(a.role) - getRolePriority(b.role));

  for (const slot of outfieldSlots) {
    if (availableOutfield.length === 0) break;
    availableOutfield.sort((a, b) => evaluateSlotFit(DB, b, slot.role, bpKey) - evaluateSlotFit(DB, a, slot.role, bpKey));
    const chosen = availableOutfield.shift();
    chosen.slot = slot.slotCode;
  }

  const remainingGKs = availablePlayers.filter(p => p.isGK && !p.slot);
  let benchIndex = 1;
  if (remainingGKs.length > 0) remainingGKs[0].slot = `B${benchIndex++}`;

  const remainingOutfield = availablePlayers.filter(p => !p.isGK && !p.slot);
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
  const starters = team.squad.filter(p => p.slot && p.slot.startsWith('S'));
  if (starters.length !== 11) return { valid: false, error: `Lineup incomplete: ${starters.length}/11 starters assigned.` };
  const hasGk = starters.some(p => p.isGK);
  if (!hasGk) return { valid: false, error: 'No goalkeeper assigned in starting XI.' };
  
  const invalidStarters = starters.filter(p => p.isInjured || p.isSuspended);
  if (invalidStarters.length > 0) {
    return { valid: false, error: `Lineup contains unavailable players (Injured/Suspended).` };
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
  if (w <= 51) return '
