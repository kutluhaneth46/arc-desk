# Arc Desk

Live Arc mainnet builder desk.

- Mainnet pulse from the public RPC
- Dual USDC check: native 18 decimals vs ERC-20 6 decimals
- Onchain guestbook via the Memo precompile

## Live

GitHub Pages: https://kutluhaneth46.github.io/arc-desk/

## Stack

Vite, React, TypeScript, Tailwind, viem

## Local

```bash
npm install
npm run dev
```

Dev server defaults to http://127.0.0.1:43127/arc-desk/

## Arc mainnet

| Field | Value |
| --- | --- |
| Chain ID | 5042 |
| RPC | https://rpc.mainnet.arc.io |
| Explorer | https://explorer.arc.io |
| USDC | 0x3600000000000000000000000000000000000000 |
| Memo | 0x5294E9927c3306DcBaDb03fe70b92e01cCede505 |

## Microgrant note

This app is deployed and working against Arc mainnet. Read paths use the public RPC. Memo posts require a wallet with native USDC for gas.
