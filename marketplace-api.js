const { readFile, writeFile, rename, mkdir } = require("node:fs/promises");
const { join } = require("node:path");
const qr = require("qrcode");

const directory = process.env.EASYFARM_DATA_DIR || join(__dirname, ".easyfarm");
const file = join(directory, "market.json");
const temporary = file + ".tmp";
const {seed,apply}=require("./marketplace-domain.cjs");
let queue = Promise.resolve();

async function read() {
  try {
    const db = JSON.parse(await readFile(file, "utf8"));
    db.history ||= (db.ledger || []).map(({ order, event, at, details }) => ({ order, event, at, details }));
    delete db.ledger;
    return db;
  }
  catch (error) { if (error.code !== "ENOENT") throw error; return structuredClone(seed); }
}
async function save(db) {
  await mkdir(directory, { recursive: true });
  await writeFile(temporary, JSON.stringify(db, null, 2));
  await rename(temporary, file);
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}
async function api(request, response, pathname) {
  try {
    if (request.method === "GET" && pathname === "/api/state") {
      const db = await read();
      return json(response, 200, db);
    }
    if (request.method === "GET" && pathname.startsWith("/api/qr/")) {
      const key = pathname.slice(8);
      if (!(await read()).orders.some(order=>order.id===key)) return json(response,404,{error:"Order was not found."});
      const url = "http://" + request.headers.host + "/app.html?batch=" + encodeURIComponent(key);
      const image = await qr.toBuffer(url, { margin: 2, width: 180 });
      response.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" }).end(image);
      return;
    }
    if (request.method !== "POST" || pathname !== "/api/action") return json(response, 404, { error: "Endpoint not found." });
    if (request.headers.origin && request.headers.origin !== "http://" + request.headers.host) return json(response, 403, { error: "Use the local EasyFarm app." });
    let raw = "";
    for await (const chunk of request) {
      raw += chunk;
      if (raw.length > 12000) return json(response, 413, { error: "Request is too large." });
    }
    let data;
    try { data = JSON.parse(raw); } catch { return json(response, 400, { error: "Invalid request." }); }
    if (!data || typeof data !== "object") return json(response,400,{error:"Invalid request."});
    const action = queue.then(async () => {
      const db = await read();
      const key = apply(db, data);
      await save(db);
      return key;
    });
    queue = action.catch(() => {});
    return json(response, 200, { id: await action });
  } catch (error) {
    if (!error.client) console.error(error);
    return json(response, error.client ? 400 : 500, { error: error.client ? error.message : "Could not save the change. Try again." });
  }
}

module.exports = api;
