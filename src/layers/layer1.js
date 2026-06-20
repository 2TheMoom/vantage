import Groq from "groq-sdk";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MANTLE_RPC = process.env.MANTLE_RPC_URL || "https://rpc.mantle.xyz";

async function fetchMantleRPC(method, params = []) {
  const res = await axios.post(MANTLE_RPC, {
    jsonrpc: "2.0", id: 1, method, params,
  }, { timeout: 8000 });
  return res.data.result;
}

async function fetchMantleTVL() {
  try {
    const res = await axios.get(
      "https://api.llama.fi/v2/historicalChainTvl/Mantle",
      { timeout: 8000 }
    );
    const data = res.data;
    const latest = data[data.length - 1];
    const prev = data[data.length - 8];
    const change7d = prev
      ? (((latest.tvl - prev.tvl) / prev.tvl) * 100).toFixed(2)
      : null;
    return { tvl: latest.tvl, date: latest.date, change7d };
  } catch {
    return null;
  }
}

// Fetch RWA protocols deployed on Mantle via DeFiLlama — no auth needed
async function fetchMantleRWAProtocols() {
  try {
    const res = await axios.get("https://api.llama.fi/protocols", { timeout: 10000 });
    const protocols = res.data;
    // Filter protocols that have Mantle chain and are in RWA-related categories
    const rwaCategories = ["RWA", "Real World Assets", "Lending", "Yield"];
    const mantleRWA = protocols.filter(p => {
      const hasMantle = p.chains && p.chains.some(c =>
        c.toLowerCase().includes("mantle")
      );
      const isRWA = p.category && rwaCategories.some(cat =>
        p.category.toLowerCase().includes(cat.toLowerCase())
      );
      return hasMantle && isRWA;
    });
    const totalRWATVL = mantleRWA.reduce((sum, p) => {
      const mantleTVL = p.chainTvls?.Mantle?.tvl ?? 0;
      return sum + mantleTVL;
    }, 0);
    return {
      count: mantleRWA.length,
      totalRWATVL,
      protocols: mantleRWA.slice(0, 5).map(p => ({
        name: p.name,
        tvl: p.chainTvls?.Mantle?.tvl ?? 0,
        category: p.category,
      })),
    };
  } catch {
    return null;
  }
}

export async function runLayer1() {
  console.log("[Layer 1] Fetching Mantle ecosystem metrics...");

  const [blockResult, tvlResult, rwaResult] = await Promise.allSettled([
    fetchMantleRPC("eth_blockNumber"),
    fetchMantleTVL(),
    fetchMantleRWAProtocols(),
  ]);

  const blockNumber = blockResult.status === "fulfilled"
    ? parseInt(blockResult.value, 16)
    : null;

  const tvl = tvlResult.status === "fulfilled" ? tvlResult.value : null;
  const rwa = rwaResult.status === "fulfilled" ? rwaResult.value : null;

  const rawData = {
    blockNumber,
    tvl: tvl?.tvl ?? null,
    tvlChange7d: tvl?.change7d ?? null,
    rwaProtocolCount: rwa?.count ?? null,
    rwaTVLOnMantle: rwa?.totalRWATVL ?? null,
    rwaProtocols: rwa?.protocols ?? [],
    source: "Mantle RPC + DeFiLlama",
    fetchedAt: new Date().toISOString(),
  };

  const rwaStr = rwa?.protocols?.length
    ? rwa.protocols.map(p => `${p.name} (${p.category})`).join(", ")
    : "none detected";

  const prompt = `
You are a concise onchain data analyst. Summarize the following Mantle L2 ecosystem metrics in 3-4 sentences.
Be factual. Highlight TVL figures, any notable change, and RWA protocol activity on Mantle. Do not speculate.

Data:
- Latest block: ${rawData.blockNumber}
- Mantle TVL: ${rawData.tvl ? "$" + (rawData.tvl / 1e6).toFixed(2) + "M" : "unavailable"}
- 7-day TVL change: ${rawData.tvlChange7d ? rawData.tvlChange7d + "%" : "unavailable"}
- RWA protocols on Mantle: ${rawData.rwaProtocolCount ?? 0} (${rwaStr})
- Total RWA TVL on Mantle: ${rawData.rwaTVLOnMantle ? "$" + (rawData.rwaTVLOnMantle / 1e6).toFixed(2) + "M" : "unavailable"}
- Fetched at: ${rawData.fetchedAt}

Return only the summary paragraph, no headers or bullets.
`.trim();

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
    temperature: 0.3,
  });

  const summary = completion.choices[0].message.content.trim();

  console.log("[Layer 1] Done.");
  return { raw: rawData, summary };
}