import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("playwright");
const server = spawn(
  "node",
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4175",
    "--strictPort",
  ],
  { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
);
let browser;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Preview startup timed out")),
      15000,
    );
    const done = (error) => {
      clearTimeout(timer);
      error ? reject(error) : resolve();
    };
    server.stdout.on("data", (d) => {
      if (d.toString().includes("4175")) done();
    });
    server.on("error", done);
    server.on("exit", (code) => done(new Error(`Preview exited (${code})`)));
  });
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const results = [];
  for (const [name, width, height, rate] of [
    ["desktop", 1280, 800, 1],
    ["mobile", 393, 851, 4],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    await page.addInitScript(() => {
      window.metrics = { longTasks: [], lcp: 0, cls: 0, events: [] };
      new PerformanceObserver((l) =>
        l
          .getEntries()
          .forEach((e) => window.metrics.longTasks.push(e.duration)),
      ).observe({ type: "longtask", buffered: true });
      new PerformanceObserver((l) => {
        window.metrics.lcp = l.getEntries().at(-1).startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) =>
        l.getEntries().forEach((e) => {
          if (!e.hadRecentInput) window.metrics.cls += e.value;
        }),
      ).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((l) =>
        l.getEntries().forEach((e) => window.metrics.events.push(e.duration)),
      ).observe({ type: "event", durationThreshold: 16, buffered: true });
      localStorage.setItem("cat-territory-progress-migrated-v3", "1");
      localStorage.setItem("cat-territory-current-level-v3", "0");
      localStorage.setItem("cat-territory-gesture-coach-v3", "done");
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:4175");
    await page.getByRole("grid").waitFor();
    await page.waitForTimeout(1200);
    await page.getByRole("gridcell").first().press("Space");
    await page.getByRole("button", { name: "How to play" }).click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    results.push({
      name,
      cpuThrottle: rate,
      ...(await page.evaluate(() => ({
        ...window.metrics,
        domNodes: document.querySelectorAll("*").length,
        jsBytes: performance
          .getEntriesByType("resource")
          .filter((r) => r.name.endsWith(".js"))
          .reduce((n, r) => n + r.encodedBodySize, 0),
      }))),
      errors,
    });
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
