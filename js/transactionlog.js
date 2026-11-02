/**
 * Transaction Logs & Public Audit Controller (transactionlog.html)
 * Manages human-readable audit trail, filtering, searching, and CSV/JSON export.
 */

let activeTypeFilter = "ALL";
let activeCategoryFilter = "ALL";
let searchQuery = "";

document.addEventListener("DOMContentLoaded", () => {
  initTxLogsUI();
  renderTxLogs();

  walletManager.onAccountChanged(() => {
    updateTxLogsWalletState();
    renderTxLogs();
  });
});

function initTxLogsUI() {
  updateTxLogsWalletState();

  // Mode Toggle
  const modeBtn = document.getElementById("mode-toggle-btn");
  if (modeBtn) {
    modeBtn.addEventListener("click", async () => {
      const currentMode = walletManager.mode;
      const targetMode = currentMode === "metamask" ? "simulation" : "metamask";
      try {
        await walletManager.setMode(targetMode);
        showToast(`Switched to ${targetMode === "metamask" ? "MetaMask (Sepolia)" : "Simulation Sandbox"} mode!`);
      } catch (err) {
        showToast(err.message || "Failed to switch mode", "error");
      }
    });
  }

  // Connect Wallet
  const connectBtn = document.getElementById("connect-wallet-btn");
  if (connectBtn) {
    connectBtn.addEventListener("click", async () => {
      try {
        await walletManager.connectMetaMask();
        showToast("Connected to MetaMask on Sepolia!");
      } catch (err) {
        showToast(err.message || "MetaMask connection failed", "error");
      }
    });
  }

  // Mobile Menu
  const mobileBtn = document.getElementById("mobile-menu-btn");
  const mobileNav = document.getElementById("mobile-nav");
  if (mobileBtn && mobileNav) {
    mobileBtn.addEventListener("click", () => {
      mobileNav.classList.toggle("hidden");
    });
  }

  // Simulation Selector
  const simSelect = document.getElementById("sim-account-select");
  if (simSelect) {
    simSelect.innerHTML = SIMULATION_ACCOUNTS.map(acc => `
      <option value="${acc.address}">${acc.name} (${acc.role})</option>
    `).join("");

    simSelect.value = store.getCurrentSimAccount().address;

    simSelect.addEventListener("change", (e) => {
      walletManager.switchSimAccount(e.target.value);
      showToast(`Active persona: ${walletManager.getCurrentUserLabel()}`);
    });
  }

  // Type Filters (ALL, PAYOUT, DEPOSIT)
  const filterBtns = document.querySelectorAll(".filter-btn");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      activeTypeFilter = btn.getAttribute("data-type");
      filterBtns.forEach(b => {
        b.className = "filter-btn px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700";
      });
      btn.className = "filter-btn px-3 py-1.5 rounded-lg bg-cyan-600 text-white font-semibold";
      renderTxLogs();
    });
  });

  // Category Filter Select
  const categorySelect = document.getElementById("category-filter-select");
  if (categorySelect) {
    categorySelect.addEventListener("change", (e) => {
      activeCategoryFilter = e.target.value;
      renderTxLogs();
    });
  }

  // Search Input
  const searchInput = document.getElementById("log-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderTxLogs();
    });
  }

  // Export CSV
  const exportCsvBtn = document.getElementById("export-csv-btn");
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", exportLogsToCSV);
  }

  // Export JSON
  const exportJsonBtn = document.getElementById("export-json-btn");
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener("click", exportLogsToJSON);
  }
}

function updateTxLogsWalletState() {
  const isSim = walletManager.isSimulationMode();
  const banner = document.getElementById("sandbox-banner");
  const modeBtn = document.getElementById("mode-toggle-btn");
  const modeIndicator = document.getElementById("mode-indicator");
  const modeLabel = document.getElementById("mode-label");
  const walletBtnText = document.getElementById("wallet-btn-text");

  if (banner) banner.style.display = isSim ? "block" : "none";

  if (modeBtn && modeIndicator && modeLabel) {
    if (isSim) {
      modeBtn.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-500/30 bg-indigo-500/10 text-indigo-300";
      modeIndicator.className = "w-2 h-2 rounded-full bg-indigo-400 animate-pulse";
      modeLabel.innerText = "Sandbox Mode";
    } else {
      modeBtn.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
      modeIndicator.className = "w-2 h-2 rounded-full bg-emerald-400";
      modeLabel.innerText = "Sepolia Network";
    }
  }

  if (walletBtnText) {
    const acc = walletManager.getCurrentAccount();
    if (isSim) {
      const sim = store.getCurrentSimAccount();
      walletBtnText.innerText = `${sim.name.split(" ")[0]} (${sim.role.split(" ")[0]})`;
    } else if (acc) {
      walletBtnText.innerText = `${acc.slice(0, 6)}...${acc.slice(-4)}`;
    } else {
      walletBtnText.innerText = "Connect MetaMask";
    }
  }

  const simSelect = document.getElementById("sim-account-select");
  if (simSelect && isSim) {
    simSelect.value = walletManager.getCurrentAccount();
  }
}

function renderTxLogs() {
  const data = store.getData();
  const logs = data.transactionLogs || [];

  // Update Summary Stats
  const totalInflows = logs.filter(l => l.type === "DEPOSIT").reduce((s, l) => s + l.amount, 0);
  const totalOutflows = logs.filter(l => l.type === "PAYOUT").reduce((s, l) => s + l.amount, 0);

  const statTotalTxs = document.getElementById("stat-total-txs");
  const statInflows = document.getElementById("stat-total-inflows");
  const statOutflows = document.getElementById("stat-total-outflows");
  const statNet = document.getElementById("stat-net-balance");

  if (statTotalTxs) statTotalTxs.innerText = logs.length;
  if (statInflows) statInflows.innerText = `${totalInflows.toFixed(2)} ETH`;
  if (statOutflows) statOutflows.innerText = `${totalOutflows.toFixed(2)} ETH`;
  if (statNet) statNet.innerText = `${data.treasuryBalance.toFixed(2)} ETH`;

  // Apply Filters
  let filtered = logs.filter(item => {
    // Type filter
    if (activeTypeFilter !== "ALL" && item.type !== activeTypeFilter) {
      return false;
    }

    // Category filter
    if (activeCategoryFilter !== "ALL") {
      if (!item.program || !item.program.toLowerCase().includes(activeCategoryFilter.toLowerCase())) {
        return false;
      }
    }

    // Search query
    if (searchQuery) {
      const combined = `${item.title} ${item.program} ${item.from} ${item.to} ${item.recipientName || ""} ${item.txHash} ${item.description || ""}`.toLowerCase();
      if (!combined.includes(searchQuery)) {
        return false;
      }
    }

    return true;
  });

  const tbody = document.getElementById("tx-logs-table-body");
  const noTxMsg = document.getElementById("no-tx-message");

  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = "";
    if (noTxMsg) noTxMsg.classList.remove("hidden");
    return;
  }

  if (noTxMsg) noTxMsg.classList.add("hidden");

  tbody.innerHTML = filtered.map(tx => {
    const isPayout = tx.type === "PAYOUT";
    const typeBadge = isPayout
      ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">↑ PAYOUT</span>`
      : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">↓ DEPOSIT</span>`;

    const amountDisplay = isPayout
      ? `<span class="font-mono font-bold text-rose-400 text-sm">-${tx.amount.toFixed(4)} ETH</span>`
      : `<span class="font-mono font-bold text-emerald-400 text-sm">+${tx.amount.toFixed(4)} ETH</span>`;

    const governanceTag = tx.approvedBy 
      ? `<span class="px-2 py-0.5 rounded bg-cyan-950/40 text-cyan-300 border border-cyan-800 text-[10px] font-semibold">${tx.approvedBy}</span>`
      : `<span class="text-slate-500 text-[10px]">Open Inflow</span>`;

    return `
      <tr class="hover:bg-slate-800/40 transition-colors">
        <td class="px-5 py-4">
          <div class="flex items-center gap-2">
            ${typeBadge}
            <span class="text-[10px] text-slate-400 font-mono">#${tx.id.replace("tx_", "")}</span>
          </div>
          <div class="text-[10px] text-slate-500 mt-1">${tx.status || "Confirmed"}</div>
        </td>

        <td class="px-5 py-4">
          <div class="font-bold text-white text-xs">${tx.title}</div>
          <div class="text-[11px] text-cyan-400 font-medium">${tx.program || "General Operations"}</div>
          <p class="text-[10px] text-slate-400 mt-0.5 max-w-sm line-clamp-2">${tx.description || ""}</p>
        </td>

        <td class="px-5 py-4 text-xs font-mono">
          <div class="text-slate-400 text-[10px] flex items-center gap-1">
            <span class="text-slate-500">From:</span>
            <span class="truncate max-w-[140px] text-slate-300" title="${tx.from}">${tx.from}</span>
          </div>
          <div class="text-slate-400 text-[10px] flex items-center gap-1 mt-1">
            <span class="text-slate-500">To:</span>
            <span class="truncate max-w-[140px] text-emerald-300 font-semibold" title="${tx.to}">
              ${tx.recipientName || tx.to}
            </span>
          </div>
        </td>

        <td class="px-5 py-4 whitespace-nowrap">
          ${amountDisplay}
        </td>

        <td class="px-5 py-4">
          ${governanceTag}
        </td>

        <td class="px-5 py-4 text-slate-400 text-[11px] whitespace-nowrap">
          ${tx.timestamp}
        </td>

        <td class="px-5 py-4 text-right font-mono text-[11px] whitespace-nowrap">
          <a href="https://sepolia.etherscan.io/tx/${tx.txHash}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 bg-slate-800/80 hover:bg-slate-800 px-2 py-1 rounded border border-slate-700/80">
            <span>${tx.txHash.slice(0, 8)}...</span>
            <span class="text-[10px]">↗</span>
          </a>
        </td>
      </tr>
    `;
  }).join("");
}

function exportLogsToCSV() {
  const data = store.getData();
  const logs = data.transactionLogs || [];
  
  if (logs.length === 0) {
    showToast("No transaction logs to export", "info");
    return;
  }

  const headers = ["ID", "Type", "Title", "Program", "Amount (ETH)", "From", "To", "Governance Resolution", "Timestamp", "Transaction Hash"];
  const rows = logs.map(l => [
    `"${l.id}"`,
    `"${l.type}"`,
    `"${l.title.replace(/"/g, '""')}"`,
    `"${(l.program || "").replace(/"/g, '""')}"`,
    l.amount,
    `"${l.from}"`,
    `"${l.recipientName ? l.recipientName + ' (' + l.to + ')' : l.to}"`,
    `"${(l.approvedBy || "Direct Inflow").replace(/"/g, '""')}"`,
    `"${l.timestamp}"`,
    `"${l.txHash}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `club_treasury_audit_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Exported transaction logs to CSV!");
}

function exportLogsToJSON() {
  const data = store.getData();
  const logs = data.transactionLogs || [];
  
  const jsonString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
  const link = document.createElement("a");
  link.setAttribute("href", jsonString);
  link.setAttribute("download", `club_treasury_audit_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Exported transaction logs to JSON!");
}
