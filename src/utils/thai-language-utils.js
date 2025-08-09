// src/utils/thai-language-utils.js

const THAI_NUM_MAP = {
  'ศูนย์': '0', 'หนึ่ง': '1', 'เอ็ด': '1', 'สอง': '2', 'ยี่': '2', 'สาม': '3',
  'สี่': '4', 'ห้า': '5', 'หก': '6', 'เจ็ด': '7', 'แปด': '8', 'เก้า': '9',
  'สิบ': '10', 'สิบเอ็ด': '11', 'สิบสอง': '12', 'ยี่สิบ': '20',
  '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4',
  '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9',
};

const NEGATIVE_WORDS = ['ลบ', 'ติดลบ'];
const POSITIVE_WORDS = ['บวก'];

const ALL_KEYWORDS = [...Object.keys(THAI_NUM_MAP), ...NEGATIVE_WORDS, ...POSITIVE_WORDS];
const KEYWORD_REGEX = new RegExp(`(${ALL_KEYWORDS.join('|')})`, 'g');

/**
 * Normalizes Thai speech text into a consistent format for parsing.
 * This function remains the same.
 */
export function thaiNormalize(text) {
  if (!text) return '';
  
  let normalized = text.replace(KEYWORD_REGEX, ' $1 ');

  POSITIVE_WORDS.forEach(word => {
    normalized = normalized.replace(new RegExp(word, 'g'), '');
  });

  NEGATIVE_WORDS.forEach(word => {
    normalized = normalized.replace(new RegExp(word, 'g'), '-');
  });

  for (const [key, value] of Object.entries(THAI_NUM_MAP)) {
    normalized = normalized.replace(new RegExp(key, 'g'), value);
  }

  normalized = normalized.replace(/-\s+/g, '-').replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Parses a normalized string of numbers into an array of integers using "smart split" logic.
 * @param {string} normalizedText - The text after normalization.
 * @returns {number[]} - An array of single-digit numbers.
 */
export function thaiNumberParser(normalizedText) {
  if (!normalizedText) return [];

  // Remove all spaces to process the string as a continuous sequence of characters
  const chars = normalizedText.replace(/\s+/g, '');
  const result = [];

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];

    if (char === '-') {
      // If a minus sign is found, check if the next character is a digit
      if (i + 1 < chars.length && /\d/.test(chars[i + 1])) {
        // Combine the minus sign with the next digit and push it as a negative number
        result.push(parseInt(char + chars[i + 1], 10));
        i++; // Increment the counter to skip the digit we just processed
      }
    } else if (/\d/.test(char)) {
      // If a character is a digit, push it as a number
      result.push(parseInt(char, 10));
    }
    // Any other characters (like extra minus signs) are ignored
  }

  return result;
}