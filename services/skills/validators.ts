// services/skills/validators.ts

export interface CanonicalResponse {
  ok: boolean;
  displayValue?: string;
  reasoning?: string;
  normalized?: any;
  error?: string;
}

export type OutputValidationOptions = {
  allowedEnums?: string[];
  allowedUnits?: string[];
  allowedPeriods?: string[];
  allowedCurrencies?: string[];
  defaultPeriod?: string;
};

function parseValueAndReason(input: string): { valuePart: string; reasonPart: string } | null {
  const match = input.match(/^(.*?)(\s+[-–—]\s+)(.*)$/);
  if (!match) return null;
  return { valuePart: match[1].trim(), reasonPart: match[3].trim() };
}

export const validateBadge = (input: string, allowedValues?: string[]): CanonicalResponse => {
  const parts = parseValueAndReason(input);
  if (!parts) return { ok: false, error: "Missing '— reason' suffix" };
  
  const { valuePart, reasonPart } = parts;
  
  if (allowedValues && allowedValues.length > 0) {
    if (!allowedValues.includes(valuePart)) {
      return { 
        ok: false, 
        error: `Value '${valuePart}' is not allowed. Allowed: ${allowedValues.join(', ')}` 
      };
    }
  }
  
  return {
    ok: true,
    displayValue: valuePart,
    reasoning: reasonPart,
    normalized: valuePart
  };
};

export const validateScore = (input: string): CanonicalResponse => {
  const parts = parseValueAndReason(input);
  if (!parts) return { ok: false, error: "Missing '— reason' suffix" };
  
  const { valuePart, reasonPart } = parts;
  
  const scoreMatch = valuePart.match(/^(\d{1,3})\/100$/);
  if (!scoreMatch) return { ok: false, error: "Format must be NN/100" };
  
  const num = parseInt(scoreMatch[1], 10);
  if (isNaN(num) || num < 0 || num > 100) {
    return { ok: false, error: "Score must be between 0 and 100" };
  }

  return {
    ok: true,
    displayValue: valuePart,
    reasoning: reasonPart,
    normalized: num
  };
};

export const validateCurrency = (input: string, options?: { allowedCurrencies?: string[], allowedPeriods?: string[], defaultPeriod?: string }): CanonicalResponse => {
  const parts = parseValueAndReason(input);
  if (!parts) return { ok: false, error: "Missing '— reason' suffix" };
  
  const { valuePart, reasonPart } = parts;
  
  const currencyMatch = valuePart.match(/^([€$£])([\d,.]+)(\/(day|week|month|year))?$/);
  
  if (!currencyMatch) {
    return { ok: false, error: "Format must be €NNN or €NNN/period" };
  }
  
  const symbol = currencyMatch[1];
  const rawNum = currencyMatch[2].replace(/,/g, '');
  const period = currencyMatch[3];
  const val = parseFloat(rawNum);
  
  if (isNaN(val)) return { ok: false, error: "Invalid numeric value" };

  if (options?.allowedCurrencies && !options.allowedCurrencies.includes(symbol)) {
      return { ok: false, error: `Currency '${symbol}' not allowed` };
  }

  return {
    ok: true,
    displayValue: valuePart,
    reasoning: reasonPart,
    normalized: { amount: val, currency: symbol === '€' ? 'EUR' : 'USD', period: period ? period.replace('/', '') : null }
  };
};

export const validateQuantity = (input: string, options?: { allowedUnits?: string[], allowedPeriods?: string[], defaultPeriod?: string }): CanonicalResponse => {
  const parts = parseValueAndReason(input);
  if (!parts) return { ok: false, error: "Missing '— reason' suffix" };
  
  const { valuePart, reasonPart } = parts;
  
  const qtyMatch = valuePart.match(/^([\d,.]+)\s+([a-zA-Z%³]+)(\/(day|week|month|year))?$/);
  
  if (!qtyMatch) {
    return { ok: false, error: "Format must be 'N UNIT' or 'N UNIT/period'" };
  }
  
  const rawNum = qtyMatch[1].replace(/,/g, '');
  const unit = qtyMatch[2];
  const period = qtyMatch[3];
  
  const val = parseFloat(rawNum);
  if (isNaN(val)) return { ok: false, error: "Invalid numeric value" };
  
  if (options?.allowedUnits && options.allowedUnits.length > 0) {
       // Check base unit or full unit+period if applicable
       if (!options.allowedUnits.includes(unit)) {
           // Allow if user provided "m3" but allowed is "m³"? No, stick to strict.
           return { ok: false, error: `Unit '${unit}' not allowed. Allowed: ${options.allowedUnits.join(', ')}` };
       }
  }

  return {
    ok: true,
    displayValue: valuePart,
    reasoning: reasonPart,
    normalized: { value: val, unit: unit, period: period ? period.replace('/', '') : null }
  };
};

export const validateEnum = (input: string, allowedEnums: string[]): CanonicalResponse => {
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
};

export const validateRange = (input: string): CanonicalResponse => {
  const parts = parseValueAndReason(input);
  if (!parts) return { ok: false, error: "Missing '— reason' suffix" };
  
  const { valuePart, reasonPart } = parts;
  
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
    displayValue: `${min}–${max}`,
    reasoning: reasonPart,
    normalized: { min, max }
  };
};

export const validateText = (input: string): CanonicalResponse => {
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
};

export const validators = {
  badge: validateBadge,
  score: validateScore,
  currency: validateCurrency,
  quantity: validateQuantity,
  enum: validateEnum,
  range: validateRange,
  text: validateText
};

export const getValidatorForOutputType = (
  outputType: keyof typeof validators,
  options?: OutputValidationOptions
): ((input: string) => CanonicalResponse) => {
  switch (outputType) {
    case "badge":
      return (input) => validateBadge(input, options?.allowedEnums);
    case "score":
      return validateScore;
    case "currency":
      return (input) =>
        validateCurrency(input, {
          allowedCurrencies: options?.allowedCurrencies,
          allowedPeriods: options?.allowedPeriods,
          defaultPeriod: options?.defaultPeriod
        });
    case "quantity":
      return (input) =>
        validateQuantity(input, {
          allowedUnits: options?.allowedUnits,
          allowedPeriods: options?.allowedPeriods,
          defaultPeriod: options?.defaultPeriod
        });
    case "enum":
      if (options?.allowedEnums && options.allowedEnums.length > 0) {
        return (input) => validateEnum(input, options.allowedEnums!);
      }
      return validateText;
    case "range":
      return validateRange;
    case "text":
    default:
      return validateText;
  }
};
