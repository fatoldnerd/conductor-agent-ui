import { describe, expect, it } from 'vitest';
import config from './vite.config';

describe('vite desktop packaging config', () => {
  it('emits relative asset URLs for Electron file:// loads', () => {
    expect(config).toMatchObject({ base: './' });
  });
});
