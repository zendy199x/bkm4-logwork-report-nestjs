import type { Request, Response } from 'express';

import { ReportService } from '../src/report/report.service';

function isAuthorized(req: Request): boolean {
    const required = (process.env.CRON_SECRET || '').trim();
    if (!required) {
        return true;
    }

    const authHeader = req.headers.authorization || '';
    const expectedBearer = `Bearer ${required}`;
    if (authHeader === expectedBearer) {
        return true;
    }

    const token = (req.query.token as string | undefined) || '';
    return token === required;
}

export default async function cronHandler(req: Request, res: Response) {
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
