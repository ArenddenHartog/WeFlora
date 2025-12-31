import { ingestUpload, ingestUrl } from './ingestion';
import { retrieveGlobal, retrieveProject, retrievePolicy } from './retrieval';
import { rerank } from './rerank';
import { compress } from './compress';

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
