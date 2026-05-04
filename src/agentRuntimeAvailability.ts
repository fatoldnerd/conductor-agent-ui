import type { AgentRuntimeDescriptor, AgentRuntimeId, LocalInventory } from './electron';

const RUNTIME_INVENTORY_KEY: Record<AgentRuntimeId, string> = {
  'claude-code': 'claude',
  'codex-cli': 'codex',
  'gemini-cli': 'gemini',
};

export function runtimeInventoryKey(runtimeId: AgentRuntimeId): string {
  return RUNTIME_INVENTORY_KEY[runtimeId];
}

export function runtimeAvailable(runtime: AgentRuntimeDescriptor, inventory: LocalInventory | null): boolean {
  if (runtime.needsValidation || !inventory) return false;
  const inventoryKey = runtimeInventoryKey(runtime.id);
  const tool = inventoryKey ? inventory.tools[inventoryKey] : undefined;
  return Boolean(tool?.available);
}
