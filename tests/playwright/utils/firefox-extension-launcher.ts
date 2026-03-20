import path from 'path';
import type { BrowserContext, Page } from '@playwright/test';

async function waitForTemporaryAddonUI(debugPage: Page, timeout: number): Promise<void> {
  const loadTemporaryAddonButton = debugPage
    .getByRole('button', { name: /load temporary add-on/i })
    .first();

  await loadTemporaryAddonButton.waitFor({ state: 'visible', timeout });
}

export async function installFirefoxTemporaryExtension(
  context: BrowserContext,
  extensionPath: string,
  extensionName = 'FaVault',
  timeout = 15000
): Promise<Page> {
  const manifestPath = path.join(extensionPath, 'manifest.json');
  const debugPage = await context.newPage();

  await debugPage.goto('about:debugging#/runtime/this-firefox');
  await debugPage.waitForLoadState('domcontentloaded');

  await waitForTemporaryAddonUI(debugPage, timeout);

  const loadTemporaryAddonButton = debugPage.getByRole('button', {
    name: /load temporary add-on/i
  }).first();

  const [fileChooser] = await Promise.all([
    debugPage.waitForEvent('filechooser'),
    loadTemporaryAddonButton.click()
  ]);

  await fileChooser.setFiles(manifestPath);

  try {
    await debugPage.getByText(new RegExp(extensionName, 'i')).first().waitFor({
      state: 'visible',
      timeout
    });
  } catch {
    await debugPage.waitForTimeout(2000);
  }

  return debugPage;
}
