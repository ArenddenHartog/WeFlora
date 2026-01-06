import Ajv from 'ajv';
import { createRequire } from 'node:module';
import type { DecisionProgram } from '../types.ts';

const require = createRequire(import.meta.url);
const schema = require('../dp.schema.json');

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

const formatErrors = (errors: typeof validate.errors) => {
  if (!errors) return [];
  return errors.map((error) => {
    const path = error.instancePath || '(root)';
    const details = error.message ? ` ${error.message}` : '';
    const keyword = error.keyword ? ` (${error.keyword})` : '';
    return `${path}${details}${keyword}`.trim();
  });
};

export const validateDecisionProgram = (program: DecisionProgram) => {
  const ok = validate(program);
  if (ok) {
    return { ok: true } as const;
  }
  const errors = formatErrors(validate.errors);
  console.error('decision_program_validation_failed', {
    programId: program?.id,
    errors,
    details: validate.errors
  });
  return { ok: false, errors, details: validate.errors } as const;
};
