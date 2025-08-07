// src/chart.config.js

export const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
export const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
export const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

export const ALL_TEETH = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_RIGHT.slice().reverse(), ...LOWER_LEFT];

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

// Maps sequence IDs to their corresponding tooth arrays and surfaces.
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
    const quadrant = segment.id.substring(0, 2); // 'Q1', 'Q2', etc.

    // Determine the direction for TEETH based on user's custom sequence
    const isReversedForTeeth = segment.direction === 'RL';
    const teeth = availableTeeth(isReversedForTeeth ? [...baseTeeth].reverse() : baseTeeth);

    // Determine the site order for PROBING (PD, RE) based on user's custom sequence direction
    let sitesForProbing;
    if (surface === 'buccal') {
        sitesForProbing = isReversedForTeeth ? BUCCAL_SITES_RL : BUCCAL_SITES_LR;
    } else { // lingual
        sitesForProbing = isReversedForTeeth ? LINGUAL_SITES_RL : LINGUAL_SITES_LR;
    }

    // Determine the site order for the BOP BUTTONS based on ANATOMY (screen position)
    // Q2 and Q3 are on the left side of the screen, so their mesial side is towards the center (right).
    const isQuadrantOnLeftSide = quadrant === 'Q2' || quadrant === 'Q3';
    let sitesForBopButtons;
    if (surface === 'buccal') {
      sitesForBopButtons = isQuadrantOnLeftSide ? BUCCAL_SITES_RL : BUCCAL_SITES_LR;
    } else { // lingual
      sitesForBopButtons = isQuadrantOnLeftSide ? LINGUAL_SITES_RL : LINGUAL_SITES_LR;
    }

    teeth.forEach(toothId => {
      // Create order for PD, RE using the probing site order
      sitesForProbing.forEach(site => {
        siteModes.forEach(mode => {
          order.push({ toothId, surface, site, type: mode });
        });
      });

      if (modes.bop) {
        // Create order for BOP using the ANATOMICALLY correct button order
        order.push({ toothId, surface, sites: sitesForBopButtons, type: 'bop' });
      }

      if (modes.mgj && surface === 'buccal') {
        order.push({ toothId, surface, site: 'b', type: 'mgj' });
      }
    });
  });

  return order;
};