import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { getLatestReport, getArchive, getReportByBinId } from "./store.js";
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const REPORTS_DIR = path.join(__dirname, "../public/reports");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// GET /api/report/latest — from JSONBin first, fallback to local
app.get("/api/report/latest", async (req, res) => {
  try {
    if (process.env.JSONBIN_LATEST_BIN_ID) {
      const report = await getLatestReport();
      return res.json(report);
    }
    // Local fallback
    const latestPath = path.join(REPORTS_DIR, "latest.json");
    if (!fs.existsSync(latestPath)) {
      return res.status(404).json({ error: "No report generated yet." });
    }
    res.json(JSON.parse(fs.readFileSync(latestPath, "utf-8")));
  } catch (err) {
    // Try local fallback on JSONBin failure
    const latestPath = path.join(REPORTS_DIR, "latest.json");
    if (fs.existsSync(latestPath)) {
      return res.json(JSON.parse(fs.readFileSync(latestPath, "utf-8")));
    }
    res.status(500).json({ error: "Could not fetch report." });
  }
});

// GET /api/reports — archive list from JSONBin
app.get("/api/reports", async (req, res) => {
  try {
    if (process.env.JSONBIN_ARCHIVE_BIN_ID) {
      const archive = await getArchive();
      return res.json({ reports: archive.reports, count: archive.reports.length });
    }
    // Local fallback
    if (!fs.existsSync(REPORTS_DIR)) return res.json({ reports: [] });
    const files = fs
      .readdirSync(REPORTS_DIR)
      .filter((f) => f.startsWith("report-") && f.endsWith(".json") && f !== "latest.json")
      .map((f) => f.replace("report-", "").replace(".json", ""))
      .sort().reverse();
    res.json({ reports: files, count: files.length });
  } catch (err) {
    res.json({ reports: [], count: 0 });
  }
});

// GET /api/report/bin/:binId — fetch specific archived report
app.get("/api/report/bin/:binId", async (req, res) => {
  try {
    const report = await getReportByBinId(req.params.binId);
    res.json(report);
  } catch (err) {
    res.status(404).json({ error: "Report not found." });
  }
});

// GET /api/health
app.get("/api/health", (req, res) => {
  res.json({ status: "running", agent: "Vantage", version: "1.0.0", timestamp: new Date().toISOString() });
});

// POST /api/run — cron trigger
app.post("/api/run", async (req, res) => {
  const secret = req.headers["x-agent-secret"];
  if (!process.env.AGENT_SECRET || secret !== process.env.AGENT_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json({ status: "Agent started", timestamp: new Date().toISOString() });
  try {
    const { runAgent } = await import("./agent.js");
    await runAgent();
  } catch (err) {
    console.error("[Agent] Error during cron trigger:", err);
  }
});

// Dashboard route
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/dashboard.html"));
});

// Fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`\n[Vantage] Server running on port ${PORT}`);
  console.log(`[Vantage] API: http://localhost:${PORT}/api/report/latest\n`);
});