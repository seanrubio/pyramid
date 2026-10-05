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

export function getCountry(DB, code) {
  return DB.countries.find(c => c.code === code) || { code: 'GB-ENG', name: 'England', flag: '🇬🇧', region: 'anglo' };
}

export function generatePlayerName(DB, countryCode = 'US') {
  const pool = DB.namePools[countryCode] || DB.namePools['US'] || Object.values(DB.namePools)[0];
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

  // 1. Resolve host country (checks team property first, then DB.cities by id or name)
  const city = DB.cities?.find(c => c.id === team.id || c.name === team.name);
  const domesticNat = team.country || city?.country || 'US';

  let favoredPool = BLUEPRINT_ARCHETYPE_MAP[style];
  if (!favoredPool && press === 'gegenpress') favoredPool = BLUEPRINT_ARCHETYPE_MAP['gegenpress'];

  // 2. Generate 2 GKs (100% domestic)
  for (let i = 0; i < 2; i++) {
    squad.push(generatePlayer(DB, true, div, domesticNat));
  }

  // 3. Generate 21 Outfield Players (100% domestic)
  for (let i = 0; i < 21; i++) {
    const archetypeKey = (favoredPool && Math.random() < 0.65) ? sampleChoice(favoredPool) : sampleChoice(OUTFIELD_ARCHETYPES);
    const player = generatePlayer(DB, false, div, domesticNat);
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
  team.squad.forEach(p => p.slot = null);
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

  const remainingGKs = team.squad.filter(p => p.isGK && !p.slot);
  let benchIndex = 1;
  if (remainingGKs.length > 0) remainingGKs[0].slot = `B${benchIndex++}`;

  const remainingOutfield = team.squad.filter(p => !p.isGK && !p.slot);
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
