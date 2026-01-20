import compliancePolicyGrounded from './compliance.policy_grounded.json';
import complianceProcurementScreen from './compliance.procurement_screen.json';
import complianceInvasiveRisk from './compliance.invasive_risk_check.json';
import planningSiteConstraints from './planning.site_constraints_summary.json';
import planningProjectBrief from './planning.project_brief.json';
import biodiversityScore from './biodiversity.species_diversity_score.json';
import climateHeat from './climate_resilience.heat_resilience.json';
import waterStormwater from './water.stormwater_capacity.json';
import carbonCanopy from './carbon.canopy_carbon_estimate.json';
import maintenancePruning from './maintenance.pruning_plan.json';
import procurementAvailability from './procurement.market_availability.json';
import riskFailure from './risk.tree_failure_risk.json';
import enrichmentSpecies from './enrichment.species_enrichment.json';
import geospatialCorridor from './geospatial.corridor_buffering.json';
import documentCompliance from './document.compliance_memo.json';

export const agentOutputFixtures = [
  compliancePolicyGrounded,
  complianceProcurementScreen,
  complianceInvasiveRisk,
  planningSiteConstraints,
  planningProjectBrief,
  biodiversityScore,
  climateHeat,
  waterStormwater,
  carbonCanopy,
  maintenancePruning,
  procurementAvailability,
  riskFailure,
  enrichmentSpecies,
  geospatialCorridor,
  documentCompliance
] as const;

export const agentOutputFixtureMap = Object.fromEntries(
  agentOutputFixtures.map((fixture) => [fixture.agent_id, fixture])
);
