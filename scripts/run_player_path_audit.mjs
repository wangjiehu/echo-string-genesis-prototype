import { loadAppContext } from "./app_vm_harness.mjs";

const { context } = loadAppContext();
const audit = context.window.__echoString.runPlayerPathAudit();

console.log(JSON.stringify(audit, null, 2));

const failures = [];
if (audit.build !== "1.0.0") failures.push(`expected 1.0.0 build, got ${audit.build}`);
if (!audit.passed) failures.push("player path audit did not pass");

const expectedChecks = [
  "non-persistent source cannot be extracted after visible tag is gone",
  "Z5 field pillar extraction is blocked on mechanic route",
  "Boss core exposure keeps positive HP before final fragile strike",
  "Boss can be finished after second visible fragile extraction"
];

for (const label of expectedChecks) {
  const item = audit.checks.find((check) => check.label === label);
  if (!item) failures.push(`missing player path check: ${label}`);
  else if (!item.passed) failures.push(`player path check failed: ${label}`);
}

if (failures.length) {
  console.error(failures.map((item) => `[FAIL] ${item}`).join("\n"));
  process.exit(1);
}
