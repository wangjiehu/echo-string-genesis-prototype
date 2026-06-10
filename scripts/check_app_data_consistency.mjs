import fs from "node:fs";
import { loadAppContext, readAppMetadata } from "./app_vm_harness.mjs";

const tagsDoc = JSON.parse(fs.readFileSync("data/semantic_tags_mvp.json", "utf8"));
const reactionsDoc = JSON.parse(fs.readFileSync("data/semantic_reactions_mvp.json", "utf8"));
const objectsDoc = JSON.parse(fs.readFileSync("data/semantic_objects_mvp.json", "utf8"));
const { context } = loadAppContext();
const app = readAppMetadata(context);
const failures = [];

function fail(message) {
  failures.push(message);
}

const dataTagIds = new Set(tagsDoc.tags.map((item) => item.tagId));
const appTagIds = new Set(app.tags.map((item) => item.id));
for (const id of dataTagIds) {
  if (!appTagIds.has(id)) fail(`data tag missing from app: ${id}`);
}
for (const id of appTagIds) {
  if (!dataTagIds.has(id)) fail(`app tag missing from data: ${id}`);
}

const dataTagById = Object.fromEntries(tagsDoc.tags.map((item) => [item.tagId, item]));
for (const appTag of app.tags) {
  const dataTag = dataTagById[appTag.id];
  if (!dataTag) continue;
  if (appTag.name !== dataTag.displayName) fail(`tag display name drift: ${appTag.id}`);
  if (appTag.slot !== dataTag.slotType) fail(`tag slot drift: ${appTag.id}`);
  if (appTag.extract !== dataTag.extractCost) fail(`tag extract cost drift: ${appTag.id}`);
  if (appTag.inject !== dataTag.injectCost) fail(`tag inject cost drift: ${appTag.id}`);
}

const allAppObjects = app.zones.flatMap((zone) => zone.objects.map((object) => ({ ...object, zone: zone.id })));
for (const object of allAppObjects) {
  for (const tagId of [...object.currentTags, ...object.providesTags]) {
    if (!dataTagIds.has(tagId)) fail(`app object ${object.name} references unknown tag: ${tagId}`);
  }
}

const dataDisplayNames = new Set(objectsDoc.objects.map((item) => item.displayName));
const missingDataNames = allAppObjects
  .filter((object) => object.id !== "archive")
  .filter((object) => !dataDisplayNames.has(object.name))
  .map((object) => `${object.zone}/${object.name}`);
if (missingDataNames.length) fail(`app objects missing from data table: ${missingDataNames.join(", ")}`);

const reactionIds = new Set(reactionsDoc.reactions.map((item) => item.reactionId));
for (const required of ["Reaction.SteamBurst", "Reaction.FractureWindow", "Reaction.FieldPulse"]) {
  if (!reactionIds.has(required)) fail(`required reaction missing: ${required}`);
}

if (app.build !== "1.0.0") fail(`app build expected 1.0.0, got ${app.build}`);
if (app.rollout.length !== 12) fail(`rollout expected 12 entries, got ${app.rollout.length}`);

if (failures.length) {
  console.error(failures.map((item) => `[FAIL] ${item}`).join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({
  build: app.build,
  tags: app.tags.length,
  zones: app.zones.length,
  objects: allAppObjects.length,
  reactions: reactionIds.size,
  rollout: app.rollout.length,
  status: "passed"
}, null, 2));
