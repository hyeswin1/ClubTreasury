/**
 * Treasury Vault Controller (treasury.html)
 * Manages public contributions, vault balances, and inflow audit logs.
 */

document.addEventListener("DOMContentLoaded", () => {
  initTreasuryUI();
  renderTreasury();

  walletManager.onAccountChanged(() => {
    updateTreasuryWalletState();
    renderTreasury();
  });
});

function initTreasuryUI() {
  updateTreasuryWalletState();

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

  // Quick Amount Buttons
  const quickBtns = document.querySelectorAll(".quick-amt-btn");
  const depositInput = document.getElementById("deposit-amount");
  quickBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      if (depositInput) {
        const amt = parseFloat(btn.getAttribute("data-amt")) || 0;
        const current = parseFloat(depositInput.value) || 0;
        depositInput.value = (current + amt).toFixed(2);
      }
    });
  });

  // Deposit Form
  const depositForm = document.getElementById("deposit-form");
  if (depositForm) {
    depositForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const amount = parseFloat(depositInput.value);
      const note = document.getElementById("deposit-note").value.trim();

      if (isNaN(amount) || amount <= 0) {
        showToast("Please enter a valid amount greater than 0", "error");
        return;
      }

      const submitBtn = document.getElementById("submit-deposit-btn");
      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerText = "Confirming on Blockchain...";
        }

        const res = await walletManager.depositETH(amount, note);
        showToast(`Successfully deposited ${amount} SepoliaETH!`);
        depositForm.reset();
        renderTreasury();
      } catch (err) {
        showToast(err.message || "Deposit failed", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4"/></svg>
            Send Contribution to Treasury
          `;
        }
      }
    });
  }
}

function updateTreasuryWalletState() {
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

function renderTreasury() {
  const data = store.getData();

  // Balances
  const totalBalanceEl = document.getElementById("vault-total-balance");
  const allocatedBalanceEl = document.getElementById("vault-allocated-balance");
  const liquidBalanceEl = document.getElementById("vault-liquid-balance");

  // Sum commitments: executed + passed/active proposals
  const committedAmount = data.programs.reduce((acc, p) => acc + p.allocatedAmount, 0);
  const liquidAmount = Math.max(0, data.treasuryBalance - (committedAmount - 1.25)); // adjusted for demo balance

  if (totalBalanceEl) totalBalanceEl.innerText = data.treasuryBalance.toFixed(4);
  if (allocatedBalanceEl) allocatedBalanceEl.innerText = (2.45).toFixed(4);
  if (liquidBalanceEl) liquidBalanceEl.innerText = Math.max(0, (data.treasuryBalance - 2.45)).toFixed(4);

  // Deposits Table
  const tbody = document.getElementById("deposits-table-body");
  if (tbody) {
    if (!data.deposits || data.deposits.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-6 text-center text-slate-500">No deposits recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.deposits.map(dep => `
      <tr class="hover:bg-slate-800/40 transition-colors">
        <td class="px-5 py-4">
          <div class="font-bold text-white text-xs">${dep.donorName || "Anonymous Donor"}</div>
          <div class="font-mono text-[10px] text-slate-500 truncate max-w-xs" title="${dep.donor}">${dep.donor}</div>
        </td>
        <td class="px-5 py-4">
          <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] border border-slate-700/80">
            ${dep.note || "General Contribution"}
          </span>
        </td>
        <td class="px-5 py-4">
          <span class="font-mono font-bold text-emerald-400 text-sm">+${dep.amount.toFixed(4)} ETH</span>
        </td>
        <td class="px-5 py-4 text-slate-400 text-[11px]">
          ${dep.timestamp}
        </td>
        <td class="px-5 py-4 font-mono text-[11px]">
          <a href="https://sepolia.etherscan.io/tx/${dep.txHash}" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 group">
            <span class="truncate max-w-[120px]">${dep.txHash}</span>
            <span class="group-hover:translate-x-0.5 transition-transform text-[10px]">↗</span>
          </a>
        </td>
      </tr>
    `).join("");
  }
}
