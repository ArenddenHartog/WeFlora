import { useCallback, useState } from 'react';
import type { PcivContextViewV1 } from '../../../src/decision-program/pciv/v1/schemas';

interface UsePcivControllerOptions {
  initialStage?: 'import' | 'map' | 'validate';
  initialCommittedContext?: PcivContextViewV1 | null;
}

const DEFAULT_STAGE: 'import' | 'map' | 'validate' = 'import';

const usePcivController = (options: UsePcivControllerOptions = {}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState<'import' | 'map' | 'validate'>(options.initialStage ?? DEFAULT_STAGE);
  const [committedContext, setCommittedContext] = useState<PcivContextViewV1 | null>(
    options.initialCommittedContext ?? null
  );

  const open = useCallback(
    (nextStage: 'import' | 'map' | 'validate' = options.initialStage ?? DEFAULT_STAGE) => {
      setStage(nextStage);
      setIsOpen(true);
    },
    [options.initialStage]
  );

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const commit = useCallback((context: PcivContextViewV1) => {
    setCommittedContext(context);
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    stage,
    open,
    close,
    commit,
    committedContext,
    setCommittedContext
  };
};

export default usePcivController;
