import { mkdir, writeFile } from "node:fs/promises";

import { runDeterministicGoogleEvaluation } from "../src/evaluation/google-protocol-evaluation";
import { runLiveGoogleEvaluation } from "../src/evaluation/live-google-evaluation";

const live = process.argv.includes("--live");
const report = live ? await runLiveGoogleEvaluation() : await runDeterministicGoogleEvaluation();
const outputPath = live ? "evaluation-results/live-vertex.json" : "evaluation-results/deterministic.json";

await mkdir("evaluation-results", { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...report, outputPath }, null, 2));

if ("status" in report ? report.status === "failed" : report.passed === false) process.exitCode = 1;
