export type DecisionIntent = 'suggest' | 'compare' | 'shortlist' | 'propose' | 'other';

export const inferIntent = (message: string): DecisionIntent => {
  const text = message.toLowerCase();
  if (/(suggest|recommend)/.test(text)) return 'suggest';
  if (/compare/.test(text)) return 'compare';
  if (/shortlist/.test(text)) return 'shortlist';
  if (/propose/.test(text)) return 'propose';
  return 'other';
};
