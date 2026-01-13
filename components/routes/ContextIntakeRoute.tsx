import React, { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import PCIVFlow from '../planning/pciv/PCIVFlow';
import { useAuth } from '../../contexts/AuthContext';
import { getPlanningScopeId } from '../../src/lib/planningScope';
import { parseContextIntakeFocus, parseContextIntakeStage } from '../planning/planningUtils';

type ContextIntakeNavState = {
  returnTo?: string;
  autoStart?: boolean;
};

const ContextIntakeRoute: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { user } = useAuth();
  const routeProjectId = params.projectId ?? null;
  const planningScopeId = useMemo(
    () => routeProjectId ?? getPlanningScopeId(),
    [routeProjectId]
  );

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const focus = parseContextIntakeFocus(searchParams.get('focus'));
  const stage = parseContextIntakeStage(searchParams.get('stage'));
  const initialStage = focus ? 'validate' : stage;

  const navState = (location.state as ContextIntakeNavState | null) ?? null;
  const returnTo = navState?.returnTo ?? '/planning';
  const autoStart = navState?.autoStart ?? false;

  return (
    <PCIVFlow
      projectId={planningScopeId}
      userId={user?.email ?? null}
      initialStage={initialStage}
      onCancel={() => navigate(returnTo)}
      onComplete={(run) => {
        navigate(returnTo, {
          state: {
            pcivRunId: run.id,
            pcivAutoStart: autoStart
          }
        });
      }}
    />
  );
};

export default ContextIntakeRoute;
