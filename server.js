const compression = require("compression");
const express = require("express");
const path = require("path");

const app = express();
const port = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, "public");

app.use(compression());
app.use(express.static(publicDir, { maxAge: process.env.NODE_ENV === "production" ? "1h" : 0 }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`luma-guest-filter listening on port ${port}`);
});
