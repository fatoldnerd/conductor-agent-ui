export const CANONICAL_RUNTIME_IDS = ['claude-code', 'codex-cli', 'gemini-cli', 'hermes', 'openclaw'] as const;

export type CanonicalRuntimeId = (typeof CANONICAL_RUNTIME_IDS)[number];

export type RuntimeCategoryId = 'agent-runtime' | 'developer-prerequisite' | 'deployment-tool' | 'service';

export type RuntimeReadiness =
  | 'ready'
  | 'installed'
  | 'running'
  | 'missing'
  | 'needs_config'
  | 'needs_credentials'
  | 'broken'
  | 'unsupported'
  | 'not_scanned'
  | 'stopped';

export type RuntimeActionKind =
  | 'refresh'
  | 'open_docs'
  | 'copy_install_command'
  | 'configure'
  | 'health_check'
  | 'preview_install'
  | 'coming_soon'
  | 'requires_desktop';

export type RuntimeActionRiskLevel = 'none' | 'low' | 'medium' | 'high';

export type RuntimeActionPreflight = {
  requirements: string[];
  riskLevel: RuntimeActionRiskLevel;
  expectedEffect: string;
  requiresApproval: boolean;
};

export type RuntimeActionMetadata = {
  kind: RuntimeActionKind;
  label: string;
  description: string;
  browserSafe: boolean;
  previewOnly: boolean;
  executesCommand: false;
  requiresDesktop: boolean;
  preflight: RuntimeActionPreflight;
};

export type RuntimeReadinessMetadata = {
  label: string;
  diagnosis: string;
  tone: 'ok' | 'warn' | 'muted' | 'danger';
};

export const RUNTIME_CATEGORY_LABELS: Record<RuntimeCategoryId, string> = {
  'agent-runtime': 'Agent runtime',
  'developer-prerequisite': 'Developer prerequisite',
  'deployment-tool': 'Deployment tool',
  service: 'Local service',
};

export const CANONICAL_RUNTIME_LABELS: Record<CanonicalRuntimeId, string> = {
  'claude-code': 'Claude Code',
  'codex-cli': 'Codex CLI',
  'gemini-cli': 'Gemini CLI',
  hermes: 'Hermes Agent',
  openclaw: 'OpenClaw',
};

export const RUNTIME_INVENTORY_KEYS: Record<CanonicalRuntimeId, string> = {
  'claude-code': 'claude',
  'codex-cli': 'codex',
  'gemini-cli': 'gemini',
  hermes: 'hermes',
  openclaw: 'openclaw',
};

export const READINESS_METADATA: Record<RuntimeReadiness, RuntimeReadinessMetadata> = {
  ready: {
    label: 'Ready',
    diagnosis: 'Detected locally and configured enough for Conductor to treat it as ready.',
    tone: 'ok',
  },
  installed: {
    label: 'Installed',
    diagnosis: 'Detected locally, but Conductor has not verified a runnable or configured state.',
    tone: 'ok',
  },
  running: {
    label: 'Running',
    diagnosis: 'A local service or process matching this entry is running.',
    tone: 'ok',
  },
  missing: {
    label: 'Missing',
    diagnosis: 'A completed desktop inventory scan did not find this tool or service.',
    tone: 'muted',
  },
  needs_config: {
    label: 'Needs config',
    diagnosis: 'The tool is installed, but expected local configuration was not detected.',
    tone: 'warn',
  },
  needs_credentials: {
    label: 'Needs credentials',
    diagnosis: 'Configuration exists, but required credential markers were not detected.',
    tone: 'warn',
  },
  broken: {
    label: 'Broken',
    diagnosis: 'The tool was detected, but the local check returned an error that needs attention.',
    tone: 'danger',
  },
  unsupported: {
    label: 'Unsupported',
    diagnosis: 'This runtime or action is not supported on the current platform or in the current mode.',
    tone: 'muted',
  },
  not_scanned: {
    label: 'Not scanned',
    diagnosis: 'No trusted desktop inventory scan has completed for this entry yet.',
    tone: 'muted',
  },
  stopped: {
    label: 'Stopped',
    diagnosis: 'A completed desktop inventory scan did not find the expected local service running.',
    tone: 'muted',
  },
};

export const SAFE_ACTION_METADATA: Record<RuntimeActionKind, RuntimeActionMetadata> = {
  refresh: {
    kind: 'refresh',
    label: 'Refresh',
    description: 'Request a new sanitized desktop inventory scan.',
    browserSafe: false,
    previewOnly: false,
    executesCommand: false,
    requiresDesktop: true,
    preflight: {
      requirements: ['Electron desktop bridge must be available.'],
      riskLevel: 'none',
      expectedEffect: 'Requests a new sanitized inventory scan from the desktop app.',
      requiresApproval: false,
    },
  },
  open_docs: {
    kind: 'open_docs',
    label: 'Open docs',
    description: 'Open the runtime documentation URL.',
    browserSafe: true,
    previewOnly: false,
    executesCommand: false,
    requiresDesktop: false,
    preflight: {
      requirements: ['A documentation URL must be present in trusted recipe metadata.'],
      riskLevel: 'none',
      expectedEffect: 'Opens documentation in the browser; no local runtime state changes.',
      requiresApproval: false,
    },
  },
  copy_install_command: {
    kind: 'copy_install_command',
    label: 'Copy install command',
    description: 'Copy a documented install command for manual use outside Conductor.',
    browserSafe: true,
    previewOnly: true,
    executesCommand: false,
    requiresDesktop: false,
    preflight: {
      requirements: ['A documented install command must be available in trusted recipe metadata.'],
      riskLevel: 'low',
      expectedEffect: 'Suggested next step only. Shows a command for manual use outside Conductor; nothing is run by the renderer.',
      requiresApproval: true,
    },
  },
  configure: {
    kind: 'configure',
    label: 'Configure',
    description: 'Show configuration guidance or a safe preview; no renderer shell execution.',
    browserSafe: true,
    previewOnly: true,
    executesCommand: false,
    requiresDesktop: false,
    preflight: {
      requirements: ['Configuration guidance must come from trusted recipe metadata or sanitized inventory.'],
      riskLevel: 'medium',
      expectedEffect: 'Suggested next step only. Shows configuration guidance; no files are written and no shell commands are run.',
      requiresApproval: true,
    },
  },
  health_check: {
    kind: 'health_check',
    label: 'Health check',
    description: 'Show health-check metadata. Execution requires explicit main-process implementation.',
    browserSafe: true,
    previewOnly: true,
    executesCommand: false,
    requiresDesktop: false,
    preflight: {
      requirements: ['Health checks must be represented as trusted metadata until an allowlisted desktop API exists.'],
      riskLevel: 'low',
      expectedEffect: 'Preflight only. This runtime is ready when inventory says ready; no live check is executed by the renderer.',
      requiresApproval: true,
    },
  },
  preview_install: {
    kind: 'preview_install',
    label: 'Preview install',
    description: 'Show trusted installer recipe metadata without running commands.',
    browserSafe: true,
    previewOnly: true,
    executesCommand: false,
    requiresDesktop: false,
    preflight: {
      requirements: ['Installer steps must come from trusted recipe metadata.'],
      riskLevel: 'medium',
      expectedEffect: 'Suggested next step only. Previews install or update steps; no installation is started.',
      requiresApproval: true,
    },
  },
  coming_soon: {
    kind: 'coming_soon',
    label: 'Coming soon',
    description: 'Placeholder for functionality that is not implemented.',
    browserSafe: true,
    previewOnly: true,
    executesCommand: false,
    requiresDesktop: false,
    preflight: {
      requirements: ['An allowlisted Electron implementation must be added before this can execute.'],
      riskLevel: 'none',
      expectedEffect: 'Communicates that no operational action is currently available.',
      requiresApproval: true,
    },
  },
  requires_desktop: {
    kind: 'requires_desktop',
    label: 'Requires desktop',
    description: 'This action depends on the Electron desktop bridge and is unavailable in browser mode.',
    browserSafe: false,
    previewOnly: false,
    executesCommand: false,
    requiresDesktop: true,
    preflight: {
      requirements: ['Electron desktop bridge must be available.'],
      riskLevel: 'none',
      expectedEffect: 'Explains that the action is unavailable outside the desktop app.',
      requiresApproval: false,
    },
  },
};

export function readinessLabel(readiness: RuntimeReadiness): string {
  return READINESS_METADATA[readiness].label;
}

export function readinessDiagnosis(readiness: RuntimeReadiness): string {
  return READINESS_METADATA[readiness].diagnosis;
}

export function safeAction(kind: RuntimeActionKind, overrides: Partial<RuntimeActionMetadata> = {}): RuntimeActionMetadata {
  return { ...SAFE_ACTION_METADATA[kind], ...overrides, kind, executesCommand: false };
}

export type RuntimeActionAvailabilityMode =
  | 'preview_only'
  | 'requires_desktop'
  | 'browser_safe'
  | 'unavailable_in_browser';

export type RuntimeActionAvailability = {
  mode: RuntimeActionAvailabilityMode;
  label: string;
  reason: string;
  rendererCanExecute: false;
  requiresApproval: boolean;
  requirements: string[];
};

export function describeRuntimeActionAvailability(
  action: RuntimeActionMetadata,
  context: { desktopAvailable: boolean },
): RuntimeActionAvailability {
  const requiresApproval = action.preflight.requiresApproval;
  const requirements = [...action.preflight.requirements];

  if (action.requiresDesktop && !context.desktopAvailable) {
    return {
      mode: 'unavailable_in_browser',
      label: 'Unavailable in browser',
      reason: 'This action requires the Conductor desktop app. The renderer cannot execute it from a browser.',
      rendererCanExecute: false,
      requiresApproval,
      requirements,
    };
  }

  if (action.previewOnly) {
    return {
      mode: 'preview_only',
      label: 'Preview only',
      reason: 'Suggested next step only. The renderer shows preview and preflight details; nothing is run from this surface.',
      rendererCanExecute: false,
      requiresApproval,
      requirements,
    };
  }

  if (action.requiresDesktop) {
    return {
      mode: 'requires_desktop',
      label: 'Desktop action',
      reason: 'Routed through the Electron desktop bridge to a sanitized allowlisted handler. The renderer never runs shell commands.',
      rendererCanExecute: false,
      requiresApproval,
      requirements,
    };
  }

  return {
    mode: 'browser_safe',
    label: 'Browser-safe action',
    reason: 'No local runtime state is changed. Opens documentation or shows guidance only.',
    rendererCanExecute: false,
    requiresApproval,
    requirements,
  };
}
