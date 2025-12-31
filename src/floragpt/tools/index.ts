import { ingestUpload, ingestUrl } from './ingestion.ts';
import { retrieveGlobal, retrieveProject, retrievePolicy } from './retrieval.ts';
import { rerank } from './rerank.ts';
import { compress } from './compress.ts';

export const floragptTools = {
  ingest: {
    upload: ingestUpload,
    url: ingestUrl
  },
  retrieve: {
    global: retrieveGlobal,
    project: retrieveProject,
    policy: retrievePolicy
  },
  rerank,
  compress
};
