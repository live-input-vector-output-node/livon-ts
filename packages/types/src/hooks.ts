import type { RefloContext } from "./context.js";
import { type EmitHookName, type AllHookName, OnHookName } from "@livon/enums/hooks.js";
import type { TypeOrFunction } from './base.js'

export interface HookExecutionProps {
  context: RefloContext;
}

export type HookEmitFn = (prop: RefloContext) => Promise<RefloContext> | RefloContext;
export type HookCb = (prop: RefloContext) => void | Promise<void> | RefloContext | Promise<RefloContext>;
export type HookOnFn = (cb: HookCb) => void;

export type HookMap = {
  [Key in OnHookName]: HookOnFn;
} & {
  [Key in EmitHookName]: HookEmitFn;
}

export type ModuleFactoryOrFunction =
  TypeOrFunction<Partial<HookMap> | void, [emitters: HookMap]>;