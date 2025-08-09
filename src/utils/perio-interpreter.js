// src/utils/perio-interpreter.js

const PD_RANGE = { min: 0, max: 15 };
const REC_RANGE = { min: -10, max: 10 };

/**
 * Interprets an array of numbers as pairs of Probing Depth (PD) and Recession (REC).
 * Groups numbers into sets of 3 pairs (6 numbers total).
 * @param {number[]} nums - An array of numbers from the parser.
 * @returns {object} - An object containing arrays of pd and rec values, and validation flags.
 */
export function perioInterpreter(nums) {
  const result = {
    pd: [],
    rec: [],
    isValid: true,
    outOfRange: false,
    consumed: 0,
  };

  // We expect data in chunks of 6 (3 pairs of PD, REC)
  const dataToProcess = nums.slice(0, 6); // Corrected variable declaration
  
  if (dataToProcess.length === 0) {
    result.isValid = false;
    return result;
  }

  if (dataToProcess.length % 2 !== 0) {
    result.isValid = false; // Incomplete pairs
  }
  
  result.consumed = dataToProcess.length;

  for (let i = 0; i < dataToProcess.length; i += 2) {
    const pd = dataToProcess[i];
    const rec = dataToProcess[i + 1];

    if (pd < PD_RANGE.min || pd > PD_RANGE.max) {
      result.outOfRange = true;
    }
    // REC can be undefined if an odd number of values are spoken
    if (rec !== undefined && (rec < REC_RANGE.min || rec > REC_RANGE.max)) {
      result.outOfRange = true;
    }
    
    // Only push valid numbers to the result arrays
    if(pd !== undefined) result.pd.push(pd);
    if(rec !== undefined) result.rec.push(rec);
  }

  return result;
}