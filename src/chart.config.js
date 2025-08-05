// src/chart.config.js

export const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
export const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
// Corrected the order for the lower right quadrant to match standard dental notation
export const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
export const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];


// Exporting ALL_TEETH for use in other components
export const ALL_TEETH = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_RIGHT.slice().reverse(), ...LOWER_LEFT];

const BUCCAL_SITES = ['db', 'b', 'mb'];
const LINGUAL_SITES = ['dl', 'l', 'ml'];

export const INITIAL_CHART_DATA = ALL_TEETH.reduce((acc, toothId) => {
  acc[toothId] = {
    pd: {}, re: {}, mgj: { b: null, l: null }, bleeding: {}, suppuration: {},
  };
  return acc;
}, {});

// This function now accepts a list of missing teeth to generate a dynamic order
export const createChartingOrder = (missingTeeth = []) => {
  const order = [];
  const availableTeeth = (teeth) => teeth.filter(t => !missingTeeth.includes(t));

  const sequence = [
    { teeth: availableTeeth([...UPPER_RIGHT, ...UPPER_LEFT]), surface: 'buccal' },
    { teeth: availableTeeth([...UPPER_LEFT.slice().reverse(), ...UPPER_RIGHT.slice().reverse()]), surface: 'lingual'},
    // Corrected the order for charting the lower arch
    { teeth: availableTeeth([...LOWER_LEFT.slice().reverse(), ...LOWER_RIGHT.slice().reverse()]), surface: 'lingual' },
    { teeth: availableTeeth([...LOWER_RIGHT, ...LOWER_LEFT]), surface: 'buccal' },
  ];

  sequence.forEach(({ teeth, surface }) => {
    teeth.forEach(toothId => {
      order.push({
        toothId, surface, sites: surface === 'buccal' ? BUCCAL_SITES : LINGUAL_SITES
      });
    });
  });

  return order;
};
