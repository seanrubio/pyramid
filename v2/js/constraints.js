export const FORMATIONS = {
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

export const GK_ARCHETYPES = [
  'gk_shot_stopper', 'gk_cross_collector', 'gk_possession_platform', 'gk_disrupter', 'gk_organizer'
];

export const OUTFIELD_ARCHETYPES = [
  'runner_in_behind', 'pocket_player', 'target', 'dribblinho', 'artist', 
  'anticipator', 'disrupter', 'soldier', 'two_way', 'steady_eddy'
];

export const BLUEPRINT_ARCHETYPE_MAP = {
  'flank play': ['target', 'two_way', 'dribblinho', 'soldier'],
  'balls in behind': ['runner_in_behind', 'dribblinho', 'artist', 'anticipator'],
  'central creator': ['artist', 'pocket_player', 'steady_eddy', 'anticipator'],
  'patient possession': ['artist', 'pocket_player', 'steady_eddy', 'two_way'],
  'gegenpress': ['disrupter', 'soldier', 'runner_in_behind', 'anticipator']
};

export const BLUEPRINT_PRESETS = {
  heavy_metal:        { mentality: 'attacking', press: 'gegenpress', buildGk: 'mixed', buildMid: 'direct', chanceCreation: 'balls in behind' },
  possession_control: { mentality: 'attacking', press: 'high press', buildGk: 'short', buildMid: 'patient possession', chanceCreation: 'tiki-taka' },
  underdog_pressing:  { mentality: 'balanced',  press: 'gegenpress', buildGk: 'long',  buildMid: 'direct', chanceCreation: 'balls in behind' },
  direct_aerial:      { mentality: 'balanced',  press: 'mid block',  buildGk: 'long',  buildMid: 'direct', chanceCreation: 'flank play' },
  safety_first:       { mentality: 'defensive', press: 'low block',  buildGk: 'mixed', buildMid: 'patient possession', chanceCreation: 'central creator' },
  counter_attacking:  { mentality: 'defensive', press: 'low block',  buildGk: 'long',  buildMid: 'direct', chanceCreation: 'balls in behind' }
};
