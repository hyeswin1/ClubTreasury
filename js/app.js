/**
 * Main Application Controller (index.html)
 * Manages dashboard metrics, student programs breakdown, proposal governance, and voting execution.
 */

document.addEventListener("DOMContentLoaded", () => {
  initUI();
  renderAll();

  // Listen for wallet/account changes
  walletManager.onAccountChanged(() => {
    updateWalletState();
    renderAll();
  });
});

function initUI() {
  updateWalletState();

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

  // Wallet Connect Button
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

  // Mobile menu toggle
  const mobileBtn = document.getElementById("mobile-menu-btn");
  const mobileNav = document.getElementById("mobile-nav");
  if (mobileBtn && mobileNav) {
    mobileBtn.addEventListener("click", () => {
      mobileNav.classList.toggle("hidden");
    });
  }

  // Sandbox Persona Selector
  const simSelect = document.getElementById("sim-account-select");
  if (simSelect) {
    simSelect.innerHTML = SIMULATION_ACCOUNTS.map(acc => `
      <option value="${acc.address}">${acc.name} (${acc.role})</option>
    `).join("");

    const currentAddr = store.getCurrentSimAccount().address;
    simSelect.value = currentAddr;

    simSelect.addEventListener("change", (e) => {
      walletManager.switchSimAccount(e.target.value);
      showToast(`Switched active persona to ${walletManager.getCurrentUserLabel()}`);
    });
  }

  // Reset Demo Button
  const resetBtn = document.getElementById("reset-demo-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Reset all festival proposals, treasury balances, and transaction logs to initial sample data?")) {
        store.resetToDefault();
        showToast("Restored initial Spring Fiesta 2026 data!");
        renderAll();
      }
    });
  }

  // Proposal Modal Events
  const openPropModalBtn = document.getElementById("open-proposal-modal-btn");
  const closePropModalBtn = document.getElementById("close-proposal-modal-btn");
  const cancelPropBtn = document.getElementById("cancel-proposal-btn");
  const propModal = document.getElementById("proposal-modal");

  if (openPropModalBtn && propModal) {
    openPropModalBtn.addEventListener("click", () => propModal.classList.remove("hidden"), propModal.classList.add("flex"));
  }
  const closePropModal = () => {
    if (propModal) {
      propModal.classList.add("hidden");
      propModal.classList.remove("flex");
    }
  };
  if (closePropModalBtn) closePropModalBtn.addEventListener("click", closePropModal);
  if (cancelPropBtn) cancelPropBtn.addEventListener("click", closePropModal);

  // Proposal Form Submission
  const propForm = document.getElementById("proposal-form");
  if (propForm) {
    propForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = document.getElementById("prop-title").value.trim();
      const category = document.getElementById("prop-category").value;
      const description = document.getElementById("prop-description").value.trim();
      const invoiceNumber = (document.getElementById("prop-invoice")?.value || "").trim();
      const amount = parseFloat(document.getElementById("prop-amount").value);
      const durationHours = parseInt(document.getElementById("prop-duration").value);
      const recipient = document.getElementById("prop-recipient").value.trim();

      if (!title || !description || isNaN(amount) || !recipient) {
        showToast("Please fill in all required fields", "error");
        return;
      }

      try {
        const submitBtn = document.getElementById("submit-proposal-btn");
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerText = "Submitting...";
        }

        const res = await walletManager.createProposal(title, description, category, recipient, amount, durationHours, invoiceNumber);
        showToast(`Proposal created successfully! (ID: #${res.proposal ? res.proposal.id : "Submitted"})`);
        propForm.reset();
        closePropModal();
        renderAll();
      } catch (err) {
        showToast(err.message || "Failed to submit proposal", "error");
      } finally {
        const submitBtn = document.getElementById("submit-proposal-btn");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = "Submit Proposal";
        }
      }
    });
  }

  // Member Modal Events
  const openMemModalBtn = document.getElementById("open-member-modal-btn");
  const closeMemModalBtn = document.getElementById("close-member-modal-btn");
  const cancelMemBtn = document.getElementById("cancel-member-btn");
  const memModal = document.getElementById("member-modal");

  if (openMemModalBtn && memModal) {
    openMemModalBtn.addEventListener("click", () => memModal.classList.remove("hidden"), memModal.classList.add("flex"));
  }
  const closeMemModal = () => {
    if (memModal) {
      memModal.classList.add("hidden");
      memModal.classList.remove("flex");
    }
  };
  if (closeMemModalBtn) closeMemModalBtn.addEventListener("click", closeMemModal);
  if (cancelMemBtn) cancelMemBtn.addEventListener("click", closeMemModal);

  const memForm = document.getElementById("member-form");
  if (memForm) {
    memForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("member-name").value.trim();
      const club = document.getElementById("member-club").value.trim();
      const verificationId = (document.getElementById("member-id")?.value || "").trim();
      const address = document.getElementById("member-address").value.trim();

      if (!name || !club || !address) {
        showToast("Please fill in all fields", "error");
        return;
      }

      try {
        await walletManager.registerMember(address, name, club, verificationId);
        showToast(`Registered member: ${name} (${club})`);
        memForm.reset();
        closeMemModal();
        renderAll();
      } catch (err) {
        showToast(err.message || "Failed to register member", "error");
      }
    });
  }

  // Filter Proposals
  setupProposalFilters();
}

function updateWalletState() {
  const isSim = walletManager.isSimulationMode();
  const banner = document.getElementById("sandbox-banner");
  const modeBtn = document.getElementById("mode-toggle-btn");
  const modeIndicator = document.getElementById("mode-indicator");
  const modeLabel = document.getElementById("mode-label");
  const walletBtnText = document.getElementById("wallet-btn-text");

  if (banner) {
    banner.style.display = isSim ? "block" : "none";
  }

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

function renderAll() {
  const data = store.getData();
  renderMetrics(data);
  renderPrograms(data);
  renderProposals(data);
}

function renderMetrics(data) {
  const vaultBal = document.getElementById("metric-vault-balance");
  const disbursedBal = document.getElementById("metric-total-disbursed");
  const progCount = document.getElementById("metric-programs-count");
  const memCount = document.getElementById("metric-members-count");

  // Calculate total disbursed from executed proposals
  const totalDisbursed = data.proposals
    .filter(p => p.executed)
    .reduce((acc, p) => acc + p.amount, 0);

  if (vaultBal) vaultBal.innerText = data.treasuryBalance.toFixed(4);
  if (disbursedBal) disbursedBal.innerText = totalDisbursed.toFixed(4);
  if (progCount) progCount.innerText = data.programs.length;
  if (memCount) memCount.innerText = data.members.length;
}

function renderPrograms(data) {
  const container = document.getElementById("programs-grid");
  if (!container) return;

  container.innerHTML = data.programs.map(prog => {
    const pct = Math.min(100, Math.round((prog.allocatedAmount / prog.estimatedBudget) * 100));
    const statusColor = prog.status.includes("Approved") 
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
      : "bg-amber-500/20 text-amber-300 border-amber-500/30";

    const itemsHtml = prog.breakdown.map(item => `
      <div class="flex items-center justify-between text-[11px] text-slate-300 py-1 border-b border-slate-800/80 last:border-b-0">
        <span class="truncate pr-2">${item.item}</span>
        <span class="font-mono font-medium text-slate-400 shrink-0">${item.cost} ETH</span>
      </div>
    `).join("");

    return `
      <div class="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">${prog.avatar}</span>
            <div>
              <h3 class="font-bold text-white text-sm leading-tight">${prog.club}</h3>
              <p class="text-[10px] text-slate-400">Lead: ${prog.lead}</p>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusColor}">
            ${prog.status}
          </span>
        </div>

        <div>
          <h4 class="text-xs font-semibold text-slate-200 line-clamp-1">${prog.title}</h4>
          
          <!-- Progress bar -->
          <div class="mt-2 space-y-1">
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-slate-400">Budget Funded</span>
              <span class="font-bold text-emerald-400">${prog.allocatedAmount.toFixed(2)} / ${prog.estimatedBudget.toFixed(2)} ETH (${pct}%)</span>
            </div>
            <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div class="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
            </div>
          </div>
        </div>

        <!-- Expense items breakdown -->
        <div class="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Itemized Expense Estimate:</span>
          <div class="space-y-0.5">
            ${itemsHtml}
          </div>
        </div>

        <button onclick="prefillProposalModal('${prog.club}', '${prog.title}', ${(prog.estimatedBudget - prog.allocatedAmount).toFixed(2)})" class="w-full py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700/60 transition-colors">
          Request Program Funding →
        </button>
      </div>
    `;
  }).join("");
}

// Prefill helper when clicking "Request Program Funding"
window.prefillProposalModal = function(club, title, remainingAmt) {
  const modal = document.getElementById("proposal-modal");
  const propCategory = document.getElementById("prop-category");
  const propTitle = document.getElementById("prop-title");
  const propAmount = document.getElementById("prop-amount");
  const propDesc = document.getElementById("prop-description");

  if (modal) modal.classList.remove("hidden"), modal.classList.add("flex");
  if (propCategory) propCategory.value = club;
  if (propTitle) propTitle.value = `Funding for ${title}`;
  if (propAmount) propAmount.value = Math.max(0.01, parseFloat(remainingAmt) || 0.1);
  if (propDesc) propDesc.value = `Disbursement for ${club} program requirements during Spring Fiesta 2026.`;
};

let currentProposalFilter = "ALL";

function setupProposalFilters() {
  const btnAll = document.getElementById("filter-all-proposals");
  const btnActive = document.getElementById("filter-active-proposals");
  const btnExecuted = document.getElementById("filter-executed-proposals");

  const setFilter = (filter, activeBtn) => {
    currentProposalFilter = filter;
    [btnAll, btnActive, btnExecuted].forEach(b => {
      if (b) {
        b.className = "px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700";
      }
    });
    if (activeBtn) {
      activeBtn.className = "px-3 py-1 rounded-lg text-xs font-medium bg-emerald-600 text-white font-semibold";
    }
    renderProposals(store.getData());
  };

  if (btnAll) btnAll.addEventListener("click", () => setFilter("ALL", btnAll));
  if (btnActive) btnActive.addEventListener("click", () => setFilter("ACTIVE", btnActive));
  if (btnExecuted) btnExecuted.addEventListener("click", () => setFilter("EXECUTED", btnExecuted));
}

function renderProposals(data) {
  const container = document.getElementById("proposals-list");
  if (!container) return;

  let proposals = [...data.proposals];

  if (currentProposalFilter === "ACTIVE") {
    proposals = proposals.filter(p => !p.executed);
  } else if (currentProposalFilter === "EXECUTED") {
    proposals = proposals.filter(p => p.executed);
  }

  if (proposals.length === 0) {
    container.innerHTML = `
      <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-sm">
        No proposals found for the current filter.
      </div>
    `;
    return;
  }

  const currentAccount = walletManager.getCurrentAccount().toLowerCase();
  const totalMembers = data.members.length;
  const quorumRequired = Math.max(1, Math.floor((totalMembers * 30) / 100)); // 30%

  container.innerHTML = proposals.map(prop => {
    const totalVotes = prop.forVotes + prop.againstVotes;
    const hasVoted = prop.voters && prop.voters.map(v => v.toLowerCase()).includes(currentAccount);
    const forPct = totalVotes > 0 ? Math.round((prop.forVotes / totalVotes) * 100) : 0;
    const againstPct = totalVotes > 0 ? 100 - forPct : 0;
    const quorumReached = totalVotes >= quorumRequired;
    const isApproved = prop.forVotes > prop.againstVotes;

    let statusBadge = "";
    if (prop.executed) {
      statusBadge = `<span class="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">✓ Executed On-Chain</span>`;
    } else if (quorumReached && isApproved) {
      statusBadge = `<span class="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold animate-pulse">● Passed (Ready to Disburse)</span>`;
    } else {
      statusBadge = `<span class="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">● Active Voting</span>`;
    }

    return `
      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl hover:border-slate-700/80 transition-all">
        
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-800">
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-mono font-bold text-slate-400">#${prop.id}</span>
              <span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-semibold border border-slate-700">${prop.programCategory}</span>
              ${prop.invoiceNumber ? `<span class="px-2 py-0.5 rounded-md bg-cyan-950/60 text-cyan-300 text-[10px] font-mono border border-cyan-800">Doc: ${prop.invoiceNumber}</span>` : ''}
              ${statusBadge}
            </div>
            <h3 class="text-lg font-bold text-white">${prop.title}</h3>
            <p class="text-xs text-slate-300 leading-relaxed">${prop.description}</p>
          </div>

          <div class="sm:text-right shrink-0">
            <span class="text-2xl font-black text-white">${prop.amount.toFixed(4)}</span>
            <span class="text-xs font-bold text-emerald-400 block">SepoliaETH</span>
          </div>
        </div>

        <!-- Details Info Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60">
          <div>
            <span class="text-slate-500 block text-[10px] uppercase font-semibold">Proposer</span>
            <span class="text-slate-200 font-medium">${prop.proposerName}</span>
          </div>
          <div>
            <span class="text-slate-500 block text-[10px] uppercase font-semibold">Vendor Recipient</span>
            <span class="text-slate-200 font-mono text-[11px] truncate block" title="${prop.recipient}">
              ${prop.recipientName || prop.recipient.slice(0, 10) + '...'}
            </span>
          </div>
          <div>
            <span class="text-slate-500 block text-[10px] uppercase font-semibold">Quorum & Margin</span>
            <span class="text-slate-200 font-medium">
              ${totalVotes}/${quorumRequired} votes (${quorumReached ? "Quorum Met" : "Awaiting Quorum"})
            </span>
          </div>
        </div>

        <!-- Voting Progress Bar -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs font-semibold">
            <span class="text-emerald-400">Yes: ${prop.forVotes} (${forPct}%)</span>
            <span class="text-rose-400">No: ${prop.againstVotes} (${againstPct}%)</span>
          </div>
          <div class="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
            <div class="bg-emerald-500 h-2.5 transition-all duration-300" style="width: ${forPct}%"></div>
            <div class="bg-rose-500 h-2.5 transition-all duration-300" style="width: ${againstPct}%"></div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
          
          <!-- Voter Status Note -->
          <div class="text-xs text-slate-400">
            ${hasVoted ? '<span class="text-emerald-400 font-semibold">✓ You have voted on this proposal</span>' : '<span class="text-slate-400">You have not voted yet</span>'}
          </div>

          <!-- Buttons Group -->
          <div class="flex items-center gap-2">
            ${!prop.executed ? `
              <button onclick="handleVote(${prop.id}, true)" ${hasVoted ? "disabled" : ""} class="px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                Vote Yes 👍
              </button>
              <button onclick="handleVote(${prop.id}, false)" ${hasVoted ? "disabled" : ""} class="px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                Vote No 👎
              </button>
            ` : ""}

            ${!prop.executed && isApproved && quorumReached ? `
              <button onclick="handleExecute(${prop.id})" class="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 active:scale-95 transition-all flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                Disburse Payout to Vendor
              </button>
            ` : ""}

            ${prop.executed ? `
              <a href="transactionlog.html" class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold transition-colors">
                View Tx Log ↗
              </a>
            ` : ""}
          </div>

        </div>

      </div>
    `;
  }).join("");
}

// Global actions called from inline button onclicks
window.handleVote = async function(proposalId, support) {
  try {
    await walletManager.voteProposal(proposalId, support);
    showToast(`Voted ${support ? "Yes" : "No"} on Proposal #${proposalId}!`);
    renderAll();
  } catch (err) {
    showToast(err.message || "Failed to submit vote", "error");
  }
};

window.handleExecute = async function(proposalId) {
  try {
    const res = await walletManager.executeProposal(proposalId);
    showToast(`Proposal #${proposalId} executed! Funds sent directly to vendor.`);
    renderAll();
  } catch (err) {
    showToast(err.message || "Execution failed", "error");
  }
};
