// PROTOTYPE helper: static server for this folder. Usage: node serve.mjs
import { createServer } from "http";
import { readFile } from "fs/promises";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".md": "text/plain" };
createServer(async (req, res) => {
  let u = req.url.split("?")[0];
  if (u === "/") u = "/index.html";
  try {
    const data = await readFile(join(ROOT, u));
    res.writeHead(200, { "Content-Type": TYPES[extname(u)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404); res.end("not found"); }
}).listen(8765, "127.0.0.1", () => console.log("Open http://127.0.0.1:8765/?variant=A"));
