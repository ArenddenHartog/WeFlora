export const STREET_TREE_SHORTLIST_REQUIRED_POINTERS = [
  '/context/site/locationType',
  '/context/site/geo/locationHint',
  '/context/site/soil/type',
  '/context/site/soil/moisture',
  '/context/site/soil/compaction',
  '/context/site/light',
  '/context/site/space/rootingVolumeClass',
  '/context/site/space/crownClearanceClass',
  '/context/site/stressors/drought',
  '/context/site/stressors/heat',
  '/context/regulatory/setting',
  '/context/regulatory/constraints/utilityConflicts',
  '/context/regulatory/constraints/setbacksKnown',
  '/context/equity/priority',
  '/context/species/goals/primaryGoal',
  '/context/species/constraints/allergiesOrToxicityConcern',
  '/context/species/diversity/rule',
  '/context/supply/availabilityRequired'
];

export const STREET_TREE_SHORTLIST_OPTIONAL_POINTERS = [
  '/context/site/stripWidthM',
  '/context/site/soil/ph',
  '/context/species/constraints/invasivesConcern'
];

export const STREET_TREE_SHORTLIST_POINTER_GROUPS = {
  site: [
    '/context/site/locationType',
    '/context/site/geo/locationHint',
    '/context/site/soil/type',
    '/context/site/soil/moisture',
    '/context/site/soil/compaction',
    '/context/site/light',
    '/context/site/space/rootingVolumeClass',
    '/context/site/space/crownClearanceClass',
    '/context/site/stressors/drought',
    '/context/site/stressors/heat',
    '/context/site/stripWidthM',
    '/context/site/soil/ph'
  ],
  regulatory: ['/context/regulatory/setting', '/context/regulatory/constraints/utilityConflicts', '/context/regulatory/constraints/setbacksKnown'],
  equity: ['/context/equity/priority'],
  species: [
    '/context/species/goals/primaryGoal',
    '/context/species/constraints/allergiesOrToxicityConcern',
    '/context/species/diversity/rule',
    '/context/species/constraints/invasivesConcern'
  ],
  supply: ['/context/supply/availabilityRequired']
};
