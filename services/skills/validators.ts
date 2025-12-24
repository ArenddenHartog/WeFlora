
// services/skills/validators.ts

export interface CanonicalResponse {
  ok: boolean;
  displayValue?: string;
  reasoning?: string;
  normalized?: any;
  error?: string;
}

// Helper regex for the separator " — "
// Matches em-dash, en-dash, or hyphen, surrounded by optional spaces, but we want to enforce presence.
// The prompt says "— reason" (em dash). We'll be lenient on the dash type but strict on existence.
const SEPARATOR_REGEX = /\s*[-–—]\s*/;

/**
 * Splits a string into value and reasoning based on the last occurrence of the separator.
 * This allows the value itself to contain dashes/hyphens if needed, though risky.
 * Ideally, we split on the *first* or *last*?
 * Given "Compliant — reason", split on first makes sense if value is simple.
 * Given "Values - like - this — reason", split on last makes sense.
 * However, the requirement is "— reason".
 * Let's try splitting on the first occurrence of " — " (space em-dash space) or similar patterns.
 */
function parseValueAndReason(input: string): { valuePart: string; reasonPart: string } | null {
  // We look for the pattern: <Value><Separator><Reason>
  // Separator: space + (dash/em-dash/en-dash) + space
  const match = input.match(/^(.*?)(\s+[-–—]\s+)(.*)$/);
  if (!match) return null;
  return { valuePart: match[1].trim(), reasonPart: match[3].trim() };
}

export const validators = {
  badge: (input: string, allowedValues?: string[]): CanonicalResponse => {
    const parts = parseValueAndReason(input);
    if (!parts) return { ok: false, error: "Missing '— reason' suffix" };
    
    const { valuePart, reasonPart } = parts;
    
    // If allowedValues provided, check inclusion
    if (allowedValues && allowedValues.length > 0) {
      if (!allowedValues.includes(valuePart)) {
        return { 
          ok: false, 
          error: `Value '${valuePart}' is not allowed. Allowed: ${allowedValues.join(', ')}` 
        };
      }
    }
    
    // Defaults for badge if not strictly controlled: just pass through
    return {
      ok: true,
      displayValue: valuePart,
      reasoning: reasonPart,
      normalized: valuePart
    };
  },

  score: (input: string): CanonicalResponse => {
    const parts = parseValueAndReason(input);
    if (!parts) return { ok: false, error: "Missing '— reason' suffix" };
    
    const { valuePart, reasonPart } = parts;
    
    // Expected format: NN/100
    const scoreMatch = valuePart.match(/^(\d{1,3})\/100$/);
    if (!scoreMatch) return { ok: false, error: "Format must be NN/100" };
    
    const num = parseInt(scoreMatch[1], 10);
    if (isNaN(num) || num < 0 || num > 100) {
      return { ok: false, error: "Score must be between 0 and 100" };
    }

    return {
      ok: true,
      displayValue: valuePart, // "85/100"
      reasoning: reasonPart,
      normalized: num
    };
  },

  currency: (input: string): CanonicalResponse => {
    const parts = parseValueAndReason(input);
    if (!parts) return { ok: false, error: "Missing '— reason' suffix" };
    
    const { valuePart, reasonPart } = parts;
    
    // Expected format: €NNN(/period)?
    // NNN can have commas or dots. We'll strip commas for parsing.
    // Regex: ^€([\d,.]+)(\/(day|week|month|year))?$
    const currencyMatch = valuePart.match(/^€([\d,.]+)(\/(day|week|month|year))?$/);
    
    if (!currencyMatch) {
      return { ok: false, error: "Format must be €NNN or €NNN/period" };
    }
    
    const rawNum = currencyMatch[1].replace(/,/g, ''); // Remove commas
    const period = currencyMatch[2]; // e.g. "/year"
    const val = parseFloat(rawNum);
    
    if (isNaN(val)) return { ok: false, error: "Invalid numeric value" };

    return {
      ok: true,
      displayValue: valuePart,
      reasoning: reasonPart,
      normalized: { amount: val, currency: 'EUR', period: period ? period.replace('/', '') : null }
    };
  },

  quantity: (input: string, allowedUnits?: string[]): CanonicalResponse => {
    const parts = parseValueAndReason(input);
    if (!parts) return { ok: false, error: "Missing '— reason' suffix" };
    
    const { valuePart, reasonPart } = parts;
    
    // Expected format: N UNIT(/period)?
    // Regex: ^([\d,.]+)\s+([a-zA-Z%]+)(\/(day|week|month|year))?$
    const qtyMatch = valuePart.match(/^([\d,.]+)\s+([a-zA-Z%]+)(\/(day|week|month|year))?$/);
    
    if (!qtyMatch) {
      return { ok: false, error: "Format must be 'N UNIT' or 'N UNIT/period'" };
    }
    
    const rawNum = qtyMatch[1].replace(/,/g, '');
    const unit = qtyMatch[2];
    const period = qtyMatch[3];
    
    const val = parseFloat(rawNum);
    if (isNaN(val)) return { ok: false, error: "Invalid numeric value" };
    
    if (allowedUnits && allowedUnits.length > 0 && !allowedUnits.includes(unit)) {
         // Also check unit + period combo if allowedUnits has it? 
         // Usually allowedUnits are just "gal", "L". 
         // But the requirement example in previous file was "gal/year".
         // Let's assume allowedUnits might contain the full string suffix or just the base unit.
         // For safety, let's check exact match of the full unit suffix part or just base.
         // Simplest: Check if the constructed unit string is allowed.
         const fullUnit = unit + (period || '');
         if (!allowedUnits.includes(fullUnit) && !allowedUnits.includes(unit)) {
             return { ok: false, error: `Unit '${fullUnit}' not allowed. Allowed: ${allowedUnits.join(', ')}` };
         }
    }

    return {
      ok: true,
      displayValue: valuePart,
      reasoning: reasonPart,
      normalized: { value: val, unit: unit, period: period ? period.replace('/', '') : null }
    };
  },

  enum: (input: string, allowedEnums: string[]): CanonicalResponse => {
    const parts = parseValueAndReason(input);
    if (!parts) return { ok: false, error: "Missing '— reason' suffix" };
    
    const { valuePart, reasonPart } = parts;
    
    if (!allowedEnums.includes(valuePart)) {
      return { ok: false, error: `Value '${valuePart}' not in allowed list: ${allowedEnums.join(', ')}` };
    }

    return {
      ok: true,
      displayValue: valuePart,
      reasoning: reasonPart,
      normalized: valuePart
    };
  },

  range: (input: string): CanonicalResponse => {
    const parts = parseValueAndReason(input);
    if (!parts) return { ok: false, error: "Missing '— reason' suffix" };
    
    const { valuePart, reasonPart } = parts;
    
    // Expected: NN–NN (en-dash) or NN-NN (hyphen) or NN—NN (em-dash)
    // Regex: ^(\d+)\s*[-–—]\s*(\d+)$
    const rangeMatch = valuePart.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    if (!rangeMatch) {
      return { ok: false, error: "Format must be Min-Max (e.g. 10-20)" };
    }
    
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    
    if (min > max) {
      return { ok: false, error: `Invalid range: min (${min}) > max (${max})` };
    }

    return {
      ok: true,
      displayValue: `${min}–${max}`, // Normalize to en-dash
      reasoning: reasonPart,
      normalized: { min, max }
    };
  },

  text: (input: string): CanonicalResponse => {
    const parts = parseValueAndReason(input);
    if (!parts) return { ok: false, error: "Missing '— reason' suffix" };
    
    const { valuePart, reasonPart } = parts;
    
    if (valuePart.length === 0) {
      return { ok: false, error: "Statement cannot be empty" };
    }

    return {
      ok: true,
      displayValue: valuePart,
      reasoning: reasonPart,
      normalized: valuePart
    };
  }
};
