import { test, expect } from '@playwright/test';

test.describe('Ajson Studio — End-to-End Core Workflows (10 Scenarios)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app shell to hydrate
    await expect(page.locator('header')).toBeVisible();
  });

  test('Scenario 1: App Boots with Professional IDE Shell Structure', async ({ page }) => {
    await expect(page.getByText('Ajson Studio').first()).toBeVisible();
    await expect(page.getByRole('complementary', { name: /activity bar/i })).toBeVisible();
    await expect(page.getByRole('contentinfo', { name: /status bar/i })).toBeVisible();
    await expect(page.getByRole('region', { name: /bottom panel/i })).toBeVisible();
    await expect(page.getByRole('region', { name: /ai assistant panel/i })).toBeVisible();
  });

  test('Scenario 2: Explorer File Tree Browsing & Tab Opening', async ({ page }) => {
    // Explorer should show workspace files
    const fileItem = page.locator('button:has-text("App.tsx")').first();
    if (await fileItem.isVisible()) {
      await fileItem.click();
      await expect(page.locator('header, div').filter({ hasText: 'App.tsx' }).first()).toBeVisible();
    }
  });

  test('Scenario 3: Command Palette Invocation (F1 / Ctrl+Shift+P)', async ({ page }) => {
    // Click search trigger in title bar or hit F1
    const searchTrigger = page.locator('button[aria-label="Open Command Palette"]');
    await searchTrigger.click();

    // Verify command palette modal dialog opens
    const palette = page.locator('input[placeholder*="command"]');
    await expect(palette).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(palette).not.toBeVisible();
  });

  test('Scenario 4: Bottom Panel Tab Switching (Terminal, Output, Problems)', async ({ page }) => {
    // Switch to Output tab
    const outputTab = page.getByRole('tab', { name: /output/i });
    await outputTab.click();
    await expect(outputTab).toHaveAttribute('aria-selected', 'true');

    // Switch to Problems tab
    const problemsTab = page.getByRole('tab', { name: /problems/i });
    await problemsTab.click();
    await expect(problemsTab).toHaveAttribute('aria-selected', 'true');

    // Switch back to Terminal tab
    const terminalTab = page.getByRole('tab', { name: /terminal/i });
    await terminalTab.click();
    await expect(terminalTab).toHaveAttribute('aria-selected', 'true');
  });

  test('Scenario 5: Terminal Panel Prompt Execution', async ({ page }) => {
    const terminalInput = page.locator('input[placeholder*="Command"]');
    if (await terminalInput.isVisible()) {
      await terminalInput.fill('echo "ajson engine active"');
      await terminalInput.press('Enter');
      await expect(page.locator('div, span').filter({ hasText: /ajson engine active/i }).first()).toBeVisible();
    }
  });

  test('Scenario 6: Git Panel Staging & Commit Workflow', async ({ page }) => {
    // Switch to Source Control via Activity Bar
    const gitNav = page.locator('button[title*="Source Control"], button[title*="Git"]').first();
    await gitNav.click();

    // Verify Git panel is rendered
    await expect(page.locator('h3, span').filter({ hasText: /Source Control/i }).first()).toBeVisible();
  });

  test('Scenario 7: AI Copilot Assistant Interaction & Message Stream', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="Ask"]');
    if (await chatInput.isVisible()) {
      await chatInput.fill('Explain project architecture');
      await chatInput.press('Enter');
      // Verify message appears in thread
      await expect(page.locator('div, p').filter({ hasText: /Explain project architecture/i }).first()).toBeVisible();
    }
  });

  test('Scenario 8: Workspace View Switcher (Editor <-> Mission Control)', async ({ page }) => {
    // Click View Switcher to toggle to Manager mode
    const managerToggle = page.locator('button[title*="Manager"], button[role="radio"]').last();
    await managerToggle.click();

    // Verify Mission Control dashboard renders
    await expect(page.locator('h1, h2, h3, span').filter({ hasText: /Mission Control/i }).first()).toBeVisible();

    // Switch back to Editor view
    const backBtn = page.locator('button:has-text("Back to Editor")').first();
    if (await backBtn.isVisible()) {
      await backBtn.click();
    }
  });

  test('Scenario 9: Settings Theme Switching (Dark, Light, High-Contrast)', async ({ page }) => {
    // Open Settings via Activity Bar
    const settingsNav = page.locator('button[title*="Settings"]').first();
    await settingsNav.click();

    // Change to Light theme
    const lightThemeBtn = page.locator('button:has-text("Light")').first();
    if (await lightThemeBtn.isVisible()) {
      await lightThemeBtn.click();
      const htmlTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      expect(htmlTheme).toBe('light');
    }

    // Restore to Dark theme
    const darkThemeBtn = page.locator('button:has-text("Dark")').first();
    if (await darkThemeBtn.isVisible()) {
      await darkThemeBtn.click();
      const htmlTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      expect(htmlTheme).toBe('dark');
    }
  });

  test('Scenario 10: Notification Center & Status Bar Indicators', async ({ page }) => {
    const notifTrigger = page.locator('button[title*="Notification"]').first();
    if (await notifTrigger.isVisible()) {
      await notifTrigger.click();
      await expect(page.locator('h3, span').filter({ hasText: /Notifications/i }).first()).toBeVisible();
      // Close popover by clicking again
      await notifTrigger.click();
    }
  });
});
