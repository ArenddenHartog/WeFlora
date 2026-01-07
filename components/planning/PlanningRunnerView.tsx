import React from 'react';
import type { DecisionModeViewProps } from '../../src/decision-program/ui/decision-accelerator/DecisionModeView';
import DecisionModeView from '../../src/decision-program/ui/decision-accelerator/DecisionModeView';

const PlanningRunnerView: React.FC<DecisionModeViewProps> = (props) => {
  return (
    <DecisionModeView
      {...props}
      labels={{
        startRun: 'Start Planning',
        promotionSummary: 'Planning matrix promotion',
        promotionMessage: 'Planning Matrix promoted to Worksheet.'
      }}
      stepperTitle="Planning flow"
      stepperSubtitle={`Run ${props.state.runId} · ${props.state.status}`}
    />
  );
};

export default PlanningRunnerView;
