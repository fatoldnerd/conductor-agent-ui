import type { AgentRuntimeDescriptor, AgentRuntimeId, LocalInventory } from './electron';
import { RUNTIME_INVENTORY_KEYS } from './runtimeReadiness';

export function runtimeInventoryKey(runtimeId: AgentRuntimeId): string {
  return RUNTIME_INVENTORY_KEYS[runtimeId];
}

export function runtimeAvailable(runtime: AgentRuntimeDescriptor, inventory: LocalInventory | null): boolean {
  if (runtime.needsValidation || !inventory) return false;
  const inventoryKey = runtimeInventoryKey(runtime.id);
  const tool = inventoryKey ? inventory.tools[inventoryKey] : undefined;
  return Boolean(tool?.available);
}
