# PR-H2 QA Checklist

## SQL verification
Run the following query to confirm structured payloads and related columns are stored:

```sql
select
  id,
  thread_id,
  sender,
  text,
  floragpt_payload,
  citations,
  context_snapshot,
  grounding,
  suggested_actions,
  created_at
from public.messages
order by created_at desc
limit 20;
```

## UI verification steps
1. Send a user message in chat and confirm it appears immediately without reloading.
2. Receive a structured FloraGPT response (v0.2) and refresh the page.
3. Confirm the structured response and citations still render after reload.
4. Trigger a json-extraction failure (or simulate fallback) and verify the "Legacy fallback" badge appears on the assistant message.
5. Select project documents before sending a query and confirm the Citations panel populates from selected sources.

## Manual QA (PR-H2 stabilization)
1. Select a project doc, submit a query, and verify `meta.sources_used` is non-empty while the Citations panel shows items.
2. Hard refresh after a structured v0.2 response and confirm `FloraGPTJsonRenderer` renders (not `MessageRenderer`).
3. Provide soil/site details in the last 6 user messages, then ask a new question and confirm no repeat soil/site clarifying questions.
