import { source as lazySource } from './sourceLazy.js';
import { createDraftBuilder } from './draft/createDraftBuilder.js';

export const draft = createDraftBuilder(lazySource);

export type {
  Draft,
  DraftBuilderInput,
  DraftByEntityModeBuilder,
  DraftCleanup,
  DraftConfig,
  DraftContext,
  DraftMetaOfConfig,
  DraftMode,
  DraftSetInput,
  DraftSetUpdater,
  DraftSetValue,
  DraftSnapshot,
  DraftSnapshotListener,
  DraftState,
  DraftStatus,
  DraftUnit,
} from './draft/index.js';
