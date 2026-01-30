# WeFlora Stabilization & UX Consistency Overhaul

**Date**: 2026-01-30  
**Status**: In Progress  
**Branch**: `cursor/weflora-stabilization-overhaul-0c33`

---

## 1. System Audit

### 1.1 User Journey Maps

#### Vault Journey
| Step | UI State | Route | Data Source | RPC/Table | Current Status |
|------|----------|-------|-------------|-----------|----------------|
| View inventory | List view | `/vault` | `vaultInventoryService.ts` | `vault_list_inventory` RPC | Works |
| Filter by type/status | Filter chips active | `/vault?types=Policy` | Local state + URL read | None | Partial - URL read but not driven |
| Select record | Side panel open | `/vault?record=<id>` | Local state | None | **BROKEN** - Uses local state, URL ignored after initial load |
| Open detail tabs | Tab active | `/vault?record=<id>` | `selectedRecord` state | None | Works |
| New intake | Modal open | `/vault?intake=1` | Upload to storage | `vault_objects` insert | Works |
| Navigate to review | Page change | `/vault/review` | `vaultInventoryService.ts` | `vault_list_inventory` | Works |

#### Review Journey
| Step | UI State | Route | Data Source | RPC/Table | Current Status |
|------|----------|-------|-------------|-----------|----------------|
| View queue | List view | `/vault/review` | `fetchVaultInventorySources` | `vault_list_inventory` | Works |
| Claim next | Navigate to detail | `/vault/review/:id` | RPC result | `vault_claim_next_review` | **MISSING RPC** |
| Edit record | Form shown | `/vault/review/:id` | Vault object | `vault_objects` select | **NOT IMPLEMENTED** |
| Save review | Submit changes | `/vault/review/:id` | Form data | `vault_update_review` | **MISSING RPC** |
| Return to queue | Navigate back | `/vault/review` | Refetch | `vault_list_inventory` | Not connected |

#### Skills Journey
| Step | UI State | Route | Data Source | RPC/Table | Current Status |
|------|----------|-------|-------------|-----------|----------------|
| Browse skills | Grid view | `/skills` | `agentProfilesContract` | None (static) | Works |
| View skill detail | Detail page | `/skills/:agentId` | `agentProfilesContract` | None | Works |
| Check readiness | Tab active | `/skills/:agentId` | Vault + contract | `vault_list_inventory` | Works |
| Run skill | Navigate to wizard | `/sessions/new?intent=skill:<id>` | URL param | None | Works |
| Session execution | Wizard steps | `/sessions/new` | Local state | **localStorage only** | **NO DB PERSISTENCE** |
| View results | Session detail | `/sessions/:runId` | `localStorage` | None | Works for local |

#### Flows Journey
| Step | UI State | Route | Data Source | RPC/Table | Current Status |
|------|----------|-------|-------------|-----------|----------------|
| Browse flows | Grid view | `/flows` | `flowTemplates` | None (static) | Works |
| View flow detail | Detail page | `/flows/:flowId` | `flowTemplatesById` | None | Works |
| Build/edit flow | Canvas shown | `/flows/:flowId` | Drag-drop state | `flow_drafts` | **PARTIAL** - upsert missing user_id |
| Validate flow | Toast feedback | `/flows/:flowId` | Local validation | None | Works but limited |
| Save draft | DB persist | `/flows/:flowId` | Steps state | `flow_drafts` upsert | **FAILS** - missing user_id |
| Run flow | Navigate to wizard | `/sessions/new?intent=flow:<id>` | URL param | None | Works |

#### Sessions Journey
| Step | UI State | Route | Data Source | RPC/Table | Current Status |
|------|----------|-------|-------------|-----------|----------------|
| Browse sessions | Grid view | `/sessions` | `localStorage` + `demoRuns` | None | Works |
| Start new session | Wizard | `/sessions/new` | URL intent param | None | Works |
| Upload files | Step 1 | `/sessions/new` | File picker | `vault_objects` | Works |
| Select skills | Step 2 | `/sessions/new` | Checkboxes | None | Works |
| Review readiness | Step 3 | `/sessions/new` | Vault + contracts | `vault_list_inventory` | Works |
| Execute run | Step 4 | `/sessions/new` | Generate events | `create_session_with_idempotency` | **PARTIAL** - RPC may not exist |
| View session | Detail page | `/sessions/:runId` | `localStorage` | None | Works |

---

### 1.2 Top 10 Root Causes of "Looks Present But Does Nothing"

1. **Missing onClick handlers** - Buttons render but have no handler attached
   - Example: "Attach evidence" button in VaultInventoryView L463
   - Example: "Export memo", "Save to Worksheet", "Link to Report" in SkillDetail L425-427

2. **Local state instead of URL-driven selection** - Re-renders reset selection
   - Example: VaultInventoryView uses `useState` for `selectedRecord` instead of URL param
   - Example: Side panel flashes/closes because parent re-render resets state

3. **Silent async failures** - No try/catch or catch swallows errors
   - Example: FlowDetail `handleSave` catches error but only shows toast, no details
   - Example: Many RPC calls don't surface network errors to user

4. **Missing RPC functions** - Code calls RPCs that don't exist in DB
   - Example: `vault_claim_next_review` - called but no migration defines it
   - Example: `vault_update_review` - called but no migration defines it
   - Example: `create_session_with_idempotency` - referenced but may not exist

5. **React Query cache invalidation issues** - Stale data after mutations
   - Not applicable: App doesn't use React Query, uses manual `loadInventory()` calls
   - But: Manual refetch not always called after mutations

6. **Feature flags / dev-only checks hiding functionality**
   - Example: DebugPanel checks `import.meta.env?.DEV` and returns null in prod

7. **Promise rejections not surfaced** - User sees nothing on failure
   - Example: `startReview` in VaultReviewQueueView uses `alert()` for errors - poor UX
   - Example: Many `showNotification('error')` calls but no actionable details

8. **Route mismatches / params not read** - URL has data but component ignores it
   - Example: VaultInventoryView reads `?record=` in useEffect but doesn't drive selection
   - Example: After initial load, URL changes don't update `selectedRecord`

9. **Missing database columns/tables** - Upserts fail silently
   - Example: `flow_drafts` upsert doesn't include `user_id` but column is NOT NULL
   - Error only logged, not surfaced

10. **Race conditions in state updates** - Click fires but effect overrides
    - Example: `setSelectedRecord` in VaultInventoryView may be reset by `loadInventory` effect
    - Example: Quick clicks can cause state desync

---

## 2. UX Standards

### 2.1 Split-View List/Detail Pattern

All list pages with detail panels should follow this pattern:

```
URL Pattern: /<resource>?selected=<uuid>

Behavior:
1. Selection state is ALWAYS derived from URL params
2. Clicking a row calls navigate('/<resource>?selected=<uuid>')
3. Detail panel renders when selected param exists
4. Panel never flashes because state is URL-derived, not useState
5. Browser back/forward works correctly
```

Implementation:
```typescript
// Good: URL-driven selection
const location = useLocation();
const navigate = useNavigate();
const params = new URLSearchParams(location.search);
const selectedId = params.get('selected');

const handleSelect = (id: string) => {
  navigate(`/vault?selected=${id}`, { replace: true });
};

// Bad: Local state selection (causes flash/reset)
const [selectedId, setSelectedId] = useState<string | null>(null);
```

### 2.2 Standard Loading/Empty/Error States

Every data-fetching component must show these states:

| State | Visual | Component |
|-------|--------|-----------|
| Loading | Skeleton or spinner with context | `<LoadingState message="Loading vault records..." />` |
| Empty | Icon + helpful message + CTA | `<EmptyState icon={...} message="..." action={...} />` |
| Error | Red banner + error message + retry | `<ErrorState error={error} onRetry={...} />` |

### 2.3 Standard Button States

Every button must have:
1. **Active handler** - Always has an onClick
2. **Disabled state** - When action not available
3. **Disabled reason** - Tooltip explaining why disabled
4. **Loading state** - While async action in progress

```typescript
// Good: Button with all states
<button
  onClick={handleAction}
  disabled={isLoading || !canPerform}
  title={!canPerform ? 'Upload at least one file first' : undefined}
  className={cn(baseStyles, isLoading && 'animate-pulse')}
>
  {isLoading ? 'Saving...' : 'Save'}
</button>

// Bad: Button that does nothing when conditions not met
<button onClick={() => { if (canPerform) doThing() }}>
  Save
</button>
```

### 2.4 Standard Status Taxonomy

All objects should use this status vocabulary:

| Status | Meaning | Badge Color |
|--------|---------|-------------|
| `draft` | Not yet submitted | Slate/gray |
| `pending` | Awaiting processing | Blue |
| `needs_review` | Requires human review | Amber/yellow |
| `in_review` | Currently being reviewed | Blue |
| `accepted` | Approved/complete | Green/teal |
| `blocked` | Cannot proceed | Red/rose |
| `partial` | Partially complete | Amber |
| `complete` | Fully complete | Green/teal |
| `failed` | Execution failed | Red |
| `canceled` | Manually canceled | Gray |

### 2.5 Async Action Pattern

Every async action must follow this pattern:

```typescript
import { safeAction } from '../utils/safeAction';

const handleSave = safeAction(async () => {
  const result = await supabase.from('table').upsert(data);
  if (result.error) throw result.error;
  showNotification('Saved successfully', 'success');
  return result.data;
}, {
  onError: (error, traceId) => {
    showNotification(`Save failed: ${error.message}`, 'error');
    console.error('[save-failed]', { traceId, error });
  }
});
```

---

## 3. Phase 0: Instrumentation Foundation

### 3.1 Global Error Boundary

Add `components/ErrorBoundary.tsx`:
- Catches all React rendering errors
- Logs to console with trace ID
- Shows user-friendly error UI with retry option
- Reports to telemetry

### 3.2 Safe Action Wrapper

Add `utils/safeAction.ts`:
- Wraps all onClick handlers and async functions
- try/catch with automatic error handling
- Generates trace ID for debugging
- Shows toast on error
- Logs to console with full context

### 3.3 Enhanced Debug Panel

Extend `components/ui/DebugPanel.tsx`:
- Show current route and params
- Show selected IDs (vault, project, session)
- Show last RPC error with details
- Show last session ID
- Show pending mutations
- Copy debug state to clipboard

---

## 4. PR Plan

### Commit 0: Instrumentation Foundation
**Files:**
- `components/ErrorBoundary.tsx` (new)
- `utils/safeAction.ts` (new)
- `components/ui/DebugPanel.tsx` (enhance)
- `components/AppLayout.tsx` (wrap with ErrorBoundary)

**Manual Tests:**
1. Throw error in any component → error boundary catches and shows UI
2. Call safeAction with failing promise → toast shows error
3. Open debug panel → shows route, selected IDs, last error

**Network Calls to Observe:** None (client-side only)

---

### Commit 1: Vault Selection + Side Panel Stability
**Files:**
- `components/vault/VaultInventoryView.tsx`
  - Replace `selectedRecord` state with URL-driven selection
  - Use `navigate('/vault?selected=<id>')` on row click
  - Derive `selectedRecord` from URL param + records array
  - Add stable key to detail panel to prevent flash

**Manual Tests:**
1. Click row → URL updates to `?selected=<id>`
2. Refresh page → same record still selected
3. Browser back → previous selection restored
4. Click another row → detail panel updates without flash
5. Filter records → selection preserved if record still visible

**Network Calls to Observe:**
- `vault_list_inventory` RPC on page load

---

### Commit 2: Review End-to-End
**Files:**
- `supabase/migrations/20260130000001_vault_review_rpcs.sql` (new)
  - Add `vault_claim_next_review` RPC
  - Add `vault_update_review` RPC
- `components/vault/VaultReviewQueueView.tsx`
  - Connect "Start review" to RPC
  - Implement review form at `/vault/review/:id`
  - Handle save with RPC call
  - Navigate back to queue on success

**Manual Tests:**
1. Click "Start review" → navigates to `/vault/review/:id`
2. Edit fields in form → changes visible
3. Click "Save" → RPC called, navigate back to queue
4. Queue refetches → item no longer needs review (or updated)

**Network Calls to Observe:**
- `vault_claim_next_review` RPC
- `vault_update_review` RPC
- `vault_list_inventory` RPC (refetch)

---

### Commit 3: Skills Run/Session Reliability
**Files:**
- `components/sessions/SessionWizard.tsx`
  - Add error handling with safeAction
  - Ensure session always created (even with empty steps)
  - Show progress indicator during run
- `src/agentic/sessions/storage.ts`
  - Add session persistence to DB (optional, fallback to localStorage)
- `services/sessionService.ts` (new)
  - Centralize session creation logic

**Manual Tests:**
1. Run skill with no uploads → session created with `partial` status
2. Run skill with uploads → session created with `complete` status
3. Error during run → toast shows error, session saved as `failed`
4. View `/sessions` → new session appears in list
5. Click session → detail shows all events

**Network Calls to Observe:**
- `vault_objects` insert (if uploading)
- `create_session_with_idempotency` RPC (or new RPC)

---

### Commit 4: Flows Validate/Run Reliability
**Files:**
- `components/agentic/FlowDetail.tsx`
  - Fix `flow_drafts` upsert to include `user_id`
  - Add safeAction wrapper to Save/Validate/Run
  - Show validation errors with specific missing items
- `supabase/migrations/20260130000002_flow_drafts_fix.sql` (new)
  - Ensure user_id is properly set via trigger or default

**Manual Tests:**
1. Click "Validate" with missing context → shows specific missing items
2. Click "Save" → draft saved to DB, success toast
3. Click "Save" again → updates existing draft (no duplicate)
4. Click "Run" → navigates to session wizard with flow intent
5. Complete flow run → session shows all step events

**Network Calls to Observe:**
- `flow_drafts` select/upsert
- `vault_list_inventory` RPC (for validation)

---

## 5. SQL Scripts for Supabase SQL Editor

> **Note:** These scripts can be copy-pasted directly into Supabase SQL Editor.
> Full migration files are in `/supabase/migrations/`.

### 5.1 Vault Review Table & RPCs

```sql
-- ==============================================
-- VAULT REVIEW SYSTEM - Copy to SQL Editor
-- ==============================================

-- 1. Create vault_reviews table
create table if not exists public.vault_reviews (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.vault_objects(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  status text not null check (status in ('in_progress', 'approved', 'rejected', 'deferred')),
  notes text,
  previous_confidence numeric,
  new_confidence numeric,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists vault_reviews_vault_idx on public.vault_reviews (vault_id, created_at desc);
create index if not exists vault_reviews_reviewer_idx on public.vault_reviews (reviewer_id, status);

alter table public.vault_reviews enable row level security;

create policy "Vault reviews select" on public.vault_reviews
  for select to authenticated using (reviewer_id = auth.uid());
create policy "Vault reviews insert" on public.vault_reviews
  for insert to authenticated with check (reviewer_id = auth.uid());
create policy "Vault reviews update" on public.vault_reviews
  for update to authenticated using (reviewer_id = auth.uid());

-- 2. Claim next review item RPC
create or replace function public.vault_claim_next_review()
returns table(
  id uuid, filename text, mime_type text, size_bytes bigint,
  confidence numeric, storage_bucket text, storage_path text,
  tags text[], created_at timestamptz
)
language plpgsql security definer as $$
declare v_vault_id uuid;
begin
  select v.id into v_vault_id
  from public.vault_objects v
  where v.owner_user_id = auth.uid()
    and (v.confidence is null or v.confidence < 0.8)
    and not exists (
      select 1 from public.vault_reviews r
      where r.vault_id = v.id and r.reviewer_id = auth.uid() and r.status = 'in_progress'
    )
  order by case when v.confidence is null then 0 else 1 end, v.confidence asc, v.created_at asc
  limit 1;

  if v_vault_id is null then return; end if;

  insert into public.vault_reviews (vault_id, reviewer_id, status, previous_confidence)
  select v_vault_id, auth.uid(), 'in_progress', vo.confidence
  from public.vault_objects vo where vo.id = v_vault_id;

  return query select v.id, v.filename, v.mime_type, v.size_bytes, v.confidence,
    v.storage_bucket, v.storage_path, v.tags, v.created_at
  from public.vault_objects v where v.id = v_vault_id;
end;
$$;

-- 3. Update review RPC
create or replace function public.vault_update_review(
  p_vault_id uuid, p_status text, p_confidence numeric default null, p_notes text default null
)
returns jsonb language plpgsql security definer as $$
declare v_review_id uuid; v_old_confidence numeric;
begin
  if p_status not in ('approved', 'rejected', 'deferred') then
    raise exception 'Invalid status';
  end if;

  select r.id, r.previous_confidence into v_review_id, v_old_confidence
  from public.vault_reviews r
  where r.vault_id = p_vault_id and r.reviewer_id = auth.uid() and r.status = 'in_progress'
  order by r.created_at desc limit 1;

  if v_review_id is null then raise exception 'No in_progress review found'; end if;

  update public.vault_reviews set status = p_status, notes = p_notes,
    new_confidence = p_confidence, completed_at = now() where id = v_review_id;

  if p_confidence is not null and p_status = 'approved' then
    update public.vault_objects set confidence = p_confidence, updated_at = now()
    where id = p_vault_id and owner_user_id = auth.uid();
  end if;

  return jsonb_build_object('success', true, 'review_id', v_review_id, 'status', p_status);
end;
$$;

grant execute on function public.vault_claim_next_review() to authenticated;
grant execute on function public.vault_update_review(uuid, text, numeric, text) to authenticated;
```

### 5.2 Flow Drafts Fix

```sql
-- ==============================================
-- FLOW DRAFTS FIX - Copy to SQL Editor
-- ==============================================

-- 1. Trigger to auto-set user_id
create or replace function public.set_flow_draft_user_id()
returns trigger language plpgsql security definer as $$
begin
  new.user_id := coalesce(new.user_id, auth.uid());
  if new.user_id != auth.uid() then
    raise exception 'Cannot create flow draft for another user';
  end if;
  return new;
end;
$$;

drop trigger if exists set_flow_draft_user_id_trigger on public.flow_drafts;
create trigger set_flow_draft_user_id_trigger
  before insert or update on public.flow_drafts
  for each row execute function public.set_flow_draft_user_id();

-- 2. Helper RPC for upserting flow drafts
create or replace function public.upsert_flow_draft(p_flow_id text, p_payload jsonb)
returns jsonb language plpgsql security definer as $$
declare v_result record;
begin
  insert into public.flow_drafts (user_id, flow_id, payload, updated_at)
  values (auth.uid(), p_flow_id, p_payload, now())
  on conflict (user_id, flow_id) do update set payload = p_payload, updated_at = now()
  returning id, flow_id, updated_at into v_result;
  return jsonb_build_object('success', true, 'id', v_result.id, 'updated_at', v_result.updated_at);
end;
$$;

grant execute on function public.upsert_flow_draft(text, jsonb) to authenticated;

-- 3. Session idempotency RPC
create or replace function public.create_session_with_idempotency(
  p_idempotency_key text, p_intent jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer as $$
declare v_session_id uuid; v_existing_id uuid;
begin
  select ar.id into v_existing_id from public.agent_runs ar
  where ar.user_id = auth.uid() and ar.title = p_idempotency_key
    and ar.created_at > now() - interval '24 hours' limit 1;

  if v_existing_id is not null then
    return jsonb_build_object('session_id', v_existing_id, 'idempotent', true);
  end if;

  insert into public.agent_runs (scope_id, user_id, title, status)
  values (coalesce(p_intent->>'scope_id', 'default'), auth.uid(), p_idempotency_key, 'running')
  returning id into v_session_id;

  return jsonb_build_object('session_id', v_session_id, 'idempotent', false);
end;
$$;

grant execute on function public.create_session_with_idempotency(text, jsonb) to authenticated;
```

---

## 6. Success Criteria

After all commits are merged:

- [ ] Vault: Click any row → detail panel opens immediately, never flashes
- [ ] Vault: Refresh page with `?selected=<id>` → same record selected
- [ ] Review: "Start review" → fetches next item and navigates
- [ ] Review: Save → updates vault object and returns to queue
- [ ] Skills: Run with no data → session created with `partial` status
- [ ] Skills: Run with data → session created with `complete` status
- [ ] Flows: Validate → shows specific missing context items
- [ ] Flows: Save → persists draft to database
- [ ] All async actions → errors shown as toast with details
- [ ] Debug panel → shows route, selections, last error

---

## 7. Files Changed Summary

| File | Change Type | Commit |
|------|-------------|--------|
| `components/ErrorBoundary.tsx` | New | 0 |
| `utils/safeAction.ts` | New | 0 |
| `components/ui/DebugPanel.tsx` | Modify | 0 |
| `components/AppLayout.tsx` | Modify | 0 |
| `components/vault/VaultInventoryView.tsx` | Modify | 1 |
| `supabase/migrations/20260130000001_vault_review_rpcs.sql` | New | 2 |
| `components/vault/VaultReviewQueueView.tsx` | Modify | 2 |
| `components/sessions/SessionWizard.tsx` | Modify | 3 |
| `services/sessionService.ts` | New | 3 |
| `components/agentic/FlowDetail.tsx` | Modify | 4 |
| `supabase/migrations/20260130000002_flow_drafts_fix.sql` | New | 4 |
