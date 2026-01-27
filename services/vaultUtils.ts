export const buildVaultStoragePath = (userId: string, vaultId: string, filename: string) =>
  `vault/global/${userId}/${vaultId}/${filename}`;

export const buildProjectVaultLinkRows = (projectId: string, vaultObjectIds: string[], createdAt: string) =>
  vaultObjectIds.map((vaultObjectId) => ({
    project_id: projectId,
    vault_id: vaultObjectId,
    created_at: createdAt
  }));
