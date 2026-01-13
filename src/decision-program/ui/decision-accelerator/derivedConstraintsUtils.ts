import type { PcivConstraintV1 } from '../../pciv/v1/schemas';

export const shouldUsePcivConstraints = (pcivConstraints?: PcivConstraintV1[]) =>
  (pcivConstraints?.length ?? 0) > 0;
