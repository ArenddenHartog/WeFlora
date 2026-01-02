# PR-H Manual QA Script

Use this script to validate the PR-H behavioral requirements end-to-end.

## 1) Clarifying gate
1. Open a Research Session chat.
2. Ask: **“Suggest trees.”**
3. **Expected:** Only clarifying questions are returned (no answer, no table, no worksheet suggestion).

## 2) Full response with reasoning, table, follow-ups
1. Reply with context, for example: **“Street planting, goal is drought tolerance, soil is compacted.”**
2. **Expected:** Narrative summary first, reasoning summary (Approach/Assumptions/Risks), a species-first table in the chat UI, and a Follow-ups section with 3 ordered items.

## 3) Citations behavior
1. Select a project document in the chat context picker.
2. Re-run the same query as in step 2.
3. **Expected:** `meta.sources_used` is populated and each table row shows an (i) icon. Clicking the (i) opens the Citations panel.

## 4) Worksheet preview flow
1. Click **“Preview Worksheet”** from the chat actions.
2. In the preview modal, rename one column.
3. Click **“Submit Worksheet.”**
4. **Expected:** The created worksheet reflects the renamed column and the previewed structure.
