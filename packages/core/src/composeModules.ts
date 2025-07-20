import { HookEmitFn, HookMap, HookOnFn } from "@livo/types/hooks.ts";
import { RefloModule, RegisteredModule } from "./runtime.js";
import { emitHookNames, HookPrefix, OnHookName, onHookNames } from "@livo/enums/hooks.js";

export const composeModules = (modules: RegisteredModule[]) => {
  const composedOnHooks = onHookNames.reduce<HookMap>((prev, hookName) => {
    const composedOnHook = modules.map(({ hooks }) => hooks[hookName]).filter((hook) => Boolean(hook)).reduce<HookOnFn>((composed, hook) => {
      return async (cb) => {
        composed(cb)
        return hook!(cb)
      };
    }, (cb) => {
      cb({})
    })
    return { ...prev, [hookName]: composedOnHook }
  }, {} as HookMap)

  const composedEmitHooks = emitHookNames.reduce<HookMap>((prev, hookName) => {
    const onHookname = hookName.replace(new RegExp(`^${HookPrefix.emit}`), HookPrefix.on) as OnHookName;
    console.log(hookName, onHookname);
    const composedHook = modules.map(({ hooks }) => hooks[hookName]).filter((hook) => Boolean(hook)).reduce<HookEmitFn>((composed, hook) => {
      return async (context) => {
        const nextContex = await composed(context) || context;
        return hook!(nextContex) || nextContex;
      };
    }, (x) => x)
    return { ...prev, [hookName]: composedHook }
  }, {} as HookMap)



  return { ...composedEmitHooks, ...composedOnHooks };
}