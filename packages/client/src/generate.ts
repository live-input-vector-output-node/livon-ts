/**
 * Client code-generation entrypoint exported as `@livon/client/generate`.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/packages/client
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstNode } from './client.js';

export interface GenerateClientFilesOptions {
  ast: AstNode;
  exportName?: string;
  astModuleName?: string;
  clientModuleName?: string;
}

export interface GeneratedClientFiles {
  files: Record<string, string>;
  astFile: string;
  clientFile: string;
}

interface NamedNode {
  name: string;
  typeName: string;
  node: AstNode;
}

interface OperationSpec {
  name: string;
  input?: AstNode;
  output?: AstNode;
  doc?: Readonly<Record<string, unknown>>;
  publishTopics: string[];
  requestType?: string;
  responseType?: string;
  constraints?: Readonly<Record<string, unknown>>;
}

interface EventSpec {
  topic: string;
  payloadType: string;
  doc?: Readonly<Record<string, unknown>>;
  constraints?: Readonly<Record<string, unknown>>;
  requestType?: string;
  responseType?: string;
  payloadNode?: AstNode;
}

interface FieldOperationSpec {
  owner: string;
  field: string;
  input?: AstNode;
  output?: AstNode;
  doc?: Readonly<Record<string, unknown>>;
  requestType?: string;
  responseType?: string;
  dependsOnType?: string;
  constraints?: Readonly<Record<string, unknown>>;
}

interface FieldOperationGroup {
  owner: string;
  operations: FieldOperationSpec[];
}

interface TypeDefinitionsResult {
  definitions: string[];
  fieldTypeNames: Map<string, Map<string, string>>;
}

interface OperationDefinitionsResult {
  lines: string[];
  clientLines: string[];
}

const AST_PLACEHOLDER = '${{LIVON_AST}}';
const CLIENT_IMPORTS_PLACEHOLDER = '${{LIVON_CLIENT_IMPORTS}}';
const CLIENT_TYPE_DEFS_PLACEHOLDER = '${{LIVON_CLIENT_TYPE_DEFS}}';
const CLIENT_EVENT_MAP_PLACEHOLDER = '${{LIVON_CLIENT_EVENT_MAP}}';
const CLIENT_SUB_HANDLER_DEFS_PLACEHOLDER = '${{LIVON_CLIENT_SUB_HANDLER_DEFS}}';
const CLIENT_FIELD_OPS_PLACEHOLDER = '${{LIVON_CLIENT_FIELD_OPS}}';
const CLIENT_OP_DEFS_PLACEHOLDER = '${{LIVON_CLIENT_OP_DEFS}}';
const CLIENT_OP_LINES_PLACEHOLDER = '${{LIVON_CLIENT_OP_LINES}}';
const CLIENT_SUB_NAMES_PLACEHOLDER = '${{LIVON_CLIENT_SUB_NAMES}}';
const CLIENT_EXPORT_NAME_PLACEHOLDER = '${{LIVON_CLIENT_EXPORT_NAME}}';
const moduleUrl = (import.meta as { url: string }).url;
const templatesDir = path.resolve(path.dirname(fileURLToPath(moduleUrl)), '../templates');
const sourceFilePath = fileURLToPath(moduleUrl);

const serializeAst = (ast: AstNode): string => JSON.stringify(ast, null, 2);

const hashText = (value: string): string => createHash('sha256').update(value).digest('hex');

const isValidIdentifier = (value: string): boolean => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);

const renderPropertyName = (value: string): string => (isValidIdentifier(value) ? value : JSON.stringify(value));

const pascalCaseName = (value: string): string => {
  const normalized = value.replace(/[^a-zA-Z0-9]+(.)/g, (_, group) => String(group).toUpperCase());
  return normalized.length === 0
    ? 'Type'
    : normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const sanitizeTypeName = (value: string): string => {
  const pascal = pascalCaseName(value);
  const cleaned = pascal.replace(/[^A-Za-z0-9_$]/g, '');
  if (cleaned.length === 0) {
    return 'Type';
  }
  return isValidIdentifier(cleaned) ? cleaned : `Type${cleaned}`;
};

const resolveUniqueName = (base: string, used: Set<string>, index = 0): string => {
  const suffix = index > 0 ? String(index) : '';
  const candidate = `${base}${suffix}`;
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }
  return resolveUniqueName(base, used, index + 1);
};

const isTypeDefinitionNode = (node: AstNode): boolean =>
  node.type !== 'api'
  && node.type !== 'api-composed'
  && node.type !== 'operation'
  && node.type !== 'field'
  && node.type !== 'subscription';

const isString = (value: unknown): value is string => typeof value === 'string';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const extractDocText = (doc: unknown): string | undefined => {
  if (!doc) {
    return undefined;
  }
  if (typeof doc === 'string') {
    return doc;
  }
  if (!isRecord(doc)) {
    return undefined;
  }
  const value =
    (typeof doc.description === 'string' && doc.description)
    || (typeof doc.summary === 'string' && doc.summary)
    || (typeof doc.text === 'string' && doc.text)
    || (typeof doc.title === 'string' && doc.title);
  return value || undefined;
};

const renderJSDoc = (lines: string[], indent = ''): string[] => {
  if (lines.length === 0) {
    return [];
  }
  return [
    `${indent}/**`,
    ...lines.map((line) => `${indent} * ${line}`),
    `${indent} */`,
  ];
};

const walkAst = (node: AstNode, visit: (node: AstNode) => void): void => {
  visit(node);
  node.children?.forEach((child) => walkAst(child, visit));
};

const collectNamedNodes = (root: AstNode): Map<string, NamedNode> => {
  const nodes = new Map<string, NamedNode>();
  const usedNames = new Set<string>();
  walkAst(root, (node) => {
    if (!node.name || !isTypeDefinitionNode(node)) {
      return;
    }
    if (nodes.has(node.name)) {
      return;
    }
    const baseName = sanitizeTypeName(node.name);
    const typeName = resolveUniqueName(baseName, usedNames);
    nodes.set(node.name, { name: node.name, typeName, node });
  });
  return nodes;
};

const collectOperations = (root: AstNode): OperationSpec[] => {
  const operations: OperationSpec[] = [];
  walkAst(root, (node) => {
    if (node.type !== 'operation' || !node.name) {
      return;
    }
    const input = node.children?.[0];
    const output = node.children?.[1];
    const constraints = node.constraints;
    const requestType = node.request ?? (typeof constraints?.request === 'string' ? constraints.request : undefined);
    const responseType = node.response ?? (typeof constraints?.response === 'string' ? constraints.response : undefined);
    operations.push({
      name: node.name,
      input,
      output,
      doc: node.doc,
      publishTopics: readPublishTopics(node),
      requestType,
      responseType,
      constraints: node.constraints,
    });
  });
  return operations;
};

const collectFieldOperations = (root: AstNode): FieldOperationSpec[] => {
  const operations: FieldOperationSpec[] = [];
  walkAst(root, (node) => {
    if (node.type !== 'field') {
      return;
    }
    const constraints = node.constraints;
    const owner = typeof constraints?.owner === 'string' ? constraints.owner : undefined;
    const field = typeof constraints?.field === 'string' ? constraints.field : undefined;
    if (!owner || !field) {
      return;
    }
    const children = node.children ?? [];
    const input = children.length === 3 ? children[1] : undefined;
    const output = children.length === 3 ? children[2] : children[1];
    const requestType = node.request ?? (typeof constraints?.request === 'string' ? constraints.request : undefined);
    const responseType = node.response ?? (typeof constraints?.response === 'string' ? constraints.response : undefined);
    const dependsOnType = node.dependsOn ?? (typeof constraints?.dependsOn === 'string' ? constraints.dependsOn : undefined);
    operations.push({
      owner,
      field,
      input,
      output,
      doc: node.doc,
      requestType,
      responseType,
      dependsOnType,
      constraints: node.constraints,
    });
  });
  return operations;
};

const readPublishTopics = (node: AstNode): string[] => {
  const constraints = node.constraints;
  if (!constraints || typeof constraints !== 'object' || Array.isArray(constraints)) {
    return [];
  }
  const raw = (constraints as Record<string, unknown>).publish;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(isString);
};

const collectPublishEvents = (root: AstNode, namedNodes: Map<string, NamedNode>): EventSpec[] => {
  const events: EventSpec[] = [];
  walkAst(root, (node) => {
    if (node.type !== 'operation') {
      return;
    }
    const topics = readPublishTopics(node);
    if (topics.length === 0) {
      return;
    }
    const output = node.children?.[1];
    const payloadType = renderType(output, namedNodes);
    topics.forEach((topic) => {
      events.push({ topic, payloadType });
    });
  });
  return events;
};

const resolveTypeName = (typeName: string | undefined, namedNodes: Map<string, NamedNode>): string | undefined => {
  if (!typeName) {
    return undefined;
  }
  const named = namedNodes.get(typeName);
  return named?.typeName;
};

const resolveDocTypeName = (
  typeName: string | undefined,
  namedNodes: Map<string, NamedNode>,
  fallback: string,
): string => resolveTypeName(typeName, namedNodes) ?? typeName ?? fallback;

const collectSubscriptionEvents = (root: AstNode, namedNodes: Map<string, NamedNode>): EventSpec[] => {
  const events: EventSpec[] = [];
  walkAst(root, (node) => {
    if (node.type !== 'subscription' || !node.name) {
      return;
    }
    const constraints = node.constraints;
    const requestType = node.request ?? (typeof constraints?.request === 'string' ? constraints.request : undefined);
    const responseType = node.response ?? (typeof constraints?.response === 'string' ? constraints.response : undefined);
    const resolvedType = resolveTypeName(responseType, namedNodes);
    const payload = node.children?.[0];
    const payloadType = resolvedType ?? renderType(payload, namedNodes, node.name);
    events.push({
      topic: node.name,
      payloadType,
      doc: node.doc,
      constraints,
      requestType,
      responseType,
      payloadNode: payload,
    });
  });
  return events;
};

const groupFieldOperations = (fieldOperations: FieldOperationSpec[]): FieldOperationGroup[] => {
  const grouped = fieldOperations.reduce<Map<string, FieldOperationSpec[]>>((acc, op) => {
    const existing = acc.get(op.owner) ?? [];
    acc.set(op.owner, existing.concat(op));
    return acc;
  }, new Map<string, FieldOperationSpec[]>());

  return Array.from(grouped.entries()).map(([owner, operations]) => ({ owner, operations }));
};

const renderLiteral = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  return 'unknown';
};

const resolveDocText = (doc: unknown): string[] => {
  const text = extractDocText(doc);
  if (!text) {
    return [];
  }
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
};

const renderConstraints = (constraints?: Readonly<Record<string, unknown>>): string[] => {
  if (!constraints || typeof constraints !== 'object') {
    return [];
  }
  const entries = Object.entries(constraints).filter(([_, value]) => value !== undefined);
  if (entries.length === 0) {
    return [];
  }
  const parts = entries.map(([key, value]) => {
    if (Array.isArray(value)) {
      return `${key}=[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return `${key}=${JSON.stringify(value)}`;
    }
    return `${key}=${JSON.stringify(value)}`;
  });
  return [`Constraints: ${parts.join(', ')}.`];
};

const buildExample = (
  node: AstNode | undefined,
  namedNodes: Map<string, NamedNode>,
  depth = 0,
  visited = new Set<string>(),
): string => {
  if (!node) {
    return 'undefined';
  }
  if (depth > 2) {
    return '...';
  }
  if (node.name && namedNodes.has(node.name) && isTypeDefinitionNode(node)) {
    const named = namedNodes.get(node.name)!.node;
    if (named !== node) {
      if (visited.has(node.name)) {
        return '...';
      }
      visited.add(node.name);
      return buildExample(named, namedNodes, depth + 1, visited);
    }
    if (visited.has(node.name)) {
      return '...';
    }
    visited.add(node.name);
  }
  switch (node.type) {
    case 'string':
      return '"string"';
    case 'number':
      return '0';
    case 'boolean':
      return 'false';
    case 'date':
      return 'new Date()';
    case 'binary':
      return 'new Uint8Array()';
    case 'literal':
      return renderLiteral(node.constraints?.value);
    case 'enum': {
      const values = Array.isArray(node.constraints?.values) ? node.constraints?.values ?? [] : [];
      return values.length > 0 ? renderLiteral(values[0]) : '"value"';
    }
    case 'array': {
      const child = node.children?.[0];
      return `[${buildExample(child, namedNodes, depth + 1, visited)}]`;
    }
    case 'tuple': {
      const items = (node.children ?? []).map((child) => buildExample(child, namedNodes, depth + 1, visited));
      return `[${items.join(', ')}]`;
    }
    case 'union': {
      const first = node.children?.[0];
      return buildExample(first, namedNodes, depth + 1, visited);
    }
    case 'and': {
      const [left, right] = node.children ?? [];
      const leftExample = buildExample(left, namedNodes, depth + 1, visited);
      if (!right) {
        return leftExample;
      }
      const rightExample = buildExample(right, namedNodes, depth + 1, visited);
      return left?.type === 'object' && right.type === 'object'
        ? `{ ...${leftExample}, ...${rightExample} }`
        : leftExample;
    }
    case 'object': {
      const fields = (node.children ?? []).filter((child) => child.type === 'field' && child.name);
      const body = fields.slice(0, 3).map((field) => {
        const value = buildExample(field.children?.[0], namedNodes, depth + 1, visited);
        return `${renderPropertyName(field.name ?? 'field')}: ${value}`;
      });
      const tail = fields.length > 3 ? ', ...' : '';
      return `{ ${body.join(', ')}${tail} }`;
    }
    default:
      return '...';
  }
};

const renderTypeDoc = (node: AstNode, namedNodes: Map<string, NamedNode>): string[] => {
  const lines: string[] = [];
  lines.push(...resolveDocText(node.doc));
  lines.push(`Type: ${node.type}${node.name ? ` (${node.name})` : ''}.`);
  lines.push(...renderConstraints(node.constraints));
  if (node.type === 'object') {
    const fields = (node.children ?? []).filter((child) => child.type === 'field' && child.name);
    if (fields.length > 0) {
      lines.push(`Fields: ${fields.map((field) => field.name).join(', ')}.`);
    }
  }
  lines.push(`@example ${buildExample(node, namedNodes)}`);
  return lines;
};

const renderFieldDoc = (
  fieldName: string,
  fieldNode: AstNode,
  fieldType: string,
  namedNodes: Map<string, NamedNode>,
): string[] => {
  const doc = fieldNode.doc ?? fieldNode.children?.[0]?.doc;
  const lines: string[] = [];
  lines.push(...resolveDocText(doc));
  lines.push(`Field: ${fieldName}.`);
  lines.push(`Type: ${fieldType}.`);
  lines.push(...renderConstraints(fieldNode.constraints));
  lines.push(`See {@link ${fieldType}}.`);
  lines.push(`@example ${buildExample(fieldNode.children?.[0], namedNodes)}`);
  return lines;
};

const renderOperationDoc = (
  operation: OperationSpec,
  inputType: string,
  outputType: string,
  namedNodes: Map<string, NamedNode>,
): string[] => {
  const lines: string[] = [];
  lines.push(...resolveDocText(operation.doc));
  lines.push(`Operation: ${operation.name}.`);
  lines.push(...renderConstraints(operation.constraints));
  const responseType = resolveDocTypeName(operation.responseType, namedNodes, outputType);
  lines.push(`Output type: ${responseType}.`);
  if (operation.input) {
    const requestType = resolveDocTypeName(operation.requestType, namedNodes, inputType);
    lines.push(`Input type: ${requestType}.`);
    lines.push(`@param input - ${requestType} request payload.`);
    lines.push(`See {@link ${requestType}}.`);
  }
  lines.push(`@returns ${responseType} operation result.`);
  lines.push(`See {@link ${responseType}}.`);
  if (operation.publishTopics.length > 0) {
    lines.push(`Publishes events: ${operation.publishTopics.join(', ')}.`);
  }
  const inputExample = operation.input ? buildExample(operation.input, namedNodes) : '';
  const call = operation.input ? `(${inputExample})` : '()';
  lines.push('@example');
  lines.push(`await client.${renderPropertyName(operation.name)}${call}`);
  if (operation.input) {
    const requestType = resolveDocTypeName(operation.requestType, namedNodes, inputType);
    const signatureInput = `${inputExample}: ${requestType}`;
    lines.push('@example');
    lines.push(`${operation.name}(${signatureInput}): ${responseType}`);
  } else {
    lines.push('@example');
    lines.push(`${operation.name}(): ${responseType}`);
  }
  return lines;
};

const renderFieldOperationDoc = (
  owner: string,
  field: string,
  inputType: string,
  outputType: string,
  hasInput: boolean,
  operation: FieldOperationSpec,
  namedNodes: Map<string, NamedNode>,
): string[] => {
  const lines: string[] = [];
  lines.push(...resolveDocText(operation.doc));
  lines.push(`Field operation: ${owner}.${field}.`);
  lines.push(...renderConstraints(operation.constraints));
  const dependsOn = resolveDocTypeName(operation.dependsOnType, namedNodes, owner);
  const responseType = resolveDocTypeName(operation.responseType, namedNodes, outputType);
  lines.push(`Depends on: ${dependsOn}.`);
  lines.push(`Output type: ${responseType}.`);
  lines.push(`See {@link ${dependsOn}}.`);
  if (hasInput) {
    const requestType = resolveDocTypeName(operation.requestType, namedNodes, inputType);
    lines.push(`Input type: ${requestType}.`);
    lines.push(`@param input - ${requestType} request payload.`);
    lines.push(`See {@link ${requestType}}.`);
  }
  lines.push(`@returns ${responseType} field operation result.`);
  lines.push(`See {@link ${responseType}}.`);
  const inputExample = hasInput ? buildExample(operation.input, namedNodes) : '';
  const call = hasInput ? `(${inputExample})` : '()';
  lines.push('@example');
  lines.push(`await ${field}${call}`);
  if (hasInput) {
    const requestType = resolveDocTypeName(operation.requestType, namedNodes, inputType);
    lines.push('@example');
    lines.push(`${field}(${inputExample}: ${requestType}): ${responseType}`);
  } else {
    lines.push('@example');
    lines.push(`${field}(): ${responseType}`);
  }
  return lines;
};

const renderType = (
  node: AstNode | undefined,
  namedNodes: Map<string, NamedNode>,
  ignoreName?: string,
): string => {
  if (!node) {
    return 'unknown';
  }
  if (node.name && node.name !== ignoreName && namedNodes.has(node.name) && isTypeDefinitionNode(node)) {
    return namedNodes.get(node.name)!.typeName;
  }
  switch (node.type) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'Date';
    case 'binary':
      return 'Uint8Array';
    case 'literal':
      return renderLiteral(node.constraints?.value);
    case 'enum': {
      const values = Array.isArray(node.constraints?.values) ? node.constraints?.values ?? [] : [];
      const literalValues = values.map((value) => renderLiteral(value)).filter((value) => value !== 'unknown');
      return literalValues.length > 0 ? literalValues.join(' | ') : 'string';
    }
    case 'array': {
      const child = node.children?.[0];
      return `Array<${renderType(child, namedNodes)}>`;
    }
    case 'tuple': {
      const items = (node.children ?? []).map((child) => renderType(child, namedNodes));
      return `[${items.join(', ')}]`;
    }
    case 'union': {
      const options = (node.children ?? []).map((child) => renderType(child, namedNodes));
      return options.length > 0 ? options.join(' | ') : 'unknown';
    }
    case 'and': {
      const options = (node.children ?? [])
        .map((child) => renderType(child, namedNodes))
        .filter((value) => value !== 'unknown');
      const unique = Array.from(new Set(options));
      return unique.length > 0 ? unique.join(' & ') : 'unknown';
    }
    case 'object':
      return node.name && namedNodes.has(node.name)
        ? namedNodes.get(node.name)!.typeName
        : 'Record<string, unknown>';
    default:
      return 'unknown';
  }
};

const renderOperationTypeName = (operation: OperationSpec, used: Set<string>): string =>
  resolveUniqueName(`${pascalCaseName(operation.name)}Operation`, used);

const renderFieldOperationTypeName = (
  ownerType: string,
  field: string,
  used: Set<string>,
): string => resolveUniqueName(`${ownerType}${pascalCaseName(field)}Field`, used);

const renderTypeDefinitions = (
  namedNodes: Map<string, NamedNode>,
  fieldOperations: FieldOperationSpec[],
  usedNames: Set<string>,
): TypeDefinitionsResult => {
  const lines: string[] = [];
  const fieldTypeNames = new Map<string, Map<string, string>>();
  const groups = groupFieldOperations(fieldOperations);
  const groupsByOwner = groups.reduce<Map<string, FieldOperationSpec[]>>((acc, group) => {
    acc.set(group.owner, group.operations);
    return acc;
  }, new Map<string, FieldOperationSpec[]>());

  const namedEntries = Array.from(namedNodes.values()).sort((a, b) => a.typeName.localeCompare(b.typeName));

  namedEntries.forEach((entry) => {
    const node = entry.node;
    lines.push(...renderJSDoc(renderTypeDoc(node, namedNodes)));
    if (node.type === 'object') {
      lines.push(`export interface ${entry.typeName} {`);
      const fields = (node.children ?? []).filter((child) => child.type === 'field' && child.name);
      fields.forEach((fieldNode) => {
        const fieldName = fieldNode.name ?? 'field';
        const childType = renderType(fieldNode.children?.[0], namedNodes);
        lines.push(...renderJSDoc(renderFieldDoc(fieldName, fieldNode, childType, namedNodes), '  '));
        lines.push(`  ${renderPropertyName(fieldName)}: ${childType};`);
      });

      const operations = groupsByOwner.get(entry.name) ?? [];
      operations.forEach((operation) => {
        const fieldMap = fieldTypeNames.get(entry.name) ?? new Map<string, string>();
        const fieldTypeName = renderFieldOperationTypeName(entry.typeName, operation.field, usedNames);
        fieldMap.set(operation.field, fieldTypeName);
        fieldTypeNames.set(entry.name, fieldMap);
        const inputType = renderType(operation.input, namedNodes);
        const outputType = renderType(operation.output, namedNodes);
        const hasInput = Boolean(operation.input);
        lines.push(
          ...renderJSDoc(
            renderFieldOperationDoc(entry.typeName, operation.field, inputType, outputType, hasInput, operation, namedNodes),
            '  ',
          ),
        );
        lines.push(`  ${renderPropertyName(operation.field)}?: ${fieldTypeName};`);
      });
      lines.push('}');
      lines.push('');
      return;
    }

    const typeBody = renderType(node, namedNodes, entry.name);
    lines.push(`export type ${entry.typeName} = ${typeBody};`);
    lines.push('');
  });

  return { definitions: lines, fieldTypeNames };
};

const renderFieldOperationDefinitions = (
  fieldOperations: FieldOperationSpec[],
  namedNodes: Map<string, NamedNode>,
  usedNames: Set<string>,
  fieldTypeNames: Map<string, Map<string, string>>,
): string[] => {
  const lines: string[] = [];
  const operations = fieldOperations
    .map((operation) => {
      const owner = namedNodes.get(operation.owner)?.typeName ?? sanitizeTypeName(operation.owner);
      const fieldTypeName = fieldTypeNames.get(operation.owner)?.get(operation.field)
        ?? renderFieldOperationTypeName(owner, operation.field, usedNames);
      const inputType = renderType(operation.input, namedNodes);
      const outputType = renderType(operation.output, namedNodes);
      return {
        owner,
        field: operation.field,
        fieldTypeName,
        inputType,
        outputType,
        hasInput: Boolean(operation.input),
        doc: operation.doc,
        inputNode: operation.input,
        requestType: operation.requestType,
        responseType: operation.responseType,
        dependsOnType: operation.dependsOnType,
      };
    })
    .sort((a, b) => a.fieldTypeName.localeCompare(b.fieldTypeName));

  operations.forEach((operation) => {
    lines.push(
      ...renderJSDoc(
        renderFieldOperationDoc(
          operation.owner,
          operation.field,
          operation.inputType,
          operation.outputType,
          operation.hasInput,
          {
            owner: operation.owner,
            field: operation.field,
            input: operation.inputNode,
            doc: operation.doc,
            requestType: operation.requestType,
            responseType: operation.responseType,
            dependsOnType: operation.dependsOnType,
          },
          namedNodes,
        ),
      ),
    );
    lines.push(`export interface ${operation.fieldTypeName} {`);
    if (operation.hasInput) {
      lines.push(`  (input: ${operation.inputType}): Promise<${operation.outputType}>;`);
    } else {
      lines.push(`  (): Promise<${operation.outputType}>;`);
    }
    lines.push('}');
    lines.push('');
  });

  return lines;
};

const renderOperationDefinitions = (
  operations: OperationSpec[],
  namedNodes: Map<string, NamedNode>,
  usedNames: Set<string>,
): OperationDefinitionsResult => {
  const lines: string[] = [];
  const clientLines: string[] = [];

  const sorted = operations
    .map((operation) => ({
      operation,
      typeName: renderOperationTypeName(operation, usedNames),
    }))
    .sort((a, b) => a.typeName.localeCompare(b.typeName));

  sorted.forEach((entry) => {
    const inputType = renderType(entry.operation.input, namedNodes);
    const outputType = renderType(entry.operation.output, namedNodes);
    lines.push(...renderJSDoc(renderOperationDoc(entry.operation, inputType, outputType, namedNodes)));
    lines.push(`export interface ${entry.typeName} {`);
    if (entry.operation.input) {
      lines.push(`  (input: ${inputType}): Promise<${outputType}>;`);
    } else {
      lines.push(`  (): Promise<${outputType}>;`);
    }
    lines.push('}');
    lines.push('');
    clientLines.push(...renderJSDoc(renderOperationDoc(entry.operation, inputType, outputType, namedNodes), '  '));
    if (entry.operation.input) {
      clientLines.push(`  ${renderPropertyName(entry.operation.name)}(input: ${inputType}): Promise<${outputType}>;`);
    } else {
      clientLines.push(`  ${renderPropertyName(entry.operation.name)}(): Promise<${outputType}>;`);
    }
  });

  return { lines, clientLines };
};

const renderSubscriptionTypeName = (topic: string, used: Set<string>): string =>
  resolveUniqueName(`${pascalCaseName(topic)}Subscription`, used);

const renderSubscriptionHandlerDoc = (
  event: EventSpec,
  payloadType: string,
  namedNodes: Map<string, NamedNode>,
): string[] => {
  const lines: string[] = [];
  lines.push(...resolveDocText(event.doc));
  lines.push(`Subscription handler for "${event.topic}".`);
  lines.push(...renderConstraints(event.constraints));
  const requestType = event.requestType
    ? resolveDocTypeName(event.requestType, namedNodes, event.requestType)
    : undefined;
  const outputType = resolveDocTypeName(event.responseType, namedNodes, payloadType);
  if (event.requestType) {
    lines.push(`Request input: ${requestType}.`);
  }
  lines.push(`Output type: ${outputType}.`);
  const payloadDoc = resolveDocText(event.payloadNode?.doc);
  if (payloadDoc.length > 0) {
    lines.push(`Payload doc: ${payloadDoc.join(' ')}`);
  }
  lines.push(`@param payload - ${payloadType} payload emitted for "${event.topic}".`);
  lines.push('@param ctx - ClientHandlerContext runtime metadata and room context.');
  lines.push(`See {@link ${payloadType}} and {@link ClientHandlerContext}.`);
  lines.push('@example');
  lines.push(`api({ ${renderPropertyName(event.topic)}: (payload) => payload });`);
  return lines;
};

const renderSubscriptionPropertyDoc = (
  event: EventSpec,
  payloadType: string,
  namedNodes: Map<string, NamedNode>,
): string[] => {
  const lines: string[] = [];
  lines.push(...resolveDocText(event.doc));
  lines.push(`Subscription callback for "${event.topic}".`);
  lines.push(...renderConstraints(event.constraints));
  const requestType = event.requestType
    ? resolveDocTypeName(event.requestType, namedNodes, event.requestType)
    : undefined;
  const outputType = resolveDocTypeName(event.responseType, namedNodes, payloadType);
  if (event.requestType) {
    lines.push(`Request input: ${requestType}.`);
  }
  lines.push(`Output type: ${outputType}.`);
  const payloadDoc = resolveDocText(event.payloadNode?.doc);
  if (payloadDoc.length > 0) {
    lines.push(`Payload doc: ${payloadDoc.join(' ')}`);
  }
  lines.push(`@param payload - ${payloadType} payload emitted for "${event.topic}".`);
  lines.push('@param ctx - ClientHandlerContext runtime metadata and room context.');
  lines.push(`See {@link ${payloadType}} and {@link ClientHandlerContext}.`);
  lines.push('@example');
  lines.push(`api({ ${renderPropertyName(event.topic)}: (payload) => payload });`);
  return lines;
};

const renderSubscriptionDefinitions = (
  events: EventSpec[],
  usedNames: Set<string>,
  namedNodes: Map<string, NamedNode>,
): string[] => {
  if (events.length === 0) {
    return ['export type SubscriptionHandlers = Partial<{ [K in SubscriptionName]: SubscriptionHandler<K> }>;', ''];
  }

  const uniqueByTopic = events.reduce<Map<string, EventSpec>>((acc, event) => {
    if (!acc.has(event.topic)) {
      acc.set(event.topic, event);
    }
    return acc;
  }, new Map<string, EventSpec>());

  const subscriptions = Array.from(uniqueByTopic.values())
    .map((event) => ({
      event,
      payloadType: event.payloadType,
      handlerTypeName: renderSubscriptionTypeName(event.topic, usedNames),
    }))
    .sort((a, b) => a.event.topic.localeCompare(b.event.topic));

  const lines: string[] = [];

  subscriptions.forEach(({ event, payloadType, handlerTypeName }) => {
    lines.push(...renderJSDoc(renderSubscriptionHandlerDoc(event, payloadType, namedNodes)));
    lines.push(`export interface ${handlerTypeName} {`);
    lines.push(`  (payload: ${payloadType}, ctx: ClientHandlerContext): void;`);
    lines.push('}');
    lines.push('');
  });

  lines.push('export interface SubscriptionHandlers {');
  subscriptions.forEach(({ event, payloadType }) => {
    lines.push(...renderJSDoc(renderSubscriptionPropertyDoc(event, payloadType, namedNodes), '  '));
    lines.push(`  ${renderPropertyName(event.topic)}?(payload: ${payloadType}, ctx: ClientHandlerContext): void;`);
  });
  lines.push('}');
  lines.push('');

  return lines;
};

const renderEventMapDefinitions = (events: EventSpec[]): string[] => {
  if (events.length === 0) {
    return ['export type LivonEventMap = Record<string, never>;', ''];
  }
  const entries = events.reduce<Map<string, string>>((acc, event) => {
    if (!acc.has(event.topic)) {
      acc.set(event.topic, event.payloadType);
    }
    return acc;
  }, new Map<string, string>());
  const lines = ['export type LivonEventMap = {'];
  Array.from(entries.entries()).forEach(([topic, payloadType]) => {
    lines.push(`  ${JSON.stringify(topic)}: ${payloadType};`);
  });
  lines.push('};');
  lines.push('');
  return lines;
};

const defaultAstTemplate = () => `export const ast = ${AST_PLACEHOLDER} as const;\n\nexport default ast;\n`;

const defaultClientTemplate = () =>
  [
    CLIENT_IMPORTS_PLACEHOLDER,
    CLIENT_TYPE_DEFS_PLACEHOLDER,
    CLIENT_EVENT_MAP_PLACEHOLDER,
    CLIENT_SUB_HANDLER_DEFS_PLACEHOLDER,
    CLIENT_FIELD_OPS_PLACEHOLDER,
    CLIENT_OP_DEFS_PLACEHOLDER,
    CLIENT_OP_LINES_PLACEHOLDER,
    CLIENT_SUB_NAMES_PLACEHOLDER,
    CLIENT_EXPORT_NAME_PLACEHOLDER,
  ].join('\n');

const readTemplate = (filename: string, fallback: () => string): string => {
  const templatePath = path.join(templatesDir, filename);
  try {
    return fs.readFileSync(templatePath, 'utf8');
  } catch {
    return fallback();
  }
};

const applyTemplate = (template: string, placeholder: string, value: string, label: string): string => {
  if (!template.includes(placeholder)) {
    throw new Error(`Template ${label} is missing placeholder ${placeholder}`);
  }
  return template.split(placeholder).join(value);
};

const applyTemplateMap = (template: string, placeholders: Array<{ key: string; value: string }>, label: string): string =>
  placeholders.reduce((next, entry) => applyTemplate(next, entry.key, entry.value, label), template);

/**
 * getClientGeneratorFingerprint is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/packages/client
 *
 * @example
 * const result = getClientGeneratorFingerprint(undefined as never);
 */
export const getClientGeneratorFingerprint = (): string => {
  const source = fs.readFileSync(sourceFilePath, 'utf8');
  const astTemplate = readTemplate('ast.template.ts', defaultAstTemplate);
  const clientTemplate = readTemplate('client.template.ts', defaultClientTemplate);
  const parts = [
    hashText(source),
    hashText(astTemplate),
    hashText(clientTemplate),
  ];
  return hashText(parts.join(':'));
};

/**
 * generateClientFiles is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/packages/client
 *
 * @example
 * const result = generateClientFiles(undefined as never);
 */
export const generateClientFiles = ({
  ast,
  exportName = 'api',
  astModuleName = 'ast',
  clientModuleName = 'api',
}: GenerateClientFilesOptions): GeneratedClientFiles => {

  const namedNodes = collectNamedNodes(ast);
  const operations = collectOperations(ast);
  const fieldOperations = collectFieldOperations(ast);
  const usedNames = new Set<string>(Array.from(namedNodes.values()).map((node) => node.typeName));
  const publishEvents = collectPublishEvents(ast, namedNodes);
  const subscriptionEvents = collectSubscriptionEvents(ast, namedNodes);

  const { definitions: typeDefinitions, fieldTypeNames } = renderTypeDefinitions(
    namedNodes,
    fieldOperations,
    usedNames,
  );
  const fieldOperationDefinitions = renderFieldOperationDefinitions(
    fieldOperations,
    namedNodes,
    usedNames,
    fieldTypeNames,
  );
  const { lines: operationDefinitions, clientLines } = renderOperationDefinitions(
    operations,
    namedNodes,
    usedNames,
  );
  const eventsByTopic = new Map<string, EventSpec>();
  subscriptionEvents.forEach((event) => eventsByTopic.set(event.topic, event));
  publishEvents.forEach((event) => {
    if (!eventsByTopic.has(event.topic)) {
      eventsByTopic.set(event.topic, event);
    }
  });
  const events = Array.from(eventsByTopic.values());

  const eventMapDefinitions = renderEventMapDefinitions(events);
  const subscriptionDefinitions = renderSubscriptionDefinitions(events, usedNames, namedNodes);

  const eventTopics = events.map((event) => event.topic);
  const subscriptionNamesArray = Array.from(new Set(eventTopics)).map((topic) => JSON.stringify(topic));

  const clientImports = [
    `import { createClient as createRuntimeClient } from '@livon/client';`,
    `import type { ClientHandlerContext, ClientModule } from '@livon/client';`,
    `import { ast } from './${astModuleName}.js';`,
  ].join('\n');
  const clientTypeDefs = typeDefinitions.join('\n');
  const clientEventMap = eventMapDefinitions.join('\n');
  const clientSubscriptionDefs = subscriptionDefinitions.join('\n');
  const clientFieldOps = fieldOperationDefinitions.join('\n');
  const clientOpDefs = operationDefinitions.join('\n');
  const clientOpLines = clientLines.join('\n');
  const clientSubscriptionNames = subscriptionNamesArray.join(', ');

  const astTemplate = readTemplate('ast.template.ts', defaultAstTemplate);
  const clientTemplate = readTemplate('client.template.ts', defaultClientTemplate);

  const astSource = applyTemplate(astTemplate, AST_PLACEHOLDER, serializeAst(ast), 'ast');
  const clientSource = applyTemplateMap(
    clientTemplate,
    [
      { key: CLIENT_IMPORTS_PLACEHOLDER, value: clientImports },
      { key: CLIENT_TYPE_DEFS_PLACEHOLDER, value: clientTypeDefs },
      { key: CLIENT_EVENT_MAP_PLACEHOLDER, value: clientEventMap },
      { key: CLIENT_SUB_HANDLER_DEFS_PLACEHOLDER, value: clientSubscriptionDefs },
      { key: CLIENT_FIELD_OPS_PLACEHOLDER, value: clientFieldOps },
      { key: CLIENT_OP_DEFS_PLACEHOLDER, value: clientOpDefs },
      { key: CLIENT_OP_LINES_PLACEHOLDER, value: clientOpLines },
      { key: CLIENT_SUB_NAMES_PLACEHOLDER, value: clientSubscriptionNames },
      { key: CLIENT_EXPORT_NAME_PLACEHOLDER, value: exportName },
    ],
    'client',
  );

  const astFile = `${astModuleName}.ts`;
  const clientFile = `${clientModuleName}.ts`;

  return {
    astFile,
    clientFile,
    files: {
      [astFile]: astSource,
      [clientFile]: clientSource,
    },
  };
};

export type { AstNode };
