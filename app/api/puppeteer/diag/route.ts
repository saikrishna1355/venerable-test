export const runtime = "nodejs";
export const maxDuration = 60;

import fs from "fs";
import path from "path";

export async function GET() {
  const info: any = {
    isServerless: !!(
      process.env.VERCEL ||
      process.env.AWS_EXECUTION_ENV ||
      process.env.LAMBDA_TASK_ROOT
    ),
    env: {
      GOOGLE_CHROME_SHIM: process.env.GOOGLE_CHROME_SHIM || null,
      CHROME_PATH: process.env.CHROME_PATH || null,
      NODE_VERSION: process.version,
    },
    modules: {
      puppeteerCore: false,
      chromiumLib: false,
    },
    chromium: {
      execFromLib: null as null | string,
      execFromLibError: null as null | string,
      argsFromLib: null as null | string[],
      candidates: [] as Array<{ path: string; exists: boolean }>,
    },
  };

  let chromiumLib: any = null;
  try {
    const mod = await import("chrome-aws-lambda");
    chromiumLib = (mod as any)?.default ?? mod;
    info.modules.chromiumLib = true;
  } catch (e: any) {
    info.modules.chromiumLib = false;
  }

  try {
    const mod = await import("puppeteer-core");
    if (mod) info.modules.puppeteerCore = true;
  } catch {}

  const candidates: string[] = [];
  if (process.env.GOOGLE_CHROME_SHIM)
    candidates.push(process.env.GOOGLE_CHROME_SHIM);
  if (process.env.CHROME_PATH) candidates.push(process.env.CHROME_PATH);
  candidates.push(
    "/var/task/node_modules/@sparticuz/chromium/bin/chromium",
    path.join(
      process.cwd(),
      "node_modules",
      "@sparticuz",
      "chromium",
      "bin",
      "chromium"
    ),
    "chromium",
    "chromium-browser",
    "/snap/bin/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "google-chrome-stable",
    "google-chrome",
    "brave-browser",
    "microsoft-edge"
  );

  if (chromiumLib) {
    try {
      const p = await chromiumLib.executablePath();
      info.chromium.execFromLib = p;
      info.chromium.argsFromLib = chromiumLib.args || null;
      candidates.unshift(p);
    } catch (e: any) {
      info.chromium.execFromLibError = String(e?.message || e || "");
    }
  }

  info.chromium.candidates = candidates.map((p) => {
    try {
      const exists = fs.existsSync(p);
      return { path: p, exists };
    } catch {
      return { path: p, exists: false };
    }
  });

  return Response.json(info);
}
