import { describe, expect, it } from 'vitest';
import appSource from './App.tsx?raw';

describe('Mission Control repo review lifecycle and deliverable', () => {
  it('shows explicit operator lifecycle labels for the approved repo review mission', () => {
    expect(appSource).toContain('Awaiting native approval');
    expect(appSource).toContain('Approval confirmed');
    expect(appSource).toContain('Codex running');
    expect(appSource).toContain('Review completed');
    expect(appSource).toContain('Review failed');
  });

  it('surfaces final Codex output as a named review report deliverable', () => {
    expect(appSource).toContain('Review report deliverable');
    expect(appSource).toContain('mission-review-deliverable');
    expect(appSource).toContain('buildRepoReviewDeliverable');
    expect(appSource).toContain('No review report captured yet.');
  });

  it('keeps the raw transcript available below the deliverable instead of replacing it', () => {
    const deliverableIndex = appSource.indexOf('mission-review-deliverable');
    const transcriptIndex = appSource.indexOf('mission-review-transcript');
    expect(deliverableIndex).toBeGreaterThan(-1);
    expect(transcriptIndex).toBeGreaterThan(deliverableIndex);
  });
});
