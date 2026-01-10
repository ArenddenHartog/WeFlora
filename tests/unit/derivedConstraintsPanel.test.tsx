import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DerivedConstraints } from '../../src/decision-program/types';
import type { PcivConstraint } from '../../src/decision-program/pciv/v0/types';
import DerivedConstraintsPanel from '../../src/decision-program/ui/decision-accelerator/DerivedConstraintsPanel';

const legacyConstraints: DerivedConstraints = {
  regulatory: {
    setting: 'Urban core',
    saltToleranceRequired: null,
    protectedZone: null,
    permitNeeded: null,
    maxHeightClass: null,
    notes: null
  },
  site: {
    lightExposure: null,
    soilType: null,
    moisture: null,
    compactionRisk: null,
    rootingVolumeClass: null,
    crownClearanceClass: null,
    utilitiesPresent: null,
    setbacksKnown: null
  },
  equity: {
    priorityZones: null,
    heatVulnerability: null,
    asthmaBurden: null,
    underservedFlag: null
  },
  biophysical: {
    canopyCover: null,
    lstClass: null,
    distanceToPaved: null,
    floodRisk: null
  },
  meta: {
    derivedFrom: []
  }
};

const legacyMarkup = renderToStaticMarkup(
  React.createElement(DerivedConstraintsPanel, {
    derivedConstraints: legacyConstraints,
    pcivConstraints: []
  })
);
assert.ok(legacyMarkup.includes('Structured constraints extracted from evidence.'));
assert.ok(legacyMarkup.includes('Urban core'));
assert.ok(!legacyMarkup.includes('context intake'));

const pcivConstraints: PcivConstraint[] = [
  {
    id: 'pciv-1',
    key: 'regulatory.setting',
    domain: 'regulatory',
    label: 'Setting',
    value: 'Urban core',
    provenance: 'source-backed'
  }
];

const pcivMarkup = renderToStaticMarkup(
  React.createElement(DerivedConstraintsPanel, {
    derivedConstraints: legacyConstraints,
    pcivConstraints
  })
);
assert.ok(pcivMarkup.includes('Structured constraints extracted from context intake.'));
assert.ok(pcivMarkup.includes('Setting'));
