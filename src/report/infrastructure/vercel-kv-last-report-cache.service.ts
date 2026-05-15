import { Injectable, Logger } from '@nestjs/common';
import { kv } from '@vercel/kv';
import type { LastReportCachePort } from '../domain/report.ports';
import type { LastReportPayloadCacheRecord } from '../domain/report.types';

const LAST_REPORT_CACHE_KEY = 'report:last-payload:v1';

@Injectable()
export class VercelKvLastReportCacheService implements LastReportCachePort {
  private readonly logger = new Logger(VercelKvLastReportCacheService.name);
  private warnedMissingConfig = false;

  async getLastReportPayload(): Promise<LastReportPayloadCacheRecord | null> {
    if (!this.isKvConfigured()) {
      this.warnMissingConfigOnce();
      return null;
    }

    try {
      const cached = await kv.get<LastReportPayloadCacheRecord>(LAST_REPORT_CACHE_KEY);
      if (!cached || typeof cached !== 'object') {
        return null;
      }

      if (!cached.payload || typeof cached.jiraCheckUrl !== 'string') {
        return null;
      }

      return cached;
    } catch (error) {
      this.logger.warn(`Failed to read cached report payload: ${(error as Error).message}`);
      return null;
    }
  }

  async setLastReportPayload(payload: LastReportPayloadCacheRecord): Promise<void> {
    if (!this.isKvConfigured()) {
      this.warnMissingConfigOnce();
      return;
    }

    try {
      await kv.set(LAST_REPORT_CACHE_KEY, payload);
    } catch (error) {
      this.logger.warn(`Failed to store cached report payload: ${(error as Error).message}`);
    }
  }

  private isKvConfigured(): boolean {
    const restUrl = (process.env.KV_REST_API_URL || '').trim();
    const restToken = (process.env.KV_REST_API_TOKEN || '').trim();

    return Boolean(restUrl && restToken);
  }

  private warnMissingConfigOnce(): void {
    if (this.warnedMissingConfig) {
      return;
    }

    this.warnedMissingConfig = true;
    this.logger.warn(
      'Vercel KV is not configured. Fast retry cache is disabled. Set KV_REST_API_URL and KV_REST_API_TOKEN to enable it.',
    );
  }
}
