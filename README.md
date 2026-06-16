# Luma Guest Filter

Upload a [Luma](https://lu.ma) guest-list CSV, filter by registration status, ticket type, coupon, and other columns, then preview and download the filtered export. Processing happens entirely in your browser: nothing is uploaded to a server.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ojusave/luma-guest-filter)

## Usage

1. In Luma, open **Manage → Guests → Download CSV**.
2. Open this app and drop the file (or click to browse).
3. Select one or more values in any filter group (e.g. **Going**, **Full-Day | Standard**).
4. Preview matching rows in the table.
5. Click **Download filtered CSV** to save the result.

Filter groups combine with **AND**. Multiple selections within a group combine with **OR**.

## Filters

Standard Luma columns:

- **Registration status**: Going, Pending, Waitlist, Invited, Not Going
- **Check-in status**: Checked in / Not checked in
- **Ticket type**, **Coupon code**, **UTM source**
- Custom registration questions with a small set of answers (auto-detected)

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
