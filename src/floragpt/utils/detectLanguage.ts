const DUTCH_FUNCTION_WORDS = ['de', 'het', 'een', 'ik', 'jij', 'zijn', 'van', 'voor', 'met'];

export const detectOutputLanguage = (text: string): 'en' | 'nl' => {
  const normalized = text.toLowerCase();
  const tokens = normalized.split(/[^a-z\u00c0-\u017f]+/).filter(Boolean);
  if (tokens.length === 0) return 'en';

  const dutchHits = tokens.filter((token) => DUTCH_FUNCTION_WORDS.includes(token)).length;
  const ratio = dutchHits / tokens.length;

  if (dutchHits >= 2 && ratio >= 0.15) return 'nl';
  return 'en';
};
