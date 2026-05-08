import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { JWT } from 'google-auth-library';
import { ChatMode, type AggregatedData, type AggregatedUser, type ChatDeliveryConfig } from '../domain/report.types';

const TEAM_NAME = (process.env.TEAM_NAME || 'BKM4').trim() || 'BKM4';
const REPORT_TITLE = `-+-${TEAM_NAME} LOGWORK REPORT-+-`;

@Injectable()
export class ChatDeliveryService {
  private readonly logger = new Logger(ChatDeliveryService.name);

  async sendReport(
    chat: ChatDeliveryConfig,
    data: AggregatedData & { reportDateTimeLabel: string },
    jiraCheckUrl: string,
  ): Promise<void> {
    const text = this.buildChatTextReport(data);
    await this.postToChat(chat, { text });

    try {
      const buttons = [
        ...this.buildRetryButtons(chat),
        {
          text: 'Kiểm tra trên Jira',
          onClick: {
            openLink: {
              url: jiraCheckUrl,
            },
          },
        },
      ];

      await this.postToChat(chat, {
        cardsV2: [
          {
            cardId: 'jira-check',
            card: {
              sections: [
                {
                  widgets: [
                    {
                      buttonList: {
                        buttons,
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send Jira button card, text report already sent: ${(error as Error).message}`,
      );
    }
  }

  private buildChatTextReport(data: {
    users: Record<string, AggregatedUser>;
    reportDate: string;
    reportDateTimeLabel: string;
  }): string {
    const rows = Object.entries(data.users)
      .map(([name, user]) => {
        const totalSeconds = user.logs[data.reportDate] || 0;
        return { name, totalSeconds };
      })
      .filter((row) => row.totalSeconds > 0)
      .sort((left, right) => right.totalSeconds - left.totalSeconds);

    if (rows.length === 0) {
      const noDataText = 'No worklog data at this time';
      const noDataBorder = `+${'-'.repeat(noDataText.length + 2)}+`;
      const noDataLine = `| ${noDataText} |`;

      return [
        '```',
        REPORT_TITLE,
        `Date: ${data.reportDateTimeLabel}`,
        noDataBorder,
        noDataLine,
        noDataBorder,
        '```',
      ].join('\n');
    }

    const grandTotalSeconds = rows.reduce((sumSeconds, row) => sumSeconds + row.totalSeconds, 0);
    const cappedRows = rows.slice(0, 50);
    const nameWidth = Math.max(
      'Author'.length,
      ...cappedRows.map((row, index) => `${index + 1}. ${row.name}`.length),
      'Total'.length,
    );
    const totalWidth = Math.max(
      'Total'.length,
      ...cappedRows.map((row) => this.formatHoursFromSeconds(row.totalSeconds).length),
      this.formatHoursFromSeconds(grandTotalSeconds).length,
    );

    const horizontalBorder = `+${'-'.repeat(nameWidth + 2)}+${'-'.repeat(totalWidth + 2)}+`;
    const totalBorder = `+${'-'.repeat(nameWidth + 2)}+${'-'.repeat(totalWidth + 2)}+`;
    const header = `| ${'Author'.padEnd(nameWidth)} | ${'Total'.padStart(totalWidth)} |`;
    const rowLines = cappedRows.map((row, index) => {
      const hoursText = this.formatHoursFromSeconds(row.totalSeconds);
      const authorText = `${index + 1}. ${row.name}`;
      return `| ${authorText.padEnd(nameWidth)} | ${hoursText.padStart(totalWidth)} |`;
    });
    const totalHoursText = this.formatHoursFromSeconds(grandTotalSeconds);
    const totalLine = `| ${'Total'.padEnd(nameWidth)} | ${totalHoursText.padStart(totalWidth)} |`;

    return [
      '```',
      REPORT_TITLE,
      `Date: ${data.reportDateTimeLabel}`,
      horizontalBorder,
      header,
      horizontalBorder,
      ...rowLines,
      totalBorder,
      totalLine,
      totalBorder,
      '```',
    ].join('\n');
  }

  private buildRetryButtons(chat: ChatDeliveryConfig): Array<Record<string, unknown>> {
    if (chat.mode === ChatMode.APP) {
      return [
        {
          text: 'Kiểm tra lại',
          onClick: {
            action: {
              function: 'retry_report',
            },
          },
        },
      ];
    }

    if (chat.reportUrl) {
      return [
        {
          text: 'Kiểm tra lại',
          onClick: {
            openLink: {
              url: chat.reportUrl,
            },
          },
        },
      ];
    }

    return [];
  }

  private async postToChat(chat: ChatDeliveryConfig, payload: Record<string, unknown>): Promise<void> {
    if (chat.mode === ChatMode.WEBHOOK) {
      if (!chat.webhook) {
        throw new Error('Missing webhook URL for webhook mode');
      }

      await axios.post(chat.webhook, payload);
      return;
    }

    const accessToken = await this.getGoogleChatAccessToken(chat);
    const url = `https://chat.googleapis.com/v1/${chat.space}/messages`;

    await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private async getGoogleChatAccessToken(
    chat: Extract<ChatDeliveryConfig, { mode: ChatMode.APP }>,
  ): Promise<string> {
    const client = new JWT({
      email: chat.serviceAccountEmail,
      key: chat.serviceAccountPrivateKey,
      scopes: ['https://www.googleapis.com/auth/chat.bot'],
    });

    const { access_token: accessToken } = await client.authorize();
    if (!accessToken) {
      throw new Error('Failed to obtain Google Chat access token');
    }

    return accessToken;
  }

  private formatHoursFromSeconds(totalSeconds: number): string {
    const hours = totalSeconds / 3600;
    return `${String(hours)}h`;
  }
}
