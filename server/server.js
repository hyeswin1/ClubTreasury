/**
 * ClubTreasury DAO - Persistent Backend & Indexer Server
 * Provides persistent SQLite/JSON database storage, API endpoints, and static web serving.
 * Zero external dependencies - runs directly on native Node.js!
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "..", "database", "treasury_db.json");
const ROOT_DIR = path.join(__dirname, "..");

// Ensure database directory and file exist
function loadDatabase() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      throw new Error("DB file missing");
    }
    const raw = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to load DB, initializing fallback:", err.message);
    return {
      organizationName: "Inter-College Spring Tech & Cultural Fiesta 2026",
      treasuryBalance: 3.85,
      committedFunds: 0.0,
      contractAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      network: "Ethereum Sepolia (Chain ID: 11155111)",
      programs: [],
      members: [],
      applications: [],
      proposals: [],
      deposits: [],
      transactionLogs: []
    };
  }
}

function saveDatabase(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Failed to save database:", err);
    return false;
  }
}

// MIME types for static serving
const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Set standard CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API Endpoints ---

  if (pathname === "/api/data" && req.method === "GET") {
    const data = loadDatabase();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, data }));
    return;
  }

  if (pathname === "/api/deposit" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const data = loadDatabase();
        const amt = parseFloat(payload.amount);
        if (isNaN(amt) || amt <= 0) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Invalid amount" }));
          return;
        }

        data.treasuryBalance = parseFloat((data.treasuryBalance + amt).toFixed(4));
        const depEntry = {
          id: "dep_" + Date.now(),
          donor: payload.donor || "Anonymous Contributor",
          donorName: payload.donorName || "Community Contributor",
          amount: amt,
          note: payload.note || "General Contribution",
          timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
          txHash: payload.txHash || "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join("")
        };

        data.deposits.unshift(depEntry);
        data.transactionLogs.unshift({
          id: "tx_" + Date.now(),
          type: "DEPOSIT",
          title: payload.note ? `Deposit: ${payload.note}` : "Community Treasury Deposit",
          program: "General Treasury Reserve",
          amount: amt,
          from: depEntry.donor,
          to: "Club Treasury Vault",
          status: "Confirmed",
          txHash: depEntry.txHash,
          timestamp: depEntry.timestamp,
          description: `Public fund deposit of ${amt} SepoliaETH contributed by ${depEntry.donor.slice(0, 10)}...`
        });

        saveDatabase(data);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, deposit: depEntry, newBalance: data.treasuryBalance }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (pathname === "/api/proposal" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const data = loadDatabase();
        const amt = parseFloat(payload.amount);

        // Invariant checks
        if (amt > data.treasuryBalance) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Amount exceeds treasury balance" }));
          return;
        }

        const newId = (data.proposals.length > 0 ? Math.max(...data.proposals.map(p => p.id)) : 0) + 1;
        const durationHours = parseInt(payload.durationHours) || 24;
        const newProposal = {
          id: newId,
          title: payload.title,
          description: payload.description,
          programCategory: payload.programCategory,
          recipient: payload.recipient,
          recipientName: payload.recipientName || ("Vendor (" + payload.recipient.slice(0, 8) + "...)"),
          invoiceNumber: payload.invoiceNumber || ("INV-" + Math.floor(1000 + Math.random()*9000)),
          amount: amt,
          snapshotMembers: data.members.length,
          forVotes: 1,
          againstVotes: 0,
          voters: [payload.proposer],
          executed: false,
          executedAt: null,
          txHash: payload.txHash || null,
          deadline: Date.now() + (durationHours * 3600 * 1000),
          proposer: payload.proposer,
          proposerName: payload.proposerName || "Council Member"
        };

        data.proposals.unshift(newProposal);
        saveDatabase(data);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, proposal: newProposal }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (pathname === "/api/vote" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const data = loadDatabase();
        const prop = data.proposals.find(p => p.id === parseInt(payload.proposalId));
        if (!prop) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Proposal not found" }));
          return;
        }

        const voter = (payload.voter || "").toLowerCase();
        if (prop.voters && prop.voters.map(v => v.toLowerCase()).includes(voter)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Member already voted" }));
          return;
        }

        if (!prop.voters) prop.voters = [];
        prop.voters.push(payload.voter);

        if (payload.support) {
          prop.forVotes++;
        } else {
          prop.againstVotes++;
        }

        saveDatabase(data);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, proposal: prop }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (pathname === "/api/execute" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const data = loadDatabase();
        const prop = data.proposals.find(p => p.id === parseInt(payload.proposalId));
        if (!prop) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Proposal not found" }));
          return;
        }
        if (prop.executed) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Already executed" }));
          return;
        }

        data.treasuryBalance = parseFloat((data.treasuryBalance - prop.amount).toFixed(4));
        prop.executed = true;
        prop.executedAt = new Date().toISOString().replace("T", " ").substring(0, 16);
        prop.txHash = payload.txHash || ("0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join(""));

        // Update club allocation
        const prog = data.programs.find(p => p.club === prop.programCategory || prop.programCategory.includes(p.club));
        if (prog) {
          prog.allocatedAmount = parseFloat((prog.allocatedAmount + prop.amount).toFixed(4));
          prog.status = "Approved & Disbursed";
        }

        // Add to audit logs
        data.transactionLogs.unshift({
          id: "tx_" + Date.now(),
          type: "PAYOUT",
          title: prop.title,
          program: prop.programCategory,
          amount: prop.amount,
          from: "Club Treasury Vault",
          to: prop.recipient,
          recipientName: prop.recipientName,
          invoiceNumber: prop.invoiceNumber,
          approvedBy: `Council Vote (${prop.forVotes} Yes - ${prop.againstVotes} No)`,
          status: "Executed On-Chain",
          txHash: prop.txHash,
          timestamp: prop.executedAt,
          description: `Disbursed directly to vendor address ${prop.recipient.slice(0, 10)}... Invoice: ${prop.invoiceNumber}`
        });

        saveDatabase(data);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, proposal: prop, newBalance: data.treasuryBalance }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (pathname === "/api/apply" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const data = loadDatabase();
        const app = {
          applicant: payload.applicant,
          name: payload.name,
          clubAffiliation: payload.clubAffiliation,
          verificationId: payload.verificationId || ("STU-2026-" + Math.floor(1000 + Math.random()*9000)),
          approvals: 0,
          isApproved: false,
          appliedAt: new Date().toISOString().replace("T", " ").substring(0, 16)
        };
        data.applications.push(app);
        saveDatabase(data);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, application: app }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // --- Static File Serving ---
  let filePath = path.join(ROOT_DIR, pathname === "/" ? "index.html" : pathname);
  
  // Security check: keep inside ROOT_DIR
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log("=================================================");
  console.log(` ClubTreasury DAO Server running at: http://localhost:${PORT}`);
  console.log(` Persistent Database: ${DB_PATH}`);
  console.log("=================================================");
});
