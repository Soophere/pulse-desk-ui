# Production UI source

This is the dashboard shell that runs on the desk, served as static files by the desk's private
service under `/static/`. It is included here for reference — it is **not** runnable on its own:

- `v3-core.js` polls the desk API (`/api/status`, `/api/history`, `/api/wallets`, …),
- write actions (`/api/start`, `/api/ban`, `/api/buy`, …) require the `X-Dashboard-Token` header,
- the trading engine and API are private and are not part of this repository.

Open `../index.html` instead for the self-contained interactive demo with invented data.

## Files

| File | Role |
|---|---|
| `v3.html` | shell: sidebar, top bar, page containers, modal |
| `v3.css` | design tokens and layout |
| `v3-core.js` | API client + token state, status poll, formatters, canvas candles and sparklines, action dispatcher, router |
| `v3-pages.js` | renderers for all thirteen pages |

## Deploy sketch

```
scp v3.html v3.css v3-core.js v3-pages.js <host>:/tmp/
ssh <host> "pct push 100 /tmp/v3-pages.js /opt/pulse-desk/dashboard/static/v3-pages.js --perms 0666"
ssh <host> "pct exec 100 -- chown pulse:pulse /opt/pulse-desk/dashboard/static/v3-pages.js"
```

Bump `?v=` in `v3.html` whenever CSS/JS changes, or browsers will serve the old file against the new
HTML.
