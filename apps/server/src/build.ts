import { buildCommit, buildVersion } from '../../../scripts/build-info.ts';

export const BUILD = { version: buildVersion(), commit: buildCommit() } as const;
