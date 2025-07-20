import { readOnlyArrayToEnum } from "./readonlyArrayToEnum.js";
import { Enum } from "./types.js";

export const hookPrefix = ['on', 'emit', 'before', 'after'] as const;

export type HookPrefix = typeof hookPrefix[number];

export const HookPrefix: Enum<HookPrefix> = readOnlyArrayToEnum(hookPrefix);

export const hookPhases = [
  'Connect',
  'Message',
  'Send',
  'Disconnect',
  'Error'
] as const;

export type HookPhase = typeof hookPhases[number];

export const RefloPhase: Enum<HookPhase> = readOnlyArrayToEnum(hookPhases);

export const emitHookNames = hookPhases.map(phase => `${HookPrefix.emit}${phase}` as const);

export type EmitHookName = typeof emitHookNames[number];

export const EmitHookName: Enum<EmitHookName> = readOnlyArrayToEnum(emitHookNames);

export const onHookNames = hookPhases.map(phase => `${HookPrefix.on}${phase}` as const);

export type OnHookName = typeof onHookNames[number];

export const OnHookName: Enum<OnHookName> = readOnlyArrayToEnum(onHookNames);

export const allHookNames = [
  ...emitHookNames,
  ...onHookNames
];

export type AllHookName = typeof allHookNames[number];

export const AllHookName: Enum<AllHookName> = readOnlyArrayToEnum(allHookNames);