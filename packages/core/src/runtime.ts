import { RefloModuleDefinition } from "./createRefloMiddleware.js";
import { resolveTypeOrFn } from '@livon/utils/resolveTypeOrFn.js';

export type RefloModule = Promise<RefloModuleDefinition> | RefloModuleDefinition
import {
  HookMap,
} from '@livon/types/hooks.ts';
import { tryCatchTagged } from "@livon/utils/tryCatchTagged.js";
import { emitHookNames, HookPhase, HookPrefix, onHookNames } from "@livon/enums/hooks.js";
import { RefloContext } from "@livon/types/context.ts";
import { composeModules } from "./composeModules.js";

export type RegisteredModule = {
  name: string;
  hooks: Partial<HookMap>;
};

export interface Pub {
  (): void
}

export interface Sub {
  (): void
}

export interface Ack {
  (): void
}

export interface RefloRuntime {
  pub: Pub,
  sub: Sub,
  ack: Ack,
}

export const runtime = async (...moduleDefs: RefloModule[]): Promise<RefloRuntime> => {
  const modules: RegisteredModule[] = [];

  const emitHookEntries = emitHookNames.map((hookName) => [hookName, (contenx: RefloContext) => {
    console.log('emitHookName')
  }] as const);

  const compose = (modules: RegisteredModule[], prefix: HookPrefix, phase: HookPhase) => {
    return modules.reduce<RefloContext>((context,) => {
      return context
    }, {})
  }
  const onHookEntries = onHookNames.map((hookName) => [hookName, () => { }] as const);

  const hookMap = [...emitHookEntries, ...onHookEntries].reduce<HookMap>((prev, entrie) => {
    return { ...prev, [entrie[0]]: entrie[1] }
  }, {} as any)

  for (const moduleDef of moduleDefs) {
    const resolvedModule = await tryCatchTagged(() => moduleDef)
    if (resolvedModule.ok) {
      const resolvedFactory = await tryCatchTagged(() => resolveTypeOrFn(resolvedModule.data.factory, hookMap));
      if (resolvedFactory.ok) {
        const moduleHooks = resolvedFactory.data || {};
        const moduleName = resolvedModule.data.name;
        modules.push({
          name: moduleName,
          hooks: moduleHooks
        });
      }
    }
  }

  const composedModules = composeModules(modules);

  composedModules.emitMessage({})

  return {
    pub: () => {
      composedModules.emitMessage({});
    },
    sub: () => {
      console.log('sub called');
    },
    ack: () => {
      console.log('ack called');
    }
  };
};