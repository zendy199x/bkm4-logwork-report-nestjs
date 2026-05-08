import 'dotenv/config';
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type NextFunction } from 'express';

import { AppModule } from '../src/app.module';

type ApiRequest = {
    url: string;
};

type ExpressHandler = (req: ApiRequest, res: unknown, next?: NextFunction) => unknown;

let cachedHandler: ExpressHandler | null = null;

async function getHandler(): Promise<ExpressHandler> {
    if (cachedHandler) {
        return cachedHandler;
    }

    const expressApp = express();
    expressApp.use((req: ApiRequest, _res: unknown, next: NextFunction) => {
        if (req.url === '/api') {
            req.url = '/';
        } else if (req.url.startsWith('/api/')) {
            req.url = req.url.slice('/api'.length) || '/';
        }

        next();
    });

    const app = await NestFactory.create(
        AppModule,
        new ExpressAdapter(expressApp),
        { logger: ['error', 'warn', 'log'] },
    );

    await app.init();
    cachedHandler = expressApp as unknown as ExpressHandler;
    return cachedHandler;
}

export default async function handler(req: unknown, res: unknown) {
    const appHandler = await getHandler();
    return appHandler(req as ApiRequest, res);
}
