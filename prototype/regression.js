const echoRuntime = window.__echoRuntime;
const runtimeState = echoRuntime.state;
const runtimeEl = echoRuntime.el;
const runtimeBuildLabel = echoRuntime.BUILD_LABEL;
const runtimeTestModes = echoRuntime.TEST_MODES;

function routeScan(id) {
  selectObject(id);
  const obj = selectedObject();
  if (!obj) throw new Error(`Route object not found: ${id}`);
  if (!obj.scanned) scanSelected();
  return obj;
}

function routeExtract(id, tagId) {
  const obj = routeScan(id);
  if (!canTakeVisibleTag(obj, tagId)) {
    throw new Error(`Route tried to extract non-visible tag: ${tagName(tagId)} from ${id}`);
  }
  selectTag(tagId);
  extractSelectedTag();
  if (!runtimeState.inventory.includes(tagId)) throw new Error(`Route failed to extract: ${tagName(tagId)} from ${id}`);
}

function routeInject(id, tagId) {
  routeScan(id);
  const index = runtimeState.inventory.indexOf(tagId);
  if (index === -1) throw new Error(`Route inventory missing: ${tagName(tagId)}`);
  selectInventory(index);
  injectSelectedInventory();
}

function routeStrikeUntilDefeated(id, limit = 6) {
  routeScan(id);
  for (let i = 0; i < limit; i += 1) {
    const obj = selectedObject();
    if (!obj || obj.defeated) return;
    heavyStrike();
  }
  if (!selectedObject()?.defeated) throw new Error(`Route failed to defeat: ${id}`);
}

function routeAssert(label, condition) {
  const item = { label, passed: Boolean(condition), zone: zone().id, t: elapsedSeconds() };
  runtimeState.metrics.routeAssertions.push(item);
  if (!item.passed) throw new Error(`Route assertion failed: ${label}`);
}

function runRouteRegression(mode = "guided") {
  runtimeState.testMode = mode;
  resetGame();

  routeExtract("statue", "Semantic.Structure.Fragile");
  routeInject("gate", "Semantic.Structure.Fragile");
  heavyStrike();
  routeAssert("Z1 gate destroyed", runtimeState.flags.gateDestroyed);
  nextZone();

  routeExtract("tablet", "Semantic.Mass.Light");
  routeInject("block", "Semantic.Mass.Light");
  moveBlock();
  routeInject("block", "Semantic.Mass.Heavy");
  pressPlate();
  routeAssert("Z2 plate pressed", runtimeState.flags.platePressed);
  nextZone();

  routeScan("guardA");
  parry();
  selectTag("Semantic.Structure.Solid");
  extractSelectedTag();
  routeStrikeUntilDefeated("guardA");
  routeStrikeUntilDefeated("guardB", 2);
  routeAssert("Z3 enemies defeated", zoneObjects().every((item) => item.defeated));
  nextZone();

  routeExtract("brazier", "Semantic.Temperature.Overheated");
  routeInject("lift", "Semantic.Temperature.Overheated");
  routeExtract("pool", "Semantic.Medium.Wet");
  routeInject("beast", "Semantic.Medium.Wet");
  routeAssert("Z4 steam and lift complete", runtimeState.flags.liftMelted && runtimeState.flags.steamBurst);
  nextZone();

  routeScan("pullPillar");
  gatherDebris();
  routeScan("pushPillar");
  formBridge();
  routeAssert("Z5 bridge formed", runtimeState.flags.bridgeFormed);
  nextZone();

  routeExtract("bossFire", "Semantic.Temperature.Overheated");
  routeInject("warden", "Semantic.Temperature.Overheated");
  routeExtract("bossPool", "Semantic.Medium.Wet");
  routeInject("warden", "Semantic.Medium.Wet");
  routeExtract("bossIce", "Semantic.Temperature.Frozen");
  routeInject("warden", "Semantic.Temperature.Frozen");
  routeExtract("bossTablet", "Semantic.Structure.Fragile");
  routeInject("warden", "Semantic.Structure.Fragile");
  heavyStrike();
  routeExtract("bossPull", "Semantic.Field.Attract");
  routeInject("warden", "Semantic.Field.Attract");
  routeExtract("bossPush", "Semantic.Field.Repel");
  routeInject("warden", "Semantic.Field.Repel");
  routeExtract("bossTablet", "Semantic.Structure.Fragile");
  routeInject("warden", "Semantic.Structure.Fragile");
  heavyStrike();
  routeAssert("Z6 boss defeated with three counters", runtimeState.flags.bossDefeated && runtimeState.metrics.bossPhaseCounters.length === 3);
  nextZone();

  let report = buildReport();
  runtimeState.metrics.regressionRuns.push({ mode, completed: report.completed, t: elapsedSeconds() });
  report = buildReport();
  if (!report.completed || report.currentZone !== "Z7") throw new Error(`${runtimeTestModes[mode] || mode} regression did not complete.`);
  return report;
}

function runGuidedRegression() {
  return runRouteRegression("guided");
}

function runLowGuidanceRegression() {
  return runRouteRegression("low");
}

function runRegressionSuite() {
  const guided = runGuidedRegression();
  const low = runLowGuidanceRegression();
  return {
    build: runtimeBuildLabel,
    passed: Boolean(guided.completed && low.completed),
    reports: {
      guided,
      low
    },
    comparison: {
      guidedMistakes: guided.summary.totalMistakes,
      lowMistakes: low.summary.totalMistakes,
      guidedScore: guided.audit.score,
      lowScore: low.audit.score
    }
  };
}

function setRouteZone(zoneId) {
  const index = runtimeState.zones.findIndex((item) => item.id === zoneId);
  if (index === -1) throw new Error(`Route zone not found: ${zoneId}`);
  runtimeState.zone = index;
  runtimeState.selectedObjectId = null;
  runtimeState.selectedTagId = null;
  runtimeState.selectedInventoryIndex = null;
  saveZoneCheckpoint(`${zoneId}审计检查点`);
  render();
}

function runFailureAudit() {
  const checks = [];
  const observedFailureCounts = {};
  const observedFailureEvents = [];
  const expectFailure = (label, category, fn) => {
    const before = runtimeState.metrics.failureCounts[category] || 0;
    fn();
    const after = runtimeState.metrics.failureCounts[category] || 0;
    checks.push({ label, category, passed: after > before });
    if (after <= before) throw new Error(`Failure audit did not trigger ${category}: ${label}`);
    observedFailureCounts[category] = (observedFailureCounts[category] || 0) + (after - before);
    const latestEvent = runtimeState.metrics.failureEvents.find((item) => item.category === category);
    if (latestEvent) observedFailureEvents.push({ label, ...latestEvent });
  };

  runtimeState.testMode = "debug";
  resetGame();

  expectFailure("剥离目标不提供的词", "tag-unavailable", () => {
    routeScan("statue");
    selectTag("Semantic.Mass.Heavy");
    extractSelectedTag();
  });

  expectFailure("词库满时继续剥离", "inventory-full", () => {
    runtimeState.inventory = [
      "Semantic.Structure.Fragile",
      "Semantic.Structure.Solid",
      "Semantic.Mass.Heavy"
    ];
    routeScan("statue");
    selectTag("Semantic.Structure.Fragile");
    extractSelectedTag();
  });

  expectFailure("向无槽机关写入结构词", "slot-missing", () => {
    setRouteZone("Z2");
    runtimeState.inventory = ["Semantic.Structure.Fragile"];
    runtimeState.selectedInventoryIndex = 0;
    routeScan("plate");
    injectSelectedInventory();
  });

  expectFailure("向锁定火盆写入温度词", "slot-locked", () => {
    setRouteZone("Z4");
    runtimeState.inventory = ["Semantic.Temperature.Overheated"];
    runtimeState.selectedInventoryIndex = 0;
    routeScan("brazier");
    injectSelectedInventory();
  });

  expectFailure("原墨不足时剥离", "ink-low", () => {
    resetGame();
    runtimeState.ink = 0;
    routeScan("statue");
    selectTag("Semantic.Structure.Fragile");
    extractSelectedTag();
  });

  const audit = {
    build: runtimeBuildLabel,
    passed: checks.every((item) => item.passed),
    checks,
    failureCounts: observedFailureCounts,
    failureEvents: observedFailureEvents
  };
  resetGame();
  return audit;
}

function runPlayerPathAudit() {
  const checks = [];
  const check = (label, condition) => {
    const item = { label, passed: Boolean(condition) };
    checks.push(item);
    if (!item.passed) throw new Error(`Player path audit failed: ${label}`);
  };

  runtimeState.testMode = "guided";
  resetGame();
  routeExtract("statue", "Semantic.Structure.Fragile");
  let hiddenExtractBlocked = false;
  try {
    routeExtract("statue", "Semantic.Structure.Fragile");
  } catch (error) {
    hiddenExtractBlocked = String(error?.message || error).includes("non-visible");
  }
  check("non-persistent source cannot be extracted after visible tag is gone", hiddenExtractBlocked);

  setRouteZone("Z5");
  routeScan("pullPillar");
  selectTag("Semantic.Field.Attract");
  const beforeWarnings = runtimeState.metrics.warnings;
  extractSelectedTag();
  check("Z5 field pillar extraction is blocked on mechanic route", runtimeState.metrics.warnings > beforeWarnings && !runtimeState.inventory.includes("Semantic.Field.Attract"));

  resetGame();
  setRouteZone("Z6");
  routeExtract("bossFire", "Semantic.Temperature.Overheated");
  routeInject("warden", "Semantic.Temperature.Overheated");
  routeExtract("bossPool", "Semantic.Medium.Wet");
  routeInject("warden", "Semantic.Medium.Wet");
  routeExtract("bossIce", "Semantic.Temperature.Frozen");
  routeInject("warden", "Semantic.Temperature.Frozen");
  routeExtract("bossTablet", "Semantic.Structure.Fragile");
  routeInject("warden", "Semantic.Structure.Fragile");
  heavyStrike();
  routeExtract("bossPull", "Semantic.Field.Attract");
  routeInject("warden", "Semantic.Field.Attract");
  routeExtract("bossPush", "Semantic.Field.Repel");
  routeInject("warden", "Semantic.Field.Repel");
  const exposed = objectById("warden");
  check("Boss core exposure keeps positive HP before final fragile strike", exposed.shieldLayers === 0 && exposed.hp > 0 && !exposed.defeated && !runtimeState.flags.bossDefeated);
  routeExtract("bossTablet", "Semantic.Structure.Fragile");
  routeInject("warden", "Semantic.Structure.Fragile");
  heavyStrike();
  check("Boss can be finished after second visible fragile extraction", runtimeState.flags.bossDefeated);

  const audit = {
    build: runtimeBuildLabel,
    passed: checks.every((item) => item.passed),
    checks
  };
  resetGame();
  return audit;
}

function maybeAutorunRegression() {
  const params = new URLSearchParams(window.location.search);
  const autorun = params.get("autorun");
  if (!["guided-regression", "low-regression", "suite-regression"].includes(autorun)) return;
  window.setTimeout(() => {
    try {
      const result = autorun === "suite-regression"
        ? runRegressionSuite()
        : autorun === "low-regression"
          ? runLowGuidanceRegression()
          : runGuidedRegression();
      const passed = autorun === "suite-regression" ? result.passed : result.completed;
      document.body.dataset.regressionStatus = passed ? "passed" : "incomplete";
      document.body.dataset.regressionBuild = runtimeBuildLabel;
      document.body.dataset.regressionMode = autorun;
      if (autorun === "suite-regression") {
        runtimeEl.reportData.textContent = JSON.stringify(result, null, 2);
        return;
      }
      renderReportData();
    } catch (error) {
      document.body.dataset.regressionStatus = "failed";
      document.body.dataset.regressionError = error?.message || String(error);
      log(`自动回归失败：${document.body.dataset.regressionError}`, "bad", "regression");
      render();
    }
  }, 0);
}


Object.assign(window.__echoString, {
  runGuidedRegression,
  runLowGuidanceRegression,
  runRegressionSuite,
  runFailureAudit,
  runPlayerPathAudit
});

maybeAutorunRegression();
