import assert from 'node:assert/strict';
import { handleRouteAction } from '../src/decision-program/ui/decision-accelerator/routeHandlers.ts';

let worksheetCalls = 0;
let reportCalls = 0;

const handledWorksheet = handleRouteAction({
  action: 'route:worksheet',
  onPromoteToWorksheet: () => {
    worksheetCalls += 1;
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
  }
});

assert.ok(handledReport);
assert.equal(reportCalls, 1);

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
