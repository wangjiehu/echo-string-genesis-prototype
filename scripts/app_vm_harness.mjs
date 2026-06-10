import fs from "node:fs";
import vm from "node:vm";

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.values = new Set();
  }

  toggle(name, active) {
    if (active) this.values.add(name);
    else this.values.delete(name);
  }

  contains(name) {
    return this.values.has(name) || String(this.element.className || "").split(/\s+/).includes(name);
  }

  add(name) {
    this.values.add(name);
  }

  remove(name) {
    this.values.delete(name);
  }
}

class FakeElement {
  constructor(id = "", tag = "div") {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.style = {
      setProperty: (key, value) => {
        this.style[key] = value;
      }
    };
    this.classList = new FakeClassList(this);
    this.attributes = {};
    this.textContent = "";
    this.innerHTML = "";
    this.className = "";
    this.disabled = false;
    this.title = "";
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  remove() {}
  addEventListener() {}
  click() {}

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  querySelectorAll() {
    return [];
  }

  querySelector() {
    return null;
  }
}

const REQUIRED_IDS = [
  "inkValue",
  "inventoryCount",
  "zoneIndex",
  "elapsedValue",
  "zoneList",
  "zoneTitle",
  "zoneObjective",
  "nextHint",
  "resultPulse",
  "stepList",
  "sceneMap",
  "contextActions",
  "actionHelp",
  "selectedHint",
  "inspector",
  "inventoryList",
  "eventLog",
  "reflectionBox",
  "metricsBox",
  "sessionStatus",
  "undoBtn",
  "checkpointBtn",
  "shareLinkBtn",
  "restartSessionBtn",
  "completionPanel",
  "reportData",
  "resetBtn",
  "clearInventoryBtn",
  "refillInkBtn",
  "resetZoneBtn",
  "downloadReportBtn"
];

export function createDomHarness() {
  const elements = Object.fromEntries(REQUIRED_IDS.map((id) => [id, new FakeElement(id)]));
  const modeButtons = ["guided", "low", "debug"].map((mode) => {
    const element = new FakeElement(`mode-${mode}`, "button");
    element.dataset.mode = mode;
    return element;
  });
  const body = new FakeElement("body", "body");
  const document = {
    body,
    scripts: [],
    getElementById: (id) => elements[id] || (elements[id] = new FakeElement(id)),
    querySelectorAll: (selector) => selector === "[data-mode]" ? modeButtons : [],
    querySelector: (selector) => selector === ".build-pill" ? new FakeElement("build-pill") : null,
    createElement: (tag) => new FakeElement("", tag)
  };

  return { document, elements, modeButtons };
}

export function loadAppContext(appPath = "prototype/app.js") {
  const { document, elements, modeButtons } = createDomHarness();
  const context = {
    console,
    document,
    window: null,
    navigator: { clipboard: { writeText: async () => {} } },
    URL: class URLShim extends URL {
      static createObjectURL() {
        return "blob:fake";
      }

      static revokeObjectURL() {}
    },
    Blob,
    setInterval: () => 0,
    setTimeout: (callback) => {
      callback();
      return 0;
    },
    clearInterval: () => {},
    structuredClone: globalThis.structuredClone,
    Date,
    Math,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Error,
    Set,
    Map,
    URLSearchParams
  };
  context.window = context;
  context.location = { search: "" };
  context.addEventListener = () => {};

  vm.runInNewContext(fs.readFileSync(appPath, "utf8"), context, { filename: appPath });
  const regressionPath = appPath.replace(/app\.js$/, "regression.js");
  if (fs.existsSync(regressionPath)) {
    vm.runInContext(fs.readFileSync(regressionPath, "utf8"), context, { filename: regressionPath });
  }
  return { context, document, elements, modeButtons };
}

export function readAppMetadata(context) {
  return vm.runInContext(`({
    build: BUILD_LABEL,
    buildName: BUILD_NAME,
    rollout: structuredClone(BUILD_ROLLOUT),
    tags: Object.entries(TAGS).map(([id, item]) => ({ id, ...item })),
    zones: ZONES.map((zone) => ({
      id: zone.id,
      name: zone.name,
      objects: zone.objects.map((object) => ({
        id: object.id,
        name: object.name,
        type: object.type,
        currentTags: [...object.currentTags],
        providesTags: [...object.providesTags],
        openSlots: [...object.openSlots],
        lockedSlots: [...object.lockedSlots],
        persistentSource: Boolean(object.persistentSource)
      }))
    }))
  })`, context);
}

export function summarizeSuite(suite) {
  return {
    build: suite.build,
    passed: suite.passed,
    comparison: suite.comparison,
    guided: {
      completed: suite.reports.guided.completed,
      mode: suite.reports.guided.testMode,
      score: suite.reports.guided.audit.score,
      grade: suite.reports.guided.audit.grade,
      assertions: suite.reports.guided.metrics.routeAssertions.length,
      mistakes: suite.reports.guided.summary.totalMistakes,
      bossCounters: suite.reports.guided.metrics.bossPhaseCounters.length,
      reactions: suite.reports.guided.metrics.reactions,
      checkpointRestores: suite.reports.guided.metrics.checkpointRestores,
      feedbackEvents: suite.reports.guided.metrics.feedbackEvents.length,
      failureEvents: suite.reports.guided.metrics.failureEvents.length,
      experienceStatus: suite.reports.guided.experience.status
    },
    low: {
      completed: suite.reports.low.completed,
      mode: suite.reports.low.testMode,
      score: suite.reports.low.audit.score,
      grade: suite.reports.low.audit.grade,
      assertions: suite.reports.low.metrics.routeAssertions.length,
      mistakes: suite.reports.low.summary.totalMistakes,
      bossCounters: suite.reports.low.metrics.bossPhaseCounters.length,
      reactions: suite.reports.low.metrics.reactions,
      checkpointRestores: suite.reports.low.metrics.checkpointRestores,
      feedbackEvents: suite.reports.low.metrics.feedbackEvents.length,
      failureEvents: suite.reports.low.metrics.failureEvents.length,
      experienceStatus: suite.reports.low.experience.status
    }
  };
}
