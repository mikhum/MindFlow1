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
      const filePath = path.join(rootDir, decodeURIComponent(requestPath));
      const fileContents = await fs.readFile(filePath);
      res.writeHead(200, { 'Content-Type': getContentType(filePath) });
      res.end(fileContents);
    } catch {
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

page.on('pageerror', (error) => {
  pageErrors.push(error.message);
});

page.on('dialog', async (dialog) => {
  await dialog.accept();
});

try {
  await page.goto(url);
  await page.waitForSelector('.node');

  const initialCount = await page.locator('.node').count();
  assert.equal(initialCount, 1, 'expected a single root node on startup');

  await page.locator('#ctrl-add-child').click({ force: true });
  await page.waitForTimeout(100);
  const afterAddChild = await page.locator('.node').count();
  assert.equal(afterAddChild, 2, 'expected Add Child to create a second node');
  const parentConnectorCount = await page.locator('svg path.connector-line').count();
  assert.equal(parentConnectorCount, 1, 'expected a parent-child connector to be created');

  const editor = page.locator('.node-text-edit');
  await editor.fill('Smoke Topic');
  await editor.press('Enter');
  await page.waitForTimeout(100);
  const nodeTexts = await page.locator('.node').allTextContents();
  assert(nodeTexts.some((text) => text.includes('Smoke Topic')), 'expected edited node text to persist');

  await page.locator('.node').first().click({ force: true });
  await page.locator('#ctrl-add-relationship').click({ force: true });
  await page.locator('.node').nth(1).click({ force: true });
  await page.waitForTimeout(100);
  const relationshipCount = await page.locator('svg path.relationship-line[marker-end="url(#relationship-arrow)"]').count();
  assert.equal(relationshipCount, 1, 'expected a relationship line to be created');

  await page.locator('svg path.relationship-line-overlay').first().dispatchEvent('pointerdown');
  await page.waitForTimeout(100);
  await page.locator('#node-color-picker').fill('#10b981');
  await page.locator('#node-comment').fill('Relationship note');
  await page.waitForTimeout(100);
  const liveRelationshipColor = await page.locator('svg path.relationship-line[marker-end="url(#relationship-arrow)"]').first().getAttribute('stroke');
  assert.equal(liveRelationshipColor, '#10b981', 'expected relationship color to update in the UI');

  await page.locator('#btn-save-map').click({ force: true });
  await page.waitForTimeout(100);
  const savedMaps = await page.evaluate(() => JSON.parse(localStorage.getItem('mindflow_saved_maps') || '{}'));
  assert(Object.keys(savedMaps).length >= 1, 'expected Save Current to populate browser saved maps');
  const latestMap = Object.values(savedMaps).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  assert.equal(latestMap?.relationships?.[0]?.color, '#10b981', 'expected relationship color to persist in saved maps');
  assert.equal(latestMap?.relationships?.[0]?.comment, 'Relationship note', 'expected relationship comment to persist in saved maps');

  assert.equal(pageErrors.length, 0, `expected no page errors, got: ${pageErrors.join('; ')}`);
  console.log('MindFlow smoke test passed');
} finally {
  await browser.close();
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}