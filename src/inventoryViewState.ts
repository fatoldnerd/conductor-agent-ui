import type { LocalInventory } from './electron';
import { localToolSummary, type LocalToolCategory } from './localTools';

export type InventoryViewStateKind =
  | 'bridge_unavailable'
  | 'loading'
  | 'error'
  | 'not_scanned'
  | 'no_tools_detected'
  | 'needs_config'
  | 'partial'
  | 'ready';

export type InventoryViewState = {
  kind: InventoryViewStateKind;
  eyebrow: string;
  title: string;
  body: string;
  primaryAction: string;
  hint: string;
  canRetry: boolean;
  summaryText: string;
};

export function inventorySummaryText(categories: LocalToolCategory[]): string {
  const summary = localToolSummary(categories);
  const parts = [
    `${summary.installed} ready`,
    `${summary.needsConfig} need config`,
    `${summary.needsCredentials} need credentials`,
    `${summary.missing} missing/stopped`,
  ];
  if (summary.notScanned > 0) parts.push(`${summary.notScanned} not scanned`);
  return parts.join(' · ');
}

export function deriveInventoryViewState({
  desktopAvailable,
  loading,
  error,
  inventory,
  categories,
}: {
  desktopAvailable: boolean;
  loading: boolean;
  error: string | null;
  inventory: LocalInventory | null;
  categories: LocalToolCategory[];
}): InventoryViewState {
  if (!desktopAvailable) {
    return {
      kind: 'bridge_unavailable',
      eyebrow: 'Desktop bridge required',
      title: 'Local inventory is available only in the Conductor desktop app',
      body: 'The browser preview cannot inspect installed CLIs, running services, config files, or local ports. Open the Electron desktop app to collect sanitized local inventory.',
      primaryAction: 'Requires desktop bridge',
      hint: 'No local runtime scan has run in browser mode.',
      canRetry: false,
      summaryText: 'Desktop bridge unavailable',
    };
  }

  if (loading && !inventory) {
    return {
      kind: 'loading',
      eyebrow: 'Scanning local inventory',
      title: 'Checking installed runtimes and services',
      body: 'Conductor is asking the Electron main process for sanitized command, service, port, and config presence checks. No results are shown until the scan returns.',
      primaryAction: 'Scanning...',
      hint: 'Waiting for desktop inventory',
      canRetry: false,
      summaryText: 'Scanning local inventory',
    };
  }

  if (error) {
    return {
      kind: 'error',
      eyebrow: 'Inventory scan failed',
      title: 'Conductor could not collect local inventory',
      body: `The desktop bridge returned an error while scanning local runtime state: ${error}`,
      primaryAction: 'Retry inventory scan',
      hint: 'No scan result is trusted until retry succeeds.',
      canRetry: true,
      summaryText: 'Inventory scan failed',
    };
  }

  if (!inventory) {
    return {
      kind: 'not_scanned',
      eyebrow: 'Inventory not scanned',
      title: 'No local inventory scan has completed yet',
      body: 'Runtime state is unknown until the desktop app completes a sanitized inventory scan. Start a scan to check installed tools and running services.',
      primaryAction: 'Scan inventory',
      hint: 'Nothing has been marked missing or installed yet.',
      canRetry: true,
      summaryText: inventorySummaryText(categories),
    };
  }

  const summary = localToolSummary(categories);
  const summaryText = inventorySummaryText(categories);
  if (summary.installed === 0 && summary.needsConfig === 0 && summary.needsCredentials === 0) {
    return {
      kind: 'no_tools_detected',
      eyebrow: 'No local tools detected',
      title: 'No ready runtimes or services were found on this machine',
      body: 'The scan completed, but Conductor did not find installed agent runtimes, configured runtimes, or running managed services. Use installer previews or install CLIs outside Conductor, then refresh inventory.',
      primaryAction: 'Refresh inventory',
      hint: summaryText,
      canRetry: true,
      summaryText,
    };
  }

  if (summary.needsConfig > 0) {
    return {
      kind: 'needs_config',
      eyebrow: 'Configuration needed',
      title: 'Some detected runtimes need local configuration',
      body: 'Conductor found installed runtime tooling, but one or more known config files were not detected. Review the affected rows and use the configure preview for the relevant runtime.',
      primaryAction: 'Refresh inventory',
      hint: summaryText,
      canRetry: true,
      summaryText,
    };
  }

  if (summary.needsCredentials > 0) {
    return {
      kind: 'needs_config',
      eyebrow: 'Credentials needed',
      title: 'Some detected runtimes need local credentials',
      body: 'Conductor found runtime configuration, but expected credential markers were not detected. Review the affected rows and configure credentials outside the renderer.',
      primaryAction: 'Refresh inventory',
      hint: summaryText,
      canRetry: true,
      summaryText,
    };
  }

  if (summary.missing > 0) {
    return {
      kind: 'partial',
      eyebrow: 'Partial local inventory',
      title: 'Some local tooling is ready and some is missing or stopped',
      body: 'The scan completed with a mix of ready tools and missing or stopped entries. Rows below show only sanitized local status reported by Electron.',
      primaryAction: 'Refresh inventory',
      hint: summaryText,
      canRetry: true,
      summaryText,
    };
  }

  return {
    kind: 'ready',
    eyebrow: 'Live local inventory',
    title: 'Local runtime inventory is current',
    body: 'Conductor is showing sanitized desktop inventory for installed tools, configuration presence, and running services. No sample or inferred operational state is displayed.',
    primaryAction: 'Refresh inventory',
    hint: summaryText,
    canRetry: true,
    summaryText,
  };
}
