import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const BASE_URL = "https://api.jsonbin.io/v3/b";
const HEADERS = {
  "Content-Type": "application/json",
  "X-Master-Key": process.env.JSONBIN_API_KEY,
};

// Save a new report — creates a new bin per report and updates the archive bin
export async function saveReport(report) {
  try {
    // 1. Create a new bin for this report
    const createRes = await axios.post(BASE_URL, report, {
      headers: {
        ...HEADERS,
        "X-Bin-Name": `vantage-report-${report.generatedAt.split("T")[0]}`,
        "X-Bin-Private": "false",
      },
    });
    const binId = createRes.data.metadata.id;
    console.log(`[Store] Report saved to JSONBin: ${binId}`);

    // 2. Update or create the latest bin
    const latestBinId = process.env.JSONBIN_LATEST_BIN_ID;
    if (latestBinId) {
      await axios.put(`${BASE_URL}/${latestBinId}`, report, { headers: HEADERS });
      console.log(`[Store] Latest bin updated: ${latestBinId}`);
    } else {
      const latestRes = await axios.post(BASE_URL, report, {
        headers: {
          ...HEADERS,
          "X-Bin-Name": "vantage-latest",
          "X-Bin-Private": "false",
        },
      });
      console.log(`[Store] Latest bin created. Add to Render env: JSONBIN_LATEST_BIN_ID=${latestRes.data.metadata.id}`);
    }

    // 3. Update or create the archive bin
    const archiveBinId = process.env.JSONBIN_ARCHIVE_BIN_ID;
    if (archiveBinId) {
      // Fetch existing archive
      const archiveRes = await axios.get(`${BASE_URL}/${archiveBinId}/latest`, { headers: HEADERS });
      const archive = archiveRes.data.record;
      const reports = Array.isArray(archive.reports) ? archive.reports : [];

      // Add new entry — store summary only to keep archive small
      reports.unshift({
        issue: report.issue,
        date: report.generatedAt.split("T")[0],
        generatedAt: report.generatedAt,
        headline: report.brief.headline,
        mantleTVL: report.layer1.raw.tvl,
        tvlChange7d: report.layer1.raw.tvlChange7d,
        binId,
      });

      await axios.put(`${BASE_URL}/${archiveBinId}`, { reports }, { headers: HEADERS });
      console.log(`[Store] Archive updated: ${reports.length} reports`);
    } else {
      const archiveRes = await axios.post(
        BASE_URL,
        {
          reports: [{
            issue: report.issue,
            date: report.generatedAt.split("T")[0],
            generatedAt: report.generatedAt,
            headline: report.brief.headline,
            mantleTVL: report.layer1.raw.tvl,
            tvlChange7d: report.layer1.raw.tvlChange7d,
            binId,
          }],
        },
        {
          headers: {
            ...HEADERS,
            "X-Bin-Name": "vantage-archive",
            "X-Bin-Private": "false",
          },
        }
      );
      console.log(`[Store] Archive bin created. Add to Render env: JSONBIN_ARCHIVE_BIN_ID=${archiveRes.data.metadata.id}`);
    }

    return binId;
  } catch (err) {
    console.error("[Store] JSONBin error:", err.response?.data || err.message);
    return null;
  }
}

// Fetch the latest report
export async function getLatestReport() {
  const binId = process.env.JSONBIN_LATEST_BIN_ID;
  if (!binId) throw new Error("JSONBIN_LATEST_BIN_ID not set");
  const res = await axios.get(`${BASE_URL}/${binId}/latest`, { headers: HEADERS });
  return res.data.record;
}

// Fetch the archive list
export async function getArchive() {
  const binId = process.env.JSONBIN_ARCHIVE_BIN_ID;
  if (!binId) throw new Error("JSONBIN_ARCHIVE_BIN_ID not set");
  const res = await axios.get(`${BASE_URL}/${binId}/latest`, { headers: HEADERS });
  return res.data.record;
}

// Fetch a specific report by its bin ID
export async function getReportByBinId(binId) {
  const res = await axios.get(`${BASE_URL}/${binId}/latest`, { headers: HEADERS });
  return res.data.record;
}