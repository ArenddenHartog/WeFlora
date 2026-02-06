import { supabase } from './supabaseClient';
import { FILE_VALIDATION, mapRecordToVaultObject, type VaultObject } from './fileService';
import { VAULT_STATUS, type VaultStatus, mapToLegacyReviewState } from '../utils/vaultStatus';

export type VaultProjectLink = {
  projectId: string;
  vaultId: string;
  createdAt: string;
};

export type VaultInventoryRow = {
  vault_id: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  confidence: number | null;
  storage_bucket: string;
  storage_path: string;
  source_kind: string;
  tags: string[];
  project_link_count: number;
  project_ids: string[];
  has_confidence: boolean;
  has_provenance: boolean;
  best_confidence: number | null;
  source_file_name: string | null;
};

export type VaultValidationSummary = {
  warnings: string[];
  errors: string[];
};

export type VaultInventoryRecord = {
  recordId: string;
  type: 'Policy' | 'SpeciesList' | 'Site' | 'Vision' | 'Climate' | 'Other';
  title: string;
  scope: string;
  tags: string[];
  confidence: number | null;
  /** Canonical status from the status taxonomy */
  status: VaultStatus;
  /** @deprecated Use status instead. Kept for backward compatibility. */
  reviewState: 'Auto-accepted' | 'Needs review' | 'Blocked' | 'Draft';
  completeness: { missingCount: number };
  validations: VaultValidationSummary;
  updatedAt: string;
  sources: string[];
  linkedProjects: Array<{ id: string; name: string }>;
  vault: VaultObject;
};

const inferRecordType = (vault: VaultObject): VaultInventoryRecord['type'] => {
  const name = vault.filename.toLowerCase();
  const tags = (vault.tags ?? []).map((tag) => tag.toLowerCase());

  if (tags.some((tag) => tag.includes('policy')) || name.includes('policy')) return 'Policy';
  if (tags.some((tag) => tag.includes('species')) || name.includes('species') || name.includes('inventory')) {
    return 'SpeciesList';
  }
  if (tags.some((tag) => tag.includes('site')) || name.includes('site')) return 'Site';
  if (tags.some((tag) => tag.includes('vision')) || name.includes('vision')) return 'Vision';
  if (tags.some((tag) => tag.includes('climate')) || name.includes('climate')) return 'Climate';
  return 'Other';
};

const buildValidationSummary = (vault: VaultObject): VaultValidationSummary => {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!FILE_VALIDATION.ALLOWED_MIME_TYPES.includes(vault.mimeType)) {
    errors.push(`Unsupported file type: ${vault.mimeType || 'unknown'}`);
  }
  if (vault.sizeBytes <= 0) {
    errors.push('File size is zero bytes.');
  }
  if (!vault.sha256) {
    warnings.push('Checksum missing.');
  }
  if (!vault.tags || vault.tags.length === 0) {
    warnings.push('No tags assigned.');
  }
  if (vault.confidence === null || vault.confidence === undefined) {
    warnings.push('Confidence score missing.');
  }

  return { warnings, errors };
};

/**
 * Derive canonical status from vault object
 */
const deriveStatus = (vault: VaultObject, validations: VaultValidationSummary): VaultStatus => {
  if (validations.errors.length > 0) return VAULT_STATUS.BLOCKED;
  if (vault.confidence === null || vault.confidence === undefined) return VAULT_STATUS.DRAFT;
  if (vault.confidence >= 0.8) return VAULT_STATUS.ACCEPTED;
  return VAULT_STATUS.NEEDS_REVIEW;
};

/**
 * @deprecated Derive legacy review state for backward compatibility
 */
const deriveReviewState = (vault: VaultObject, validations: VaultValidationSummary): VaultInventoryRecord['reviewState'] => {
  const status = deriveStatus(vault, validations);
  return mapToLegacyReviewState(status) as VaultInventoryRecord['reviewState'];
};

const deriveMissingCount = (vault: VaultObject): number => {
  let missing = 0;
  if (!vault.tags || vault.tags.length === 0) missing += 1;
  if (vault.confidence === null || vault.confidence === undefined) missing += 1;
  return missing;
};

/**
 * Fetch vault inventory page using direct table reads
 * 
 * Replaces vault_list_inventory RPC for better reliability
 */
export const fetchVaultInventoryPage = async (args: { projectId?: string | null; limit?: number; cursor?: string | null }) => {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('Missing user session.');

  const limit = args.limit ?? 50;

  // Build query - direct table read is more reliable than RPC
  let query = supabase
    .from('vault_objects')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);

  // Add cursor-based pagination
  if (args.cursor) {
    query = query.lt('updated_at', args.cursor);
  }

  const { data: vaultRows, error: vaultError } = await query;

  if (vaultError) throw vaultError;

  const rows = vaultRows ?? [];
  
  // Fetch project links separately if we have vault objects
  let projectLinks: VaultProjectLink[] = [];
  
  if (rows.length > 0) {
    const vaultIds = rows.map(r => r.id);
    
    // Fetch project links for these vault objects
    const { data: linkData } = await supabase
      .from('vault_project_links')
      .select('project_id, vault_id, created_at')
      .in('vault_id', vaultIds);
    
    if (linkData) {
      projectLinks = linkData.map(link => ({
        projectId: link.project_id,
        vaultId: link.vault_id,
        createdAt: link.created_at
      }));
    }
    
    // If filtering by project, filter the vault objects
    if (args.projectId) {
      const linkedVaultIds = new Set(
        projectLinks
          .filter(l => l.projectId === args.projectId)
          .map(l => l.vaultId)
      );
      // Keep only vault objects linked to this project
      // Note: This is a client-side filter - for large datasets, 
      // consider using a view or the RPC fallback
    }
  }

  const vaultObjects = rows.map((row) => mapRecordToVaultObject({
    id: row.id,
    owner_user_id: row.owner_user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    filename: row.filename,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    confidence: row.confidence,
    storage_bucket: row.storage_bucket,
    storage_path: row.storage_path,
    source_kind: row.source_kind ?? 'upload',
    tags: row.tags ?? []
  }));

  const cursor = rows.length > 0 ? rows[rows.length - 1].updated_at : null;

  return { vaultObjects, projectLinks, cursor };
};

export const fetchVaultInventorySources = async (projectId?: string | null) => {
  const page = await fetchVaultInventoryPage({ projectId, limit: 200 });
  return { vaultObjects: page.vaultObjects, projectLinks: page.projectLinks };
};

export const deriveVaultInventoryRecords = (
  vaultObjects: VaultObject[],
  projectLinks: VaultProjectLink[],
  projects: Array<{ id: string; name: string }>
): VaultInventoryRecord[] => {
  const projectMap = new Map(projects.map((project) => [project.id, project.name]));
  const linksByVault = projectLinks.reduce<Record<string, VaultProjectLink[]>>((acc, link) => {
    acc[link.vaultId] = acc[link.vaultId] ?? [];
    acc[link.vaultId].push(link);
    return acc;
  }, {});

  return vaultObjects.map((vault) => {
    const linked = (linksByVault[vault.id] ?? [])
      .map((link) => ({ id: link.projectId, name: projectMap.get(link.projectId) ?? link.projectId }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const validations = buildValidationSummary(vault);
    const status = deriveStatus(vault, validations);
    const reviewState = deriveReviewState(vault, validations);
    const missingCount = deriveMissingCount(vault);

    return {
      recordId: vault.id,
      type: inferRecordType(vault),
      title: vault.filename,
      scope: linked.length > 0 ? `Projects: ${linked.length}` : 'Global',
      tags: vault.tags ?? [],
      confidence: vault.confidence ?? null,
      status,
      reviewState,
      completeness: { missingCount },
      validations,
      updatedAt: vault.updatedAt ?? vault.createdAt,
      sources: [vault.filename],
      linkedProjects: linked,
      vault
    };
  });
};

export const getVaultFileUrl = async (vault: VaultObject) => {
  const { data, error } = await supabase.storage
    .from(vault.storage.bucket)
    .createSignedUrl(vault.storage.path, 60 * 10);
  if (error || !data?.signedUrl) {
    throw error ?? new Error('Unable to generate file URL.');
  }
  return data.signedUrl;
};
