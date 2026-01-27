-- Planner Pack v1.1: extend artifact/run types for maintenance + species mix

begin;

alter table public.planner_runs
  drop constraint if exists planner_runs_worker_type_check;

alter table public.planner_runs
  add constraint planner_runs_worker_type_check
  check (worker_type = any (array['inventory_ingest','planner_pack_compose','maintenance_lifecycle']));

alter table public.planner_artifacts
  drop constraint if exists planner_artifacts_type_check;

alter table public.planner_artifacts
  add constraint planner_artifacts_type_check
  check (type = any (array['memo','options','procurement','email_draft','check_report','maintenance','species_mix']));

commit;
