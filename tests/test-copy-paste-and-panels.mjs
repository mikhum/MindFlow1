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

page.on('console', (msg) => {
  console.log('BROWSER:', msg.text());
});

try {
  await page.goto(url, { waitUntil: 'networkidle' });

  // ----------------------------------------------------
  // Test 1: Collapsible floating panels (Förminska paneler)
  // ----------------------------------------------------
  const depthPanel = page.locator('#visible-depth-panel');
  const commentPanel = page.locator('#comment-panel');
  const btnToggleDepth = page.locator('#btn-toggle-depth-panel');
  const btnToggleComment = page.locator('#btn-toggle-comment-panel');

  assert.equal(await btnToggleDepth.count(), 1, 'expected depth panel toggle button to exist');
  assert.equal(await btnToggleComment.count(), 1, 'expected comment panel toggle button to exist');

  // Test collapsing depth panel
  await btnToggleDepth.click({ force: true });
  await page.waitForTimeout(100);
  assert(await depthPanel.evaluate((el) => el.classList.contains('collapsed')), 'depth panel should have .collapsed');
  const depthToolbarVisible = await page.locator('#toolbar-visible-depth').isVisible();
  assert.equal(depthToolbarVisible, false, 'toolbar in depth panel should be hidden when collapsed');

  // Test collapsing comment panel
  await btnToggleComment.click({ force: true });
  await page.waitForTimeout(100);
  assert(await commentPanel.evaluate((el) => el.classList.contains('collapsed')), 'comment panel should have .collapsed');
  const textareaVisible = await page.locator('#node-comment').isVisible();
  assert.equal(textareaVisible, false, 'textarea in comment panel should be hidden when collapsed');

  // Test expanding back
  await btnToggleDepth.click({ force: true });
  await btnToggleComment.click({ force: true });
  await page.waitForTimeout(100);
  assert(!(await depthPanel.evaluate((el) => el.classList.contains('collapsed'))), 'depth panel should not be collapsed after click');
  assert(!(await commentPanel.evaluate((el) => el.classList.contains('collapsed'))), 'comment panel should not be collapsed after click');

  console.log('SUCCESS: Panel collapse and expand test passed!');

  // ----------------------------------------------------
  // Test 2: Copy and Paste branch (including descendants)
  // ----------------------------------------------------
  // 1. Create a branch: Root -> BranchA -> ChildA
  await page.locator('#ctrl-add-child').click({ force: true });
  await page.waitForTimeout(100);
  await page.keyboard.type('BranchA');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);

  // Add child under BranchA
  await page.locator('#ctrl-add-child').click({ force: true });
  await page.waitForTimeout(100);
  await page.keyboard.type('ChildA');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);

  // 2. Create another branch on Root: TargetLeaf
  await page.locator('.node').first().click({ force: true }); // select root
  await page.waitForTimeout(100);
  await page.locator('#ctrl-add-child').click({ force: true });
  await page.waitForTimeout(100);
  await page.keyboard.type('TargetLeaf');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  // Move TargetLeaf down so it does not visually overlap BranchA
  await page.evaluate(() => {
    const leaf = Object.values(window.state.nodes).find(n => n.text === 'TargetLeaf');
    if (leaf) leaf.y = 160;
    window.state.lastPointerDownNodeId = null;
    window.state.lastPointerDownAt = 0;
    window.render();
  });
  await page.waitForTimeout(200);

  // 3. Find and select BranchA
  const branchANode = page.locator('.node').filter({ hasText: 'BranchA' }).first();
  await branchANode.click();
  await page.waitForTimeout(400);

  // Copy BranchA (and ChildA) via Ctrl+C
  await page.keyboard.press('Control+c');
  await page.waitForTimeout(200);

  // 4. Find and select TargetLeaf
  const targetLeafNode = page.locator('.node').filter({ hasText: 'TargetLeaf' }).first();
  await targetLeafNode.click();
  await page.waitForTimeout(400);

  // Paste BranchA under TargetLeaf via Ctrl+V
  await page.keyboard.press('Control+v');
  await page.waitForTimeout(300);

  // 5. Verify the node count increased by 2 (BranchA copy + ChildA copy)
  const afterPasteNodeCount = await page.locator('.node').count();
  assert.equal(afterPasteNodeCount, 6, `expected 6 nodes after paste, got ${afterPasteNodeCount}`);

  // Verify that there are now two nodes named 'BranchA' and two named 'ChildA'
  const branchACount = await page.locator('.node').filter({ hasText: 'BranchA' }).count();
  const childACount = await page.locator('.node').filter({ hasText: 'ChildA' }).count();
  assert.equal(branchACount, 2, 'expected two BranchA nodes after paste');
  assert.equal(childACount, 2, 'expected two ChildA nodes after paste');

  // Verify that the newly pasted BranchA has TargetLeaf as its parent
  const treeStructure = await page.evaluate(() => {
    return Object.values(window.testState?.nodes || {});
  });

  assert.equal(pageErrors.length, 0, `unexpected page errors: ${pageErrors.join(', ')}`);
  console.log('SUCCESS: Copy and paste branch test passed perfectly!');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
