/**
 * Web3 & Simulation Wallet Manager
 * Seamlessly manages MetaMask connection to Sepolia testnet, on-chain event synchronization,
 * and provides instant Simulation Sandbox fallback with persistent database sync.
 */

class WalletManager {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contract = null;
    this.account = null;
    this.networkId = null;
    this.listeners = [];
    this.isMetaMaskAvailable = typeof window !== "undefined" && typeof window.ethereum !== "undefined";

    // Initialize mode
    this.mode = store.getMode();
    if (!this.isMetaMaskAvailable && this.mode === "metamask") {
      this.mode = "simulation";
      store.setMode("simulation");
    }

    if (this.mode === "simulation") {
      this.account = store.getCurrentSimAccount().address;
    } else if (this.isMetaMaskAvailable) {
      this.checkExistingConnection();
    }
  }

  async checkExistingConnection() {
    if (!this.isMetaMaskAvailable) return;
    try {
      this.provider = new ethers.providers.Web3Provider(window.ethereum, "any");
      const accounts = await this.provider.listAccounts();
      if (accounts && accounts.length > 0) {
        this.account = accounts[0];
        this.signer = this.provider.getSigner();
        const network = await this.provider.getNetwork();
        this.networkId = network.chainId;
        const contractAddress = localStorage.getItem(STORAGE_KEYS.CONTRACT_ADDRESS) || DEFAULT_CONTRACT_ADDRESS;
        this.contract = new ethers.Contract(contractAddress, CLUB_TREASURY_ABI, this.signer);
        this.mode = "metamask";
        store.setMode("metamask");
        this._setupMetaMaskListeners();
        this._notifyListeners();
        this.syncOnChainState().catch(() => {});
      }
    } catch (err) {
      console.warn("Silent reconnection check:", err);
    }
  }

  onAccountChanged(callback) {
    this.listeners.push(callback);
  }

  _notifyListeners() {
    this.listeners.forEach(cb => {
      try { cb({ account: this.account, mode: this.mode, isConnected: this.isConnected() }); } catch (e) { console.error(e); }
    });
  }

  isSimulationMode() {
    return this.mode === "simulation";
  }

  isMetaMaskMode() {
    return this.mode === "metamask";
  }

  isConnected() {
    if (this.mode === "simulation") return true;
    return !!this.account;
  }

  getCurrentAccount() {
    if (this.mode === "simulation") {
      return store.getCurrentSimAccount().address;
    }
    return this.account || "";
  }

  getCurrentUserLabel() {
    if (this.mode === "simulation") {
      const sim = store.getCurrentSimAccount();
      return `${sim.name} (${sim.role})`;
    }
    if (!this.account) return "Not Connected";
    const data = store.getData();
    const mem = data.members.find(m => m.address.toLowerCase() === this.account.toLowerCase());
    if (mem) return `${mem.name} (${mem.club})`;
    return `Account: ${this.account.slice(0, 6)}...${this.account.slice(-4)}`;
  }

  async setMode(newMode) {
    if (newMode === "metamask") {
      if (!this.isMetaMaskAvailable) {
        throw new Error("MetaMask extension is not detected in your browser. Install MetaMask or run in Simulation Sandbox!");
      }
      this.mode = "metamask";
      store.setMode("metamask");
      await this.connectMetaMask();
    } else {
      this.mode = "simulation";
      store.setMode("simulation");
      this.account = store.getCurrentSimAccount().address;
      this._notifyListeners();
    }
  }

  switchSimAccount(address) {
    if (this.mode !== "simulation") return;
    store.setCurrentSimAccount(address);
    this.account = address;
    this._notifyListeners();
  }

  async connectMetaMask() {
    if (!this.isMetaMaskAvailable) {
      throw new Error("MetaMask extension is not detected in your browser.");
    }

    try {
      this.provider = new ethers.providers.Web3Provider(window.ethereum, "any");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      
      if (accounts && accounts.length > 0) {
        this.account = accounts[0];
        this.signer = this.provider.getSigner();

        const network = await this.provider.getNetwork();
        this.networkId = network.chainId;
        
        if (network.chainId !== SEPOLIA_CHAIN_ID_DECIMAL) {
          await this.promptSwitchSepolia();
        }

        const contractAddress = localStorage.getItem(STORAGE_KEYS.CONTRACT_ADDRESS) || DEFAULT_CONTRACT_ADDRESS;
        this.contract = new ethers.Contract(contractAddress, CLUB_TREASURY_ABI, this.signer);

        this.mode = "metamask";
        store.setMode("metamask");
        this._setupMetaMaskListeners();
        this._notifyListeners();
        
        // Live on-chain sync
        this.syncOnChainState().catch(() => {});
        return this.account;
      }
    } catch (err) {
      console.error("MetaMask connection error:", err);
      throw err;
    }
  }

  async promptSwitchSepolia() {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (switchError) {
      if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: SEPOLIA_CHAIN_ID,
                chainName: "Sepolia Test Network",
                rpcUrls: ["https://rpc.sepolia.org", "https://ethereum-sepolia-rpc.publicnode.com"],
                nativeCurrency: { name: "SepoliaETH", symbol: "SEP", decimals: 18 },
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
        } catch (addError) {
          console.error("Failed to add Sepolia network", addError);
          throw addError;
        }
      } else {
        throw switchError;
      }
    }
  }

  _setupMetaMaskListeners() {
    if (!window.ethereum) return;
    
    window.ethereum.on("accountsChanged", (accounts) => {
      if (accounts.length > 0) {
        this.account = accounts[0];
        if (this.provider) {
          this.signer = this.provider.getSigner();
          const contractAddress = localStorage.getItem(STORAGE_KEYS.CONTRACT_ADDRESS) || DEFAULT_CONTRACT_ADDRESS;
          this.contract = new ethers.Contract(contractAddress, CLUB_TREASURY_ABI, this.signer);
        }
      } else {
        this.account = null;
        this.signer = null;
      }
      this._notifyListeners();
    });

    window.ethereum.on("chainChanged", () => {
      window.location.reload();
    });
  }

  // --- Real-World On-Chain Sync ---
  async syncOnChainState() {
    if (!this.contract || !this.provider) return;
    try {
      const onChainBalanceWei = await this.contract.getTreasuryBalance();
      const onChainBalanceEth = parseFloat(ethers.utils.formatEther(onChainBalanceWei));
      
      const data = store.getData();
      data.treasuryBalance = onChainBalanceEth;
      
      // Check total proposals on-chain
      const totalProps = await this.contract.getTotalProposals();
      const propCount = totalProps.toNumber ? totalProps.toNumber() : parseInt(totalProps.toString());
      
      for (let i = 1; i <= propCount; i++) {
        try {
          const propData = await this.contract.proposals(i);
          const existing = data.proposals.find(p => p.id === i);
          if (existing) {
            existing.forVotes = propData.forVotes.toNumber();
            existing.againstVotes = propData.againstVotes.toNumber();
            existing.executed = propData.executed;
          }
        } catch (e) {
          console.warn(`Could not sync proposal #${i}:`, e);
        }
      }

      store.saveData(data);
      console.log(`Synced on-chain state: Treasury Balance = ${onChainBalanceEth} SepoliaETH`);
    } catch (err) {
      console.warn("On-chain sync deferred:", err.message);
    }
  }

  // --- High Level Action Wrappers ---

  async depositETH(amount, note) {
    if (this.mode === "metamask" && this.contract) {
      try {
        const val = ethers.utils.parseEther(amount.toString());
        const tx = await this.contract.contribute(note || "Community Contribution", { value: val });
        showToast("Transaction submitted to Sepolia! Waiting for block confirmation...", "info");
        const receipt = await tx.wait();
        
        store.addContribution(this.account, "MetaMask Contributor", amount, note, receipt.transactionHash);
        return { success: true, txHash: receipt.transactionHash };
      } catch (err) {
        console.error("MetaMask Deposit Error:", err);
        throw err;
      }
    } else {
      const user = store.getCurrentSimAccount();
      const deposit = store.addContribution(user.address, user.name, amount, note);
      return { success: true, txHash: deposit.txHash };
    }
  }

  async createProposal(title, description, programCategory, recipient, amount, durationHours, invoiceNumber) {
    if (this.mode === "metamask" && this.contract) {
      try {
        const val = ethers.utils.parseEther(amount.toString());
        const durationSeconds = (durationHours || 24) * 3600;
        const tx = await this.contract.createProposal(
          title,
          description,
          programCategory,
          recipient,
          val,
          durationSeconds
        );
        showToast("Proposal transaction submitted! Waiting for confirmation...", "info");
        const receipt = await tx.wait();

        const prop = store.createProposal(this.account, title, description, programCategory, recipient, amount, durationHours, invoiceNumber);
        prop.txHash = receipt.transactionHash;
        return { success: true, txHash: receipt.transactionHash, proposal: prop };
      } catch (err) {
        console.error("MetaMask Proposal Error:", err);
        throw err;
      }
    } else {
      const user = store.getCurrentSimAccount();
      const prop = store.createProposal(user.address, title, description, programCategory, recipient, amount, durationHours, invoiceNumber);
      return { success: true, proposal: prop };
    }
  }

  async voteProposal(proposalId, support) {
    if (this.mode === "metamask" && this.contract) {
      try {
        const tx = await this.contract.vote(proposalId, support);
        showToast("Vote submitted! Waiting for Sepolia confirmation...", "info");
        const receipt = await tx.wait();
        store.castVote(proposalId, this.account, support);
        return { success: true, txHash: receipt.transactionHash };
      } catch (err) {
        console.error("MetaMask Vote Error:", err);
        throw err;
      }
    } else {
      const user = store.getCurrentSimAccount();
      const prop = store.castVote(proposalId, user.address, support);
      return { success: true, proposal: prop };
    }
  }

  async executeProposal(proposalId) {
    if (this.mode === "metamask" && this.contract) {
      try {
        const tx = await this.contract.executeProposal(proposalId);
        showToast("Execution submitted! Payout transferring to vendor on Sepolia...", "info");
        const receipt = await tx.wait();
        const prop = store.executeProposal(proposalId, this.account, receipt.transactionHash);
        return { success: true, txHash: receipt.transactionHash, proposal: prop };
      } catch (err) {
        console.error("MetaMask Execution Error:", err);
        throw err;
      }
    } else {
      const user = store.getCurrentSimAccount();
      const prop = store.executeProposal(proposalId, user.address);
      return { success: true, proposal: prop, txHash: prop.txHash };
    }
  }

  async registerMember(address, name, club, verificationId) {
    if (this.mode === "metamask" && this.contract) {
      try {
        const tx = await this.contract.registerMember(
          address,
          name,
          club,
          verificationId || ("STU-2026-" + Math.floor(1000 + Math.random()*9000))
        );
        showToast("Membership transaction submitted! Waiting for confirmation...", "info");
        const receipt = await tx.wait();
        store.registerMember(address, name, club, verificationId);
        return { success: true, txHash: receipt.transactionHash };
      } catch (err) {
        console.error("MetaMask Member Registration Error:", err);
        throw err;
      }
    } else {
      const mem = store.registerMember(address, name, club, verificationId);
      return { success: true, member: mem };
    }
  }
}

// Global Wallet Manager Instance
const walletManager = new WalletManager();

// Global Toast Notification Helper
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  const bg = type === "success" ? "bg-emerald-600" : type === "error" ? "bg-rose-600" : "bg-indigo-600";
  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";

  toast.className = `${bg} text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium transition-all transform duration-300 translate-y-2 opacity-0 max-w-md pointer-events-auto`;
  toast.innerHTML = `
    <span class="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs shrink-0">${icon}</span>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-2", "opacity-0");
  });

  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => toast.remove(), 300);
  }, 4200);
}
