export type PrerequisiteStatus = {
  available: boolean;
  version: string | null;
  error?: string;
};

export type SystemInfo = {
  appVersion: string;
  platform: string;
  arch: string;
  osRelease: string;
  hostname: string;
  homeDir: string;
  desktopCapable?: boolean;
};

export type InventoryToolStatus = {
  id: string;
  label: string;
  command: string;
  category: 'agent-runtime' | 'developer-prerequisite' | 'deployment-tool' | string;
  recipeId?: string;
  available: boolean;
  status: 'ready' | 'missing';
  version: string | null;
  error?: string;
};

export type InventoryServiceStatus = {
  id: string;
  label: string;
  running: boolean;
  status: 'running' | 'stopped';
  port?: number;
};

export type InventoryAgentStatus = {
  id: string;
  name: string;
  platform: 'openclaw' | 'hermes' | string;
  running: boolean;
  status: 'running' | 'stopped';
  port?: number;
};

export type InventoryConfigStatus = {
  id: string;
  path: string;
  exists: boolean;
  status: 'found' | 'missing';
  secrets?: Record<string, boolean>;
};

export type LocalInventory = {
  collectedAt: string;
  desktopSmoke: {
    bridgeExpected: boolean;
    platformSupported: boolean;
    status: 'ready' | 'needs_attention';
  };
  machine: Omit<SystemInfo, 'appVersion'>;
  tools: Record<string, InventoryToolStatus>;
  services: Record<string, InventoryServiceStatus>;
  agents: Record<string, InventoryAgentStatus>;
  configs: Record<string, InventoryConfigStatus>;
};

export type IntegrationRecipeSummary = {
  id: string;
  name: string;
  category: string;
  description: string;
  supportedPlatforms: string[];
  providerRequirements: string[];
  prerequisites: string[];
  install: {
    steps: Array<{
      id: string;
      title: string;
      kind: string;
      description: string;
      command: string;
      requiresApproval?: boolean;
    }>;
  };
};

export type IntegrationInstallPlan = {
  mode: 'dry-run';
  recipeId: string;
  platform: string;
  steps: IntegrationRecipeSummary['install']['steps'];
  warnings: string[];
};

export type IntegrationInstallRunStep = IntegrationRecipeSummary['install']['steps'][number] & {
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'requires_manual' | 'skipped';
  output: string;
  exitCode: number | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export type IntegrationInstallRun = {
  id: string;
  recipeId: string;
  platform: string;
  status: 'ready' | 'running' | 'succeeded' | 'failed' | 'requires_manual';
  createdAt: string;
  approvedBy: string;
  steps: IntegrationInstallRunStep[];
  warnings: string[];
};

export type IntegrationAuditEvent = {
  type: string;
  timestamp: string;
  runId?: string;
  stepId?: string;
  [key: string]: unknown;
};

declare global {
  interface Window {
    conductor?: {
      system: {
        getInfo: () => Promise<SystemInfo>;
        checkPrerequisites: () => Promise<Record<string, PrerequisiteStatus>>;
        collectInventory: () => Promise<LocalInventory>;
      };
      integrations: {
        listRecipes: () => Promise<IntegrationRecipeSummary[]>;
        planInstall: (recipeId: string) => Promise<IntegrationInstallPlan>;
        createInstallRun: (recipeId: string) => Promise<IntegrationInstallRun>;
        getInstallRun: (runId: string) => Promise<IntegrationInstallRun>;
        runInstallStep: (runId: string, stepId: string) => Promise<IntegrationInstallRunStep>;
        runInstallSequence: (runId: string) => Promise<IntegrationInstallRun>;
        listAuditEvents: (runId?: string) => Promise<IntegrationAuditEvent[]>;
        onInstallOutput: (callback: (payload: { runId: string; stepId?: string; chunk: string }) => void) => () => void;
      };
    };
  }
}

export {};
