import {
  test as base,
  expect,
  type Page,
  type BrowserContext,
} from "@playwright/test";
import { createServer } from "node:http";
import { cp, readFile, readdir, writeFile, rename } from "node:fs/promises";
import { resolve, extname, join } from "node:path";
import { buildOfflineWorker } from "../scripts/build-offline-worker.mjs";

type Site = {
  url: string;
  disconnect: () => void;
  release: (name: string, failAsset?: boolean) => Promise<void>;
};
const test = base.extend<{ site: Site }>({
  site: async ({}, use, testInfo) => {
    const root = testInfo.outputPath("releases");
    let active = join(root, "initial"),
      blocked: string | null = null;
    async function release(name: string, failAsset = false) {
      const dir = join(root, name);
      await cp(resolve("dist"), dir, { recursive: true });
      if (name !== "initial") {
        // Change real chunk URLs, so an old tab cannot secretly fetch them from the new release.
        const files = (await readdir(join(dir, "assets"))).filter(
          (x) => x.endsWith(".js") || x.endsWith(".css"),
        );
        const names = files.map((file) => [
          file,
          file.replace(/\.(js|css)$/, `-${name}.$1`),
        ]);
        for (const path of [
          "index.html",
          ...files.map((file) => "assets/" + file),
        ]) {
          let content = await readFile(join(dir, path), "utf8");
          for (const [before, after] of names)
            content = content.replaceAll(before, after);
          await writeFile(join(dir, path), content);
        }
        for (const [before, after] of names)
          await rename(join(dir, "assets", before), join(dir, "assets", after));
      }
      const html = await readFile(join(dir, "index.html"), "utf8");
      await writeFile(
        join(dir, "index.html"),
        html.replace(
          "</head>",
          `<meta name="test-release" content="${name}"></head>`,
        ),
      );
      if (name === "initial") {
        blocked = null;
        active = dir;
        return;
      }
      const manifest = await buildOfflineWorker(dir);
      blocked = failAsset
        ? "/" + manifest.paths.find((p: string) => p.endsWith(".js"))
        : null;
      active = dir;
    }
    await release("initial");
    let disconnected = false;
    const server = createServer(async (req, res) => {
      if (disconnected) {
        req.socket.destroy();
        return;
      }
      try {
        const pathname = new URL(req.url!, "http://localhost").pathname;
        if (pathname === blocked) {
          res.writeHead(503);
          res.end();
          return;
        }
        const file = resolve(
          active,
          "." + (pathname === "/" ? "/index.html" : pathname),
        );
        if (!file.startsWith(active + "/")) throw Error("Invalid path");
        const bytes = await readFile(file);
        res.setHeader(
          "Content-Type",
          extname(file) === ".js"
            ? "text/javascript"
            : extname(file) === ".css"
              ? "text/css"
              : extname(file) === ".html"
                ? "text/html"
                : "application/octet-stream",
        );
        res.setHeader("Cache-Control", "no-store");
        res.end(bytes);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const address = server.address() as { port: number };
    try {
      await use({
        url: `http://127.0.0.1:${address.port}`,
        release,
        disconnect() {
          disconnected = true;
          server.closeAllConnections();
        },
      });
    } finally {
      await new Promise<void>((r) => {
        server.close(() => r());
        server.closeAllConnections();
      });
    }
  },
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("cat-territory-gesture-coach-v3", "done"),
  );
});
async function ready(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((r) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => r(),
          { once: true },
        ),
      );
  });
}
async function releaseName(page: Page) {
  return page.locator('meta[name="test-release"]').getAttribute("content");
}

// WebKit's Playwright offline emulation cannot reliably reload controlled pages.
// Remove the actual origin instead, and independently prove it is unreachable.
async function goOffline(
  context: BrowserContext,
  site: Site,
  browserName: string,
) {
  if (browserName === "webkit") {
    site.disconnect();
    await expect(
      fetch(site.url, { signal: AbortSignal.timeout(5000) }),
    ).rejects.toThrow();
  } else {
    await context.setOffline(true);
  }
}

test("first visit supports offline reload and unopened screens", async ({
  page,
  context,
  site,
  browserName,
}) => {
  await page.goto(site.url);
  await expect(page.getByRole("grid")).toBeVisible();
  await ready(page);
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("cat-territory-session-v3-v2-5-01") ?? "{}",
          ).usedHint,
      ),
    )
    .toBe(true);
  await goOffline(context, site, browserName);
  await page.reload();
  await expect(page.getByRole("grid")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("cat-territory-session-v3-v2-5-01")!)
          .usedHint,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(page.locator(".rules-modal")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open Daily Territory" }).click();
  await expect(page.locator(".daily-screen .board")).toBeVisible();
});

test("new release waits for old tabs and retains progress", async ({
  page,
  context,
  site,
  browserName,
}) => {
  await page.goto(site.url);
  await ready(page);
  const other = await context.newPage();
  await other.goto(site.url);
  await page.evaluate(async () => {
    localStorage.setItem("audit-progress", "retained");
    await caches.open("unrelated-cache");
  });
  await site.release("next");
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())!.update();
  });
  await expect
    .poll(() =>
      page.evaluate(async () =>
        Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
      ),
    )
    .toBe(true);
  // Reload while another old tab is open must keep a coherent old HTML/module set.
  await page.reload();
  expect(await releaseName(page)).toBe("initial");
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(page.locator(".rules-modal")).toBeVisible();
  await other.close();
  await page.close();
  const fresh = await context.newPage();
  await fresh.goto(site.url);
  await expect(fresh.getByRole("grid")).toBeVisible();
  await expect.poll(() => releaseName(fresh)).toBe("next");
  expect(
    await fresh.evaluate(() => localStorage.getItem("audit-progress")),
  ).toBe("retained");
  const keys = await fresh.evaluate(() => caches.keys());
  expect(
    keys.filter((k) => k.startsWith("cat-territory-release-")),
  ).toHaveLength(1);
  expect(keys).toContain("unrelated-cache");
  await goOffline(context, site, browserName);
  await fresh.reload();
  await expect(fresh.getByRole("grid")).toBeVisible();
  await fresh.getByRole("button", { name: "Open Daily Territory" }).click();
  await expect(fresh.locator(".daily-screen .board")).toBeVisible();
});

test("incomplete update preserves the working offline release", async ({
  page,
  context,
  site,
  browserName,
}) => {
  await page.goto(site.url);
  await ready(page);
  const before = await page.evaluate(() => caches.keys());
  await site.release("broken", true);
  const status = await page.evaluate(async () => {
    const reg = (await navigator.serviceWorker.getRegistration())!;
    const result = new Promise<string>((resolve) =>
      reg.addEventListener(
        "updatefound",
        () => {
          const w = reg.installing!;
          w.addEventListener("statechange", () => {
            if (w.state === "redundant" || w.state === "installed")
              resolve(w.state);
          });
        },
        { once: true },
      ),
    );
    await reg.update();
    return result;
  });
  expect(status).toBe("redundant");
  expect(await page.evaluate(() => caches.keys())).toEqual(before);
  await goOffline(context, site, browserName);
  await page.reload();
  await expect(page.getByRole("grid")).toBeVisible();
  expect(await releaseName(page)).toBe("initial");
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(page.locator(".rules-modal")).toBeVisible();
});
