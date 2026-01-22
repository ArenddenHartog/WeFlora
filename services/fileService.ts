import { supabase } from './supabaseClient';
import { buildProjectVaultLinkRows, buildVaultStoragePath } from './vaultUtils';
import type { FileEntity, FileScope, FileStatus, FileVisibility, ProjectFile, KnowledgeCategory } from '../types';
import { FileSheetIcon, FilePdfIcon, FileCodeIcon } from '../components/icons';

export const FILE_BUCKET = 'project_files';
export const VAULT_BUCKET = 'vault';
export const FILE_VALIDATION = {
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ],
  ACCEPTED_FILE_TYPES: '.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp'
};

export interface UploadFileOptions {
  projectId?: string | null;
  scope?: FileScope;
  visibility?: FileVisibility;
  category?: KnowledgeCategory;
  tags?: string[];
  relatedEntityId?: string | null;
  userId?: string;
}

export interface UploadFileResult {
  fileEntity?: FileEntity;
  projectFile?: ProjectFile;
  error?: string;
}

export type VaultScope = 'global' | 'project';

export interface VaultObject {
  id: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256?: string | null;
  confidence?: number | null;

  storage: {
    bucket: string;
    path: string;
  };

  source: {
    kind: 'upload' | 'connector' | 'manual';
    connectorId?: string;
    externalRef?: string;
  };

  tags?: string[];
}

export interface VaultLink {
  id: string;
  projectId: string;
  vaultObjectId: string;
  createdBy: string;
  createdAt: string;
  label?: string | null;
}


const formatFileSize = (sizeBytes: number) => `${(sizeBytes / 1024).toFixed(1)} KB`;

const getFileIcon = (fileName: string) => {
  if (fileName.endsWith('.pdf')) return FilePdfIcon;
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) return FileSheetIcon;
  return FileCodeIcon;
};

const resolveScope = (projectId?: string | null, explicitScope?: FileScope): FileScope => {
  if (explicitScope) return explicitScope;
  if (!projectId) return 'knowledge';
  return 'project';
};

export const mapRecordToFileEntity = (record: any): FileEntity => ({
  id: record.id,
  ownerId: record.user_id,
  projectId: record.project_id ?? null,
  scope: record.scope ?? 'project',
  mimeType: record.mime_type ?? 'application/octet-stream',
  storagePath: record.storage_path ?? `${record.user_id}/${record.id}`,
  tags: record.tags ?? [],
  visibility: record.visibility ?? 'private',
  status: record.status ?? 'active',
  name: record.name,
  size: record.size,
  createdAt: record.created_at ?? new Date().toISOString(),
  category: record.category,
  relatedEntityId: record.related_entity_id ?? null
});

export const mapFileEntityToProjectFile = (entity: FileEntity): ProjectFile => ({
  id: entity.id,
  name: entity.name,
  size: entity.size,
  date: new Date(entity.createdAt).toLocaleDateString(),
  category: entity.category,
  source: 'upload',
  icon: getFileIcon(entity.name),
  tags: entity.tags,
  status: entity.status === 'archived' ? 'archived' : 'active',
  relatedEntityId: entity.relatedEntityId ?? undefined
});

const mapRecordToVaultObject = (record: any): VaultObject => ({
  id: record.id,
  ownerUserId: record.owner_user_id,
  createdAt: record.created_at ?? new Date().toISOString(),
  updatedAt: record.updated_at ?? new Date().toISOString(),
  filename: record.filename,
  mimeType: record.mime_type ?? 'application/octet-stream',
  sizeBytes: record.size_bytes ?? 0,
  sha256: record.sha256 ?? null,
  confidence: record.confidence ?? null,
  storage: {
    bucket: record.storage_bucket ?? VAULT_BUCKET,
    path: record.storage_path ?? ''
  },
  source: {
    kind: record.source_kind ?? 'upload',
    connectorId: record.connector_id ?? undefined,
    externalRef: record.external_ref ?? undefined
  },
  tags: record.tags ?? []
});

export const validateFile = (file: File): string | null => {
  if (file.size > FILE_VALIDATION.MAX_FILE_SIZE) {
    return 'File too large. Max size is 10MB.';
  }
  if (!FILE_VALIDATION.ALLOWED_MIME_TYPES.includes(file.type)) {
    return `Invalid file type: ${file.type}.`;
  }
  return null;
};

export const uploadFile = async (file: File, options: UploadFileOptions = {}): Promise<UploadFileResult> => {
  const validationError = validateFile(file);
  if (validationError) {
    return { error: validationError };
  }

  const userId = options.userId ?? (await supabase.auth.getUser()).data.user?.id;
  if (!userId) {
    return { error: 'Missing user session.' };
  }

  const scope = resolveScope(options.projectId ?? null, options.scope);
  const insertPayload = {
    project_id: options.projectId ?? null,
    user_id: userId,
    name: file.name,
    size: formatFileSize(file.size),
    category: options.category ?? 'Input Data',
    tags: options.tags ?? [],
    scope,
    mime_type: file.type,
    visibility: options.visibility ?? 'private',
    status: 'pending' as FileStatus,
    related_entity_id: options.relatedEntityId ?? null
  };

  const { data: fileRecord, error: dbError } = await supabase
    .from('files')
    .insert(insertPayload)
    .select()
    .single();

  if (dbError || !fileRecord) {
    return { error: 'Database error during upload.' };
  }

  const storagePath = `${userId}/${fileRecord.id}`;
  const { error: storageError } = await supabase.storage.from(FILE_BUCKET).upload(storagePath, file);

  if (storageError) {
    await supabase.from('files').update({ status: 'error' }).eq('id', fileRecord.id);
    return { error: 'Storage upload failed.' };
  }

  const { data: updatedRecord } = await supabase
    .from('files')
    .update({ storage_path: storagePath, status: 'active' })
    .eq('id', fileRecord.id)
    .select()
    .single();

  const entity = mapRecordToFileEntity(updatedRecord ?? fileRecord);
  const projectFile = mapFileEntityToProjectFile(entity);
  return { fileEntity: entity, projectFile };
};

export const uploadToGlobalVault = async (files: File[]): Promise<VaultObject[]> => {
  if (files.length === 0) return [];

  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) {
    throw new Error('Missing user session.');
  }

  const uploaded: VaultObject[] = [];
  for (const file of files) {
    const validationError = validateFile(file);
    if (validationError) {
      throw new Error(validationError);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const storagePath = buildVaultStoragePath(userId, id, file.name);

    const { error: storageError } = await supabase.storage
      .from(VAULT_BUCKET)
      .upload(storagePath, file, { upsert: false });
    if (storageError) {
      const storageBaseUrl = (supabase as any)?.storageUrl ?? (supabase as any)?.url ?? '';
      const requestUrl = storageBaseUrl
        ? `${storageBaseUrl}/object/${VAULT_BUCKET}/${storagePath}`
        : `/${VAULT_BUCKET}/${storagePath}`;
      console.error('[vault-upload] storage error', {
        requestUrl,
        statusCode: storageError.statusCode,
        errorCode: (storageError as any).code,
        message: storageError.message,
        details: (storageError as any).details,
        name: storageError.name
      });
      throw new Error('Storage upload failed. Likely causes: missing bucket, RLS, invalid path, payload too large, or mime not allowed.');
    }

    const { data: inserted, error: insertError } = await supabase
      .from('vault_objects')
      .insert({
        id,
        owner_user_id: userId,
        created_at: now,
        updated_at: now,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        sha256: null,
        storage_bucket: VAULT_BUCKET,
        storage_path: storagePath,
        source_kind: 'upload',
        connector_id: null,
        external_ref: null,
        tags: []
      })
      .select()
      .single();

    if (insertError || !inserted) {
      console.error('[vault-upload] database insert error', {
        table: 'vault_objects',
        storagePath,
        statusCode: (insertError as any)?.status,
        errorCode: (insertError as any)?.code,
        message: insertError?.message,
        details: (insertError as any)?.details
      });
      throw new Error('Database error during vault insert.');
    }

    uploaded.push(mapRecordToVaultObject(inserted));
  }

  return uploaded;
};

export const linkVaultObjectsToProject = async (
  projectId: string,
  vaultObjectIds: string[]
): Promise<VaultLink[]> => {
  if (!projectId || vaultObjectIds.length === 0) return [];

  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) {
    throw new Error('Missing user session.');
  }

  const now = new Date().toISOString();
  const rows = buildProjectVaultLinkRows(projectId, vaultObjectIds, now);

  const { data, error } = await supabase.from('project_vault_links').insert(rows).select();
  if (error || !data) {
    console.error('[vault-upload] link insert error', {
      table: 'project_vault_links',
      projectId,
      statusCode: (error as any)?.status,
      errorCode: (error as any)?.code,
      message: error?.message,
      details: (error as any)?.details
    });
    throw new Error('Database error during vault link insert.');
  }

  return data.map((record: any) => ({
    id: record.id ?? `${record.project_id}-${record.vault_id}`,
    projectId: record.project_id,
    vaultObjectId: record.vault_id,
    createdBy: record.created_by ?? userId,
    createdAt: record.created_at,
    label: record.label ?? null
  }));
};

export const deleteFile = async (fileId: string, userId?: string, hardDelete: boolean = true): Promise<{ error?: string }> => {
  const resolvedUserId = userId ?? (await supabase.auth.getUser()).data.user?.id;
  if (!resolvedUserId) {
    return { error: 'Missing user session.' };
  }

  const { data: record } = await supabase.from('files').select('*').eq('id', fileId).single();
  if (record?.user_id && record.user_id !== resolvedUserId) {
    return { error: 'Permission denied.' };
  }

  const storagePath = record?.storage_path ?? `${resolvedUserId}/${fileId}`;
  await supabase.storage.from(FILE_BUCKET).remove([storagePath]);

  if (hardDelete) {
    const { error } = await supabase.from('files').delete().eq('id', fileId);
    if (error) {
      return { error: 'Failed to delete file record.' };
    }
  } else {
    const { error } = await supabase.from('files').update({ status: 'deleted' }).eq('id', fileId);
    if (error) {
      return { error: 'Failed to update file status.' };
    }
  }

  return {};
};

export const archiveFile = async (fileId: string, userId?: string): Promise<{ error?: string }> => {
  const resolvedUserId = userId ?? (await supabase.auth.getUser()).data.user?.id;
  if (!resolvedUserId) {
    return { error: 'Missing user session.' };
  }

  const { data: record } = await supabase.from('files').select('*').eq('id', fileId).single();
  if (record?.user_id && record.user_id !== resolvedUserId) {
    return { error: 'Permission denied.' };
  }

  const { error } = await supabase.from('files').update({ status: 'archived' }).eq('id', fileId);
  if (error) {
    return { error: 'Failed to archive file.' };
  }

  return {};
};

export const resolveFile = async (fileId: string, fileNameFallback?: string): Promise<File | null> => {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return null;

  const { data: record } = await supabase.from('files').select('*').eq('id', fileId).single();
  const storagePath = record?.storage_path ?? `${userId}/${fileId}`;
  const { data, error } = await supabase.storage.from(FILE_BUCKET).download(storagePath);

  if (error || !data) return null;

  const fileName = record?.name ?? fileNameFallback ?? 'downloaded_file';
  return new File([data], fileName, { type: data.type });
};
