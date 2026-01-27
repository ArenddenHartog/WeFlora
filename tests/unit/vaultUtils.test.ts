import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProjectVaultLinkRows, buildVaultStoragePath } from '../../services/vaultUtils.ts';

test('buildVaultStoragePath constructs vault/global path with filename', () => {
  const path = buildVaultStoragePath('user-123', 'vault-456', 'report.pdf');
  assert.equal(path, 'vault/global/user-123/vault-456/report.pdf');
});

test('buildProjectVaultLinkRows creates pointer link rows', () => {
  const rows = buildProjectVaultLinkRows('project-1', ['vault-a', 'vault-b'], '2026-01-22T00:00:00.000Z');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    project_id: 'project-1',
    vault_id: 'vault-a',
    created_at: '2026-01-22T00:00:00.000Z'
  });
});
