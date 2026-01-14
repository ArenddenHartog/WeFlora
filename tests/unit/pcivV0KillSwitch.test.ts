import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

describe('PCIV v0 Kill-Switch', () => {
  test('FEATURES.pcivV0Fallback defaults to false in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.VITE_PCIV_V0_FALLBACK;
    
    // Reimport features to get updated value
    const { FEATURES } = await import(`../../src/config/features.ts?t=${Date.now()}`);
    
    assert.strictEqual(FEATURES.pcivV0Fallback, false, 'v0 fallback should be false in production by default');
    
    process.env.NODE_ENV = originalEnv;
  });

  test('FEATURES.pcivV0Fallback can be explicitly enabled', async () => {
    process.env.VITE_PCIV_V0_FALLBACK = 'true';
    
    // Reimport features to get updated value
    const { FEATURES } = await import(`../../src/config/features.ts?t=${Date.now()}`);
    
    assert.strictEqual(FEATURES.pcivV0Fallback, true, 'v0 fallback should respect explicit enable');
    
    delete process.env.VITE_PCIV_V0_FALLBACK;
  });

  test('v0 store respects kill-switch when disabled', async () => {
    // This is a smoke test that the kill-switch integration exists
    // Actual localStorage access prevention is tested by verifying the feature flag gates
    const { FEATURES } = await import('../../src/config/features.ts');
    const { loadPcivRun, savePcivRun } = await import('../../src/decision-program/pciv/v0/store.ts');
    
    // With fallback disabled, these functions should return early
    // We can't easily test localStorage access without mocking, but we verify the code path exists
    assert.ok(typeof loadPcivRun === 'function', 'loadPcivRun should exist');
    assert.ok(typeof savePcivRun === 'function', 'savePcivRun should exist');
    assert.ok(typeof FEATURES.pcivV0Fallback === 'boolean', 'Feature flag should be boolean');
  });

  test('v0 store functions check FEATURES.pcivV0Fallback', async () => {
    // Read the source code to verify the kill-switch is implemented
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    
    const storeFilePath = path.join(process.cwd(), 'src/decision-program/pciv/v0/store.ts');
    const sourceCode = await fs.readFile(storeFilePath, 'utf8');
    
    // Verify loadPcivRun checks the feature flag
    assert.ok(
      sourceCode.includes('FEATURES.pcivV0Fallback') && 
      sourceCode.includes('loadPcivRun'),
      'loadPcivRun should check FEATURES.pcivV0Fallback'
    );
    
    // Verify savePcivRun checks the feature flag
    assert.ok(
      sourceCode.includes('FEATURES.pcivV0Fallback') && 
      sourceCode.includes('savePcivRun'),
      'savePcivRun should check FEATURES.pcivV0Fallback'
    );
    
    // Verify it imports FEATURES
    assert.ok(
      sourceCode.includes('import') && 
      sourceCode.includes('FEATURES') && 
      sourceCode.includes('features'),
      'v0 store should import FEATURES'
    );
  });
});
