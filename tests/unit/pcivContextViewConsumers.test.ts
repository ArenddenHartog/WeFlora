import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPcivContextView } from '../../src/decision-program/pciv/v1/contextView.ts';
import { PcivContextViewV1Schema } from '../../src/decision-program/pciv/v1/schemas.ts';

test('Planning and Skills consume the same PcivContextViewV1 shape', () => {
  const fixture = {
    run: {
      id: '11111111-1111-4111-8111-111111111111',
      scopeId: 'project-123',
      userId: '22222222-2222-4222-8222-222222222222',
      status: 'committed',
      allowPartial: false,
      committedAt: '2025-01-02T03:04:05.000Z',
      createdAt: '2025-01-02T03:04:05.000Z',
      updatedAt: '2025-01-02T03:04:05.000Z'
    },
    sourcesById: {
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        runId: '11111111-1111-4111-8111-111111111111',
        kind: 'file',
        title: 'Site report',
        uri: 's3://example/site-report.pdf',
        fileId: null,
        mimeType: 'application/pdf',
        sizeBytes: 5120,
        parseStatus: 'parsed',
        excerpt: 'Site report excerpt',
        rawMeta: {},
        createdAt: '2025-01-02T03:04:05.000Z'
      }
    },
    inputsByPointer: {
      'site.name': {
        id: '33333333-3333-4333-8333-333333333333',
        runId: '11111111-1111-4111-8111-111111111111',
        pointer: 'site.name',
        label: 'Site name',
        domain: 'site',
        required: true,
        fieldType: 'text',
        options: null,
        valueKind: 'string',
        valueString: 'Pine Ridge',
        valueNumber: null,
        valueBoolean: null,
        valueEnum: null,
        valueJson: null,
        provenance: 'user-entered',
        updatedBy: 'user',
        updatedAt: '2025-01-02T03:04:05.000Z',
        evidenceSnippet: null,
        sourceIds: []
      },
      'site.acres': {
        id: '44444444-4444-4444-8444-444444444444',
        runId: '11111111-1111-4111-8111-111111111111',
        pointer: 'site.acres',
        label: 'Site acreage',
        domain: 'site',
        required: true,
        fieldType: 'text',
        options: null,
        valueKind: 'number',
        valueString: null,
        valueNumber: 42,
        valueBoolean: null,
        valueEnum: null,
        valueJson: null,
        provenance: 'model-inferred',
        updatedBy: 'model',
        updatedAt: '2025-01-02T03:04:05.000Z',
        evidenceSnippet: null,
        sourceIds: []
      },
      'site.hasWetlands': {
        id: '55555555-5555-4555-8555-555555555555',
        runId: '11111111-1111-4111-8111-111111111111',
        pointer: 'site.hasWetlands',
        label: 'Wetlands present',
        domain: 'biophysical',
        required: false,
        fieldType: 'boolean',
        options: null,
        valueKind: 'boolean',
        valueString: null,
        valueNumber: null,
        valueBoolean: true,
        valueEnum: null,
        valueJson: null,
        provenance: 'source-backed',
        updatedBy: 'system',
        updatedAt: '2025-01-02T03:04:05.000Z',
        evidenceSnippet: 'Report notes wetlands near stream.',
        sourceIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']
      }
    },
    constraints: [],
    artifactsByType: {
      summary: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          runId: '11111111-1111-4111-8111-111111111111',
          type: 'summary',
          title: 'Summary',
          payload: { text: 'Summary text.' },
          createdAt: '2025-01-02T03:04:05.000Z'
        }
      ]
    }
  };

  const parsedViaSchema = PcivContextViewV1Schema.parse(fixture);
  const view = assertPcivContextView(parsedViaSchema);

  const planningConsumer = (context: typeof view) => {
    const siteName = context.inputsByPointer['site.name'];
    const siteAcres = context.inputsByPointer['site.acres'];
    const wetlands = context.inputsByPointer['site.hasWetlands'];

    assert.equal(siteName.valueKind, 'string');
    assert.equal(siteName.valueString, 'Pine Ridge');

    assert.equal(siteAcres.valueKind, 'number');
    assert.equal(siteAcres.valueNumber, 42);

    assert.equal(wetlands.valueKind, 'boolean');
    assert.equal(wetlands.valueBoolean, true);

    return { siteName, siteAcres, wetlands };
  };

  const skillsConsumer = (context: typeof view) => {
    const inputs = Object.values(context.inputsByPointer);
    inputs.forEach((input) => {
      if (input.provenance === 'source-backed') {
        assert.ok(input.sourceIds && input.sourceIds.length > 0, 'Missing sourceIds for source-backed input');
      }
    });
    return true;
  };

  const planningResult = planningConsumer(view);
  const skillsResult = skillsConsumer(view);

  assert.ok(planningResult.siteName === view.inputsByPointer['site.name']);
  assert.ok(skillsResult);
});
