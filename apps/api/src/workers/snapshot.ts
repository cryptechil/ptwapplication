import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { hashSchema, type FormField, type FieldType } from '@ptw/shared';

/**
 * Scrapes the live Tevel form and stores a snapshot. Computes a hash and
 * compares to the version baked into the running code. If they differ,
 * submissions get blocked until an admin reviews and approves.
 */
export async function runSnapshot() {
  await fs.mkdir(env.SNAPSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ locale: 'he-IL' });
  const page = await ctx.newPage();
  try {
    await page.goto(env.TEVEL_FORM_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('form[aria-label*="PTW"]', { timeout: 30_000 });

    const fields = await scrape(page);
    const hash = hashSchema(fields);

    const screenshot = await page.screenshot({ fullPage: true });
    const screenshotPath = path.join(env.SNAPSHOT_DIR, `${Date.now()}-${hash}.png`);
    await fs.writeFile(screenshotPath, screenshot);

    const existing = await prisma.formSchemaSnapshot.findUnique({ where: { hash } });
    if (existing) {
      // Touch capturedAt so we know guard is still running.
      await prisma.formSchemaSnapshot.update({
        where: { id: existing.id },
        data: { capturedAt: new Date() },
      });
      return { hash, changed: false };
    }
    await prisma.formSchemaSnapshot.create({
      data: { hash, fields: fields as never, notes: null },
    });
    return { hash, changed: true };
  } finally {
    await browser.close();
  }
}

async function scrape(page: import('playwright').Page): Promise<FormField[]> {
  return page.$$eval('[data-testid$="-question-title-wrapper"]', (titleEls) => {
    function inferType(testIdPrefix: string): FieldType {
      if (testIdPrefix.startsWith('date_range')) return 'date_range';
      if (testIdPrefix.startsWith('date_')) return 'datetime';
      if (testIdPrefix.startsWith('email')) return 'email';
      if (testIdPrefix.startsWith('phone')) return 'phone';
      if (testIdPrefix.startsWith('long_text')) return 'long_text';
      if (testIdPrefix.startsWith('short_text') || testIdPrefix.startsWith('text_'))
        return 'short_text';
      if (testIdPrefix.startsWith('multi_select')) return 'multi_select';
      if (testIdPrefix.startsWith('single_select')) return 'radio_yes_no';
      if (testIdPrefix.startsWith('dropdown') || testIdPrefix.startsWith('color_'))
        return 'dropdown';
      if (testIdPrefix.startsWith('file')) return 'file';
      return 'short_text';
    }
    const out: FormField[] = [];
    for (const t of titleEls) {
      const id =
        t.getAttribute('data-testid')?.replace('-question-title-wrapper', '') ?? '';
      const titleNode = t.querySelector('h2 .QuestionTitle-module_innerTitle__PzEOP, h2');
      const labelHe = (titleNode?.textContent ?? '').trim();
      const required = !!t.querySelector('[aria-label="Required"]');
      out.push({
        id,
        mondayId: id,
        type: inferType(id),
        labelHe,
        labelEn: labelHe,
        required,
      });
    }
    return out;
  });
}
