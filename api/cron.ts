import { ReportService } from '../src/report/report.service';

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

export default async function cronHandler(req: ApiRequest, res: ApiResponse) {
    if (!isAuthorized(req)) {
        return res.status(401).json({
            ok: false,
            message: 'Invalid or missing cron secret',
        });
    }

    const reportService = new ReportService();

    try {
        const result = await reportService.runDailyReport('vercel-cron');
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
