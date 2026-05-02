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

declare global {
  interface Window {
    conductor?: {
      system: {
        getInfo: () => Promise<SystemInfo>;
        checkPrerequisites: () => Promise<Record<string, PrerequisiteStatus>>;
      };
    };
  }
}

export {};
