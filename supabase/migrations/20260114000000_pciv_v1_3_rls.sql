-- PCIV v1.3: Row Level Security (RLS) + Ownership Model
-- Enables RLS on all PCIV tables with ownership-based access control.
-- Owned runs (user_id set) are private to the owner.
-- Shared runs (user_id NULL) are readable by all authenticated users.

-- Enable RLS on all PCIV tables
ALTER TABLE pciv_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pciv_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE pciv_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pciv_input_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE pciv_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE pciv_artifacts ENABLE ROW LEVEL SECURITY;

-- pciv_runs policies
-- Service role bypasses RLS
CREATE POLICY "Service role bypass" ON pciv_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Shared runs (user_id NULL): readable by authenticated users
CREATE POLICY "Shared runs select" ON pciv_runs
  FOR SELECT TO authenticated
  USING (user_id IS NULL);

-- Shared runs: writable by authenticated users
CREATE POLICY "Shared runs insert" ON pciv_runs
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Shared runs update" ON pciv_runs
  FOR UPDATE TO authenticated
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Shared runs delete" ON pciv_runs
  FOR DELETE TO authenticated
  USING (user_id IS NULL);

-- Owned runs: readable/writable only by owner
CREATE POLICY "Owned runs select" ON pciv_runs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owned runs insert" ON pciv_runs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owned runs update" ON pciv_runs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owned runs delete" ON pciv_runs
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- pciv_sources policies
CREATE POLICY "Service role bypass" ON pciv_sources
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Sources inherit shared run access" ON pciv_sources
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_sources.run_id AND user_id IS NULL
    )
  );

CREATE POLICY "Sources inherit shared run write" ON pciv_sources
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_sources.run_id AND user_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_sources.run_id AND user_id IS NULL
    )
  );

CREATE POLICY "Sources inherit owned run access" ON pciv_sources
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_sources.run_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Sources inherit owned run write" ON pciv_sources
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_sources.run_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_sources.run_id AND user_id = auth.uid()
    )
  );

-- pciv_inputs policies
CREATE POLICY "Service role bypass" ON pciv_inputs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Inputs inherit shared run access" ON pciv_inputs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_inputs.run_id AND user_id IS NULL
    )
  );

CREATE POLICY "Inputs inherit shared run write" ON pciv_inputs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_inputs.run_id AND user_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_inputs.run_id AND user_id IS NULL
    )
  );

CREATE POLICY "Inputs inherit owned run access" ON pciv_inputs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_inputs.run_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Inputs inherit owned run write" ON pciv_inputs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_inputs.run_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_inputs.run_id AND user_id = auth.uid()
    )
  );

-- pciv_input_sources policies
CREATE POLICY "Service role bypass" ON pciv_input_sources
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Input sources inherit shared run access" ON pciv_input_sources
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_input_sources.run_id AND user_id IS NULL
    )
  );

CREATE POLICY "Input sources inherit shared run write" ON pciv_input_sources
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_input_sources.run_id AND user_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_input_sources.run_id AND user_id IS NULL
    )
  );

CREATE POLICY "Input sources inherit owned run access" ON pciv_input_sources
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_input_sources.run_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Input sources inherit owned run write" ON pciv_input_sources
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_input_sources.run_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_input_sources.run_id AND user_id = auth.uid()
    )
  );

-- pciv_constraints policies
CREATE POLICY "Service role bypass" ON pciv_constraints
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Constraints inherit shared run access" ON pciv_constraints
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_constraints.run_id AND user_id IS NULL
    )
  );

CREATE POLICY "Constraints inherit shared run write" ON pciv_constraints
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_constraints.run_id AND user_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_constraints.run_id AND user_id IS NULL
    )
  );

CREATE POLICY "Constraints inherit owned run access" ON pciv_constraints
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_constraints.run_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Constraints inherit owned run write" ON pciv_constraints
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_constraints.run_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_constraints.run_id AND user_id = auth.uid()
    )
  );

-- pciv_artifacts policies
CREATE POLICY "Service role bypass" ON pciv_artifacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Artifacts inherit shared run access" ON pciv_artifacts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_artifacts.run_id AND user_id IS NULL
    )
  );

CREATE POLICY "Artifacts inherit shared run write" ON pciv_artifacts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_artifacts.run_id AND user_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_artifacts.run_id AND user_id IS NULL
    )
  );

CREATE POLICY "Artifacts inherit owned run access" ON pciv_artifacts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_artifacts.run_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Artifacts inherit owned run write" ON pciv_artifacts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_artifacts.run_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pciv_runs WHERE run_id = pciv_artifacts.run_id AND user_id = auth.uid()
    )
  );
