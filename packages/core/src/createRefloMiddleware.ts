import {
  ModuleFactoryOrFunction
} from "@livon/types/hooks.ts";

export interface RefloModuleDefinition {
  name: string;
  factory: ModuleFactoryOrFunction;
  crationOrder?: number;
}

let creationOrder = 0;

export const createRefloMiddleware = async (
  moduleName: string,
  factoryFunction: ModuleFactoryOrFunction,
): Promise<RefloModuleDefinition> => {
  return {
    name: moduleName,
    factory: factoryFunction,
    crationOrder: creationOrder++,
  };
};