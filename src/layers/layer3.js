import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
dotenv.config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runLayer3(layer1, layer2) {
  console.log("[Layer 3] Running research synthesis with Claude...");

  const prompt = `
You are Vantage, an autonomous onchain finance research agent. 
Your role is to synthesize live data from two intelligence layers into a structured, publishable research brief.
Mantle is the settlement layer anchor for this analysis.

LAYER 1 — MANTLE ECOSYSTEM METRICS:
${layer1.summary}

Raw data snapshot:
- TVL: ${layer1.raw.tvl ? "$" + (layer1.raw.tvl / 1e6).toFixed(2) + "M" : "unavailable"}
- 7-day TVL change: ${layer1.raw.tvlChange7d ?? "unavailable"}%
- RWA assets on Mantle: ${layer1.raw.rwaAssets ?? "unavailable"}
- Latest block: ${layer1.raw.blockNumber ?? "unavailable"}

LAYER 2 — BROADER ONCHAIN FINANCE:
${layer2.summary}

Raw data snapshot:
- Global RWA protocol TVL: ${layer2.raw.globalRWATVL ? "$" + (layer2.raw.globalRWATVL / 1e9).toFixed(2) + "B" : "unavailable"}
- Total RWA assets tracked globally: ${layer2.raw.globalRWAAssets ?? "unavailable"}

YOUR TASK:
Write a structured research brief using the following JSON format exactly. 
Return ONLY valid JSON, no markdown fences, no preamble.

{
  "headline": "A sharp, specific one-line headline summarizing the key finding",
  "summary": "2-3 sentence executive summary positioning Mantle within the broader RWA market",
  "mantlePosition": "1-2 sentences on Mantle's specific position or movement relative to the global market",
  "forwardSignal": "1 clear, specific forward-looking signal or metric to watch",
  "keyMetrics": {
    "mantleTVL": "formatted value or unavailable",
    "globalRWATVL": "formatted value from layer2 globalRWATVL or unavailable",
    "tvlChange7d": "formatted value or unavailable",
    "mantleRWAAssets": "formatted value or unavailable"
  },
  "generatedAt": "${new Date().toISOString()}"
}
`.trim();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].text.trim();

  let brief;
  try {
    brief = JSON.parse(raw);
  } catch {
    brief = {
      headline: "Research brief generated",
      summary: raw,
      mantlePosition: "",
      forwardSignal: "",
      keyMetrics: {},
      generatedAt: new Date().toISOString(),
    };
  }

  console.log("[Layer 3] Done.");
  return brief;
}