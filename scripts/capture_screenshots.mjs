import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const VIEWS = [
  {
    name: "overview",
    route: "/",
    waitTimeout: 2000,
    desc: "Executive Dashboard & KPIs",
  },
  {
    name: "map",
    route: "/map",
    waitTimeout: 5000,
    desc: "Interactive Map & Cluster View",
  },
  {
    name: "observations",
    route: "/observations",
    waitTimeout: 2500,
    desc: "Observation Ledger",
  },
  {
    name: "observation-detail",
    route: "/observations/c865ab41-8675-56c7-b5f6-2b5312c67a79",
    waitTimeout: 2500,
    desc: "Observation Detail Inspector",
  },
  {
    name: "visual-search",
    route: "/visual-search",
    waitTimeout: 1500,
    desc: "Multimodal Visual Search",
  },
  {
    name: "similarity",
    route: "/similarity",
    waitTimeout: 2500,
    desc: "DINOv2 Near-Duplicates & Similarity",
  },
  {
    name: "timeline",
    route: "/timeline",
    waitTimeout: 2500,
    desc: "Temporal Timeline & Staleness",
  },
  {
    name: "review",
    route: "/review",
    waitTimeout: 2500,
    desc: "Analyst Verification Queue",
  },
  {
    name: "compare",
    route: "/compare",
    waitTimeout: 3000,
    desc: "Geographic Area Comparison",
  },
  {
    name: "data-sources",
    route: "/data-sources",
    waitTimeout: 2000,
    desc: "Datasets, Licenses & Provenance",
  },
];

async function main() {
  const outputDir = path.resolve("docs/screenshots");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error(`[Browser Console Error] ${msg.text()}`);
    }
  });

  page.on("pageerror", (err) => {
    console.error(`[Page Uncaught Error] ${err.message}`);
  });

  for (const view of VIEWS) {
    const url = `http://localhost:3001${view.route}`;
    console.log(`\nNavigating to ${view.name} (${url})...`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(view.waitTimeout || 2000);

      // Interactive actions on specific pages
      if (view.name === "visual-search") {
        const input = await page.$('input[type="text"]');
        if (input) {
          await input.fill("construction crane and scaffolding");
          const searchBtn = await page.$(
            'button[type="submit"], button:has-text("Search")',
          );
          if (searchBtn) {
            await searchBtn.click();
            await page.waitForTimeout(3500);
          }
        }
      }

      if (view.name === "compare") {
        // Trigger a compare if available
        const compareBtn = await page.$('button:has-text("Compare")');
        if (compareBtn) {
          await compareBtn.click();
          await page.waitForTimeout(2000);
        }
      }

      const filePath = path.join(outputDir, `${view.name}.png`);
      await page.screenshot({ path: filePath });
      console.log(`Saved screenshot: ${filePath}`);
    } catch (err) {
      console.error(`Error on ${view.name}: ${err.message}`);
    }
  }

  await browser.close();
  console.log("\nAll 10 views captured successfully!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
