#!/usr/bin/env node
/* Deterministic local tool; never calls a model. */
const fs = require("node:fs"), path = require("node:path");
const sourceSvg = require("../../tools/svg-source.cjs");
const { validateCapabilityProfile } = require("../../tools/preview/svg-boundary-runtime.js");
const { read, json, write, check, schemaCheck, runCli } = require("../../tools/tool-common.cjs");
async function open(options) {
  const result = await sourceSvg.open(options);
  for (const p of [
    "../../tools/preview/svg-boundary-runtime.js",
    "boundary-compiler.js",
  ])
    await result.page.addScriptTag({ path: path.resolve(__dirname, p) });
  return result;
}
async function build(options) {
  const bytes = fs.readFileSync(options.svg),
    recipeText = read(options.recipe),
    recipe = JSON.parse(recipeText),
    out = path.resolve(options["out-dir"]);
  schemaCheck(recipe, "boundary-recipe.schema.json");
  check(
    sourceSvg.sha(bytes) === recipe.source_sha256,
    "Source SVG fingerprint mismatch",
  );
  for (const file of ["character.svg", "controls.json", "build-report.json"])
    check(
      ![options.svg, options.recipe].some(
        (p) => path.resolve(p) === path.join(out, file),
      ),
      "Output cannot overwrite author source",
    );
  const { browser, page } = await open(options);
  try {
    await sourceSvg.mount(page, bytes.toString("utf8"));
    const result = await page.evaluate(
      (recipe) => AstraBoundaryCompiler.compile(rigSvg, recipe),
      recipe,
    );
    result.rig.source.recipe_sha256 = sourceSvg.sha(recipeText);
    schemaCheck(result.rig, "boundary-rig.schema.json");
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "character.svg"), bytes);
    write(path.join(out, "controls.json"), result.rig);
    const report = {
      status: "compiled",
      visual_status: "not_reviewed",
      source: result.rig.source,
      bindings: result.rig.bindings.length,
      coordinates: result.rig.bindings.reduce((n, b) => n + b.rest.length, 0),
      warnings: result.warnings,
      diagnostics: result.diagnostics,
      capabilities: validateCapabilityProfile(result.rig),
    };
    write(path.join(out, "build-report.json"), report);
    return report;
  } finally {
    await browser.close();
  }
}
module.exports = { open, build };
if (require.main === module) runCli({ build }, "build-rig.cjs --svg SVG --recipe recipe.json --out-dir DIR");
