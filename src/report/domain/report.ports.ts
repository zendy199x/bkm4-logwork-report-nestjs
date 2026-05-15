import type {
    ChatDeliveryConfig,
    Issue,
    JiraConfig,
    LastReportPayloadCacheRecord,
    ReportChatPayload,
    ReportRuntimeConfig,
} from './report.types';

export const REPORT_CONFIG_PORT = Symbol('REPORT_CONFIG_PORT');
export const JIRA_GATEWAY_PORT = Symbol('JIRA_GATEWAY_PORT');
export const CHAT_GATEWAY_PORT = Symbol('CHAT_GATEWAY_PORT');
export const LAST_REPORT_CACHE_PORT = Symbol('LAST_REPORT_CACHE_PORT');

export interface ReportConfigPort {
  getRuntimeConfig(): ReportRuntimeConfig;
  canTriggerWithToken(token: string): boolean;
  isRetryAction(invokedFunction: string): boolean;
}

export interface JiraGatewayPort {
  fetchIssuesWithWorkLogs(jira: JiraConfig, jql: string, debugEnabled: boolean): Promise<Issue[]>;
}

export interface ChatGatewayPort {
  sendReport(
    chat: ChatDeliveryConfig,
    data: ReportChatPayload,
    jiraCheckUrl: string,
  ): Promise<void>;
}

export interface LastReportCachePort {
  getLastReportPayload(): Promise<LastReportPayloadCacheRecord | null>;
  setLastReportPayload(payload: LastReportPayloadCacheRecord): Promise<void>;
}
