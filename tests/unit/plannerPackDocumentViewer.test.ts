import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeHtml } from '../../components/planner-pack/documentSanitizer.ts';

test('DocumentViewer sanitizes raw HTML tags', () => {
  const html = '<script>alert("x")</script><p>Safe content</p>';
  const output = sanitizeHtml(html);

  assert.ok(!output.includes('<script'));
  assert.ok(output.includes('Safe content'));
});
