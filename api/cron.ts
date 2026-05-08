import { ReportRunnerService } from '../src/report/application/report-runner.service';
import { ChatDeliveryService } from '../src/report/infrastructure/chat-delivery.service';
import { JiraApiService } from '../src/report/infrastructure/jira-api.service';
import { ReportConfigService } from '../src/report/infrastructure/report-config.service';

type ApiRequest = {
    headers?: Record<string, string | string[] | undefined>;
    query?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
    status: (code: number) => ApiResponse;
    json: (body: Record<string, unknown>) => void;
};

function toSingleValue(value: string | string[] | undefined): string {
    if (Array.isArray(value)) {
        return String(value[0] || '');
    }

    return String(value || '');
}

function isAuthorized(req: ApiRequest): boolean {
    const required = (process.env.CRON_SECRET || '').trim();
    if (!required) {
        return true;
    }

    const authHeader = toSingleValue(req.headers?.authorization);
    const expectedBearer = `Bearer ${required}`;
    if (authHeader === expectedBearer) {
        return true;
    }

    const token = toSingleValue(req.query?.token);
    return token === required;
}

let cachedRunner: ReportRunnerService | null = null;

function getReportRunner(): ReportRunnerService {
    if (cachedRunner) {
        return cachedRunner;
    }

    const configService = new ReportConfigService();
    const jiraApiService = new JiraApiService();
    const chatDeliveryService = new ChatDeliveryService();

    cachedRunner = new ReportRunnerService(configService, jiraApiService, chatDeliveryService);
    return cachedRunner;
}

export default async function cronHandler(req: ApiRequest, res: ApiResponse) {
    if (!isAuthorized(req)) {
        return res.status(401).json({
            ok: false,
            message: 'Invalid or missing cron secret',
        });
    }

    const reportRunner = getReportRunner();

    try {
        const result = await reportRunner.runDailyReport('vercel-cron');
        return res.status(200).json({
            ok: true,
            ...result,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({
            ok: false,
            message,
        });
    }
}
