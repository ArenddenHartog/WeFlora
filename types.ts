import React from 'react';
import type { SkillTemplateId } from './services/skillTemplates';

export type SkillOutputType = 'text' | 'badge' | 'score' | 'currency' | 'quantity' | 'enum' | 'range';

export interface User {
  name: string;
  email: string;
  avatar: string;
  isPro: boolean;
}

export interface Member {
    id: string;
    name: string;
    initials: string;
}

export interface Workspace {
    id: string;
    name: string;
    type: 'Personal' | 'Organization';
    avatar?: string; // URL or initials
}

export interface PinnedProject {
  id: string;
  name: string;
  icon: React.ElementType;
  status: 'Active' | 'Archived';
  date: string;
  members: Member[];
  workspaceId: string;
}

export interface RecentItem {
  id: string;
  name: string;
  group: string;
}

export interface Chat {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  time: string;
  tags?: string[];
}

export interface ProjectFile {
    id: string;
    name: string;
    icon: React.ElementType;
    file?: File;
    type?: string;
    size?: string;
    date?: string;
    status?: 'active' | 'archived';
    // Enhanced fields for Files Hub
    category?: KnowledgeCategory; // e.g., 'Research', 'Input', 'Output'
    source?: 'upload' | 'generated' | 'reference' | 'worksheet-input';
    relatedEntityId?: string; // ID of the worksheet or report this file is linked to
    tags?: string[];
}

// -- Knowledge Base Types --
export type KnowledgeCategory = 'Internal' | 'Policy' | 'Research' | 'External' | 'Project Assets' | 'Input Data';

export interface KnowledgeItem {
    id: string;
    title: string;
    category: KnowledgeCategory;
    tags: string[];
    date: string;
    size: string;
    type: 'pdf' | 'xlsx' | 'docx' | 'txt';
    author: string;
}

// -- Unified Context Types --
export type ContextSource = 'project' | 'knowledge' | 'upload' | 'web' | 'report' | 'worksheet';

export interface ContextItem {
    id: string;
    name: string;
    source: ContextSource;
    itemId?: string; // ID of the original item if it exists (project file or KB)
    file?: File; // Raw file if upload
    content?: string; // NEW: Raw text content for internal assets (Reports/Worksheets)
    description?: string; // Metadata or snippet
}

export interface MemoryPolicy {
    id?: string;
    userId: string;
    shortTermWindow: number;
    topN: number;
    summaryTrigger: number;
    summaryMinGapMinutes: number;
    memoryEnabled: boolean;
    allowSummaries: boolean;
    maxMemoryItems: number;
}

export type MemoryItemKind = 'profile' | 'preference' | 'fact' | 'summary';

export interface MemoryItem {
    id: string;
    userId: string;
    kind: MemoryItemKind;
    content: string;
    sourceThreadId?: string;
    metadata?: Record<string, any>;
    createdAt?: string;
    lastUsedAt?: string;
    importance?: number;
}

export interface MemorySummary {
    profile: string[];
    preferences: string[];
    stableFacts: string[];
    summary: string;
}

// -- Thread / Research Session Types --
export interface Thread {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messages: ChatMessage[];
    contextSnapshot?: ContextItem[]; // Context used when thread started
    isPinned?: boolean;
}

// -- Species DB Types --
export interface Species {
    id: string;
    scientificName: string;
    commonName: string;
    family: string;
    tags: string[];
}

// -- Templates (Replaces Library) --

export interface WorksheetTemplate {
    id: string;
    title: string;
    description: string;
    tags: string[];
    columns: MatrixColumn[]; // Pre-defined columns
    rows?: MatrixRow[]; // Optional default data
    usageCount: number;
    lastUsed: string;
    isSystem: boolean;
}

export interface PromptTemplate {
    id: string;
    title: string;
    description: string;
    templateText: string; // The visible prompt text for the user
    systemInstruction?: string; // The invisible instruction for the AI ("The Translator")
    tags: string[];
    usageCount: number;
    lastUsed: string;
    isSystem: boolean;
}

export interface ReportTemplate {
    id: string;
    title: string;
    description: string;
    content: string; // Markdown content
    tags: string[];
    usageCount: number;
    lastUsed: string;
    isSystem: boolean;
}

// Temporary alias for backward compatibility if needed, though we are removing LibraryTemplate
export type TemplateType = 'Prompt' | 'Project' | 'Workflow';
export interface LibraryTemplate {
    id: string;
    title: string;
    description: string;
    type: TemplateType;
    content: string;
    tags: string[];
    usageCount: number;
    lastUsed: string;
    isSystem: boolean;
}


export interface Citation {
  source: string;
  text: string;
  type: 'research' | 'project_file';
}

export interface WebSource {
    uri: string;
    title: string;
}

export interface MapSource {
    uri: string;
    title: string;
}

export interface GroundingMetadata {
    webSources?: WebSource[];
    mapSources?: MapSource[];
    searchEntryPoint?: any;
}

export interface ReasoningStep {
    id: string;
    text: string;
    status: 'pending' | 'active' | 'completed';
}

export interface ChatMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    avatar?: string;
    citations?: Citation[];
    attachments?: ProjectFile[];
    grounding?: GroundingMetadata;
    contextSnapshot?: ContextItem[]; // Traceability: What context was active when this message was sent?
    reasoningSteps?: ReasoningStep[]; // For Deep Research visualization
    suggestedActions?: Array<{ label: string, action: string, icon?: string }>; // "Convert to Worksheet"
    createdAt?: string;
}

// -- Analytics & Visualizations --

export interface LifecycleCost {
    year: number;
    cumulativeCost: number;
    maintenance: number;
    water: number;
    capital: number;
}

export interface WaterUsage {
    month: string;
    gallons: number;
    rainfallOffset: number;
}

export interface SpeciesDistribution {
    species: string;
    count: number;
    color: string;
}

export interface TreeLocation {
    id: string;
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    species: string;
    status: 'Planned' | 'Planted' | 'Critical' | 'Healthy';
    dbh: number; // Diameter at Breast Height in inches
}

// -- Matrix / Reasoning Engine Types --

export type MatrixColumnType = 'text' | 'number' | 'select' | 'ai';

export interface ConditionalFormattingRule {
    id: string;
    condition: 'contains' | 'equals' | 'starts_with' | 'greater_than' | 'less_than';
    value: string;
    style: 'green' | 'amber' | 'red' | 'blue' | 'slate';
}

export interface SkillConfiguration {
    id: string; 
    name: string;           // e.g. "Zoning Validator"
    description?: string;   // e.g. "Checks species against 2024 City Policy"
    
    // The "Brain"
    promptTemplate: string; // [LEGACY] e.g. "Analyze {Row} against the attached PDF..."
    templateId?: SkillTemplateId; // NEW: References a locked template
    params?: Record<string, any>; // NEW: Parameters for the locked template
    
    // The "Context" (The Anthropic Skill Feature)
    attachedContextIds: string[]; // IDs of ProjectFiles or KnowledgeItems specific to this column
    
    // The "Inputs" (Dependencies)
    requiredColumnIds?: string[]; // e.g. This skill needs 'DBH' and 'Species' to work
    
    // The "Output" (Visuals)
    outputType: SkillOutputType;
    outputConfig?: {
        badgeColors?: { [key: string]: string }; // Legacy support
    };
    conditionalFormatting?: ConditionalFormattingRule[]; // NEW: Explicit visual rules
}

export interface MatrixColumn {
    id: string;
    title: string;
    type: MatrixColumnType;
    width?: number; // pixel width
    options?: string[]; // For select type
    aiPrompt?: string; // Legacy: For AI type
    skillConfig?: SkillConfiguration; // NEW: Replaces simple 'aiPrompt' for Skills
    visible?: boolean; // Controls column visibility in the view
    isPrimaryKey?: boolean; // Identifies the entity name column
}

export interface MatrixCell {
    columnId: string;
    value: string | number;
    status?: 'idle' | 'loading' | 'success' | 'error'; // For AI processing
    citations?: Citation[]; // Verification for AI cells
    colSpan?: number; // For merging cells horizontally
    
    // NEW: Skill Output Fields
    displayValue?: string;
    reasoning?: string;
    outputType?: SkillOutputType;
    normalized?: any;
    provenance?: {
       skillTemplateId?: string;
       skillRunId?: string;
       model?: string;
       ranAt?: string;
       contextFileIds?: string[];
       promptHash?: string;
    };
}

export interface MatrixRow {
    id: string;
    entityName?: string; // The "Primary Key" extracted (e.g. "Quercus robur")
    linkedFileId?: string; 
    linkedSpeciesId?: string; // Link to canonical species
    sourceMeta?: {
        fileId: string;
        fileName: string;
        pageNumber?: number;
        rawSnippet?: string; // The text block where this entity was found
    };
    cells: { [columnId: string]: MatrixCell };
}

export interface Matrix {
    id: string;
    projectId?: string; // Optional: if null/undefined, it's a standalone worksheet
    title: string; // The Document Title (if root) or Tab Title (if child)
    tabTitle?: string; // NEW: Optional specific name for the tab, distinct from Document Title
    description?: string;
    columns: MatrixColumn[];
    rows: MatrixRow[];
    updatedAt?: string;
    parentId?: string; // NEW: ID of the parent WorksheetDocument
    order?: number; // NEW: Order in the tab list
}

export interface DiscoveredStructure {
    id: string;
    title: string;
    description: string;
    suggestedColumns: string[];
    confidence: 'High' | 'Medium' | 'Low';
}

// -- Report Types (Renamed from Doc) --
export interface Report {
    id: string;
    projectId?: string; // Optional: if null, standalone
    title: string; // Document Title (if root)
    tabTitle?: string; // NEW: Optional specific tab name
    content: string; // Markdown content
    lastModified: string;
    tags?: string[];
    parentId?: string; // NEW: ID of the parent ReportDocument
    order?: number; // NEW: Order in the tab list
}

// -- NEW DOCUMENT CONTAINER TYPES --

export interface WorksheetDocument {
    id: string;
    projectId?: string;
    title: string; // The "File Name"
    description?: string;
    createdAt: string;
    updatedAt: string;
    tabs: Matrix[]; // The content
}

export interface ReportDocument {
    id: string;
    projectId?: string;
    title: string; // The "File Name"
    description?: string;
    createdAt: string;
    updatedAt: string;
    tabs: Report[]; // The content
}

export interface ProjectData {
    analytics: {
        costs: LifecycleCost[];
        water: WaterUsage[];
        diversity: SpeciesDistribution[];
    };
    map: {
        image?: string; // Optional background image
        trees: TreeLocation[];
    };
    matrices?: Matrix[];
}

export interface ProjectInsights {
    summary: string;
    metrics: { label: string, value: string, icon?: string }[];
    actions: { text: string, type: 'missing_data' | 'suggestion' }[];
    updatedAt: string;
}

// -- Collaborative / Team Types --

export type TaskStatus = 'Todo' | 'In Progress' | 'Done';
export type TaskPriority = 'Low' | 'Medium' | 'High';

export interface Task {
    id: string;
    title: string;
    assigneeId: string; // Member ID
    dueDate: string;
    status: TaskStatus;
    priority: TaskPriority;
    projectId: string;
}

export interface TeamComment {
    id: string;
    memberId: string;
    text: string;
    timestamp: string;
    projectId: string;
}

export type ViewMode = 'home' | 'projects' | 'project' | 'chat' | 'knowledge_base' | 'worksheets' | 'prompts' | 'reports' | 'research_history' | 'report_editor';
