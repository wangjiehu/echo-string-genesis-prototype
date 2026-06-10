import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const APP_URL = process.argv[2] || "http://127.0.0.1:4174/index.html";
const OUTPUT_PATH = process.argv[3] || "production/latest_1_0_0_visual_smoke_report.json";

const scenarios = [
  {
    name: "desktop-guided",
    mode: "guided",
    width: 1280,
    height: 900,
    mobile: false,
    screenshot: "prototype/prototype_1_0_0_full.png"
  },
  {
    name: "mobile-low",
    mode: "low",
    width: 390,
    height: 844,
    mobile: true,
    screenshot: "prototype/prototype_1_0_0_mobile.png"
  }
];

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge"
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("Chrome or Edge was not found for visual smoke.");
  return found;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForJson(url, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(120);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.wsUrl);
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${message.error.message}: ${message.error.data || ""}`));
      else pending.resolve(message.result);
    });
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
  }

  call(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 10000);
    });
  }

  close() {
    this.socket?.close();
  }
}

async function launchBrowser() {
  const browserPath = findBrowser();
  const port = await freePort();
  const profilePrefix = "echo-visual-";
  cleanupMatchingProfiles(profilePrefix);
  const profile = path.join(os.tmpdir(), `${profilePrefix}${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const child = spawn(browserPath, [
    "--headless=new",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-component-update",
    "--disable-crash-reporter",
    "--disable-crashpad",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-features=Translate,CalculateNativeWinOcclusion",
    "--disable-gpu",
    "--disable-renderer-backgrounding",
    "--disable-sync",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank"
  ], { stdio: "ignore" });

  const cleanup = async () => {
    await terminateBrowser(child);
    await wait(500);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
        return;
      } catch (error) {
        await wait(500);
      }
    }
  };

  try {
    await waitForJson(`http://127.0.0.1:${port}/json/version`);
    return { port, browserPath, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function openBlankTarget(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about%3Ablank`, { method: "PUT" });
  if (!response.ok) throw new Error(`Could not create browser page: ${response.status}`);
  const target = await response.json();
  const session = new CdpSession(target.webSocketDebuggerUrl);
  await session.connect();
  await session.call("Page.enable");
  await session.call("Runtime.enable");
  return session;
}

async function setViewport(session, scenario) {
  await session.call("Emulation.setDeviceMetricsOverride", {
    width: scenario.width,
    height: scenario.height,
    deviceScaleFactor: 1,
    mobile: scenario.mobile,
    screenWidth: scenario.width,
    screenHeight: scenario.height
  });
  await session.call("Emulation.setTouchEmulationEnabled", { enabled: scenario.mobile });
}

async function navigate(session, url) {
  await session.call("Page.navigate", { url });
  await waitForReady(session);
  await waitForAppReady(session);
}

async function waitForReady(session) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const state = await evalPage(session, "document.readyState");
    if (state === "complete" || state === "interactive") return;
    await wait(80);
  }
  throw new Error("Page did not become ready.");
}

async function waitForAppReady(session) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const ready = await evalPage(session, `(() => {
      const report = document.querySelector("#reportData")?.textContent || "";
      return Boolean(document.querySelector(".object-token") && window.__echoString && report.includes('"uxBuild"'));
    })()`);
    if (ready) return;
    await wait(80);
  }
  throw new Error("Echo String app did not render.");
}

async function evalPage(session, expression) {
  const result = await session.call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 10000
  });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
    throw new Error(detail);
  }
  return result.result.value;
}

async function inspectPage(session, scenario) {
  return evalPage(session, `(() => {
    const report = JSON.parse(document.querySelector("#reportData").textContent);
    const bodyText = document.body.innerText;
    const action = [...document.querySelectorAll(".action-button")].find((item) => item.textContent.trim().length > 0);
    const actionRect = action?.getBoundingClientRect();
    const firstObject = document.querySelector(".object-token");
    const firstObjectRect = firstObject?.getBoundingClientRect();
    const objectTokens = document.querySelectorAll(".object-token").length;
    const overflowX = Math.max(0, Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
    const resultPulse = document.querySelector("#resultPulse");
    const resultRect = resultPulse?.getBoundingClientRect();
    const unscannedCards = [...document.querySelectorAll(".object-token")]
      .filter((item) => item.textContent.includes("未扫描"));
    const lowLeaks = ${JSON.stringify(scenario.mode)} === "low"
      ? unscannedCards.some((item) => item.textContent.includes("当前词缀") || item.textContent.includes("开放槽位") || item.textContent.includes("取词成本"))
      : false;
    return {
      uxBuild: report.uxBuild,
      mode: report.testMode,
      zone: report.currentZone,
      objectTokens,
      actionButtons: document.querySelectorAll(".action-button").length,
      overflowX,
      firstActionVisible: Boolean(actionRect && actionRect.top < window.innerHeight && actionRect.bottom > 0),
      firstActionEnabled: Boolean(action && !action.disabled),
      firstObjectVisible: Boolean(firstObjectRect && firstObjectRect.top < window.innerHeight && firstObjectRect.bottom > 0),
      firstObjectEnabled: Boolean(firstObject && !firstObject.disabled),
      firstUsableStepVisible: Boolean(
        (actionRect && actionRect.top < window.innerHeight && actionRect.bottom > 0 && action && !action.disabled) ||
        (firstObjectRect && firstObjectRect.top < window.innerHeight && firstObjectRect.bottom > 0 && firstObject && !firstObject.disabled)
      ),
      resultPulseVisible: Boolean(resultRect && resultRect.top < window.innerHeight && resultRect.bottom > 0),
      hasTitle: bodyText.includes("断句庭院灰盒原型"),
      hasBuild: bodyText.includes("1.0.0 Public Playtest"),
      lowUnscannedLeaks: lowLeaks
    };
  })()`);
}

async function captureScenario(browser, scenario) {
  const session = await openBlankTarget(browser.port);
  try {
    await setViewport(session, scenario);
    const url = `${APP_URL}${APP_URL.includes("?") ? "&" : "?"}mode=${scenario.mode}`;
    await navigate(session, url);
    await wait(250);
    const inspection = await inspectPage(session, scenario);
    const screenshot = await session.call("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false
    });
    const screenshotPath = path.join(ROOT, scenario.screenshot);
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));

    const failures = [];
    if (inspection.uxBuild !== "1.0.0") failures.push("build label is not 1.0.0");
    if (inspection.mode !== scenario.mode) failures.push(`mode expected ${scenario.mode}, got ${inspection.mode}`);
    if (inspection.zone !== "Z1") failures.push(`initial zone expected Z1, got ${inspection.zone}`);
    if (inspection.objectTokens < 2) failures.push("fewer than two object cards rendered");
    if (inspection.actionButtons < 1) failures.push("no action buttons rendered");
    if (inspection.overflowX > 2) failures.push(`horizontal overflow ${inspection.overflowX}px`);
    if (!inspection.firstActionVisible) failures.push("first action button is not visible in the first viewport");
    if (scenario.mobile && !inspection.firstObjectVisible) failures.push("first object card is not visible in the first mobile viewport");
    if (!inspection.firstUsableStepVisible) failures.push("no usable first-step target is visible in the first viewport");
    if (!inspection.resultPulseVisible) failures.push("result feedback is not visible in the first viewport");
    if (!inspection.hasTitle || !inspection.hasBuild) failures.push("title or build label is missing");
    if (inspection.lowUnscannedLeaks) failures.push("low mode leaks hidden unscanned object details");

    return {
      name: scenario.name,
      url,
      viewport: { width: scenario.width, height: scenario.height, mobile: scenario.mobile },
      screenshot: scenario.screenshot,
      passed: failures.length === 0,
      inspection,
      failures
    };
  } finally {
    session.close();
  }
}

function wait(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanupMatchingProfiles(prefix) {
  try {
    for (const entry of fs.readdirSync(os.tmpdir(), { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith(prefix)) continue;
      fs.rmSync(path.join(os.tmpdir(), entry.name), { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
    }
  } catch {
    // Best-effort cleanup only. Current run still uses a fresh profile.
  }
}

async function terminateBrowser(child) {
  if (child.exitCode != null || child.signalCode != null) return;
  if (process.platform === "win32" && child.pid) {
    await new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      killer.once("exit", done);
      killer.once("error", done);
      setTimeout(done, 5000);
    });
  } else {
    child.kill();
  }
  await waitForExit(child, 8000);
}

function waitForExit(child, timeoutMs = 3000) {
  if (child.exitCode != null || child.signalCode != null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

const browser = await launchBrowser();
try {
  const results = [];
  for (const scenario of scenarios) {
    results.push(await captureScenario(browser, scenario));
  }
  const failures = results.flatMap((result) => result.failures.map((failure) => `${result.name}: ${failure}`));
  const output = {
    build: "1.0.0",
    browser: path.basename(browser.browserPath),
    url: APP_URL,
    passed: failures.length === 0,
    scenarios: results,
    failures
  };
  console.log(JSON.stringify(output, null, 2));
  if (OUTPUT_PATH) {
    const resolvedOutput = path.isAbsolute(OUTPUT_PATH) ? OUTPUT_PATH : path.join(ROOT, OUTPUT_PATH);
    fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
    fs.writeFileSync(resolvedOutput, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  }
  if (failures.length) process.exit(1);
} finally {
  await browser.cleanup();
}
