export interface SkillTemplate {
    id: string;
    category: 'Compliance' | 'Maintenance' | 'Finance' | 'Analysis';
    name: string;
    description: string;
    promptTemplate: string;
    outputType: 'text' | 'badge' | 'score' | 'currency';
}

export const SKILL_TEMPLATES: SkillTemplate[] = [
    {
        id: 'st-zoning',
        category: 'Compliance',
        name: 'Zoning Check',
        description: 'Checks if species complies with standard urban zoning.',
        promptTemplate: 'Analyze {Row} against standard urban zoning requirements. Output format: "Status - Key Factor" (e.g. "Approved - Non-invasive").',
        outputType: 'badge'
    },
    {
        id: 'st-native',
        category: 'Compliance',
        name: 'Native Status',
        description: 'Verifies native status for the region.',
        promptTemplate: 'Determine if {Row} is native to [Insert Region]. Output format: "Status - Origin" (e.g. "Native - Local Ecotype").',
        outputType: 'badge'
    },
    {
        id: 'st-maint-sched',
        category: 'Maintenance',
        name: 'Maintenance Schedule',
        description: 'Generates a brief pruning/watering summary.',
        promptTemplate: 'Create a 1-sentence maintenance summary for {Row} focusing on pruning and watering needs.',
        outputType: 'text'
    },
    {
        id: 'st-urgency',
        category: 'Maintenance',
        name: 'Pruning Urgency',
        description: 'Estimates urgency based on growth rate.',
        promptTemplate: 'Estimate pruning urgency for {Row} based on typical growth rate. Output format: "Score/100 - Frequency" (e.g. "80/100 - Annual").',
        outputType: 'score'
    },
    {
        id: 'st-cost-est',
        category: 'Finance',
        name: 'Cost Estimator',
        description: 'Estimates average market unit cost.',
        promptTemplate: 'Estimate the average market unit cost for {Row} (standard size). Output format: "$Amount".',
        outputType: 'currency'
    },
    {
        id: 'st-resilience',
        category: 'Analysis',
        name: 'Resilience Score',
        description: 'Scores urban resilience (drought/pollution).',
        promptTemplate: 'Rate the urban resilience of {Row} considering drought and pollution. Output format: "Score/100 - Key Trait".',
        outputType: 'score'
    }
];
