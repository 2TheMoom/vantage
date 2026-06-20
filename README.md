# Vantage

**Onchain Finance Research Agent — Mantle as the Settlement Layer**

Vantage is a three-layer autonomous research agent that fetches live onchain finance data, builds cross-chain context, and synthesizes a structured research brief daily using AI — with no human in the loop between fetch and publish.

Built for the [Mantle Research Challenge 2026](https://x.com/Mantle_Official) — Track 2.

---

## How It Works

```
Layer 1 (Groq)     Layer 2 (Groq)
Mantle RPC         RWA.xyz
RWA.xyz            DeFiLlama
     \                /
      \              /
       Layer 3 (Claude Sonnet)
       Research Synthesis Brief
              |
         /api/report/latest
              |
         Dashboard (public/index.html)
```

**Layer 1 — Mantle Ecosystem Metrics**
Reads directly from Mantle RPC and RWA.xyz for TVL, xStocks activity, Fluxion volume, and Atomic RFQ status. Summarized by Groq Llama 3.3 70B.

**Layer 2 — Broader Onchain Finance**
Pulls cross-chain RWA market data from RWA.xyz and DeFiLlama — global TVL, top chains, category breakdown. Summarized by Groq Llama 3.3 70B.

**Layer 3 — Research Synthesis**
Claude Sonnet receives both layer summaries and raw snapshots, then generates a structured JSON research brief positioning Mantle within the broader narrative with a forward-looking signal.

---

## Stack

| Layer | Engine | Source |
|---|---|---|
| Layer 1 | Groq · Llama 3.3 70B | Mantle RPC, RWA.xyz |
| Layer 2 | Groq · Llama 3.3 70B | RWA.xyz, DeFiLlama |
| Layer 3 | Claude Sonnet | Layer 1 + 2 output |
| Server | Express · Node.js | — |
| Deploy | Render | render.yaml |
| Schedule | Render Cron | Daily 08:00 UTC |

---

## Setup

**1. Clone the repo**
```bash
git clone https://github.com/2TheMoom/vantage.git
cd vantage
```

**2. Install dependencies**
```bash
npm install
```

**3. Set environment variables**
```bash
cp .env.example .env
```

Edit `.env`:
```
GROQ_API_KEY=your_groq_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
MANTLE_RPC_URL=https://rpc.mantle.xyz
PORT=3000
```

Get your Groq key free at [groq.com/keys](https://groq.com/keys).
Get your Anthropic key at [console.anthropic.com](https://console.anthropic.com).

**4. Run the agent manually**
```bash
npm run run-agent
```

This runs all three layers and saves the report to `public/reports/`.

**5. Start the server**
```bash
npm start
```

Visit `http://localhost:3000` for the dashboard.
Visit `http://localhost:3000/api/report/latest` for the raw JSON brief.

---

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/report/latest` | Latest generated research brief |
| `GET /api/report/:date` | Report for a specific date (YYYY-MM-DD) |
| `GET /api/reports` | List of all available report dates |
| `GET /api/health` | Agent status |

---

## Deploy on Render

1. Push repo to GitHub
2. Connect repo on [render.com](https://render.com)
3. Render detects `render.yaml` automatically
4. Add environment variables in the Render dashboard
5. Deploy — the cron job runs daily at 08:00 UTC

---

## Report Output

Each run generates a JSON brief:

```json
{
  "issue": 1,
  "generatedAt": "2026-06-21T08:04:00.000Z",
  "brief": {
    "headline": "Mantle's Atomic RFQ Marks Structural Shift in RWA Distribution",
    "summary": "...",
    "mantlePosition": "...",
    "forwardSignal": "Watch redemption volume over TVL in H2 2026",
    "keyMetrics": {
      "mantleTVL": "$247.5M",
      "globalRWATVL": "$31.76B",
      "tvlChange7d": "+3.2%",
      "mantleRWAAssets": "10+"
    }
  }
}
```

---

## ERC-8004 Identity

Vantage is registered as an onchain agent on Mantle using the ERC-8004 agent identity standard.

Agent ID: *(registered post-deployment)*

---

## Built by

Abu Olumi — [@olumi441](https://x.com/Olumi441) · [olumi.xyz](https://olumi.xyz)
