// Calculates the "distance" between two strings. Written by copilot.
export function stringDistance(aCased: string, bCased: string): number {
  const a = aCased.toLowerCase();
  const b = bCased.toLowerCase();

  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  // increment along the first column of each row
  let i;
  for (i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  // increment each column in the first row
  let j;
  for (j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  // Fill in the rest of the matrix
  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution

          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1
        ); // deletion
      }
    }
  }

  return matrix[b.length][a.length];
}

// List of words to exclude from capitalization, except when they are the first or last word
const excludedWords = [
  'a',
  'an',
  'and',
  'the',
  'but',
  'or',
  'nor',
  'for',
  'so',
  'yet',
  'at',
  'by',
  'in',
  'of',
  'on',
  'to',
  'up',
  'with',
  'as',
];

export function toTitleCase(input: string): string {
  // Helper function to capitalize the first letter of a word
  const capitalize = (word: string): string => {
    if (word === word.toUpperCase()) {
      return word; // Return the word as is if it's already in uppercase
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  };

  // Split the string into words
  const words = input.match(/\b\w+(?:'\w+)?\b|[\p{P}\p{S}]+|\s+/gu) || [];

  // Map over the words and apply capitalization rules
  const titleCasedWords = words.map((word, index, array) => {
    const lowerCaseWord = word.toLowerCase();

    // Check if the word is in the excluded list
    const isExcluded = excludedWords.includes(lowerCaseWord);

    // Check if the next word contains an apostrophe (e.g., "day's")
    const nextWordHasApostrophe = array[index + 1] && /'\w+/u.test(array[index + 1]);

    // Always capitalize the first and last word, or if it's not in the excludedWords list,
    // or if it's followed by punctuation/symbols, or if the next word has an apostrophe
    if (
      index === 0 ||
      index === array.length - 1 ||
      !isExcluded ||
      nextWordHasApostrophe
    ) {
      return capitalize(word);
    } else {
      return lowerCaseWord; // Convert excluded words to lowercase
    }
  });

  // Join the words back into a single string
  return titleCasedWords.join('');
}

const maliciousStrings = [
  'base64',
  'decode',
  'str_pad',
  '";',
  'strlen',
  '$d',
  'phpinfo',
  '$(',
  '==',
  'eval',
  'passthru',
  'shell_exec',
  'proc_open',
  'proc_close',
];
const maliciousPatterns = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE|EXEC|GRANT|REVOKE|MERGE|DECLARE|CAST|CONVERT)\b.*\b(FROM|INTO|WHERE|TABLE|DATABASE|SCHEMA|COLUMN)\b)/i, // SQL Injection
  /(<script.*?>.*?<\/script>)/i, // XSS attack (script injection)
  /((\bdocument\.cookie|onerror|onload|eval|javascript:|href=|src=)\b)/i, // XSS payloads
  /(\b(?:http|https):\/\/[^\s]+(?:login|bank|verify|confirm|secure|account|password)\b)/i, // Phishing attempts
];
export function isMaliciousString(...inputs: string[]): boolean {
  for (const input of inputs) {
    const inputLower = input.toLowerCase();
    if (maliciousStrings.some(str => inputLower.includes(str))) {
      return true;
    }
    if (maliciousPatterns.some(pattern => pattern.test(input))) {
      return true;
    }
  }
  return false;
}
