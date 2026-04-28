import type { Request, Response } from 'express';

import handler from '../_handler';

export default async function reportsRetry(req: Request, res: Response) {
    return handler(req, res);
}
