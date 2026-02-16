/**
 * Central TypeScript surface template used by `@livon/client` generator output.
 *
 * Edit this file to change how generated interfaces, call signatures, and
 * property/method signatures are rendered across all generated clients.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/packages/client
 */
import { fileURLToPath } from 'node:url';

export interface InterfaceStartInput {
  name: string;
}

export interface TypeAliasInput {
  name: string;
  body: string;
}

export interface PropertySignatureInput {
  name: string;
  type: string;
  optional?: boolean;
  indent?: string;
}

export interface MethodSignatureInput {
  name: string;
  parameters: string;
  returnType: string;
  optional?: boolean;
  indent?: string;
}

export interface CallSignatureInput {
  parameters: string;
  returnType: string;
  indent?: string;
}

export interface TypeScriptSurfaceTemplate {
  renderInterfaceStart(input: InterfaceStartInput): string;
  renderInterfaceEnd(): string;
  renderTypeAlias(input: TypeAliasInput): string;
  renderPropertySignature(input: PropertySignatureInput): string;
  renderMethodSignature(input: MethodSignatureInput): string;
  renderCallSignature(input: CallSignatureInput): string;
}

const DEFAULT_MEMBER_INDENT = '  ';

const withOptionalMark = (value: string, optional = false): string => (optional ? `${value}?` : value);

const memberIndent = (indent?: string): string => indent ?? DEFAULT_MEMBER_INDENT;

export const typeScriptSurfaceTemplate: TypeScriptSurfaceTemplate = {
  renderInterfaceStart: ({ name }) => `export interface ${name} {`,
  renderInterfaceEnd: () => '}',
  renderTypeAlias: ({ body, name }) => `export type ${name} = ${body};`,
  renderPropertySignature: ({ indent, name, optional, type }) =>
    `${memberIndent(indent)}${withOptionalMark(name, optional)}: ${type};`,
  renderMethodSignature: ({ indent, name, optional, parameters, returnType }) =>
    `${memberIndent(indent)}${withOptionalMark(name, optional)}(${parameters}): ${returnType};`,
  renderCallSignature: ({ indent, parameters, returnType }) =>
    `${memberIndent(indent)}(${parameters}): ${returnType};`,
};

const moduleUrl = (import.meta as { url: string }).url;

export const typeScriptSurfaceTemplateSourceFilePath = fileURLToPath(moduleUrl);
