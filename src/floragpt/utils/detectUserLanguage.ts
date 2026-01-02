const SCRIPT_DETECTORS: Array<{ language: string; regex: RegExp }> = [
  { language: 'Japanese', regex: /[\u3040-\u30ff]/ },
  { language: 'Chinese', regex: /[\u4e00-\u9fff]/ },
  { language: 'Korean', regex: /[\uac00-\ud7af]/ },
  { language: 'Arabic', regex: /[\u0600-\u06ff]/ },
  { language: 'Russian', regex: /[\u0400-\u04ff]/ }
];

const LANGUAGE_HINTS: Record<string, string[]> = {
  English: ['the', 'and', 'with', 'tree', 'trees', 'plant', 'planting', 'soil', 'street', 'park', 'shade', 'drought'],
  Dutch: ['de', 'het', 'een', 'bomen', 'boom', 'aanplant', 'straat', 'park', 'schaduw', 'droogte'],
  French: ['le', 'la', 'les', 'des', 'arbre', 'arbres', 'plantation', 'rue', 'parc', 'ombre', 'sécheresse'],
  German: ['der', 'die', 'das', 'baum', 'bäume', 'pflanzung', 'straße', 'park', 'schatten', 'trockenheit'],
  Spanish: ['el', 'la', 'los', 'las', 'árbol', 'árboles', 'plantación', 'calle', 'parque', 'sombra', 'sequía'],
  Italian: ['il', 'lo', 'la', 'gli', 'albero', 'alberi', 'piantumazione', 'strada', 'parco', 'ombra', 'siccità']
};

const tokenize = (text: string) =>
  (text.toLowerCase().match(/\p{L}+/gu) || []).map((word) => word.trim());

export const detectUserLanguage = (text: string, fallback: string = 'English'): string => {
  const trimmed = text.trim();
  if (!trimmed) return fallback;

  const scriptHit = SCRIPT_DETECTORS.find(({ regex }) => regex.test(trimmed));
  if (scriptHit) return scriptHit.language;

  const words = tokenize(trimmed);
  if (words.length === 0) return fallback;

  let bestLanguage = fallback;
  let bestScore = 0;

  Object.entries(LANGUAGE_HINTS).forEach(([language, hints]) => {
    const hintSet = new Set(hints);
    const score = words.reduce((sum, word) => sum + (hintSet.has(word) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestLanguage = language;
    }
  });

  return bestScore > 0 ? bestLanguage : fallback;
};
