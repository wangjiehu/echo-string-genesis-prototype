import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const APP_URL = process.argv[2] || "http://127.0.0.1:4174/index.html";
const OUTPUT_PATH = process.argv[3] || "";

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
  if (!found) throw new Error("Chrome or Edge was not found for DOM click regression.");
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
    await new Promise((resolve) => setTimeout(resolve, 120));
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
  const profilePrefix = "echo-dom-click-";
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
    "--hide-scrollbars",
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

async function openPageTarget(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Could not create browser page: ${response.status}`);
  const target = await response.json();
  const session = new CdpSession(target.webSocketDebuggerUrl);
  await session.connect();
  await session.call("Page.enable");
  await session.call("Runtime.enable");
  await session.call("Page.setLifecycleEventsEnabled", { enabled: true });
  await waitForReady(session);
  await waitForAppReady(session);
  return session;
}

async function waitForReady(session) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const state = await evalPage(session, `document.readyState`);
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
  throw new Error("Echo String app did not render object tokens.");
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

function clickExpr(kind, value) {
  const encoded = JSON.stringify(value);
  return `(() => {
    const fail = (message) => { throw new Error(message); };
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const byText = (selector, text) => [...document.querySelectorAll(selector)]
      .find((element) => element.textContent.trim() === text && visible(element));
    let element;
    if (${JSON.stringify(kind)} === "object") element = document.querySelector('[data-object-id=' + CSS.escape(${encoded}) + ']');
    if (${JSON.stringify(kind)} === "tag") element = document.querySelector('.tag-chip[data-tag=' + CSS.escape(${encoded}) + ']');
    if (${JSON.stringify(kind)} === "inventory") element = document.querySelector('.inventory-token[data-tag=' + CSS.escape(${encoded}) + ']');
    if (${JSON.stringify(kind)} === "action") element = byText('.action-button', ${encoded});
    if (!element) fail('Missing DOM target: ${kind} ' + ${encoded});
    if (!visible(element)) fail('DOM target is not visible: ${kind} ' + ${encoded});
    if (element.disabled) fail('DOM target is disabled: ${kind} ' + ${encoded});
    element.scrollIntoView({ block: "center", inline: "center" });
    element.click();
    return true;
  })()`;
}

async function click(session, kind, value) {
  await evalPage(session, clickExpr(kind, value));
  await wait();
}

async function isScanned(session, id) {
  return evalPage(session, `(() => {
    const card = document.querySelector('[data-object-id=' + CSS.escape(${JSON.stringify(id)}) + ']');
    return Boolean(card && card.textContent.includes("已扫描"));
  })()`);
}

async function scan(session, id) {
  await click(session, "object", id);
  if (!(await isScanned(session, id))) await click(session, "action", "扫描");
}

async function extract(session, id, tagId) {
  await scan(session, id);
  await click(session, "tag", tagId);
  await click(session, "action", "剥离选中词");
  await assertPage(session, `Boolean(document.querySelector('.inventory-token[data-tag=' + CSS.escape(${JSON.stringify(tagId)}) + ']'))`, `inventory has ${tagId}`);
}

async function inject(session, id, tagId) {
  await scan(session, id);
  await click(session, "inventory", tagId);
  await click(session, "action", "注入选中词");
}

async function strike(session, id, limit = 1) {
  for (let i = 0; i < limit; i += 1) {
    await scan(session, id);
    const canStrike = await evalPage(session, `(() => {
      const button = [...document.querySelectorAll('.action-button')]
        .find((item) => item.textContent.trim() === "重击");
      return Boolean(button && !button.disabled);
    })()`);
    if (!canStrike) return;
    await click(session, "action", "重击");
  }
}

async function nextZone(session) {
  await click(session, "action", "进入下一区域");
}

async function assertPage(session, expression, label) {
  const passed = await evalPage(session, `Boolean(${expression})`);
  if (!passed) throw new Error(`DOM click assertion failed: ${label}`);
}

async function route(session, mode) {
  await evalPage(session, `document.body.dataset.domClickMode = ${JSON.stringify(mode)}`);

  await extract(session, "statue", "Semantic.Structure.Fragile");
  await inject(session, "gate", "Semantic.Structure.Fragile");
  await strike(session, "gate");
  await assertPage(session, `JSON.parse(document.querySelector("#reportData").textContent).flags.gateDestroyed`, "Z1 gate destroyed");
  await nextZone(session);

  await extract(session, "tablet", "Semantic.Mass.Light");
  await inject(session, "block", "Semantic.Mass.Light");
  await click(session, "action", "推动石块");
  await inject(session, "block", "Semantic.Mass.Heavy");
  await click(session, "action", "压住机关");
  await assertPage(session, `JSON.parse(document.querySelector("#reportData").textContent).flags.platePressed`, "Z2 plate pressed");
  await nextZone(session);

  await scan(session, "guardA");
  await click(session, "action", "弹反破绽");
  await click(session, "tag", "Semantic.Structure.Solid");
  await click(session, "action", "剥离选中词");
  await strike(session, "guardA", 5);
  await strike(session, "guardB", 3);
  await assertPage(session, `JSON.parse(document.querySelector("#reportData").textContent).currentZone === "Z3" && JSON.parse(document.querySelector("#reportData").textContent).currentSteps.every((item) => item.done)`, "Z3 enemies defeated");
  await nextZone(session);

  await extract(session, "brazier", "Semantic.Temperature.Overheated");
  await inject(session, "lift", "Semantic.Temperature.Overheated");
  await extract(session, "pool", "Semantic.Medium.Wet");
  await inject(session, "beast", "Semantic.Medium.Wet");
  await assertPage(session, `JSON.parse(document.querySelector("#reportData").textContent).flags.liftMelted && JSON.parse(document.querySelector("#reportData").textContent).flags.steamBurst`, "Z4 steam and lift complete");
  await nextZone(session);

  await scan(session, "pullPillar");
  await click(session, "action", "聚拢碎片");
  await scan(session, "pushPillar");
  await click(session, "action", "形成桥面");
  await assertPage(session, `JSON.parse(document.querySelector("#reportData").textContent).flags.bridgeFormed`, "Z5 bridge formed");
  await nextZone(session);

  await extract(session, "bossFire", "Semantic.Temperature.Overheated");
  await inject(session, "warden", "Semantic.Temperature.Overheated");
  await extract(session, "bossPool", "Semantic.Medium.Wet");
  await inject(session, "warden", "Semantic.Medium.Wet");
  await extract(session, "bossIce", "Semantic.Temperature.Frozen");
  await inject(session, "warden", "Semantic.Temperature.Frozen");
  await extract(session, "bossTablet", "Semantic.Structure.Fragile");
  await inject(session, "warden", "Semantic.Structure.Fragile");
  await strike(session, "warden");
  await extract(session, "bossPull", "Semantic.Field.Attract");
  await inject(session, "warden", "Semantic.Field.Attract");
  await extract(session, "bossPush", "Semantic.Field.Repel");
  await inject(session, "warden", "Semantic.Field.Repel");
  await assertPage(session, `(() => {
    const report = JSON.parse(document.querySelector("#reportData").textContent);
    const wardenText = document.querySelector('[data-object-id="warden"]')?.textContent || "";
    return report.flags.fieldPulse && !report.flags.bossDefeated && !wardenText.includes("耐久 0");
  })()`, "Boss exposed core with positive HP after field pulse");
  await extract(session, "bossTablet", "Semantic.Structure.Fragile");
  await inject(session, "warden", "Semantic.Structure.Fragile");
  await strike(session, "warden");
  await assertPage(session, `JSON.parse(document.querySelector("#reportData").textContent).flags.bossDefeated`, "Z6 boss defeated");
  await nextZone(session);

  return evalPage(session, `(() => {
    const report = JSON.parse(document.querySelector("#reportData").textContent);
    return {
      mode: report.testMode,
      completed: report.completed,
      currentZone: report.currentZone,
      scans: report.metrics.scans,
      extracts: report.metrics.extracts,
      injects: report.metrics.injects,
      reactions: report.metrics.reactions,
      mistakes: report.summary.totalMistakes,
      feedbackEvents: report.metrics.feedbackEvents.length,
      failureEvents: report.metrics.failureEvents.length,
      bossCounters: report.metrics.bossPhaseCounters.length,
      experienceStatus: report.experience.status
    };
  })()`);
}

async function runMode(port, mode) {
  const url = `${APP_URL}${APP_URL.includes("?") ? "&" : "?"}mode=${mode}`;
  const session = await openPageTarget(port, url);
  try {
    return await route(session, mode);
  } finally {
    session.close();
  }
}

const browser = await launchBrowser();
try {
  const reports = {
    guided: await runMode(browser.port, "guided"),
    low: await runMode(browser.port, "low")
  };
  const failures = [];
  for (const [mode, report] of Object.entries(reports)) {
    if (!report.completed || report.currentZone !== "Z7") failures.push(`${mode} did not complete`);
    if (report.mistakes !== 0) failures.push(`${mode} mistakes expected 0, got ${report.mistakes}`);
    if (report.failureEvents !== 0) failures.push(`${mode} failure events expected 0, got ${report.failureEvents}`);
    if (report.bossCounters !== 3) failures.push(`${mode} boss counters expected 3, got ${report.bossCounters}`);
    if (report.reactions !== 4) failures.push(`${mode} reactions expected 4, got ${report.reactions}`);
  }
  const output = {
    build: "1.0.0",
    browser: path.basename(browser.browserPath),
    url: APP_URL,
    passed: failures.length === 0,
    reports,
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
