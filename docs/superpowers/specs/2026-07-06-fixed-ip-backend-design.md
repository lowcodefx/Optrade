# Fixed-IP Kite Proxy Backend — Design Spec
**Date:** 2026-07-06  
**Status:** Approved

---

## Problem

Azure Static Web Apps managed functions use shared infrastructure with rotating outbound IPs. Zerodha Kite Connect's IP whitelist applies to all API calls for an API key (not just order placement), and allows a maximum of 2 IPs. The current setup has already been observed using 3 different IPs and can rotate further, making reliable IP whitelisting impossible.

## Goal

Route all Zerodha Kite API calls through a single Azure VM with one reserved static public IP. Whitelist only that IP in Zerodha. The React frontend on Azure Static Web Apps remains unchanged except for a single base-URL environment variable swap.

---

## Architecture

```
Browser (SWA: black-pond-09bbb5b00.7.azurestaticapps.net)
    │
    │  HTTPS  →  https://optrade.duckdns.org/api/*
    ▼
Azure B1s VM  (East Asia, reserved static public IP)
    nginx :443  →  Node.js/Express :3000  (PM2)
    │
    │  outbound from fixed IP → whitelisted in Zerodha
    ▼
api.kite.trade
```

---

## Infrastructure

| Resource | Spec | Est. Cost |
|----------|------|-----------|
| Azure VM | B1s Standard, Ubuntu 22.04 LTS, East Asia | ~₹700/mo |
| Public IP | Standard SKU, static, reserved | ~₹270/mo |
| Domain | DuckDNS subdomain (optrade.duckdns.org) | Free |
| TLS cert | Let's Encrypt via certbot, auto-renew | Free |
| **Total** | | **~₹970/mo** |

**NSG rules:**
- Inbound 443 (HTTPS) — from Internet
- Inbound 22 (SSH) — from developer IP only
- Outbound — unrestricted (allows calls to api.kite.trade)

---

## Backend — Node.js/Express Service

**Runtime:** Node.js 20 LTS  
**Framework:** Express.js  
**Process manager:** PM2 (auto-restart on crash, start on boot)  
**Reverse proxy:** nginx (terminates TLS, forwards to Express on port 3000)

### Routes

| Method | Route | Action |
|--------|-------|--------|
| GET/POST | `/api/kite` | Generic Kite proxy — handles all `api.kite.trade` calls including quote, option chain, instruments, orders, positions, margins, place-order, modify-order, cancel-order |
| POST | `/api/exchange-token` | Exchange Zerodha request_token → access_token |
| POST | `/api/set-token` | Store token in memory for monitor service (existing behaviour) |
| GET | `/health` | Returns `200 OK` — used for uptime checks |

All other SWA-hosted routes (news, FII/DII, global markets, niftyInstruments, optionChain, niftyQuote) stay on SWA managed functions and are unaffected — they call external APIs that don't have IP restrictions.

### Request authentication

Every request to the VM is validated with a shared secret before being forwarded to Kite:

```
X-Backend-Key: <secret>        ← checked by VM, rejects 401 if missing/wrong
X-Kite-Auth: token <key>:<token>  ← forwarded to Kite as Authorization header
```

The `X-Backend-Key` secret is a random 32-character string generated once at VM setup and stored as:
- **VM:** environment variable in PM2 ecosystem config (`ecosystem.config.js`)
- **Frontend:** `VITE_BACKEND_KEY` in SWA application settings (not in source code)

### Kite proxy logic

Identical to the current `kiteProxy.js` — reads `kite_path` query param, strips it, forwards remaining params plus request body to `api.kite.trade`, returns the response. No business logic in the proxy layer.

### CORS

Allows `https://black-pond-09bbb5b00.7.azurestaticapps.net` and `localhost:5173` (dev). Not a wildcard — origin is explicitly checked.

---

## Frontend Changes

### Environment variable

| Variable | Current value | New value |
|----------|--------------|-----------|
| `VITE_KITE_BASE` | (implicit `/api`) | `https://optrade.duckdns.org/api` |

A single constant in `src/core/services/zerodhaService.ts` (and `zerodhaAuth.ts`) switches the base URL. All existing fetch calls are unchanged.

### Request headers

Every Kite-bound fetch gains one additional header:

```ts
'X-Backend-Key': import.meta.env.VITE_BACKEND_KEY
```

This is added in one place — the shared `kiteRequest()` helper — not scattered across callers.

### SWA managed functions retained

The following SWA functions continue to serve their existing routes unchanged:
- `news`, `fiiDii`, `globalMarkets`, `emailAlert`

The following SWA functions that currently call Kite (`niftyQuote`, `optionChain`, `niftyInstruments`) are also moved to the VM, because Zerodha's IP whitelist applies to all API calls for the key — not just order placement. Leaving any Kite call on SWA managed functions would result in 403 errors once the IP whitelist is active.

---

## Deployment

### One-time VM setup (manual, ~45 min)

1. Create B1s VM + reserved static IP in Azure Portal (East Asia)
2. Configure NSG: open 443 inbound, restrict 22 to developer IP
3. SSH in, install Node.js 20, PM2, nginx, certbot
4. Register `optrade.duckdns.org` pointing to the VM's static IP
5. Obtain Let's Encrypt cert: `certbot --nginx -d optrade.duckdns.org`
6. Configure certbot auto-renewal cron
7. Deploy Express app, start with PM2, save PM2 config for boot

### Ongoing deployment (code changes)

```bash
# From developer machine
git pull && npm ci
pm2 restart optrade-api
```

No CI/CD pipeline required for a single-developer personal app.

---

## Security Considerations

- SSH access restricted to developer IP via NSG — no password auth, key only
- `X-Backend-Key` shared secret prevents unauthorized use of the proxy endpoint
- Access token is never stored on disk — lives in PM2 process memory and frontend Zustand store only
- CORS origin whitelist prevents cross-origin abuse
- Let's Encrypt cert ensures all traffic is encrypted in transit

---

## What Does NOT Change

- Zerodha OAuth login flow — SWA still receives the redirect, frontend calls `/api/exchange-token` on VM
- All React components, store, hooks — zero changes
- SWA deployment pipeline — unchanged
- Non-Kite SWA functions — unchanged
