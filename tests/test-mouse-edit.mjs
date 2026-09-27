import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { extname } from 'node:path';
import { chromium } from 'playwright';

const rootDir = process.cwd();

function getContentType(filePath) {
  switch (extname(filePath)) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'text/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    default: return 'text/plain; charset=utf-8';
  }
}

async function createServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const requestPath = req.url === '/' ? '/index.html' : req.url;
      const cleanPath = requestPath.split('?')[0];
      const filePath = path.join(rootDir, decodeURIComponent(cleanPath));
      const fileContents = await fs.readFile(filePath);
      res.writeHead(200, { 'Content-Type': getContentType(filePath) });
      res.end(fileContents);
    } catch (err) {
      console.log('404 for:', req.url);
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    server,
    url: `http://127.0.0.1:${address.port}/index.html`
  };
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'msedge', headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

const { server, url } = await createServer();
const browser = await launchBrowser();
const page = await browser.newPage();
const pageErrors = [];

page.on('console', (msg) => {
  console.log('BROWSER:', msg.text());
});

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('#btn-toggle-maps-sidebar').click({ force: true });
  await page.waitForTimeout(100);

  // 1. Root node is selected by default; create child (level 1)
  await page.locator('#ctrl-add-child').click({ force: true });
  await page.waitForTimeout(100);
  await page.keyboard.type('Branch1');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);

  // 2. Add grandchild / leaf node (level 2, .node-inline-text)
  await page.locator('#ctrl-add-child').click({ force: true });
  await page.waitForTimeout(100);
  await page.keyboard.type('LeafNodeText');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);

  // Hide floating comment panel in test so it does not intercept pointer clicks
  await page.evaluate(() => {
    const cp = document.getElementById('comment-panel');
    if (cp) cp.style.display = 'none';
  });
  await page.waitForTimeout(100);

  const leafLocator = page.locator('.node.node-inline-text').first();
  await leafLocator.dblclick();
  await page.waitForTimeout(200);

  const editor = page.locator('.node-text-edit');
  assert.equal(await editor.count(), 1, 'expected .node-text-edit to be visible on dblclick');

  // 4. Click with mouse inside the editor text to position the caret
  const box = await editor.boundingBox();
  assert(box !== null, 'expected editor to have bounding box');

  // Click near the middle of the text
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(100);

  // Verify that clicking with the mouse did NOT close the editor
  assert.equal(await page.locator('.node-text-edit').count(), 1, 'editor must still be open after clicking with mouse');

  // 5. Type extra text at the clicked cursor position
  await page.keyboard.type('-EDITED-');
  await page.waitForTimeout(100);

  // 6. Press Enter to commit
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);

  // Verify editor closed and new text persists
  assert.equal(await page.locator('.node-text-edit').count(), 0, 'editor should close after Enter');
  const updatedText = await leafLocator.textContent();
  assert(updatedText?.includes('-EDITED-'), `expected leaf text to include -EDITED-, got: ${updatedText}`);

  assert.equal(pageErrors.length, 0, `unexpected page errors: ${pageErrors.join(', ')}`);
  console.log('SUCCESS: Leaf double-click and mouse cursor positioning test passed perfectly!');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
