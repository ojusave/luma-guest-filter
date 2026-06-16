# Luma Guest Filter

Upload any Luma guest-list CSV. Filters are auto-generated from whatever columns your export contains (status, tickets, coupons, custom registration questions, etc.), then preview and download the filtered export. Processing happens entirely in the browser.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ojusave/luma-guest-filter)

## Usage

1. In Luma, open **Manage → Guests → Download CSV**.
2. Open this app and drop the file (or click to browse).
3. Select one or more values in any filter group (e.g. **Going**, **Full-Day | Standard**).
4. Preview matching rows in the table.
5. Click **Download filtered CSV** to save the result.

Filter groups combine with **AND**. Multiple selections within a group combine with **OR**.

## Filters

The app inspects your CSV and creates filter groups for columns that look filterable:

- **Always when present:** registration status (`approval_status`), check-in/join columns, ticket type, coupon, source fields
- **Auto-detected:** any other column with a small set of distinct values (custom registration questions, payment tiers, etc.)
- **Skipped:** high-cardinality fields like email, names, URLs, IDs, and long free-text answers

Known Luma status values are shown with friendly labels (Going, Pending, Not Going, etc.) when they appear in the file.

## Deploy on Render

Connect this repo as a **Blueprint** or use the Deploy button above. Render runs a single Node web service (`npm install` → `npm start`).

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Set automatically on Render |
| `NODE_ENV` | `production` | Production mode |

No API keys or database required.

## Local development

```bash
npm install
npm start
```

Open http://localhost:3000

## License

MIT
