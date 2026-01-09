import React from 'react';
import type { DecisionModeViewProps } from '../../src/decision-program/ui/decision-accelerator/DecisionModeView';
import DecisionModeView from '../../src/decision-program/ui/decision-accelerator/DecisionModeView';

const PlanningRunnerView: React.FC<DecisionModeViewProps & { startLabel?: string }> = ({ startLabel, ...props }) => {
  return (
    <DecisionModeView
      {...props}
      labels={{
        startRun: startLabel ?? 'Start Planning',
        promotionSummary: 'Planning matrix promotion',
        promotionMessage: 'Planning Matrix promoted to Worksheet.'
      }}
      stepperTitle="Planning flow"
    />
  );
};

export default PlanningRunnerView;
