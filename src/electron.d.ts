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
