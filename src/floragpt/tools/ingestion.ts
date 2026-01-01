export type IngestionResult = {
  sourceId: string;
  chunksIndexed: number;
  tablesIndexed?: number;
};

export const ingestUpload = async (projectId: string, fileId: string): Promise<IngestionResult> => {
  return {
    sourceId: `${projectId}:${fileId}`,
    chunksIndexed: 0,
    tablesIndexed: 0
  };
};

export const ingestUrl = async (projectId: string, url: string): Promise<IngestionResult> => {
  return {
    sourceId: `${projectId}:${url}`,
    chunksIndexed: 0
  };
};
