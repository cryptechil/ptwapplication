import { chromium, type Page } from 'playwright';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { tevelFormSchema, type FormField, payloadSchema } from '@ptw/shared';

/**
 * Submits a PTW request by driving Tevel's Monday form with Playwright.
 *
 * Strategy: man-in-the-loop captcha.
 *   1. Open the form in a non-headless Chromium (visible window on the VPS,
 *      reachable via VNC/noVNC by the admin).
 *   2. Fill all fields per `tevelFormSchema`.
 *   3. Mark the request as `awaiting_captcha`. The admin solves the reCAPTCHA
 *      and clicks "שלח | Submit" themselves.
 *   4. The worker watches for the success page, scrapes the PTW number/title/
 *      link, stores them, and marks the request as `submitted` (or `approved`
 *      if Tevel auto-approves on submission — this is the same step here).
 *
 * The admin gets notified (UI poll + audit log) when a job is `awaiting_captcha`.
 */
export async function runSubmit(requestId: string) {
  const r = await prisma.ptwRequest.findUnique({
    where: { id: requestId },
    include: { attachments: true },
  });
  if (!r) throw new Error(`request ${requestId} not found`);

  // Re-validate; payload may have been edited between queue + run.
  const parsed = payloadSchema.safeParse(r.payload);
  if (!parsed.success) {
    await prisma.ptwRequest.update({
      where: { id: requestId },
      data: { status: 'failed', failureReason: 'payload invalid at submission time' },
    });
    return;
  }
  const payload = parsed.data;

  const attempt = await prisma.submissionAttempt.create({
    data: {
      requestId,
      attemptNo: (await prisma.submissionAttempt.count({ where: { requestId } })) + 1,
      status: 'started',
    },
  });

  const browser = await chromium.launch({
    headless: env.PLAYWRIGHT_HEADLESS,
    args: ['--no-sandbox'],
  });
  const ctx = await browser.newContext({ locale: 'he-IL' });
  const page = await ctx.newPage();

  try {
    await page.goto(env.TEVEL_FORM_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('form[aria-label*="PTW"]', { timeout: 30_000 });

    // Live schema check — bail if the DOM no longer matches our code.
    await assertSchemaIntact(page);

    await fillForm(page, payload);

    // Hand-off to admin for CAPTCHA solving + final submit.
    await prisma.ptwRequest.update({
      where: { id: requestId },
      data: { status: 'awaiting_captcha' },
    });

    // Wait for the success page. Monday redirects to a /submission?... URL with
    // a thank-you screen that contains the new PTW number + title + link.
    const success = await waitForSuccess(page).catch(() => null);

    if (!success) {
      await markFailed(requestId, attempt.id, 'submission did not complete (timeout or error after captcha)');
      return;
    }

    await prisma.ptwRequest.update({
      where: { id: requestId },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
        approvedAt: new Date(),
        tevelApprovalNumber: success.number,
        tevelApprovalTitle: success.title,
        tevelApprovalLink: success.link,
      },
    });
    await prisma.submissionAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'success',
        finishedAt: new Date(),
        responseHtml: success.html.slice(0, 200_000),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markFailed(requestId, attempt.id, msg);
  } finally {
    await browser.close().catch(() => {});
  }
}

async function markFailed(requestId: string, attemptId: string, reason: string) {
  await prisma.ptwRequest.update({
    where: { id: requestId },
    data: { status: 'failed', failureReason: reason.slice(0, 1000) },
  });
  await prisma.submissionAttempt.update({
    where: { id: attemptId },
    data: { status: 'failed', error: reason.slice(0, 1000), finishedAt: new Date() },
  });
}

async function assertSchemaIntact(page: Page) {
  const presentIds = await page.$$eval(
    '[data-testid$="-question-title-wrapper"]',
    (els) => els.map((e) => (e.getAttribute('data-testid') ?? '').replace('-question-title-wrapper', '')),
  );
  const expected = new Set(tevelFormSchema.map((f) => f.mondayId));
  const missing = [...expected].filter((id) => !presentIds.includes(id));
  if (missing.length > 0) {
    throw new Error(`schema_mismatch: missing fields in live form: ${missing.join(', ')}`);
  }
}

async function fillForm(page: Page, payload: Record<string, unknown>) {
  for (const field of tevelFormSchema) {
    const value = payload[field.id];
    if (value === undefined || value === null || value === '') continue;
    await fillField(page, field, value);
  }
}

async function fillField(page: Page, f: FormField, value: unknown) {
  const root = page.locator(`#${cssEscape(f.mondayId)}`).first();
  switch (f.type) {
    case 'datetime':
      await root.locator('input[type="datetime-local"]').fill(String(value));
      break;
    case 'date_range': {
      const v = value as { start: string; end: string };
      await root.locator('input[type="date"]').first().fill(v.start);
      await root.locator('input[type="date"]').nth(1).fill(v.end);
      break;
    }
    case 'short_text':
    case 'long_text':
      await root.locator('textarea, input[type="text"]').first().fill(String(value));
      break;
    case 'email':
      await root.locator('input[type="email"]').fill(String(value));
      break;
    case 'phone': {
      const v = value as { countryCode?: string; number: string };
      // Default country is Israel (+972); skip code change unless different.
      if (v.countryCode && v.countryCode !== '+972') {
        // TODO: open the country dropdown and pick the matching flag.
      }
      await page.locator(`#${cssEscape(f.mondayId)}-phone-number-input`).fill(v.number);
      break;
    }
    case 'radio_yes_no': {
      const idx = value === 'yes' ? 0 : 1;
      await root.locator(`[data-testid="${f.mondayId}-${idx}"]`).click();
      break;
    }
    case 'dropdown': {
      const trigger = root.locator('[role="combobox"]');
      await trigger.click();
      await page.locator('[role="listbox"] [role="option"]', { hasText: String(value) }).first().click();
      break;
    }
    case 'multi_select': {
      const arr = (value as string[]) ?? [];
      const trigger = root.locator('[role="combobox"]');
      for (const v of arr) {
        await trigger.click();
        await page.locator('[role="listbox"] [role="option"]', { hasText: v }).first().click();
        await page.keyboard.press('Escape');
      }
      break;
    }
    case 'checkbox_group': {
      const arr = (value as string[]) ?? [];
      const opts = f.options ?? [];
      for (const v of arr) {
        const idx = opts.findIndex((o) => o.value === v);
        if (idx >= 0) {
          await root.locator(`[data-testid="${f.mondayId}-checkboxes-${idx}"] input`).check();
        }
      }
      break;
    }
    case 'signature_name':
      await page.locator(`#${cssEscape(f.mondayId)}-type-section`).fill(String(value).slice(0, 30));
      break;
    case 'file': {
      const ids = (value as string[]) ?? [];
      if (ids.length === 0) break;
      const atts = await prisma.attachment.findMany({ where: { id: { in: ids } } });
      const filePaths = atts.map((a) => path.join(env.UPLOAD_DIR, a.storagePath));
      await page
        .locator(`#${cssEscape(f.mondayId)}-file-input`)
        .setInputFiles(filePaths);
      break;
    }
  }
}

interface SuccessPayload {
  number: string;
  title: string;
  link: string;
  html: string;
}

async function waitForSuccess(page: Page): Promise<SuccessPayload> {
  // Monday's thank-you screen typically lives at /submission/... and
  // contains the response text from the connected board automation.
  // We poll for up to 10 minutes, plenty of time for human captcha solving.
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const html = await page.content();
    const match = html.match(/PTW\d{2}-\d{4}[^<\n]*/);
    if (match) {
      const text = match[0].trim();
      const numMatch = text.match(/PTW\d{2}-\d{4}/);
      const linkLoc = page.locator('a[href*="monday.com"]').first();
      const link = await linkLoc.getAttribute('href').catch(() => null);
      return {
        number: numMatch?.[0] ?? text,
        title: text.replace(/^PTW\d{2}-\d{4}\s*/, '').trim(),
        link: link ?? '',
        html,
      };
    }
    await page.waitForTimeout(2000);
  }
  throw new Error('timeout waiting for success page');
}

function cssEscape(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}
