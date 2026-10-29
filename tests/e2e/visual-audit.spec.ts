import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const VIEWPORTS = [
  { width: 1100, height: 700, name: '1100x700' },
  { width: 1440, height: 900, name: '1440x900' },
  { width: 1920, height: 1080, name: '1920x1080' },
];

const THEMES = ['dark', 'light', 'high-contrast'] as const;

test.describe('Visual Audit Across Viewports and Themes', () => {
  const screensDir = path.resolve(process.cwd(), 'docs/reports/screens');

  test.beforeAll(() => {
    if (!fs.existsSync(screensDir)) {
      fs.mkdirSync(screensDir, { recursive: true });
    }
  });

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`Audit screen: ${theme} @ ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/');

        // Set theme on root element
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
        }, theme);

        // Allow micro-animations and fonts to settle
        await page.waitForTimeout(300);

        // Capture full IDE workspace view
        const filePath = path.join(screensDir, `workspace-${theme}-${vp.name}.png`);
        await page.screenshot({ path: filePath, fullPage: true });

        // Switch to Mission Control (Agent Orchestrator) view
        const managerToggle = page.locator('button[title*="Manager"], button[role="radio"]').last();
        if (await managerToggle.isVisible()) {
          await managerToggle.click();
          await page.waitForTimeout(300);
          const mcPath = path.join(screensDir, `mission-control-${theme}-${vp.name}.png`);
          await page.screenshot({ path: mcPath, fullPage: true });
        }
      });
    }
  }
});
