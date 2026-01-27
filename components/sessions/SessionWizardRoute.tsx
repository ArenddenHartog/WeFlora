import React from 'react';
import { useSearchParams } from 'react-router-dom';
import SessionWizard from './SessionWizard';
import { parseSessionIntent } from '../../src/agentic/intents/sessionIntent';

const SessionWizardRoute: React.FC = () => {
  const [searchParams] = useSearchParams();
  const intent = parseSessionIntent(searchParams.get('intent'));

  return <SessionWizard intent={intent} />;
};

export default SessionWizardRoute;
