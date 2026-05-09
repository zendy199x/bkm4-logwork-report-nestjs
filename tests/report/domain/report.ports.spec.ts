import { CHAT_GATEWAY_PORT, JIRA_GATEWAY_PORT, REPORT_CONFIG_PORT } from '../../../src/report/domain/report.ports';

describe('report ports', () => {
  it('exports unique symbols', () => {
    expect(REPORT_CONFIG_PORT).toBeDefined();
    expect(JIRA_GATEWAY_PORT).toBeDefined();
    expect(CHAT_GATEWAY_PORT).toBeDefined();
    expect(REPORT_CONFIG_PORT).not.toBe(JIRA_GATEWAY_PORT);
    expect(JIRA_GATEWAY_PORT).not.toBe(CHAT_GATEWAY_PORT);
  });
});
