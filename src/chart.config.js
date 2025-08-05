// src/chart.config.js

export const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
export const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
export const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

export const ALL_TEETH = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_RIGHT.slice().reverse(), ...LOWER_LEFT];

const BUCCAL_SITES = ['db', 'b', 'mb'];
const LINGUAL_SITES = ['dl', 'l', 'ml'];

export const INITIAL_CHART_DATA = ALL_TEETH.reduce((acc, toothId) => {
  acc[toothId] = {
    pd: {}, re: {}, mgj: { b: null, l: null }, bleeding: {}, suppuration: {},
  };
  return acc;
}, {});

export const createChartingOrder = (missingTeeth = [], modes = { pd: true, re: true, bop: true, mgj: true }) => {
  const order = [];
  const availableTeeth = (teeth) => teeth.filter(t => !missingTeeth.includes(t));

  const siteModes = ['pd', 're'].filter(m => modes[m]);

  const archSequence = [
    // Q1
    { teeth: availableTeeth(UPPER_RIGHT), surface: 'buccal' },
    { teeth: availableTeeth(UPPER_RIGHT.slice().reverse()), surface: 'lingual' },
    // Q2
    { teeth: availableTeeth(UPPER_LEFT), surface: 'buccal' },
    { teeth: availableTeeth(UPPER_LEFT.slice().reverse()), surface: 'lingual' },
    // Q3
    { teeth: availableTeeth(LOWER_LEFT.slice().reverse()), surface: 'lingual' },
    { teeth: availableTeeth(LOWER_LEFT), surface: 'buccal' },
    // Q4
    { teeth: availableTeeth(LOWER_RIGHT), surface: 'lingual' },
    { teeth: availableTeeth(LOWER_RIGHT.slice().reverse()), surface: 'buccal' },
  ];

  archSequence.forEach(({ teeth, surface }) => {
    const sites = surface === 'buccal' ? BUCCAL_SITES : LINGUAL_SITES;

    teeth.forEach(toothId => {
      // Add site-specific measurements (PD, RE) for each site of the tooth.
      sites.forEach(site => {
        siteModes.forEach(mode => {
          order.push({ toothId, surface, site, type: mode });
        });
      });

      // After all sites for a single tooth are done, add its BOP step if selected.
      if (modes.bop) {
        order.push({ toothId, surface, sites, type: 'bop' });
      }

      // After the BOP step, add its MGJ step if it's a buccal surface and MGJ is selected.
      if (modes.mgj && surface === 'buccal') {
        order.push({ toothId, surface, site: 'b', type: 'mgj' });
      }
    });
  });

  return order;
};