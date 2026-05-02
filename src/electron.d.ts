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
      };
    };
  }
}

export {};
