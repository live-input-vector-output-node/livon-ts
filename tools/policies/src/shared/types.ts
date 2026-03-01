export interface PolicyContext {
  readonly rootDir: string;
  readonly baseDir: string;
  readonly packagesDir: string;
  readonly appsDir: string;
  readonly toolsDir: string;
  readonly websiteDir: string;
  readonly githubDir: string;
  readonly rootPackageJsonPath: string;
  readonly rootAgentsPath: string;
  readonly aiRoutingConfigPath: string;
  readonly aiActiveRulesDocPath: string;
  readonly aiRootGateConfigPath: string;
  readonly aiRootGateDocPath: string;
  readonly aiSpecializationsConfigPath: string;
  readonly aiSpecializationsDocPath: string;
  readonly lintWarningBudgetConfigPath: string;
}

export interface PolicyCheckResult {
  readonly id: string;
  readonly errors: string[];
  readonly warnings?: string[];
  readonly info?: string[];
}

export interface PackageJsonLike {
  readonly name?: string;
  readonly type?: string;
  readonly version?: string;
  readonly scripts?: Record<string, string>;
  readonly [key: string]: unknown;
}
