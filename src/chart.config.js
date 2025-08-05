// src/chart.config.js

export const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
export const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
export const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

export const ALL_TEETH = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_RIGHT.slice().reverse(), ...LOWER_LEFT];

const BUCCAL_SITES = ['db', 'b', 'mb'];
const LINGUAL_SITES = ['dl', 'l', 'ml'];

export const createChartingOrder = (missingTeeth = []) => {
  const order = [];
  const availableTeeth = (teeth) => teeth.filter(t => !missingTeeth.includes(t));

  // This sequence defines the new charting order, completing one quadrant at a time.
  const sequence = [
    // Quadrant 1
    { teeth: availableTeeth(UPPER_RIGHT), surface: 'buccal' }, // 18 -> 11
    { teeth: availableTeeth(UPPER_RIGHT.slice().reverse()), surface: 'lingual' }, // 11 -> 18
    // Quadrant 2
    { teeth: availableTeeth(UPPER_LEFT), surface: 'buccal' }, // 21 -> 28
    { teeth: availableTeeth(UPPER_LEFT.slice().reverse()), surface: 'lingual' }, // 28 -> 21
    // Quadrant 3
    { teeth: availableTeeth(LOWER_LEFT.slice().reverse()), surface: 'lingual' }, // 38 -> 31
    { teeth: availableTeeth(LOWER_LEFT), surface: 'buccal' }, // 31 -> 38
    // Quadrant 4
    { teeth: availableTeeth(LOWER_RIGHT), surface: 'lingual' }, // 48 -> 41
    { teeth: availableTeeth(LOWER_RIGHT.slice().reverse()), surface: 'buccal' }, // 41 -> 48
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
