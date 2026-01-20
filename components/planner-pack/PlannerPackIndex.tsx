import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { getPlanningScopeId } from '../../src/lib/planningScope';
import { listInterventionsForScope, setGeometry } from '../../src/planner-pack/v1/storage/supabase';
import type { PlannerIntervention } from '../../src/planner-pack/v1/schemas';
import { plannerPackCompose } from '../../src/planner-pack/v1/workers/plannerPackCompose';
import { useUI } from '../../contexts/UIContext';

const DEMO_STORAGE_KEY = 'planner-pack-demo-seeded-v1';

const demoGeometry = {
  kind: 'corridor' as const,
  corridorWidthM: 12,
  geojson: {
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates: [
        [5.0921, 52.0938],
        [5.1042, 52.0944]
      ]
    },
    properties: {}
  },
  lengthM: 1200,
  areaM2: 14400
};

const PlannerPackIndex: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useUI();
  const scopeId = useMemo(() => {
    if (typeof window === 'undefined') {
      return getPlanningScopeId();
    }

    const params = new URLSearchParams(window.location.search);
    const invitedScope = params.get('scope');
    if (invitedScope) {
      window.localStorage.setItem('planning_workspace_scope', invitedScope);
      return invitedScope;
    }

    return getPlanningScopeId();
  }, []);
  const [interventions, setInterventions] = useState<PlannerIntervention[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formMunicipality, setFormMunicipality] = useState('');
  const [formType, setFormType] = useState<'street' | 'park' | 'corridor' | 'district' | 'other'>('corridor');

  const loadInterventions = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await listInterventionsForScope(supabase, scopeId);
      setInterventions(list);
    } catch (error) {
      console.error(error);
      showNotification('Unable to load Planner Pack interventions.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [scopeId, showNotification]);

  const bootstrapIntervention = useCallback(
    async (args: { scopeId: string; name: string; municipality?: string | null; interventionType: string }) => {
      const { data, error } = await supabase.rpc('planner_bootstrap_intervention', {
        p_scope_id: args.scopeId,
        p_name: args.name,
        p_municipality: args.municipality ?? null,
        p_intervention_type: args.interventionType
      });
      if (error) {
        throw new Error(error.message);
      }
      const row = data?.[0];
      if (!row?.intervention_id) {
        throw new Error('bootstrapIntervention failed: no intervention id returned');
      }
      return { interventionId: row.intervention_id, scopeId: row.scope_id };
    },
    []
  );

  useEffect(() => {
    loadInterventions();
  }, [loadInterventions]);

  useEffect(() => {
    const seedDemo = async () => {
      if (interventions.length > 0) return;
      if (typeof window === 'undefined') return;
      if (window.localStorage.getItem(DEMO_STORAGE_KEY)) return;

      try {
        const demoName = 'Kanaalstraat corridor vergroening';
        const demoMunicipality = 'Utrecht';
        const demo = await bootstrapIntervention(supabase, {
          scopeId,
          name: demoName,
          municipality: demoMunicipality,
          interventionType: 'corridor'
        });
        await setGeometry(supabase, demo.interventionId, demoGeometry);
        await plannerPackCompose({
          supabase,
          interventionId: demo.interventionId,
          municipality: demoMunicipality,
          interventionName: demoName,
          geometry: demoGeometry,
          inventorySummary: null,
          sourceIds: []
        });
        window.localStorage.setItem(DEMO_STORAGE_KEY, 'true');
        await loadInterventions();
      } catch (error) {
        console.error(error);
      }
    };

    if (!isLoading) {
      seedDemo();
    }
  }, [interventions.length, isLoading, scopeId, loadInterventions, bootstrapIntervention]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formName.trim()) return;

    setIsCreating(true);
    try {
      const created = await bootstrapIntervention(supabase, {
        scopeId,
        name: formName.trim(),
        municipality: formMunicipality.trim() || null,
        interventionType: formType
      });
      showNotification('WeFlora created the record and set you as owner.', 'success');
      setFormOpen(false);
      setFormName('');
      setFormMunicipality('');
      setFormType('corridor');
      navigate(`/planner-pack/${created.interventionId}`);
    } catch (error) {
      console.error(error);
      showNotification('Failed to create intervention.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-layout-root>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Planner Pack</h1>
        <p className="text-sm text-slate-500">Submission-ready intervention packs prepared by WeFlora.</p>
      </header>

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          {isLoading ? 'Loading interventions…' : `${interventions.length} intervention${interventions.length === 1 ? '' : 's'}`}
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="px-4 py-2 bg-weflora-teal text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-weflora-dark"
        >
          New Intervention
        </button>
      </div>

      {formOpen && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <label className="text-sm font-semibold text-slate-700">
              Name
              <input
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Kanaalstraat corridor vergroening"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Municipality
              <input
                value={formMunicipality}
                onChange={(event) => setFormMunicipality(event.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Utrecht"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Intervention type
              <select
                value={formType}
                onChange={(event) => setFormType(event.target.value as any)}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="street">Street</option>
                <option value="corridor">Corridor</option>
                <option value="park">Park</option>
                <option value="district">District</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-2 bg-weflora-teal text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-weflora-dark disabled:opacity-60"
            >
              {isCreating ? 'Creating…' : 'Create intervention'}
            </button>
          </div>
        </form>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {interventions.map((intervention) => (
          <button
            key={intervention.id}
            onClick={() => navigate(`/planner-pack/${intervention.id}`)}
            className="text-left border border-slate-200 rounded-xl p-4 bg-white hover:border-weflora-teal transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{intervention.name}</h3>
                <p className="text-sm text-slate-500">{intervention.municipality ?? 'Municipality'}</p>
              </div>
              <span className="text-xs font-semibold text-weflora-dark bg-weflora-mint/20 px-2 py-1 rounded-full">
                {intervention.status.replace('_', ' ')}
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-400">Prepared by WeFlora · Ready for review</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default PlannerPackIndex;
