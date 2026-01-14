/**
 * PCIV Supabase Membership RLS Integration Tests
 * 
 * Tests membership-based authorization for PCIV scopes.
 * Requires Supabase environment variables:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import {
  createDraftRun,
  listScopeMembers,
  upsertScopeMember,
  upsertSources,
  upsertInputs,
  commitRun,
  fetchContextViewByRunId,
  type CreateRunOptions
} from '../../src/decision-program/pciv/v1/storage/supabase.ts';
import { PcivRlsDeniedError, PcivAuthRequiredError } from '../../src/decision-program/pciv/v1/storage/rls-errors.ts';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('⚠️  Skipping membership RLS tests: Missing Supabase environment variables');
  process.exit(0);
}

const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

test('PCIV Membership: Bootstrap requires auth', async () => {
  // Create anon client (no session)
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  
  const scopeId = `membership-test-anon-${Date.now()}`;
  
  // Calling createDraftRun without auth should fail
  try {
    // This should throw because there's no authenticated user
    const { error } = await anonClient.rpc('pciv_bootstrap_scope', {
      p_scope_id: scopeId,
      p_create_draft_run: true
    });
    
    assert.ok(error, 'Bootstrap should fail without auth');
    assert.match(error.message, /auth|401|42501/i, 'Error should be auth-related');
  } catch (err: any) {
    // Expected: auth error
    assert.ok(
      err instanceof PcivAuthRequiredError || err.message?.includes('auth'),
      'Should throw auth-required error'
    );
  }
});

test('PCIV Membership: Bootstrap creates scope membership + first run', async () => {
  // Create test user
  const testEmail = `membership-test-${Date.now()}@example.com`;
  const { data: { user } } = await serviceClient.auth.admin.createUser({
    email: testEmail,
    password: 'test-password-123',
    email_confirm: true
  });

  assert.ok(user, 'Failed to create test user');

  // Get user session
  const { data: sessionData } = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email!
  });

  assert.ok(sessionData.properties, 'Failed to generate session');

  // Create authenticated client
  const userClient = createClient(supabaseUrl, supabaseAnonKey);
  await userClient.auth.setSession({
    access_token: sessionData.properties.access_token,
    refresh_token: sessionData.properties.refresh_token
  });

  const scopeId = `membership-test-bootstrap-${Date.now()}`;

  try {
    // Call bootstrap RPC
    const { data, error } = await userClient.rpc('pciv_bootstrap_scope', {
      p_scope_id: scopeId,
      p_create_draft_run: true
    });

    assert.equal(error, null, `Bootstrap should succeed: ${error?.message}`);
    assert.ok(data, 'Bootstrap should return data');
    assert.ok(data[0]?.run_id, 'Bootstrap should return run_id');
    
    // Verify run exists
    const { data: runData, error: runError } = await userClient
      .from('pciv_runs')
      .select('*')
      .eq('id', data[0].run_id)
      .single();

    assert.equal(runError, null, 'Should be able to read created run');
    assert.equal(runData.scope_id, scopeId, 'Run should have correct scope_id');
    assert.equal(runData.status, 'draft', 'Run should be draft');

    // Verify membership exists
    const { data: memberData, error: memberError } = await userClient
      .from('pciv_scope_members')
      .select('*')
      .eq('scope_id', scopeId)
      .eq('user_id', user.id);

    assert.equal(memberError, null, 'Should be able to read membership');
    assert.ok(memberData?.length > 0, 'User should be a member');
    assert.equal(memberData[0].role, 'owner', 'User should be owner');

  } finally {
    // Cleanup
    await serviceClient.from('pciv_runs').delete().eq('scope_id', scopeId);
    await serviceClient.from('pciv_scope_members').delete().eq('scope_id', scopeId);
    await serviceClient.auth.admin.deleteUser(user.id);
  }
});

test('PCIV Membership: Viewer cannot write', async () => {
  // Create two test users: owner and viewer
  const ownerEmail = `owner-${Date.now()}@example.com`;
  const viewerEmail = `viewer-${Date.now()}@example.com`;
  
  const { data: { user: owner } } = await serviceClient.auth.admin.createUser({
    email: ownerEmail,
    password: 'test-password-123',
    email_confirm: true
  });

  const { data: { user: viewer } } = await serviceClient.auth.admin.createUser({
    email: viewerEmail,
    password: 'test-password-123',
    email_confirm: true
  });

  assert.ok(owner && viewer, 'Failed to create test users');

  const scopeId = `membership-test-viewer-${Date.now()}`;

  try {
    // Bootstrap scope with owner
    const { data: bootstrapData } = await serviceClient.rpc('pciv_bootstrap_scope', {
      p_scope_id: scopeId,
      p_create_draft_run: true
    });

    const runId = bootstrapData[0].run_id;

    // Add viewer as member
    await serviceClient
      .from('pciv_scope_members')
      .insert({
        scope_id: scopeId,
        user_id: viewer.id,
        role: 'viewer',
        created_by: owner.id
      });

    // Create viewer client
    const { data: viewerSession } = await serviceClient.auth.admin.generateLink({
      type: 'magiclink',
      email: viewer.email!
    });

    const viewerClient = createClient(supabaseUrl, supabaseAnonKey);
    await viewerClient.auth.setSession({
      access_token: viewerSession.properties!.access_token,
      refresh_token: viewerSession.properties!.refresh_token
    });

    // Viewer should be able to read
    const { data: readRun, error: readError } = await viewerClient
      .from('pciv_runs')
      .select('*')
      .eq('id', runId)
      .single();

    assert.equal(readError, null, 'Viewer should be able to read');
    assert.ok(readRun, 'Viewer should see run data');

    // Viewer should NOT be able to write
    const { error: writeError } = await viewerClient
      .from('pciv_sources')
      .insert({
        id: crypto.randomUUID(),
        run_id: runId,
        kind: 'regulation',
        title: 'Test Source',
        parse_status: 'success'
      });

    assert.ok(writeError, 'Viewer should not be able to write');

  } finally {
    // Cleanup
    await serviceClient.from('pciv_runs').delete().eq('scope_id', scopeId);
    await serviceClient.from('pciv_scope_members').delete().eq('scope_id', scopeId);
    await serviceClient.auth.admin.deleteUser(owner.id);
    await serviceClient.auth.admin.deleteUser(viewer.id);
  }
});

test('PCIV Membership: Editor can write', async () => {
  // Create test user
  const editorEmail = `editor-${Date.now()}@example.com`;
  
  const { data: { user: editor } } = await serviceClient.auth.admin.createUser({
    email: editorEmail,
    password: 'test-password-123',
    email_confirm: true
  });

  assert.ok(editor, 'Failed to create test user');

  const scopeId = `membership-test-editor-${Date.now()}`;

  try {
    // Bootstrap scope
    const { data: bootstrapData } = await serviceClient.rpc('pciv_bootstrap_scope', {
      p_scope_id: scopeId,
      p_create_draft_run: true
    });

    const runId = bootstrapData[0].run_id;

    // Update editor to have editor role (they start as owner from bootstrap)
    // Actually, let's add editor as a second member
    const ownerEmail = `owner2-${Date.now()}@example.com`;
    const { data: { user: owner } } = await serviceClient.auth.admin.createUser({
      email: ownerEmail,
      password: 'test-password-123',
      email_confirm: true
    });

    // Update scope to have owner as owner and original as editor
    await serviceClient
      .from('pciv_scope_members')
      .insert({
        scope_id: scopeId,
        user_id: owner.id,
        role: 'owner',
        created_by: editor.id
      });

    await serviceClient
      .from('pciv_scope_members')
      .update({ role: 'editor' })
      .eq('scope_id', scopeId)
      .eq('user_id', editor.id);

    // Create editor client
    const { data: editorSession } = await serviceClient.auth.admin.generateLink({
      type: 'magiclink',
      email: editor.email!
    });

    const editorClient = createClient(supabaseUrl, supabaseAnonKey);
    await editorClient.auth.setSession({
      access_token: editorSession.properties!.access_token,
      refresh_token: editorSession.properties!.refresh_token
    });

    // Editor should be able to write sources
    const sourceId = crypto.randomUUID();
    const { error: sourceError } = await editorClient
      .from('pciv_sources')
      .insert({
        id: sourceId,
        run_id: runId,
        kind: 'regulation',
        title: 'Test Source',
        parse_status: 'success'
      });

    assert.equal(sourceError, null, 'Editor should be able to write sources');

    // Editor should be able to write inputs
    const { error: inputError } = await editorClient
      .from('pciv_inputs')
      .insert({
        id: crypto.randomUUID(),
        run_id: runId,
        pointer: 'test.input',
        label: 'Test Input',
        domain: 'site',
        required: false,
        field_type: 'text',
        value_kind: 'string',
        value_string: 'test',
        provenance: 'user-entered',
        updated_by: 'user',
        updated_at: new Date().toISOString()
      });

    assert.equal(inputError, null, 'Editor should be able to write inputs');

    // Editor should be able to commit
    const { error: commitError } = await editorClient
      .from('pciv_runs')
      .update({
        status: 'committed',
        committed_at: new Date().toISOString()
      })
      .eq('id', runId);

    assert.equal(commitError, null, 'Editor should be able to commit run');

  } finally {
    // Cleanup
    await serviceClient.from('pciv_runs').delete().eq('scope_id', scopeId);
    await serviceClient.from('pciv_scope_members').delete().eq('scope_id', scopeId);
    await serviceClient.auth.admin.deleteUser(editor.id);
  }
});

test('PCIV Membership: Non-member cannot access scope', async () => {
  // Create two users: member and non-member
  const memberEmail = `member-${Date.now()}@example.com`;
  const nonMemberEmail = `nonmember-${Date.now()}@example.com`;
  
  const { data: { user: member } } = await serviceClient.auth.admin.createUser({
    email: memberEmail,
    password: 'test-password-123',
    email_confirm: true
  });

  const { data: { user: nonMember } } = await serviceClient.auth.admin.createUser({
    email: nonMemberEmail,
    password: 'test-password-123',
    email_confirm: true
  });

  assert.ok(member && nonMember, 'Failed to create test users');

  const scopeId = `membership-test-nonmember-${Date.now()}`;

  try {
    // Bootstrap scope with member
    const { data: bootstrapData } = await serviceClient.rpc('pciv_bootstrap_scope', {
      p_scope_id: scopeId,
      p_create_draft_run: true
    });

    const runId = bootstrapData[0].run_id;

    // Create non-member client
    const { data: nonMemberSession } = await serviceClient.auth.admin.generateLink({
      type: 'magiclink',
      email: nonMember.email!
    });

    const nonMemberClient = createClient(supabaseUrl, supabaseAnonKey);
    await nonMemberClient.auth.setSession({
      access_token: nonMemberSession.properties!.access_token,
      refresh_token: nonMemberSession.properties!.refresh_token
    });

    // Non-member should NOT be able to read
    const { data: readRun } = await nonMemberClient
      .from('pciv_runs')
      .select('*')
      .eq('id', runId)
      .maybeSingle();

    assert.equal(readRun, null, 'Non-member should not be able to read');

    // Non-member should NOT be able to write
    const { error: writeError } = await nonMemberClient
      .from('pciv_sources')
      .insert({
        id: crypto.randomUUID(),
        run_id: runId,
        kind: 'regulation',
        title: 'Test Source',
        parse_status: 'success'
      });

    assert.ok(writeError, 'Non-member should not be able to write');

  } finally {
    // Cleanup
    await serviceClient.from('pciv_runs').delete().eq('scope_id', scopeId);
    await serviceClient.from('pciv_scope_members').delete().eq('scope_id', scopeId);
    await serviceClient.auth.admin.deleteUser(member.id);
    await serviceClient.auth.admin.deleteUser(nonMember.id);
  }
});

console.log('✅ PCIV membership RLS integration tests completed');
