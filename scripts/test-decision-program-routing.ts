import assert from 'node:assert/strict';
import { buildRouteLogEntry, handleRouteAction } from '../src/decision-program/ui/decision-accelerator/routeHandlers.ts';

let worksheetCalls = 0;
let reportCalls = 0;
const stateLogs: Array<{ message: string }> = [];

const handledWorksheet = handleRouteAction({
  action: 'route:worksheet',
  onPromoteToWorksheet: () => {
    worksheetCalls += 1;
    stateLogs.push(buildRouteLogEntry({ action: 'route:worksheet', runId: 'run-1' }));
  },
  onDraftReport: () => {
    reportCalls += 1;
  }
});

assert.ok(handledWorksheet);
assert.equal(worksheetCalls, 1);
assert.equal(reportCalls, 0);

const handledReport = handleRouteAction({
  action: 'route:report',
  onPromoteToWorksheet: () => {
    worksheetCalls += 1;
  },
  onDraftReport: () => {
    reportCalls += 1;
    stateLogs.push(buildRouteLogEntry({ action: 'route:report', runId: 'run-1' }));
  }
});

assert.ok(handledReport);
assert.equal(reportCalls, 1);
assert.equal(stateLogs.length, 2);
assert.equal(stateLogs[0].message, 'User routed run to worksheet');
assert.equal(stateLogs[1].message, 'User routed run to report');

const handledOther = handleRouteAction({
  action: 'resolve:/context/site/soilType',
  onPromoteToWorksheet: () => {
    worksheetCalls += 1;
  },
  onDraftReport: () => {
    reportCalls += 1;
  }
});

assert.equal(handledOther, false);
assert.equal(worksheetCalls, 1);
assert.equal(reportCalls, 1);
