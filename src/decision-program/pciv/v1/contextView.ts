import { PcivContextViewV1Schema, type PcivContextViewV1 } from './schemas.ts';

export const assertPcivContextView = (view: unknown): PcivContextViewV1 => {
  return PcivContextViewV1Schema.parse(view);
};
