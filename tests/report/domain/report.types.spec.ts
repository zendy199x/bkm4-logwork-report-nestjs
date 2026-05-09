import { ChatMode } from '../../../src/report/domain/report.types';

describe('report types runtime exports', () => {
  it('keeps chat mode enum values', () => {
    expect(ChatMode.WEBHOOK).toBe('webhook');
    expect(ChatMode.APP).toBe('app');
  });
});
