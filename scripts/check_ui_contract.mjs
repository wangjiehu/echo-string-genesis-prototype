import fs from "node:fs";

const html = fs.readFileSync("prototype/index.html", "utf8");
const app = fs.readFileSync("prototype/app.js", "utf8");
const failures = [];

function fail(message) {
  failures.push(message);
}

const idMatches = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const ids = new Set(idMatches);
const duplicateIds = idMatches.filter((id, index) => idMatches.indexOf(id) !== index);
if (duplicateIds.length) fail(`duplicate html ids: ${[...new Set(duplicateIds)].join(", ")}`);

const boundIds = [...app.matchAll(/document\.getElementById\("([^"]+)"\)/g)].map((match) => match[1]);
for (const id of boundIds) {
  if (!ids.has(id)) fail(`app binds missing html id: ${id}`);
}

for (const mode of ["guided", "low", "debug"]) {
  if (!html.includes(`data-mode="${mode}"`)) fail(`missing mode button: ${mode}`);
}

if (!html.includes("app.js?v=1.0.0")) fail("index.html script cache key is not 1.0.0");
if (!html.includes("regression.js?v=1.0.0")) fail("index.html regression cache key is not 1.0.0");
if (!html.includes("1.0.0 Public Playtest")) fail("index.html build pill is not 1.0.0");
if (!ids.has("decisionStrip")) fail("decision strip node missing");
if (!ids.has("resultPulse")) fail("result pulse node missing");
if (!ids.has("checkpointBtn")) fail("checkpoint button missing");

if (failures.length) {
  console.error(failures.map((item) => `[FAIL] ${item}`).join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "passed",
  ids: ids.size,
  boundIds: boundIds.length,
  modes: 3
}, null, 2));
