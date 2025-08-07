// src/plaque.config.js

export const UPPER_RIGHT_PLAQUE = [18, 17, 16, 15, 14, 13, 12, 11];
export const UPPER_LEFT_PLAQUE = [21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_RIGHT_PLAQUE = [48, 47, 46, 45, 44, 43, 42, 41];
export const LOWER_LEFT_PLAQUE = [31, 32, 33, 34, 35, 36, 37, 38];

export const ALL_TEETH_PLAQUE = [
    ...UPPER_RIGHT_PLAQUE, ...UPPER_LEFT_PLAQUE,
    ...LOWER_RIGHT_PLAQUE.slice().reverse(), ...LOWER_LEFT_PLAQUE
];

// O'Leary sites: Mesial, Distal, Buccal, Lingual
export const PLAQUE_SITES = ['m', 'd', 'b', 'l'];

export const INITIAL_PLAQUE_DATA = ALL_TEETH_PLAQUE.reduce((acc, toothId) => {
  acc[toothId] = {
    m: false, d: false, b: false, l: false,
  };
  return acc;
}, {});