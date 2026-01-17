/**
 * Planner Pack RLS Integration Tests
 *
 * Requires:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import {
  createIntervention,
  listInterventionsForScope
} from '../../src/planner-pack/v1/storage/supabase.ts';
import { PlannerAuthRequiredError, PlannerRlsDeniedError } from '../../src/planner-pack/v1/storage/errors.ts';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('⚠️  Skipping Planner Pack RLS tests: Missing Supabase environment variables');
  process.exit(0);
}

const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

const createAuthedClient = async (email: string) => {
  const password = 'Test-password-123!';
  const { data: { user } } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  assert.ok(user, 'Failed to create test user');

  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  assert.equal(error, null, `Failed to sign in: ${error?.message}`);
  assert.ok(data.session, 'Missing auth session');

  return { client, user };
};

test('Planner Pack RLS: anon cannot insert', async () => {
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  const scopeId = `planner-rls-anon-${Date.now()}`;

  try {
    await createIntervention(anonClient, {
      scopeId,
      name: 'Anon attempt',
      municipality: 'Utrecht',
      interventionType: 'corridor'
    });
    assert.fail('Anon insert should not succeed');
  } catch (error) {
    assert.ok(
      error instanceof PlannerAuthRequiredError || error instanceof PlannerRlsDeniedError,
      'Expected auth or RLS error'
    );
  }
});

test('Planner Pack RLS: authenticated non-member cannot insert', async () => {
  const { client } = await createAuthedClient(`planner-nonmember-${Date.now()}@example.com`);
  const scopeId = `planner-rls-nonmember-${Date.now()}`;

  await assert.rejects(
    () =>
      createIntervention(client, {
        scopeId,
        name: 'Non-member attempt',
        municipality: 'Utrecht',
        interventionType: 'corridor'
      }),
    (error: any) => error instanceof PlannerRlsDeniedError
  );
});

test('Planner Pack RLS: member owner can insert', async () => {
  const { client, user } = await createAuthedClient(`planner-owner-${Date.now()}@example.com`);
  const scopeId = `planner-rls-owner-${Date.now()}`;

  await serviceClient.from('pciv_scope_members').insert({
    scope_id: scopeId,
    user_id: user.id,
    role: 'owner'
  });

  const intervention = await createIntervention(client, {
    scopeId,
    name: 'Owner insert',
    municipality: 'Utrecht',
    interventionType: 'corridor'
  });

  assert.equal(intervention.scopeId, scopeId);
});

test('Planner Pack RLS: viewer cannot write, can read', async () => {
  const { client: ownerClient, user: owner } = await createAuthedClient(`planner-viewer-owner-${Date.now()}@example.com`);
  const scopeId = `planner-rls-viewer-${Date.now()}`;

  await serviceClient.from('pciv_scope_members').insert({
    scope_id: scopeId,
    user_id: owner.id,
    role: 'owner'
  });

  const intervention = await createIntervention(ownerClient, {
    scopeId,
    name: 'Viewer scope',
    municipality: 'Utrecht',
    interventionType: 'corridor'
  });

  const { client: viewerClient, user: viewer } = await createAuthedClient(`planner-viewer-${Date.now()}@example.com`);
  await serviceClient.from('pciv_scope_members').insert({
    scope_id: scopeId,
    user_id: viewer.id,
    role: 'viewer'
  });

  await assert.rejects(
    () =>
      createIntervention(viewerClient, {
        scopeId,
        name: 'Viewer insert',
        municipality: 'Utrecht',
        interventionType: 'corridor'
      }),
    (error: any) => error instanceof PlannerRlsDeniedError
  );

  const interventions = await listInterventionsForScope(viewerClient, scopeId);
  assert.ok(interventions.some((item) => item.id === intervention.id));
});

test('Planner Pack RLS: bootstrap RPC creates membership + intervention', async (t) => {
  const { client, user } = await createAuthedClient(`planner-bootstrap-${Date.now()}@example.com`);
  const scopeId = `planner-rls-bootstrap-${Date.now()}`;

  const probe = await client.rpc('planner_bootstrap_intervention', {
    p_scope_id: 'probe-scope',
    p_name: '',
    p_municipality: null,
    p_intervention_type: 'corridor'
  });

  if (probe.error?.code === 'PGRST202') {
    t.skip('planner_bootstrap_intervention RPC not deployed');
    return;
  }

  const { data, error } = await client.rpc('planner_bootstrap_intervention', {
    p_scope_id: scopeId,
    p_name: 'Bootstrap intervention',
    p_municipality: 'Utrecht',
    p_intervention_type: 'corridor'
  });

  assert.equal(error, null, `Bootstrap should succeed: ${error?.message}`);
  assert.ok(data?.[0]?.intervention_id, 'Bootstrap should return intervention_id');

  const interventions = await listInterventionsForScope(client, scopeId);
  assert.ok(interventions.some((item) => item.id === data[0].intervention_id));

  const { data: memberData } = await client
    .from('pciv_scope_members')
    .select('*')
    .eq('scope_id', scopeId)
    .eq('user_id', user.id);

  assert.ok(memberData?.length > 0, 'User should be a scope member after bootstrap');
});
