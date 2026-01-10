import type { PcivConstraint } from '../../pciv/v0/types';

export const shouldUsePcivConstraints = (pcivConstraints?: PcivConstraint[]) =>
  (pcivConstraints?.length ?? 0) > 0;
