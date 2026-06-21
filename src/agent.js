import { runLayer1 } from "./layers/layer1.js";
import { runLayer2 } from "./layers/layer2.js";
import { runLayer3 } from "./layers/layer3.js";
import { saveReport } from "./store.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.join(__dirname, "../public/reports");

export async function runAgent() {
  console.log("\n========================================");
  console.log("  VANTAGE — Research Agent Starting");
  console.log(`  ${new Date().toISOString()}`);
  console.log("========================================\n");

  const issueNumber = getNextIssueNumber();

  const [layer1Result, layer2Result] = await Promise.all([
    runLayer1(),
    runLayer2(),
  ]);

  const brief = await runLayer3(layer1Result, layer2Result);

  const report = {
    issue: issueNumber,
    generatedAt: new Date().toISOString(),
    layer1: layer1Result,
    layer2: layer2Result,
    brief,
  };

  // Save to local filesystem (fallback)
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  const today = new Date().toISOString().split("T")[0];
  fs.writeFileSync(path.join(REPORTS_DIR, `report-${today}.json`), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(REPORTS_DIR, "latest.json"), JSON.stringify(report, null, 2));

  // Save to JSONBin (persistent across redeploys)
  await saveReport(report);

  console.log("\n========================================");
  console.log(`  Issue #${issueNumber} complete`);
  console.log("  VANTAGE — Agent Complete");
  console.log("========================================\n");

  return report;
}

function getNextIssueNumber() {
  if (!fs.existsSync(REPORTS_DIR)) return 1;
  const files = fs
    .readdirSync(REPORTS_DIR)
    .filter((f) => f.startsWith("report-") && f.endsWith(".json") && f !== "latest.json");
  return files.length + 1;
}

// Only auto-run when executed directly
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  runAgent().catch((err) => {
    console.error("[Agent] Fatal error:", err);
    process.exit(1);
  });
}