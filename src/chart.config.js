// src/chart.config.js

export const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
export const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
export const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

export const ALL_TEETH = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_RIGHT.slice().reverse(), ...LOWER_LEFT];

// --- NEW EXPORT FOR MGJ MODE ---
// Defines the standard order for buccal MGJ measurements
export const MGJ_CHARTING_TEETH = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_LEFT, ...LOWER_RIGHT.slice().reverse()];
export const MGJ_CHARTING_QUADRANTS = [
    UPPER_RIGHT,
    UPPER_LEFT,
    LOWER_LEFT,
    LOWER_RIGHT.slice().reverse(),
];

const BUCCAL_SITES_LR = ['db', 'b', 'mb'];
const LINGUAL_SITES_LR = ['dl', 'l', 'ml'];
const BUCCAL_SITES_RL = ['mb', 'b', 'db'];
const LINGUAL_SITES_RL = ['ml', 'l', 'dl'];

export const INITIAL_CHART_DATA = ALL_TEETH.reduce((acc, toothId) => {
  acc[toothId] = {
    pd: {}, re: {}, mgj: { b: null, l: null }, bleeding: {}, suppuration: {},
  };
  return acc;
}, {});

const SEQUENCE_MAP = {
    Q1B: { teeth: UPPER_RIGHT, surface: 'buccal' },
    Q1L: { teeth: UPPER_RIGHT, surface: 'lingual' },
    Q2B: { teeth: UPPER_LEFT, surface: 'buccal' },
    Q2L: { teeth: UPPER_LEFT, surface: 'lingual' },
    Q3B: { teeth: LOWER_LEFT, surface: 'buccal' },
    Q3L: { teeth: LOWER_LEFT, surface: 'lingual' },
    Q4B: { teeth: LOWER_RIGHT, surface: 'buccal' },
    Q4L: { teeth: LOWER_RIGHT, surface: 'lingual' },
};

export const createChartingOrder = (missingTeeth = [], modes = {}, customSequence = []) => {
  const order = [];
  const availableTeeth = (teeth) => teeth.filter(t => !missingTeeth.includes(t));
  const siteModes = ['pd', 're'].filter(m => modes[m]);

  customSequence.forEach(segment => {
    const { teeth: baseTeeth, surface } = SEQUENCE_MAP[segment.id];
    const quadrant = segment.id.substring(0, 2);
    const isDirectionReversed = segment.direction === 'RL';
    const teeth = availableTeeth(isDirectionReversed ? [...baseTeeth].reverse() : baseTeeth);
    const isQuadrantOnLeftSide = quadrant === 'Q2' || quadrant === 'Q3';
    const useEffectiveRLProbingOrder = isDirectionReversed ^ isQuadrantOnLeftSide;

    let sitesForProbing;
    if (surface === 'buccal') {
        sitesForProbing = useEffectiveRLProbingOrder ? BUCCAL_SITES_RL : BUCCAL_SITES_LR;
    } else {
        sitesForProbing = useEffectiveRLProbingOrder ? LINGUAL_SITES_RL : LINGUAL_SITES_LR;
    }

    let sitesForBopButtons;
    if (surface === 'buccal') {
      sitesForBopButtons = isQuadrantOnLeftSide ? BUCCAL_SITES_RL : BUCCAL_SITES_LR;
    } else {
      sitesForBopButtons = isQuadrantOnLeftSide ? LINGUAL_SITES_RL : LINGUAL_SITES_LR;
    }

    teeth.forEach(toothId => {
      sitesForProbing.forEach(site => {
        siteModes.forEach(mode => {
          order.push({ toothId, surface, site, type: mode });
        });
      });
      if (modes.bop) {
        order.push({ toothId, surface, sites: sitesForBopButtons, type: 'bop' });
      }
      if (modes.mgj && surface === 'buccal') {
        order.push({ toothId, surface, site: 'b', type: 'mgj' });
      }
    });
  });
  return order;
};

export const createVoiceChartingOrder = (missingTeeth = [], customSequence = []) => {
  const order = [];
  const availableTeeth = (teeth) => teeth.filter(t => !missingTeeth.includes(t));
  customSequence.forEach(segment => {
    const { teeth: baseTeeth, surface } = SEQUENCE_MAP[segment.id];
    const isReversed = segment.direction === 'RL';
    const processableTeeth = availableTeeth(isReversed ? [...baseTeeth].reverse() : baseTeeth);
    let sitesForSurface;
    if (surface === 'buccal') {
      sitesForSurface = isReversed ? BUCCAL_SITES_RL : BUCCAL_SITES_LR;
    } else {
      sitesForSurface = isReversed ? LINGUAL_SITES_RL : LINGUAL_SITES_LR;
    }
    processableTeeth.forEach(toothId => {
      order.push({
        toothId,
        surface,
        sites: sitesForSurface,
        type: 'pd/re',
      });
    });
  });
  return order;
};