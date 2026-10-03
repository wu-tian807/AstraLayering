/* Shared JSON/schema and CLI helpers; stage algorithms stay in their own tools/. */
const fs = require("node:fs"), path = require("node:path");
const { execFileSync } = require("node:child_process");
const read = p => fs.readFileSync(p, "utf8");
const json = p => JSON.parse(read(p));
const write = (p, value) => fs.writeFileSync(p, JSON.stringify(value, null, 2) + "\n");
const check = (ok, message) => { if (!ok) throw Error(message); };
function schemaCheck(value, name) {
  execFileSync(process.env.ASTRA_PYTHON || "python3", ["-c",
    "import json,sys,jsonschema; jsonschema.Draft202012Validator(json.load(open(sys.argv[1]))).validate(json.load(sys.stdin))",
    path.resolve(__dirname, "../contracts", name),
  ], { input: JSON.stringify(value), encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}
async function runCli(commands, usage) {
  try {
    const args = process.argv.slice(2), names = Object.keys(commands);
    if (!args.length || args.includes("--help")) { console.log(usage); return; }
    const command = names.length === 1 ? names[0] : args.shift(), options = {};
    check(Object.hasOwn(commands, command), "Unknown command");
    check(args.length % 2 === 0, "Options require --key value pairs");
    for (let i = 0; i < args.length; i += 2) {
      check(args[i].startsWith("--"), "Invalid option");
      options[args[i].slice(2)] = args[i + 1];
    }
    const result = await commands[command](options);
    console.log(JSON.stringify(result.visual_cases ? {
      status: result.status, cases: result.visual_cases.length, failures: result.failures,
    } : result, null, 2));
    if (result.status === "failed") process.exitCode = 1;
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
module.exports = { read, json, write, check, schemaCheck, runCli };
