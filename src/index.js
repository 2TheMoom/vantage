import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const REPORTS_DIR = path.join(__dirname, "../public/reports");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// GET /api/report/latest
app.get("/api/report/latest", (req, res) => {
  const latestPath = path.join(REPORTS_DIR, "latest.json");
  if (!fs.existsSync(latestPath)) {
    return res.status(404).json({ error: "No report generated yet. Run the agent first." });
  }
  const report = JSON.parse(fs.readFileSync(latestPath, "utf-8"));
  res.json(report);
});

// GET /api/report/:date
app.get("/api/report/:date", (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
  }
  const reportPath = path.join(REPORTS_DIR, `report-${date}.json`);
  if (!fs.existsSync(reportPath)) {
    return res.status(404).json({ error: `No report found for ${date}.` });
  }
  const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  res.json(report);
});

// GET /api/reports
app.get("/api/reports", (req, res) => {
  if (!fs.existsSync(REPORTS_DIR)) {
    return res.json({ reports: [] });
  }
  const files = fs
    .readdirSync(REPORTS_DIR)
    .filter((f) => f.startsWith("report-") && f.endsWith(".json") && f !== "latest.json")
    .map((f) => f.replace("report-", "").replace(".json", ""))
    .sort()
    .reverse();
  res.json({ reports: files, count: files.length });
});

// GET /api/health
app.get("/api/health", (req, res) => {
  res.json({
    status: "running",
    agent: "Vantage",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// POST /api/run — triggers the agent via cron-job.org or manually
app.post("/api/run", async (req, res) => {
  const secret = req.headers["x-agent-secret"];
  console.log("[Run] Received secret:", secret);
  console.log("[Run] Expected secret:", process.env.AGENT_SECRET);
  if (!process.env.AGENT_SECRET || secret !== process.env.AGENT_SECRET) {
    return res.status(401).json({ error: "Unauthorized", received: secret ? "present" : "missing" });
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

// Fallback — serve index.html for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`\n[Vantage] Server running on port ${PORT}`);
  console.log(`[Vantage] API: http://localhost:${PORT}/api/report/latest\n`);
});