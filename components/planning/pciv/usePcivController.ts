import { useCallback, useState } from 'react';
import type { PcivCommittedContext, PcivStage } from '../../../src/decision-program/pciv/v0/types';

interface UsePcivControllerOptions {
  initialStage?: PcivStage;
  initialCommittedContext?: PcivCommittedContext | null;
}

const DEFAULT_STAGE: PcivStage = 'import';

const usePcivController = (options: UsePcivControllerOptions = {}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState<PcivStage>(options.initialStage ?? DEFAULT_STAGE);
  const [committedContext, setCommittedContext] = useState<PcivCommittedContext | null>(
    options.initialCommittedContext ?? null
  );

  const open = useCallback(
    (nextStage: PcivStage = options.initialStage ?? DEFAULT_STAGE) => {
      setStage(nextStage);
      setIsOpen(true);
    },
    [options.initialStage]
  );

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const commit = useCallback((context: PcivCommittedContext) => {
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
