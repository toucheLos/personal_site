import { chromium, Page } from 'playwright';

async function recon() {
  console.log('='.repeat(60));
  console.log('GOMOKU RECON REPORT — papergames.io');
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const wsMessages: { direction: string; payload: string; ts: number }[] = [];
  const networkRequests: { method: string; url: string; body?: string }[] = [];

  // Capture WebSocket frames
  context.on('page', (page) => {
    page.on('websocket', (ws) => {
      console.log('\n[WS] WebSocket opened:', ws.url());
      ws.on('framesent', (frame) =>
        wsMessages.push({ direction: 'SENT', payload: frame.payload.toString(), ts: Date.now() })
      );
      ws.on('framereceived', (frame) =>
        wsMessages.push({ direction: 'RECV', payload: frame.payload.toString(), ts: Date.now() })
      );
      ws.on('close', () => console.log('[WS] WebSocket closed:', ws.url()));
    });
  });

  const page = await context.newPage();

  // Capture network requests
  page.on('request', (req) => {
    if (req.url().includes('papergames') || req.url().includes('socket') || req.url().includes('api')) {
      networkRequests.push({ method: req.method(), url: req.url() });
    }
  });

  // ── Step 1: Load homepage ──────────────────────────────────────────────────
  console.log('\n[1] Loading https://papergames.io/en/gomoku ...');
  await page.goto('https://papergames.io/en/gomoku', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log('\n[1a] Page title:', await page.title());
  console.log('[1b] Final URL:', page.url());

  // ── Step 2: Board DOM structure ────────────────────────────────────────────
  console.log('\n[2] BOARD DOM STRUCTURE');
  const domReport = await page.evaluate(() => {
    const findings: Record<string, unknown> = {};

    findings.canvases = Array.from(document.querySelectorAll('canvas')).map((c) => ({
      id: c.id,
      class: c.className,
      width: c.width,
      height: c.height,
      parent: c.parentElement?.className,
    }));

    findings.svgs = Array.from(document.querySelectorAll('svg')).map((s) => ({
      id: s.id,
      class: s.className.baseVal ?? s.className,
      width: s.getAttribute('width'),
      height: s.getAttribute('height'),
      viewBox: s.getAttribute('viewBox'),
      childCount: s.children.length,
    }));

    // Look for board-like grid divs
    const divGrids = Array.from(document.querySelectorAll('[class*="board"], [class*="grid"], [class*="game"], [class*="cell"], [class*="stone"], [id*="board"], [id*="grid"]'));
    findings.boardDivs = divGrids.slice(0, 20).map((el) => ({
      tag: el.tagName,
      id: el.id,
      class: el.className,
      childCount: el.children.length,
      rect: el.getBoundingClientRect(),
    }));

    // localStorage snapshot
    const ls: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      ls[k] = localStorage.getItem(k)!.substring(0, 200);
    }
    findings.localStorage = ls;

    return findings;
  });

  console.log('  Canvases:', JSON.stringify(domReport.canvases, null, 2));
  console.log('  SVGs:', JSON.stringify(domReport.svgs, null, 2));
  console.log('  Board-like divs (first 20):', JSON.stringify(domReport.boardDivs, null, 2));
  console.log('  localStorage keys:', JSON.stringify(domReport.localStorage, null, 2));

  // ── Step 3: Screenshot before any moves ───────────────────────────────────
  await page.screenshot({ path: 'recon_initial.png', fullPage: false });
  console.log('\n[3] Screenshot saved: recon_initial.png');

  // ── Step 4: Try to start a game (look for "Play" / "vs CPU" buttons) ───────
  console.log('\n[4] Looking for game-start controls...');
  const buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button, a[href], [role="button"]')).map((el) => ({
      text: (el as HTMLElement).innerText?.trim().substring(0, 60),
      href: (el as HTMLAnchorElement).href,
      class: el.className,
      id: el.id,
      visible: (el as HTMLElement).offsetParent !== null,
    })).filter((b) => b.text || b.href)
  );
  console.log('  Buttons/links found:');
  buttons.slice(0, 30).forEach((b) => console.log(`    [${b.visible ? 'visible' : 'hidden'}] "${b.text}" href="${b.href}" class="${b.class}"`));

  // Try clicking "Play" or "vs AI" / "vs Computer" buttons
  const playSelectors = [
    'text=Play vs Computer',
    'text=vs Computer',
    'text=vs AI',
    'text=vs Bot',
    'text=Play',
    'text=New Game',
    '[data-testid="play-button"]',
    'button:has-text("Play")',
  ];

  let gameStarted = false;
  for (const sel of playSelectors) {
    try {
      const el = page.locator(sel).first();
      const count = await el.count();
      if (count > 0) {
        console.log(`\n[4a] Clicking: ${sel}`);
        await el.click({ timeout: 3000 });
        await page.waitForTimeout(2000);
        gameStarted = true;
        break;
      }
    } catch {}
  }

  if (!gameStarted) {
    console.log('  Could not auto-click a play button. Proceeding with current state.');
  }

  await page.screenshot({ path: 'recon_after_play_click.png' });
  console.log('[4b] Screenshot after play attempt: recon_after_play_click.png');

  // ── Step 5: Re-inspect DOM after game start ────────────────────────────────
  console.log('\n[5] DOM AFTER POTENTIAL GAME START');
  const postStart = await page.evaluate(() => {
    const findings: Record<string, unknown> = {};

    findings.canvases = Array.from(document.querySelectorAll('canvas')).map((c) => ({
      id: c.id,
      class: c.className,
      width: c.width,
      height: c.height,
    }));

    findings.svgs = Array.from(document.querySelectorAll('svg')).map((s) => ({
      id: s.id,
      class: s.className.baseVal ?? s.className,
      childCount: s.children.length,
      firstChildTag: s.children[0]?.tagName,
    }));

    // Look for game-specific attributes
    const interactives = Array.from(document.querySelectorAll('[onclick], [data-row], [data-col], [data-x], [data-y], [data-pos]'));
    findings.interactiveElements = interactives.slice(0, 20).map((el) => ({
      tag: el.tagName,
      id: el.id,
      class: el.className,
      dataRow: el.getAttribute('data-row'),
      dataCol: el.getAttribute('data-col'),
      dataX: el.getAttribute('data-x'),
      dataY: el.getAttribute('data-y'),
    }));

    return findings;
  });

  console.log('  Canvases:', JSON.stringify(postStart.canvases, null, 2));
  console.log('  SVGs:', JSON.stringify(postStart.svgs, null, 2));
  console.log('  Interactive elements:', JSON.stringify(postStart.interactiveElements, null, 2));

  // ── Step 6: Try to find the game board and click it ────────────────────────
  console.log('\n[6] ATTEMPTING TO SIMULATE MOVES');

  // Find any canvas or large clickable area
  const boardInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      return { type: 'canvas', rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, id: canvas.id, class: canvas.className };
    }
    const svg = document.querySelector('svg');
    if (svg) {
      const rect = svg.getBoundingClientRect();
      return { type: 'svg', rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, id: svg.id, class: (svg.className as any).baseVal ?? svg.className };
    }
    return null;
  });

  console.log('  Board element:', JSON.stringify(boardInfo, null, 2));

  if (boardInfo && boardInfo.rect.width > 100) {
    // Try clicking center of board and a few cells
    const { x, y, width, height } = boardInfo.rect;
    const cellW = width / 15;
    const cellH = height / 15;

    const clicks = [
      { row: 7, col: 7, label: 'center H8' },
      { row: 6, col: 7, label: 'G8' },
      { row: 7, col: 8, label: 'H9' },
    ];

    for (const click of clicks) {
      const px = x + cellW * click.col + cellW / 2;
      const py = y + cellH * click.row + cellH / 2;
      console.log(`  Clicking ${click.label} at screen (${Math.round(px)}, ${Math.round(py)})`);
      await page.mouse.click(px, py);
      await page.waitForTimeout(800);
    }

    await page.screenshot({ path: 'recon_after_moves.png' });
    console.log('  Screenshot after moves: recon_after_moves.png');

    // Re-check localStorage after moves
    const lsAfter = await page.evaluate(() => {
      const ls: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        ls[k] = localStorage.getItem(k)!.substring(0, 500);
      }
      return ls;
    });
    console.log('\n  localStorage after moves:', JSON.stringify(lsAfter, null, 2));
  }

  // ── Step 7: WebSocket summary ──────────────────────────────────────────────
  console.log('\n[7] WEBSOCKET MESSAGES CAPTURED:');
  if (wsMessages.length === 0) {
    console.log('  None detected.');
  } else {
    wsMessages.slice(0, 40).forEach((m) =>
      console.log(`  [${m.direction}] ${m.payload.substring(0, 200)}`)
    );
  }

  // ── Step 8: Network requests ───────────────────────────────────────────────
  console.log('\n[8] RELEVANT NETWORK REQUESTS:');
  networkRequests.slice(0, 40).forEach((r) => console.log(`  ${r.method} ${r.url}`));

  // ── Step 9: Full HTML snapshot (truncated) ────────────────────────────────
  console.log('\n[9] BODY HTML SNAPSHOT (first 3000 chars):');
  const bodyHtml = await page.evaluate(() => document.body.innerHTML.substring(0, 3000));
  console.log(bodyHtml);

  // ── Step 10: React / Framework detection ──────────────────────────────────
  console.log('\n[10] FRAMEWORK DETECTION:');
  const framework = await page.evaluate(() => {
    const findings: Record<string, boolean | string> = {};
    findings.hasReact = !!(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    findings.hasVue = !!(window as any).__vue__;
    findings.hasAngular = !!(window as any).ng;
    findings.hasNext = !!(window as any).__NEXT_DATA__;
    if ((window as any).__NEXT_DATA__) {
      findings.nextData = JSON.stringify((window as any).__NEXT_DATA__).substring(0, 500);
    }
    // Check for socket.io
    findings.hasSocketIO = !!(window as any).io;
    // Check for any global game state
    const gameKeys = Object.keys(window).filter(k =>
      k.toLowerCase().includes('game') || k.toLowerCase().includes('board') || k.toLowerCase().includes('gomoku')
    );
    findings.gameGlobals = gameKeys.join(', ');
    return findings;
  });
  console.log(JSON.stringify(framework, null, 2));

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Board type: ${boardInfo?.type ?? 'unknown'}`);
  console.log(`Board size: ${boardInfo ? `${Math.round(boardInfo.rect.width)}x${Math.round(boardInfo.rect.height)}` : 'n/a'}`);
  console.log(`WebSocket messages: ${wsMessages.length}`);
  console.log(`Network requests captured: ${networkRequests.length}`);
  console.log(`Framework: React=${framework.hasReact}, Vue=${framework.hasVue}, Next=${framework.hasNext}, SocketIO=${framework.hasSocketIO}`);
  console.log('='.repeat(60));

  await browser.close();
}

recon().catch(console.error);
