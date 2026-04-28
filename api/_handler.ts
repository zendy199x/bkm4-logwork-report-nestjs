import 'dotenv/config';
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Request, type Response } from 'express';

import { AppModule } from '../src/app.module';

type ExpressHandler = (req: Request, res: Response) => void;

let cachedHandler: ExpressHandler | null = null;

async function getHandler(): Promise<ExpressHandler> {
    if (cachedHandler) {
        return cachedHandler;
    }

    const expressApp = express();
    expressApp.use((req, _res, next) => {
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
    cachedHandler = expressApp;
    return cachedHandler;
}

export default async function handler(req: Request, res: Response) {
    const appHandler = await getHandler();
    return appHandler(req, res);
}
