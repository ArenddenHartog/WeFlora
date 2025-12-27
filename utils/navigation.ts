import type { NavigateFunction } from 'react-router-dom';

type CreatedKind = 'report' | 'worksheet';

export type NavigateToCreatedEntityArgs = {
  navigate: NavigateFunction;
  kind: CreatedKind;
  withinProject: boolean;
  projectId?: string;
  reportId?: string;
  matrixId?: string;
  focusTabId?: string;
  replace?: boolean;
};

export function navigateToCreatedEntity(args: NavigateToCreatedEntityArgs) {
  const {
    navigate,
    kind,
    withinProject,
    projectId,
    reportId,
    matrixId,
    focusTabId,
    replace = false,
  } = args;

  const entityId = kind === 'report' ? reportId : matrixId;

  if (withinProject) {
    if (!projectId) return;

    if (kind === 'report') {
      navigate(`/project/${projectId}/reports`, {
        replace,
        state: { focusReportTabId: focusTabId || entityId },
      });
      return;
    }

    navigate(`/project/${projectId}/worksheets`, {
      replace,
      state: { focusWorksheetTabId: focusTabId || entityId },
    });
    return;
  }

  if (!entityId) return;

  if (kind === 'report') {
    navigate(`/reports/${entityId}`, { replace });
    return;
  }

  navigate(`/worksheets/${entityId}`, { replace });
}

