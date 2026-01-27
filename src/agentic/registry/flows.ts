import type { FlowTemplate, InputFieldSpec } from '../../decision-program/contracts/types.ts';

const baseTextInput = (key: string, label: string, description: string): InputFieldSpec => ({
  key,
  label,
  description,
  required: true,
  source: 'value',
  schema: { type: 'string' },
  ui: { control: 'text' }
});

const optionalTextInput = (key: string, label: string, description: string): InputFieldSpec => ({
  key,
  label,
  description,
  required: false,
  source: 'value',
  schema: { type: 'string' },
  ui: { control: 'text' }
});

export const flowTemplates: FlowTemplate[] = [
  {
    id: 'flow.planner_pack_ppp',
    title: 'Planner Pack (PPP)',
    description: 'Produces a submission-ready planner pack from site inputs and inventory context.',
    mode: 'operated',
    personas: ['urban_planner', 'municipal_professional'],
    inputs: [
      baseTextInput('projectName', 'Project name', 'Name of the intervention or corridor.'),
      baseTextInput('location', 'Location', 'Address, municipality, or corridor description.'),
      optionalTextInput('inventorySource', 'Inventory source', 'Optional inventory dataset or file reference.'),
      optionalTextInput('policyScope', 'Policy scope', 'Applicable policy or municipal standard reference.')
    ],
    steps: [
      {
        step_id: 'policy_compliance',
        agent_id: 'compliance.policy_grounded',
        agent_spec_version: '1.0.0',
        agent_schema_version: '1.0.0',
        expected_writes: ['/compliance']
      },
      {
        step_id: 'species_mix',
        agent_id: 'decision.overall_fit_score',
        agent_spec_version: '1.0.0',
        agent_schema_version: '1.0.0',
        expected_writes: ['/species_mix']
      },
      {
        step_id: 'maintenance_plan',
        agent_id: 'maintenance.schedule_recommendation',
        agent_spec_version: '1.0.0',
        agent_schema_version: '1.0.0',
        expected_writes: ['/maintenance']
      }
    ],
    success: {
      required_artifact_types: ['memo', 'options', 'procurement', 'maintenance'],
      required_pointer_paths: ['/compliance', '/species_mix', '/maintenance']
    },
    template_version: '1.0.0',
    tags: ['planner-pack', 'ppp', 'submission'],
    ui: { icon: 'clipboard', accent: 'slate' }
  },
  {
    id: 'flow.planning_core',
    title: 'Planning',
    description: 'Guided planning flow that captures constraints, risks, and recommended actions.',
    mode: 'assistive',
    personas: ['urban_planner', 'consultant'],
    inputs: [
      baseTextInput('planningScope', 'Planning scope', 'Summary of planning objective and boundaries.'),
      baseTextInput('location', 'Location', 'Address, municipality, or corridor description.'),
      optionalTextInput('constraints', 'Known constraints', 'Optional known site or regulatory constraints.')
    ],
    steps: [
      {
        step_id: 'constraints',
        agent_id: 'analysis.strategic_site_regulatory',
        agent_spec_version: '1.0.0',
        agent_schema_version: '1.0.0',
        expected_writes: ['/constraints']
      },
      {
        step_id: 'risk',
        agent_id: 'risk.pest_susceptibility',
        agent_spec_version: '1.0.0',
        agent_schema_version: '1.0.0',
        expected_writes: ['/risk']
      },
      {
        step_id: 'fit',
        agent_id: 'decision.overall_fit_score',
        agent_spec_version: '1.0.0',
        agent_schema_version: '1.0.0',
        expected_writes: ['/fit_score']
      }
    ],
    success: {
      required_pointer_paths: ['/constraints', '/risk', '/fit_score']
    },
    template_version: '1.0.0',
    tags: ['planning', 'constraints', 'risk'],
    ui: { icon: 'map', accent: 'slate' }
  }
];

export const flowTemplatesById: Record<string, FlowTemplate> = Object.fromEntries(
  flowTemplates.map((flow) => [flow.id, flow])
);
