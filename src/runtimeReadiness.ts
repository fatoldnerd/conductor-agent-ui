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

export type RuntimeActionMetadata = {
  kind: RuntimeActionKind;
  label: string;
  description: string;
  browserSafe: boolean;
  executesCommand: false;
  requiresDesktop: boolean;
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
    executesCommand: false,
    requiresDesktop: true,
  },
  open_docs: {
    kind: 'open_docs',
    label: 'Open docs',
    description: 'Open the runtime documentation URL.',
    browserSafe: true,
    executesCommand: false,
    requiresDesktop: false,
  },
  copy_install_command: {
    kind: 'copy_install_command',
    label: 'Copy install command',
    description: 'Copy a documented install command for manual use outside Conductor.',
    browserSafe: true,
    executesCommand: false,
    requiresDesktop: false,
  },
  configure: {
    kind: 'configure',
    label: 'Configure',
    description: 'Show configuration guidance or a safe preview; no renderer shell execution.',
    browserSafe: true,
    executesCommand: false,
    requiresDesktop: false,
  },
  health_check: {
    kind: 'health_check',
    label: 'Health check',
    description: 'Show health-check metadata. Execution requires explicit main-process implementation.',
    browserSafe: true,
    executesCommand: false,
    requiresDesktop: false,
  },
  preview_install: {
    kind: 'preview_install',
    label: 'Preview install',
    description: 'Show trusted installer recipe metadata without running commands.',
    browserSafe: true,
    executesCommand: false,
    requiresDesktop: false,
  },
  coming_soon: {
    kind: 'coming_soon',
    label: 'Coming soon',
    description: 'Placeholder for functionality that is not implemented.',
    browserSafe: true,
    executesCommand: false,
    requiresDesktop: false,
  },
  requires_desktop: {
    kind: 'requires_desktop',
    label: 'Requires desktop',
    description: 'This action depends on the Electron desktop bridge and is unavailable in browser mode.',
    browserSafe: false,
    executesCommand: false,
    requiresDesktop: true,
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
