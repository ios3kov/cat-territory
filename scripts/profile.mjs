import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = require('playwright');
const scenarios = [
  {
    name: 'desktop',
    width: 1280,
    height: 800,
    cpuThrottle: 1,
    levelIndex: 0,
    expectedCells: 25,
    lcpLimit: 1500,
    longTaskLimit: 250,
    eventLimit: 300,
    heapLimitMb: 32,
  },
  {
    name: 'mobile',
    width: 393,
    height: 851,
    cpuThrottle: 4,
    levelIndex: 0,
    expectedCells: 25,
    lcpLimit: 2000,
    longTaskLimit: 400,
    eventLimit: 500,
    heapLimitMb: 32,
  },
  {
    name: 'low-end-10x10',
    width: 360,
    height: 740,
    cpuThrottle: 6,
    levelIndex: 33,
    expectedCells: 100,
    lcpLimit: 3000,
    seedFixture: true,
    longTaskLimit: 600,
    eventLimit: 650,
    heapLimitMb: 40,
  },
];

const server = spawn(
  'node',
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4175',
    '--strictPort',
  ],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
);

let browser;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Preview startup timed out')),
      15000,
    );
    const done = (error) => {
      clearTimeout(timer);
      error ? reject(error) : resolve();
    };
    server.stdout.on('data', (d) => {
      if (d.toString().includes('4175')) done();
    });
    server.on('error', done);
    server.on('exit', (code) => done(new Error(`Preview exited (${code})`)));
  });

  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    args: ['--no-sandbox'],
  });

  const results = [];
  for (const scenario of scenarios) {
    const {
      name,
      width,
      height,
      cpuThrottle,
      levelIndex,
      expectedCells,
      seedFixture,
    } = scenario;
    const page = await browser.newPage({ viewport: { width, height } });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
    await page.addInitScript(
      ({ index, seededLevel }) => {
        window.metrics = {
          longTasks: [],
          lcp: 0,
          lcpElement: '',
          lcpUrl: '',
          cls: 0,
          events: [],
        };
        new PerformanceObserver((list) =>
          list
            .getEntries()
            .forEach((entry) => window.metrics.longTasks.push(entry.duration)),
        ).observe({ type: 'longtask', buffered: true });
        new PerformanceObserver((list) => {
          const entry = list.getEntries().at(-1);
          window.metrics.lcp = entry.startTime;
          window.metrics.lcpElement =
            entry.element?.className || entry.element?.tagName || '';
          window.metrics.lcpUrl = entry.url || '';
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) =>
          list.getEntries().forEach((entry) => {
            if (!entry.hadRecentInput) window.metrics.cls += entry.value;
          }),
        ).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver((list) =>
          list
            .getEntries()
            .forEach((entry) => window.metrics.events.push(entry.duration)),
        ).observe({ type: 'event', durationThreshold: 16, buffered: true });
        localStorage.setItem('cat-territory-progress-migrated-v3', '1');
        localStorage.setItem('cat-territory-current-level-v3', String(index));
        localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
        if (seedFixture)
          localStorage.setItem('cat-territory-profile-seed-index', String(index));
      },
      { index: levelIndex, seedFixture },
    );

    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    if (seedFixture) {
      await page.route('**/levelWorker-*.js', async (route) => {
        await route.continue();
      });
    }
    await page.goto('http://127.0.0.1:4175');
    await page.getByRole('grid').waitFor({ timeout: 30000 });
    await page.waitForFunction(
      (count) =>
        document.querySelectorAll('[role="gridcell"]').length === count,
      expectedCells,
      { timeout: 30000 },
    );
    await page.waitForTimeout(1200);
    await page
      .locator('[role="gridcell"]:not([disabled])')
      .first()
      .press('Space');
    await page.getByRole('button', { name: 'How to play' }).click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    const browserMetrics = await cdp.send('Performance.getMetrics');
    const metric = (metricName) =>
      browserMetrics.metrics.find(({ name: key }) => key === metricName)
        ?.value ?? 0;
    results.push({
      name,
      cpuThrottle,
      levelIndex,
      ...(await page.evaluate(() => ({
        ...window.metrics,
        domNodes: document.querySelectorAll('*').length,
        gridCells: document.querySelectorAll('[role="gridcell"]').length,
        jsBytes: performance
          .getEntriesByType('resource')
          .filter((resource) => resource.name.endsWith('.js'))
          .reduce((total, resource) => total + resource.encodedBodySize, 0),
      }))),
      heapUsedMb: metric('JSHeapUsedSize') / 1024 / 1024,
      errors,
    });
    await page.close();
  }

  console.log(JSON.stringify(results, null, 2));
  if (process.argv.includes('--check')) {
    const failures = [];
    for (const result of results) {
      const scenario = scenarios.find(({ name }) => name === result.name);
      const maxLongTask = Math.max(0, ...result.longTasks);
      const maxEvent = Math.max(0, ...result.events);
      if (result.errors.length)
        failures.push(
          `${result.name}: runtime errors: ${result.errors.join('; ')}`,
        );
      if (!(result.lcp > 0 && result.lcp <= scenario.lcpLimit))
        failures.push(
          `${result.name}: LCP ${Math.round(result.lcp)}ms > ${scenario.lcpLimit}ms or unavailable`,
        );
      if (result.cls > 0.05)
        failures.push(`${result.name}: CLS ${result.cls.toFixed(3)} > 0.05`);
      if (maxLongTask > scenario.longTaskLimit)
        failures.push(
          `${result.name}: longest task ${Math.round(maxLongTask)}ms > ${scenario.longTaskLimit}ms`,
        );
      if (maxEvent > scenario.eventLimit)
        failures.push(
          `${result.name}: longest event ${Math.round(maxEvent)}ms > ${scenario.eventLimit}ms`,
        );
      if (result.jsBytes > 220 * 1024)
        failures.push(
          `${result.name}: JS transfer ${Math.round(result.jsBytes / 1024)}KiB > 220KiB`,
        );
      if (result.domNodes > 900)
        failures.push(`${result.name}: DOM nodes ${result.domNodes} > 900`);
      if (result.gridCells !== scenario.expectedCells)
        failures.push(
          `${result.name}: expected ${scenario.expectedCells} cells, got ${result.gridCells}`,
        );
      if (result.heapUsedMb > scenario.heapLimitMb)
        failures.push(
          `${result.name}: JS heap ${result.heapUsedMb.toFixed(1)}MiB > ${scenario.heapLimitMb}MiB`,
        );
    }
    if (failures.length)
      throw new Error(`Performance budgets failed:\n${failures.join('\n')}`);
  }
} finally {
  await browser?.close();
  server.kill();
}
