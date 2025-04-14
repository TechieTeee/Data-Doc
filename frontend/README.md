# Data Doc
**Data for Humanity, Decentralized**  
Decentralized AI dataset storage with Croissant ML-ZKP, rewarding contributors transparently.

## Problem
AI relies on human data, but contributors go unpaid. Kaggle’s 200,000+ datasets lack transparency—78% of data scientists worry (O'Reilly, 2023).

## Background
Data Doc fuses Croissant ML and ZKP—a Web3 first—for private, auditable attribution. Unlike Kaggle, it shares revenue via CIDs and blockchain, targeting $1.2T markets (McKinsey, 2024) and 500M incomes (World Bank, 2022).

## Tech Stack
- **Pinata**: Live IPFS uploads with JWT (`backend/index.js`).
- **Storacha**: Blob uploads coded (`index (8).js`), mocked (`storachaCid: mock-storacha-...`).
- **Akave**: Streaming coded (`index (8).js`), mocked (`akaveCid: mock-akave-...`).
- **EigenDA**: Mocked (`eigenDAId: mock-eigenda-...`).
- **Blockchain**: Sepolia coded, mocked (contract: `0xD624121d86871E022E3674F45C43BBB30188033e`).
- **ZKP-Croissant**: `snarkjs` coded, mocked (`zkpProof: {"mockProof": "zkp-mocked"}`).
- **Frontend**: Next.js, RainbowKit, drag-and-drop, confetti (`page.tsx`).

## Implementation
1. Connect Wallet at `https://data-doc.vercel.app`.
2. Drag-and-drop CSV; Pinata uploads with Croissant metadata.
3. Storacha (blobs), Akave (streaming), ZKP coded, mocked for demo.
4. See CIDs, confetti.

## Prizes
- **Hack the Data Layer**: Pinata live, Storacha/Akave coded, Croissant-ZKP.
- **Storacha**: `w3up-client` blobs, mocked.
- **Akave**: Streaming, mocked.

## Challenges
- Pinata: Fixed auth with JWT.
- Storacha: Switched to blobs for scale.
- Akave: Coded streaming, tested locally.
- Gitpod: Ports fixed, used Vercel.
- Mocks for demo; logic in `index (8).js`.

## Impact
- **Human-First**: Rewards vs. Kaggle’s opacity, 10xing datasets (Gartner, 2024).
- **Research**: Global collaborations.
- **Equity**: $100B dispute savings (Forbes, 2023), 500M incomes (World Bank, 2022).

## Next Steps
- Live Storacha/Akave.
- Sepolia contract.
- Croissant-ZKP live.
- Grants (Ethereum, Filecoin).

## Setup
1. Clone: `git clone github.com/data-doc`.
2. Install: `cd Data-Doc && npm install`.
3. Set `.env`: `PINATA_API_KEY`, `PINATA_SECRET`.
4. Run: `cd backend && node index.js`, `cd frontend && npm run dev`.
5. Visit: `https://data-doc.vercel.app`.

**Contract**: `0xD624121d86871E022E3674F45C43BBB30188033e`