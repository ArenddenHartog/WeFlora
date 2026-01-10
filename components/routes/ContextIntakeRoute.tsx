import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import PCIVFlow from '../planning/pciv/PCIVFlow';
import { useAuth } from '../../contexts/AuthContext';
import { resolvePlanningProject } from '../../src/lib/projects/resolvePlanningProject';
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
  const [resolvedProjectId, setResolvedProjectId] = useState<string | null>(routeProjectId);

  useEffect(() => {
    if (routeProjectId) {
      setResolvedProjectId(routeProjectId);
      return;
    }
    let active = true;
    resolvePlanningProject().then((resolved) => {
      if (!active || !resolved) return;
      setResolvedProjectId(resolved.projectId);
    });
    return () => {
      active = false;
    };
  }, [routeProjectId]);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const focus = parseContextIntakeFocus(searchParams.get('focus'));
  const stage = parseContextIntakeStage(searchParams.get('stage'));
  const initialStage = focus ? 'validate' : stage;

  const navState = (location.state as ContextIntakeNavState | null) ?? null;
  const returnTo = navState?.returnTo ?? '/planning';
  const autoStart = navState?.autoStart ?? false;

  if (!resolvedProjectId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Preparing context intake...
      </div>
    );
  }

  return (
    <PCIVFlow
      projectId={resolvedProjectId}
      userId={user?.email ?? null}
      initialStage={initialStage}
      onCancel={() => navigate(returnTo)}
      onComplete={(commit) => {
        navigate(returnTo, {
          state: {
            pcivCommittedAt: commit.committed_at,
            pcivAutoStart: autoStart
          }
        });
      }}
    />
  );
};

export default ContextIntakeRoute;
