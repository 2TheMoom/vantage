import Groq from "groq-sdk";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function fetchGlobalTVL() {
  try {
    const res = await axios.get("https://api.llama.fi/v2/globalcharts", { timeout: 8000 });
    const data = res.data;
    const latest = data[data.length - 1];
    const prev7 = data[data.length - 8];
    const change7d = prev7
      ? (((latest.totalLiquidityUSD - prev7.totalLiquidityUSD) / prev7.totalLiquidityUSD) * 100).toFixed(2)
      : null;
    return { tvl: latest.totalLiquidityUSD, change7d };
  } catch {
    return null;
  }
}

async function fetchTopChainsTVL() {
  try {
    const res = await axios.get("https://api.llama.fi/v2/chains", { timeout: 8000 });
    return res.data
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, 12)
      .map((c) => ({ name: c.name, tvl: c.tvl }));
  } catch {
    return null;
  }
}

async function fetchRWAProtocolsGlobal() {
  try {
    const res = await axios.get("https://api.llama.fi/protocols", { timeout: 12000 });
    const protocols = res.data;

    // DeFiLlama uses exact category string "RWA" — log unique categories for debug
    const allCategories = [...new Set(protocols.map(p => p.category).filter(Boolean))];
    const rwaCategories = allCategories.filter(c =>
      c === "RWA" || c.includes("RWA") || c.toLowerCase().includes("real world")
    );

    const rwaProtocols = protocols.filter(p =>
      p.category && (
        p.category === "RWA" ||
        p.category.includes("RWA") ||
        p.category.toLowerCase().includes("real world")
      )
    );

    const totalRWATVL = rwaProtocols.reduce((sum, p) => sum + (p.tvl ?? 0), 0);

    console.log(`[Layer 2] RWA categories found: ${rwaCategories.join(", ")}`);
    console.log(`[Layer 2] RWA protocols: ${rwaProtocols.length}, Total TVL: $${(totalRWATVL/1e9).toFixed(2)}B`);

    return {
      count: rwaProtocols.length,
      totalRWATVL: totalRWATVL > 0 ? totalRWATVL : null,
      categories: rwaCategories,
    };
  } catch (e) {
    console.log("[Layer 2] RWA fetch error:", e.message);
    return null;
  }
}

export async function runLayer2() {
  console.log("[Layer 2] Fetching broader onchain finance data...");

  const [globalTVL, topChains, rwaGlobal] = await Promise.allSettled([
    fetchGlobalTVL(),
    fetchTopChainsTVL(),
    fetchRWAProtocolsGlobal(),
  ]);

  const global = globalTVL.status === "fulfilled" ? globalTVL.value : null;
  const chains = topChains.status === "fulfilled" ? topChains.value : null;
  const rwa = rwaGlobal.status === "fulfilled" ? rwaGlobal.value : null;

  const rawData = {
    globalDeFiTVL: global?.tvl ?? null,
    globalTVLChange7d: global?.change7d ?? null,
    globalRWATVL: rwa?.totalRWATVL ?? null,
    globalRWAProtocols: rwa?.count ?? null,
    topChains: chains ?? [],
    source: "DeFiLlama",
    fetchedAt: new Date().toISOString(),
  };

  const chainsStr = rawData.topChains.length
    ? rawData.topChains.map(c => `${c.name}: $${(c.tvl / 1e9).toFixed(2)}B`).join(", ")
    : "unavailable";

  const prompt = `
You are a concise onchain finance analyst. Summarize the following cross-chain DeFi market data in 3-4 sentences.
Be factual. Highlight global TVL and RWA market context. Do not speculate.

Data:
- Global DeFi TVL: ${rawData.globalDeFiTVL ? "$" + (rawData.globalDeFiTVL / 1e9).toFixed(2) + "B" : "unavailable"}
- Global DeFi TVL 7D change: ${rawData.globalTVLChange7d ? rawData.globalTVLChange7d + "%" : "unavailable"}
- Global RWA protocol TVL: ${rawData.globalRWATVL ? "$" + (rawData.globalRWATVL / 1e9).toFixed(2) + "B" : "unavailable"}
- RWA protocols tracked: ${rawData.globalRWAProtocols ?? "unavailable"}
- Top 12 chains by TVL: ${chainsStr}

Return only the summary paragraph, no headers or bullets.
`.trim();

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
    temperature: 0.3,
  });

  const summary = completion.choices[0].message.content.trim();

  console.log("[Layer 2] Done.");
  return { raw: rawData, summary };
}