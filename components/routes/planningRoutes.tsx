import React from 'react';
import type { RouteObject } from 'react-router-dom';
import PlanningRoute from './PlanningRoute';
import ContextIntakeRoute from './ContextIntakeRoute';
import { planningRoutePaths } from './planningRoutePaths';

export const planningRoutes: RouteObject[] = [
  ...planningRoutePaths.planning.map((path) => ({ path, element: <PlanningRoute /> })),
  ...planningRoutePaths.contextIntake.map((path) => ({ path, element: <ContextIntakeRoute /> }))
];
