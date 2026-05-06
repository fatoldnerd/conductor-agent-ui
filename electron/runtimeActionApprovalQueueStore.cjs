function readRuntimeActionApprovalQueue() {
  return {
    schemaVersion: 1,
    status: 'empty',
    items: [],
    message: 'No runtime action approval requests have been recorded yet. Conductor will not show fake approvals.',
  };
}

module.exports = {
  readRuntimeActionApprovalQueue,
};
