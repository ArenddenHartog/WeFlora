import assert from 'node:assert/strict';
import test from 'node:test';
import { createMemoryRouter } from 'react-router-dom';
import { planningRoutePaths } from '../../components/routes/planningRoutePaths.ts';
import { getContextIntakeUrl } from '../../components/planning/planningUtils.ts';

test('planning routes navigate to context intake and back', async () => {
  const router = createMemoryRouter(
    [
      ...planningRoutePaths.planning.map((path) => ({ path, element: null })),
      ...planningRoutePaths.contextIntake.map((path) => ({ path, element: null }))
    ],
    { initialEntries: ['/planning'] }
  );

  assert.equal(router.state.location.pathname, '/planning');

  await router.navigate(getContextIntakeUrl('import'));
  assert.equal(router.state.location.pathname, '/planning/context-intake');
  assert.ok(router.state.matches.some((match) => match.route.path === '/planning/context-intake'));

  await router.navigate('/planning');
  assert.equal(router.state.location.pathname, '/planning');
});
