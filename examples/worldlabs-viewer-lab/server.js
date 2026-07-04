import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 3016);
const DIR = path.dirname(fileURLToPath(import.meta.url));

const files = {
  "/": { type: "text/html; charset=utf-8", file: "index.html" },
  "/styles.css": { type: "text/css; charset=utf-8", file: "styles.css" },
};

const server = http.createServer((req, res) => {
  const item = files[req.url || ""];
  if (!item) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }
  const fullPath = path.join(DIR, item.file);
  res.writeHead(200, { "content-type": item.type, "cache-control": "no-store" });
  fs.createReadStream(fullPath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`worldlabs-viewer-lab running at http://localhost:${PORT}`);
});
