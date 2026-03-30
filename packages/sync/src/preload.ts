interface SourceModule {
  source: typeof import('./source/index.js').source;
}

interface ActionModule {
  action: typeof import('./action/index.js').action;
}

interface StreamModule {
  stream: typeof import('./stream/index.js').stream;
}

let sourceModulePromise: Promise<SourceModule> | undefined;
let actionModulePromise: Promise<ActionModule> | undefined;
let streamModulePromise: Promise<StreamModule> | undefined;

export const loadLazySourceModule = (): Promise<SourceModule> => {
  sourceModulePromise ??= import('./source/index.js');
  return sourceModulePromise;
};

export const loadLazyActionModule = (): Promise<ActionModule> => {
  actionModulePromise ??= import('./action/index.js');
  return actionModulePromise;
};

export const loadLazyStreamModule = (): Promise<StreamModule> => {
  streamModulePromise ??= import('./stream/index.js');
  return streamModulePromise;
};

export interface PreloadInput {
  source?: boolean;
  action?: boolean;
  stream?: boolean;
}

export const preload = async ({
  source = true,
  action = true,
  stream = true,
}: PreloadInput = {}): Promise<void> => {
  await Promise.all([
    source ? loadLazySourceModule() : Promise.resolve(undefined),
    action ? loadLazyActionModule() : Promise.resolve(undefined),
    stream ? loadLazyStreamModule() : Promise.resolve(undefined),
  ]);
};
