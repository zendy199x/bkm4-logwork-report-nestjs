import {
    Body,
    Controller,
    Get,
    Header,
    Headers,
    HttpCode,
    Post,
    Query,
    UnauthorizedException,
} from '@nestjs/common';

import { ReportService } from './report.service';

@Controller('reports')
export class ReportController {
  private readonly teamName = (process.env.TEAM_NAME || 'TEAM').trim() || 'TEAM';

  constructor(private readonly reportService: ReportService) { }

  @Post('run')
  async run(
    @Headers('x-cron-secret') cronSecretHeader: string | undefined,
    @Query('token') tokenFromQuery: string | undefined,
  ) {
    const token = cronSecretHeader || tokenFromQuery || '';

    if (!this.reportService.canTriggerWithToken(token)) {
      throw new UnauthorizedException('Invalid or missing cron secret');
    }

    const result = await this.reportService.runDailyReport('manual-api-trigger');
    return {
      ok: true,
      ...result,
    };
  }

  @Get('retry')
  @Header('Content-Type', 'text/html; charset=utf-8')
  retryPage() {
    const escapedTeamName = this.escapeHtml(this.teamName);

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <title>Retry report - ${escapedTeamName}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
    <style>
      :root {
        color-scheme: light;
        --bg-top: #fff6ee;
        --bg-bottom: #eaf4ff;
        --ink: #1f2940;
        --muted: #596785;
        --line: #dbe2f1;
        --card: rgba(255, 255, 255, 0.86);
        --primary: #3558e6;
        --primary-hover: #2745bf;
        --danger: #b83280;
        --danger-hover: #912a67;
        --success: #0f8b8d;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        touch-action: manipulation;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: 'Space Grotesk', sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 10% 14%, rgba(255, 170, 123, 0.35), transparent 34%),
          radial-gradient(circle at 90% 10%, rgba(104, 196, 255, 0.28), transparent 30%),
          radial-gradient(circle at 92% 80%, rgba(121, 171, 255, 0.20), transparent 32%),
          linear-gradient(180deg, var(--bg-top), var(--bg-bottom));
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }

      .panel {
        position: relative;
        width: min(760px, 100%);
        background: var(--card);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.9);
        border-radius: 24px;
        padding: clamp(18px, 4vw, 34px);
        box-shadow:
          0 24px 45px rgba(35, 67, 124, 0.14),
          inset 0 1px 0 rgba(255, 255, 255, 0.9);
      }

      .panel-top {
        display: flex;
        justify-content: flex-end;
        margin-bottom: clamp(10px, 2vw, 18px);
      }

      .lang-switch {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 7px 11px;
        background: rgba(255, 255, 255, 0.9);
        color: #26385f;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
      }

      .lang-switch:hover {
        background: #fff;
      }

      .lang-icon {
        width: 14px;
        height: 14px;
        display: inline-block;
      }

      h1 {
        margin: 2px 0 0;
        font-size: clamp(28px, 5vw, 44px);
        line-height: 1.08;
        letter-spacing: -0.02em;
      }

      p {
        margin: 12px 0;
        color: var(--muted);
        font-size: clamp(14px, 2.8vw, 18px);
      }

      .count-card {
        margin: 18px 0;
        padding: 14px;
        border-radius: 14px;
        border: 1px solid var(--line);
        background: linear-gradient(160deg, rgba(255, 255, 255, 0.95), rgba(247, 250, 255, 0.75));
      }

      .count-title {
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 12px;
      }

      .count-value {
        margin-top: 6px;
        font-size: clamp(24px, 5vw, 34px);
        font-weight: 700;
        color: #1b2a48;
      }

      .realtime-top {
        margin: 8px 0 2px;
      }

      .realtime-value {
        margin-top: 6px;
        font-size: clamp(16px, 3vw, 22px);
        font-weight: 700;
        color: #1b2a48;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 14px;
        justify-content: center;
        min-height: 44px;
      }

      .actions .is-hidden {
        display: none !important;
      }

      .actions.is-canceled button {
        display: none !important;
      }

      button {
        appearance: none;
        border: 0;
        border-radius: 12px;
        padding: 11px 16px;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
      }

      button:focus-visible {
        outline: 3px solid rgba(53, 88, 230, 0.35);
        outline-offset: 2px;
      }

      .confirm {
        color: #fff;
        background: var(--primary);
        min-width: 180px;
        box-shadow: 0 8px 18px rgba(53, 88, 230, 0.3);
      }

      .confirm:hover:not(:disabled) {
        background: var(--primary-hover);
        transform: translateY(-1px);
      }

      .cancel {
        color: #fff;
        background: var(--danger);
        box-shadow: 0 8px 18px rgba(184, 50, 128, 0.25);
      }

      .cancel:hover:not(:disabled) {
        background: var(--danger-hover);
        transform: translateY(-1px);
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.68;
        transform: none;
        box-shadow: none;
      }

      .status {
        min-height: 24px;
        margin-top: 14px;
        font-weight: 600;
      }

      .status.ok {
        color: var(--success);
      }

      .status.error {
        color: #8a2323;
      }

      .status.info {
        color: #39527f;
      }

      .note {
        margin-top: 8px;
        font-size: 13px;
        color: #60708c;
      }
    </style>
  </head>
  <body>
    <main class="panel">
      <div class="panel-top">
        <button id="langSwitchBtn" class="lang-switch" type="button" aria-label="Switch language">
          <svg class="lang-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M3 12h18"></path>
            <path d="M12 3a15 15 0 0 1 0 18"></path>
            <path d="M12 3a15 15 0 0 0 0 18"></path>
          </svg>
          <span id="langSwitchText">EN</span>
        </button>
      </div>

      <h1 id="titleText">Retry report - ${escapedTeamName}</h1>
      <div class="realtime-top" aria-live="polite">
        <div id="localTime" class="realtime-value">--</div>
      </div>
      <p id="questionText">Do you want to retry sending the report now?</p>

      <section class="count-card" aria-live="polite">
        <p id="countTitleText" class="count-title">Retry Count Today</p>
        <div id="retryCount" class="count-value">0</div>
      </section>

      <div id="actionsRow" class="actions">
        <button id="confirmBtn" class="confirm" type="button">Confirm Retry</button>
        <button id="cancelBtn" class="cancel" type="button">Cancel</button>
      </div>

      <p id="status" class="status info">No report has been retried yet.</p>
    </main>

    <script>
      (function () {
        var STORAGE_KEY = 'retry_report_daily_counter_v1';
        var LANGUAGE_STORAGE_KEY = 'retry_report_language_v1';
        var TEAM_NAME = ${JSON.stringify(this.teamName)};

        var translations = {
          en: {
            langButton: 'EN',
            pageTitle: 'Retry report - {team}',
            canceledTitle: 'Retry request canceled - {team}',
            question: 'Do you want to retry sending the report now?',
            canceledQuestion: 'No further action is needed. You can close this page now.',
            retryCountTitle: 'Retry Count Today',
            localTimeTitle: 'Local Time',
            confirm: 'Confirm Retry',
            buttonRetrying: 'Retrying',
            cancel: 'Cancel',
            statusIdle: 'You have not retried any report today.',
            statusCanceled: 'Action canceled. No report was sent.',
            statusRetrying: 'Retrying report...',
            statusErrorFallback: 'An error occurred while retrying the report.',
            statusRetryFailedFallback: 'Failed to retry report. Please try again.',
            statusNetworkError: 'Unable to connect to the server. Please check your network and try again.',
            statusSuccess: function (count) {
              var unit = count === 1 ? 'time' : 'times';
              return 'Retry successful. You have retried ' + count + ' ' + unit + ' today.';
            },
            statusHistory: function (count) {
              var unit = count === 1 ? 'time' : 'times';
              return 'You have retried ' + count + ' ' + unit + ' today.';
            },
          },
          vi: {
            langButton: 'VI',
            pageTitle: 'Gửi lại report - {team}',
            canceledTitle: 'Đã hủy yêu cầu gửi lại - {team}',
            question: 'Bạn có muốn gửi lại report ngay bây giờ không?',
            canceledQuestion: 'Không cần thao tác thêm. Bạn có thể đóng trang này.',
            retryCountTitle: 'Số lần đã gửi lại hôm nay',
            localTimeTitle: 'Giờ local hiện tại',
            confirm: 'Xác nhận gửi lại',
            buttonRetrying: 'Đang gửi lại',
            cancel: 'Hủy',
            statusIdle: 'Hôm nay bạn chưa gửi lại report lần nào.',
            statusCanceled: 'Đã hủy thao tác. Không có report nào được gửi.',
            statusRetrying: 'Đang gửi lại report...',
            statusErrorFallback: 'Đã xảy ra lỗi khi gửi lại report.',
            statusRetryFailedFallback: 'Không thể gửi lại report. Vui lòng thử lại.',
            statusNetworkError: 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.',
            statusSuccess: function (count) {
              return 'Gửi lại thành công. Hôm nay bạn đã retry ' + count + ' lần.';
            },
            statusHistory: function (count) {
              return 'Hôm nay bạn đã retry ' + count + ' lần.';
            },
          },
        };

        var statusEl = document.getElementById('status');
        var titleEl = document.getElementById('titleText');
        var questionEl = document.getElementById('questionText');
        var countTitleEl = document.getElementById('countTitleText');
        var countEl = document.getElementById('retryCount');
        var localTimeEl = document.getElementById('localTime');
        var langSwitchBtn = document.getElementById('langSwitchBtn');
        var langSwitchText = document.getElementById('langSwitchText');
        var confirmBtn = document.getElementById('confirmBtn');
        var cancelBtn = document.getElementById('cancelBtn');
        var actionsRow = document.getElementById('actionsRow');

        var currentLanguage = getSavedLanguage();
        var statusState = { kind: 'idle' };
        var loadingTimerId = null;
        var isCanceledMode = false;

        function pad(num) {
          return String(num).padStart(2, '0');
        }

        function todayKey() {
          var now = new Date();
          return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
        }

        function getSavedLanguage() {
          var saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
          return saved === 'vi' ? 'vi' : 'en';
        }

        function getI18n() {
          return translations[currentLanguage] || translations.en;
        }

        function applyLanguage() {
          var i18n = getI18n();
          var localizedTitle = (isCanceledMode ? i18n.canceledTitle : i18n.pageTitle).replace('{team}', TEAM_NAME);
          document.title = localizedTitle;
          document.documentElement.lang = currentLanguage;
          titleEl.textContent = localizedTitle;

          if (isCanceledMode) {
            questionEl.textContent = i18n.canceledQuestion;
            confirmBtn.hidden = true;
            confirmBtn.classList.add('is-hidden');
            confirmBtn.style.display = 'none';
            confirmBtn.style.setProperty('display', 'none', 'important');
            cancelBtn.hidden = true;
            cancelBtn.classList.add('is-hidden');
            cancelBtn.style.display = 'none';
            cancelBtn.style.setProperty('display', 'none', 'important');
            actionsRow.classList.add('is-canceled');
          } else {
            questionEl.textContent = i18n.question;
            confirmBtn.hidden = false;
            confirmBtn.classList.remove('is-hidden');
            confirmBtn.style.display = '';
            cancelBtn.hidden = false;
            cancelBtn.classList.remove('is-hidden');
            cancelBtn.style.display = '';
            actionsRow.classList.remove('is-canceled');
          }

          countTitleEl.textContent = i18n.retryCountTitle;
          if (!isCanceledMode && loadingTimerId === null) {
            confirmBtn.textContent = i18n.confirm;
            confirmBtn.style.width = 'auto';
            confirmBtn.style.width = confirmBtn.offsetWidth + 'px';
          }
          cancelBtn.textContent = i18n.cancel;
          langSwitchText.textContent = i18n.langButton;
          refreshLocalTime();
          renderStatus();
        }

        function startConfirmLoading() {
          var i18n = getI18n();
          var dots = ['.', '..', '...'];
          var frame = 0;

          confirmBtn.textContent = i18n.buttonRetrying + dots[frame];

          loadingTimerId = setInterval(function () {
            frame = (frame + 1) % dots.length;
            confirmBtn.textContent = i18n.buttonRetrying + dots[frame];
          }, 420);
        }

        function stopConfirmLoading() {
          if (loadingTimerId !== null) {
            clearInterval(loadingTimerId);
            loadingTimerId = null;
          }

          confirmBtn.textContent = getI18n().confirm;
        }

        function enterCanceledMode() {
          isCanceledMode = true;
          confirmBtn.disabled = true;
          cancelBtn.disabled = true;
          confirmBtn.hidden = true;
          confirmBtn.classList.add('is-hidden');
          confirmBtn.style.display = 'none';
          confirmBtn.style.setProperty('display', 'none', 'important');
          cancelBtn.hidden = true;
          cancelBtn.classList.add('is-hidden');
          cancelBtn.style.display = 'none';
          cancelBtn.style.setProperty('display', 'none', 'important');
          actionsRow.classList.add('is-canceled');
          statusState = { kind: 'canceled' };
          applyLanguage();
          renderStatus();
        }

        function readCounter() {
          var empty = { date: todayKey(), count: 0 };
          try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
              return empty;
            }

            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed.date !== 'string' || typeof parsed.count !== 'number') {
              return empty;
            }

            if (parsed.date !== todayKey()) {
              return empty;
            }

            return parsed;
          } catch (_error) {
            return empty;
          }
        }

        function writeCounter(state) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }

        function refreshCount(state) {
          countEl.textContent = String(state.count);
        }

        function refreshLocalTime() {
          var now = new Date();

          if (currentLanguage === 'vi') {
            var viFormatter = new Intl.DateTimeFormat('vi-VN', {
              year: 'numeric',
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
              timeZoneName: 'shortOffset',
            });

            var parts = viFormatter.formatToParts(now);
            var hour = parts.find(function (part) { return part.type === 'hour'; })?.value || '00';
            var minute = parts.find(function (part) { return part.type === 'minute'; })?.value || '00';
            var second = parts.find(function (part) { return part.type === 'second'; })?.value || '00';
            var day = parts.find(function (part) { return part.type === 'day'; })?.value || '';
            var month = parts.find(function (part) { return part.type === 'month'; })?.value || '';
            var year = parts.find(function (part) { return part.type === 'year'; })?.value || '';
            var timeZoneName = parts.find(function (part) { return part.type === 'timeZoneName'; })?.value || 'GMT';

            localTimeEl.textContent =
              hour +
              ':' +
              minute +
              ':' +
              second +
              ' ngày ' +
              day +
              ' tháng ' +
              month +
              ' năm ' +
              year +
              ' (' +
              timeZoneName +
              ')';
            return;
          }

          var enFormatter = new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZoneName: 'shortOffset',
          });
          var enParts = enFormatter.formatToParts(now);
          var enMonth = enParts.find(function (part) { return part.type === 'month'; })?.value || '';
          var enDay = enParts.find(function (part) { return part.type === 'day'; })?.value || '';
          var enYear = enParts.find(function (part) { return part.type === 'year'; })?.value || '';
          var enHour = enParts.find(function (part) { return part.type === 'hour'; })?.value || '00';
          var enMinute = enParts.find(function (part) { return part.type === 'minute'; })?.value || '00';
          var enSecond = enParts.find(function (part) { return part.type === 'second'; })?.value || '00';
          var enTimeZone = enParts.find(function (part) { return part.type === 'timeZoneName'; })?.value || 'GMT';

          localTimeEl.textContent =
            enMonth +
            ' ' +
            enDay +
            ', ' +
            enYear +
            ', ' +
            enHour +
            ':' +
            enMinute +
            ':' +
            enSecond +
            ' (' +
            enTimeZone +
            ')';
        }

        function setStatus(text, kind) {
          statusEl.textContent = text;
          statusEl.className = 'status ' + kind;
        }

        function resolveErrorState(error) {
          if (!(error instanceof Error)) {
            return { kind: 'error', message: '' };
          }

          var rawMessage = (error.message || '').trim();
          var normalized = rawMessage.toLowerCase();
          var isFetchNetworkError =
            normalized === 'failed to fetch' ||
            normalized.includes('networkerror') ||
            normalized.includes('load failed');

          if (isFetchNetworkError) {
            return { kind: 'error', errorType: 'network' };
          }

          return { kind: 'error', message: rawMessage };
        }

        function renderStatus() {
          var i18n = getI18n();

          if (statusState.kind === 'idle') {
            setStatus(i18n.statusIdle, 'info');
            return;
          }

          if (statusState.kind === 'canceled') {
            confirmBtn.disabled = true;
            cancelBtn.disabled = true;
            confirmBtn.hidden = true;
            confirmBtn.classList.add('is-hidden');
            confirmBtn.style.display = 'none';
            confirmBtn.style.setProperty('display', 'none', 'important');
            cancelBtn.hidden = true;
            cancelBtn.classList.add('is-hidden');
            cancelBtn.style.display = 'none';
            cancelBtn.style.setProperty('display', 'none', 'important');
            actionsRow.classList.add('is-canceled');
            questionEl.textContent = i18n.canceledQuestion;
            setStatus(i18n.statusCanceled, 'info');
            return;
          }

          if (statusState.kind === 'retrying') {
            setStatus(i18n.statusRetrying, 'info');
            return;
          }

          if (statusState.kind === 'success') {
            setStatus(i18n.statusSuccess(statusState.count), 'ok');
            return;
          }

          if (statusState.kind === 'history') {
            setStatus(i18n.statusHistory(statusState.count), 'info');
            return;
          }

          if (statusState.kind === 'infoMessage') {
            setStatus(statusState.message, 'info');
            return;
          }

          if (statusState.kind === 'error') {
            if (statusState.errorType === 'network') {
              setStatus(i18n.statusNetworkError, 'error');
              return;
            }

            setStatus(statusState.message || i18n.statusErrorFallback, 'error');
          }
        }

        var state = readCounter();
        if (state.count > 0) {
          statusState = { kind: 'history', count: state.count };
        }
        writeCounter(state);
        refreshCount(state);
        refreshLocalTime();
        setInterval(refreshLocalTime, 1000);
        applyLanguage();

        langSwitchBtn.addEventListener('click', function () {
          currentLanguage = currentLanguage === 'en' ? 'vi' : 'en';
          localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
          applyLanguage();
        });

        cancelBtn.addEventListener('click', function () {
          enterCanceledMode();
        });

        confirmBtn.addEventListener('click', async function () {
          confirmBtn.disabled = true;
          cancelBtn.disabled = true;
          startConfirmLoading();

          try {
            var response = await fetch(window.location.href, {
              method: 'POST',
              headers: {
                Accept: 'application/json',
              },
            });

            var data = null;
            try {
              data = await response.json();
            } catch (_jsonError) {
              data = null;
            }

            if (!response.ok || !data || data.ok !== true) {
              var i18n = getI18n();
              var errorMessage = (data && data.message) || i18n.statusRetryFailedFallback;
              throw new Error(errorMessage);
            }

            state = {
              date: todayKey(),
              count: state.count + 1,
            };
            writeCounter(state);
            refreshCount(state);
            var successI18n = getI18n();
            if (data.cacheHit === false) {
              statusState = {
                kind: 'infoMessage',
                message: data.message || successI18n.statusRetrying,
              };
            } else {
              statusState = { kind: 'success', count: state.count };
            }
            renderStatus();
          } catch (error) {
            statusState = resolveErrorState(error);
            renderStatus();
          } finally {
            stopConfirmLoading();
            confirmBtn.disabled = false;
            cancelBtn.disabled = false;
          }
        });
      })();
    </script>
  </body>
</html>`;
  }

  @Post('retry')
  async retry(@Query('token') token = '') {
    if (!this.reportService.canTriggerWithToken(token)) {
      throw new UnauthorizedException('Invalid or missing cron secret');
    }

    const result = await this.reportService.retryDailyReportWithCache('chat-retry-button');
    return {
      ok: true,
      ...result,
    };
  }

  @Post('chat/events')
  @HttpCode(200)
  async handleGoogleChatEvent(@Body() event: unknown) {
    return this.reportService.handleGoogleChatEvent(event);
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
