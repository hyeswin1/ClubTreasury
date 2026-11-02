/**
 * Central State Store with Persistent Database Sync & LocalStorage Fallback
 * Connects to the Node.js backend database (database/treasury_db.json) for cross-device persistence,
 * with resilient offline caching in localStorage.
 */

const STORAGE_KEYS = {
  TREASURY_DATA: "club_treasury_data_v3",
  APP_MODE: "club_treasury_mode", // "metamask" or "simulation"
  CURRENT_ACCOUNT: "club_treasury_current_account",
  CONTRACT_ADDRESS: "club_treasury_contract_address",
};

// Initial Seed Data for offline fallback
const DEFAULT_SEED_DATA = {
  organizationName: "Inter-College Spring Tech & Cultural Fiesta 2026",
  treasuryBalance: 3.85,
  committedFunds: 0.0,
  contractAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  
  programs: [
    {
      id: "prog_robotics",
      club: "Robotics & Hardware Club",
      lead: "Priya Sharma",
      avatar: "🤖",
      title: "Autonomous Maze Bot & Robo-Wars Arena",
      estimatedBudget: 0.45,
      allocatedAmount: 0.45,
      status: "Approved",
      color: "blue",
      breakdown: [
        { item: "Arena Acrylic & Plywood Flooring", cost: 0.18 },
        { item: "Arduino Mega & Ultrasonic Sensors Pack", cost: 0.15 },
        { item: "LiPo Batteries & Motor Drivers", cost: 0.12 }
      ]
    },
    {
      id: "prog_coding",
      club: "Coding & AI Society",
      lead: "Kavya Patel",
      avatar: "💻",
      title: "24-Hour AI Innovation Hackathon",
      estimatedBudget: 0.60,
      allocatedAmount: 0.60,
      status: "In Review",
      color: "indigo",
      breakdown: [
        { item: "Cloud GPU Compute Credits (A100 instances)", cost: 0.30 },
        { item: "Winner Prize Pool (1st & 2nd place)", cost: 0.20 },
        { item: "Participant Swag & Git Badges", cost: 0.10 }
      ]
    },
    {
      id: "prog_cultural",
      club: "Cultural & Performing Arts Guild",
      lead: "Rohan Verma",
      avatar: "🎭",
      title: "Mainstage Acoustic & Dramatic Musical",
      estimatedBudget: 0.80,
      allocatedAmount: 0.80,
      status: "Approved",
      color: "purple",
      breakdown: [
        { item: "Dual 10kW Line Array Speakers & Mixer Rental", cost: 0.45 },
        { item: "Stage Ambient Par-LED Lighting Rig", cost: 0.20 },
        { item: "Wireless Sennheiser Vocal Mics (Set of 6)", cost: 0.15 }
      ]
    },
    {
      id: "prog_media",
      club: "Design & Media Collective",
      lead: "Ananya Gupta",
      avatar: "🎨",
      title: "Campus Live Broadcast & Stage Branding",
      estimatedBudget: 0.25,
      allocatedAmount: 0.25,
      status: "Approved",
      color: "amber",
      breakdown: [
        { item: "HDMI 4K Capture Cards & Cabling", cost: 0.12 },
        { item: "Eco-Friendly Recycled Stage Banners", cost: 0.08 },
        { item: "Live Stream CDN & Twitch Overlays", cost: 0.05 }
      ]
    },
    {
      id: "prog_esports",
      club: "Sports & E-Sports Council",
      lead: "Tanmay Sen",
      avatar: "🏆",
      title: "Campus Valorant & Chess Blitz Tournament",
      estimatedBudget: 0.35,
      allocatedAmount: 0.00,
      status: "Pending Vote",
      color: "emerald",
      breakdown: [
        { item: "Custom Laser-Engraved Championship Trophies", cost: 0.15 },
        { item: "Low-Latency Gigabit Switch Hubs", cost: 0.10 },
        { item: "Certified Referee Stipend", cost: 0.10 }
      ]
    }
  ],

  members: [
    {
      address: "0xAlex89B1cD5e342Eaa99757f4955bFc31cDb21A7",
      name: "Alex Chen",
      club: "Student Council Treasury Rep",
      role: "Deployer / Council Rep",
      verificationId: "STU-2026-CH-0192",
      isVerified: true,
      joinedAt: "2026-10-15"
    },
    {
      address: "0xPriya3C73f06922D96aD13E72a81878d65C4F7Eb",
      name: "Priya Sharma",
      club: "Robotics Club Lead",
      role: "Club Representative",
      verificationId: "STU-2026-ROBO-4819",
      isVerified: true,
      joinedAt: "2026-10-16"
    },
    {
      address: "0xRohan7398b671A65E68e27c191a613C3f848cAfF0",
      name: "Rohan Verma",
      club: "Cultural Guild Lead",
      role: "Club Representative",
      verificationId: "STU-2026-ARTS-8391",
      isVerified: true,
      joinedAt: "2026-10-16"
    },
    {
      address: "0xKavya9F2A197eCdCc18bB357F322dE9C168e3195",
      name: "Kavya Patel",
      club: "Coding & AI Lead",
      role: "Club Representative",
      verificationId: "STU-2026-CS-9921",
      isVerified: true,
      joinedAt: "2026-10-17"
    },
    {
      address: "0xTanmay5D256AcFF2f7d98305E067Ac24B48Db5D29",
      name: "Tanmay Sen",
      club: "Sports Council Lead",
      role: "Club Representative",
      verificationId: "STU-2026-SPORTS-1120",
      isVerified: true,
      joinedAt: "2026-10-18"
    }
  ],

  applications: [
    {
      applicant: "0xMayaLin920194820194820194820194820194820",
      name: "Maya Lin",
      clubAffiliation: "Photography & Film Guild",
      verificationId: "STU-2026-MEDIA-4412",
      approvals: 1,
      isApproved: false,
      appliedAt: "2026-10-29 11:20"
    }
  ],

  proposals: [
    {
      id: 1,
      title: "Acoustic Audio Consoles & Stage Rig",
      description: "Direct rental contract with SoundCraft Event Audio for 3-day outdoor line array speakers and stage monitor consoles.",
      programCategory: "Cultural & Performing Arts Guild",
      recipient: "0xVendorAudio9948271BcDe93847291a84f32981bcde",
      recipientName: "SoundCraft Audio Services Ltd.",
      invoiceNumber: "INV-SND-2026-904",
      amount: 0.80,
      snapshotMembers: 4,
      forVotes: 4,
      againstVotes: 0,
      voters: [
        "0xAlex89B1cD5e342Eaa99757f4955bFc31cDb21A7",
        "0xPriya3C73f06922D96aD13E72a81878d65C4F7Eb",
        "0xRohan7398b671A65E68e27c191a613C3f848cAfF0",
        "0xKavya9F2A197eCdCc18bB357F322dE9C168e3195"
      ],
      executed: true,
      executedAt: "2026-10-24 16:30",
      txHash: "0x78ab29c4de8390bca235492193eab908321049281a8c9b98d2491a384f932840",
      deadline: 1792842000,
      proposer: "0xRohan7398b671A65E68e27c191a613C3f848cAfF0",
      proposerName: "Rohan Verma"
    },
    {
      id: 2,
      title: "Robo-Wars Combat Arena Plyboards & Sensor Kits",
      description: "Bulk purchase of bulletproof polycarbonate barriers, steel framing, Arduino Mega boards, and ultrasonic collision sensors.",
      programCategory: "Robotics & Hardware Club",
      recipient: "0xVendorRoboTech849201948201a93840291a829104",
      recipientName: "RoboSupply Direct Tech",
      invoiceNumber: "INV-ROBO-8819",
      amount: 0.45,
      snapshotMembers: 4,
      forVotes: 3,
      againstVotes: 1,
      voters: [
        "0xAlex89B1cD5e342Eaa99757f4955bFc31cDb21A7",
        "0xPriya3C73f06922D96aD13E72a81878d65C4F7Eb",
        "0xTanmay5D256AcFF2f7d98305E067Ac24B48Db5D29"
      ],
      executed: true,
      executedAt: "2026-10-27 11:15",
      txHash: "0x12fc9908da4721950aaee7651034f7b2c93841a0846201bcf9128038f884917a",
      deadline: 1793101200,
      proposer: "0xPriya3C73f06922D96aD13E72a81878d65C4F7Eb",
      proposerName: "Priya Sharma"
    },
    {
      id: 3,
      title: "AI Hackathon Cloud GPU Cluster Vouchers",
      description: "Allocating compute vouchers for 25 student teams training open-weight LLMs and computer vision models on LambdaLabs.",
      programCategory: "Coding & AI Society",
      recipient: "0xCloudCreditsGPU492019482910482910395820",
      recipientName: "Lambda Cloud GPU Services",
      invoiceNumber: "QTE-LAMBDA-GPU-012",
      amount: 0.60,
      snapshotMembers: 5,
      forVotes: 2,
      againstVotes: 0,
      voters: [
        "0xAlex89B1cD5e342Eaa99757f4955bFc31cDb21A7",
        "0xKavya9F2A197eCdCc18bB357F322dE9C168e3195"
      ],
      executed: false,
      executedAt: null,
      txHash: null,
      deadline: 1794500000,
      proposer: "0xKavya9F2A197eCdCc18bB357F322dE9C168e3195",
      proposerName: "Kavya Patel"
    },
    {
      id: 4,
      title: "Championship Trophies & LAN Routing Equipment",
      description: "Custom engraved brass trophies for campus esports finals and 10Gbps switches for competitive stage setups.",
      programCategory: "Sports & E-Sports Council",
      recipient: "0xTrophyCraftSports94829104829104829104829",
      recipientName: "Apex Trophies & Tech Co.",
      invoiceNumber: "QTE-APEX-9920",
      amount: 0.35,
      snapshotMembers: 5,
      forVotes: 1,
      againstVotes: 0,
      voters: [
        "0xTanmay5D256AcFF2f7d98305E067Ac24B48Db5D29"
      ],
      executed: false,
      executedAt: null,
      txHash: null,
      deadline: 1794600000,
      proposer: "0xTanmay5D256AcFF2f7d98305E067Ac24B48Db5D29",
      proposerName: "Tanmay Sen"
    }
  ],

  deposits: [
    {
      id: "dep_1",
      donor: "0xAlumniCouncilFoundation948201948201948201",
      donorName: "Alumni Association Grant",
      amount: 2.50,
      note: "Annual Student Innovation & Culture Endowment",
      timestamp: "2026-10-12 10:00",
      txHash: "0x44bf0912c0194829103948201948201948201948201948201948201948201948"
    },
    {
      id: "dep_2",
      donor: "0xCampusFestCorporateSponsor849201948201",
      donorName: "TechCorp Global Inc.",
      amount: 1.50,
      note: "Title Sponsorship for AI Hackathon Arena",
      timestamp: "2026-10-18 14:22",
      txHash: "0x892a019482019482019482019482019482019482019482019482019482019482"
    },
    {
      id: "dep_3",
      donor: "0xStudentTicketEscrow948201948201948201",
      donorName: "Early-Bird Ticket Receipts",
      amount: 1.10,
      note: "Batch 1 Student Pass Registrations",
      timestamp: "2026-10-21 09:45",
      txHash: "0x61ac019482019482019482019482019482019482019482019482019482019482"
    }
  ],

  transactionLogs: [
    {
      id: "tx_101",
      type: "DEPOSIT",
      title: "Alumni Association Grant Inflow",
      program: "General Festival Endowment",
      amount: 2.50,
      from: "0xAlumniCouncilFoundation948201948201948201",
      to: "Club Treasury Vault",
      status: "Confirmed",
      txHash: "0x44bf0912c0194829103948201948201948201948201948201948201948201948",
      timestamp: "2026-10-12 10:00",
      description: "Direct community funding contribution received by the smart contract."
    },
    {
      id: "tx_102",
      type: "DEPOSIT",
      title: "TechCorp Title Sponsorship Inflow",
      program: "Coding & AI Society",
      amount: 1.50,
      from: "0xCampusFestCorporateSponsor849201948201",
      to: "Club Treasury Vault",
      status: "Confirmed",
      txHash: "0x892a019482019482019482019482019482019482019482019482019482019482",
      timestamp: "2026-10-18 14:22",
      description: "Sponsorship grant for student tech infrastructure."
    },
    {
      id: "tx_103",
      type: "PAYOUT",
      title: "Acoustic Audio Consoles & Stage Rig",
      program: "Cultural & Performing Arts Guild",
      amount: 0.80,
      from: "Club Treasury Vault",
      to: "0xVendorAudio9948271BcDe93847291a84f32981bcde",
      recipientName: "SoundCraft Audio Services Ltd.",
      invoiceNumber: "INV-SND-2026-904",
      approvedBy: "Council Vote (4 Yes - 0 No)",
      status: "Executed On-Chain",
      txHash: "0x78ab29c4de8390bca235492193eab908321049281a8c9b98d2491a384f932840",
      timestamp: "2026-10-24 16:30",
      description: "Disbursed directly from smart contract to vendor wallet following passed governance vote #1."
    },
    {
      id: "tx_104",
      type: "DEPOSIT",
      title: "Early-Bird Ticket Receipts",
      program: "General Treasury Reserve",
      amount: 1.10,
      from: "0xStudentTicketEscrow948201948201948201",
      to: "Club Treasury Vault",
      status: "Confirmed",
      txHash: "0x61ac019482019482019482019482019482019482019482019482019482019482",
      timestamp: "2026-10-21 09:45",
      description: "Public contribution from ticket revenue."
    },
    {
      id: "tx_105",
      type: "PAYOUT",
      title: "Robo-Wars Combat Arena Plyboards & Sensor Kits",
      program: "Robotics & Hardware Club",
      amount: 0.45,
      from: "Club Treasury Vault",
      to: "0xVendorRoboTech849201948201a93840291a829104",
      recipientName: "RoboSupply Direct Tech",
      invoiceNumber: "INV-ROBO-8819",
      approvedBy: "Council Vote (3 Yes - 1 No)",
      status: "Executed On-Chain",
      txHash: "0x12fc9908da4721950aaee7651034f7b2c93841a0846201bcf9128038f884917a",
      timestamp: "2026-10-27 11:15",
      description: "Hardware acquisition funds sent directly to verified hardware supplier."
    }
  ]
};

const SIMULATION_ACCOUNTS = [
  {
    address: "0xAlex89B1cD5e342Eaa99757f4955bFc31cDb21A7",
    name: "Alex Chen",
    role: "Council President (Deployer)",
    club: "Student Council Treasury Rep",
    badge: "Verified Rep"
  },
  {
    address: "0xPriya3C73f06922D96aD13E72a81878d65C4F7Eb",
    name: "Priya Sharma",
    role: "Robotics Lead",
    club: "Robotics & Hardware Club",
    badge: "Verified Rep"
  },
  {
    address: "0xRohan7398b671A65E68e27c191a613C3f848cAfF0",
    name: "Rohan Verma",
    role: "Cultural Lead",
    club: "Cultural & Performing Arts Guild",
    badge: "Verified Rep"
  },
  {
    address: "0xStudentGuestAuditor77777777777777777777",
    name: "Campus Student Auditor",
    role: "Public Auditor",
    club: "General Student Body",
    badge: "Observer"
  }
];

class StoreManager {
  constructor() {
    this.apiAvailable = false;
    this.init();
    this.trySyncBackend();
  }

  init() {
    const existing = localStorage.getItem(STORAGE_KEYS.TREASURY_DATA);
    if (!existing) {
      this.saveLocalData(DEFAULT_SEED_DATA);
    }
    
    if (!localStorage.getItem(STORAGE_KEYS.APP_MODE)) {
      const hasMetaMask = typeof window !== "undefined" && typeof window.ethereum !== "undefined";
      localStorage.setItem(STORAGE_KEYS.APP_MODE, hasMetaMask ? "metamask" : "simulation");
    }

    if (!localStorage.getItem(STORAGE_KEYS.CURRENT_ACCOUNT)) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_ACCOUNT, SIMULATION_ACCOUNTS[0].address);
    }
  }

  async trySyncBackend() {
    if (typeof window === "undefined" || !window.fetch) return;
    try {
      const res = await fetch("/api/data");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          this.apiAvailable = true;
          this.saveLocalData(json.data);
          console.log("Synced live database from backend server.");
        }
      }
    } catch (e) {
      // Backend not running, local storage acts as persistent browser store
      this.apiAvailable = false;
    }
  }

  getData() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TREASURY_DATA);
      return data ? JSON.parse(data) : DEFAULT_SEED_DATA;
    } catch (e) {
      console.error("Failed to parse treasury data from localStorage", e);
      return DEFAULT_SEED_DATA;
    }
  }

  saveLocalData(data) {
    localStorage.setItem(STORAGE_KEYS.TREASURY_DATA, JSON.stringify(data));
  }

  saveData(data) {
    this.saveLocalData(data);
  }

  resetToDefault() {
    this.saveLocalData(DEFAULT_SEED_DATA);
    return DEFAULT_SEED_DATA;
  }

  getMode() {
    return localStorage.getItem(STORAGE_KEYS.APP_MODE) || "simulation";
  }

  setMode(mode) {
    localStorage.setItem(STORAGE_KEYS.APP_MODE, mode);
  }

  getCurrentSimAccount() {
    const addr = localStorage.getItem(STORAGE_KEYS.CURRENT_ACCOUNT);
    return SIMULATION_ACCOUNTS.find(a => a.address.toLowerCase() === (addr || "").toLowerCase()) || SIMULATION_ACCOUNTS[0];
  }

  setCurrentSimAccount(address) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_ACCOUNT, address);
  }

  // --- Core Treasury State Mutations (Database + Local Sync) ---

  addContribution(donorAddress, donorName, amount, note, txHash) {
    const data = this.getData();
    const parsedAmount = parseFloat(amount);
    
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error("Contribution amount must be greater than zero");
    }

    data.treasuryBalance = parseFloat((data.treasuryBalance + parsedAmount).toFixed(4));
    
    const depositEntry = {
      id: "dep_" + Date.now(),
      donor: donorAddress,
      donorName: donorName || "Community Contributor",
      amount: parsedAmount,
      note: note || "Open Community Contribution",
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
      txHash: txHash || ("0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join(""))
    };
    
    data.deposits.unshift(depositEntry);

    data.transactionLogs.unshift({
      id: "tx_" + Date.now(),
      type: "DEPOSIT",
      title: note ? `Deposit: ${note}` : "Community Treasury Deposit",
      program: "General Treasury Reserve",
      amount: parsedAmount,
      from: donorAddress,
      to: "Club Treasury Vault",
      status: "Confirmed",
      txHash: depositEntry.txHash,
      timestamp: depositEntry.timestamp,
      description: `Public fund deposit of ${parsedAmount} SepoliaETH contributed by ${donorAddress.slice(0, 10)}...`
    });

    this.saveData(data);

    // Sync to backend API if server is running
    if (typeof window !== "undefined" && window.fetch) {
      fetch("/api/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donor: donorAddress, donorName, amount: parsedAmount, note, txHash: depositEntry.txHash })
      }).catch(() => {});
    }

    return depositEntry;
  }

  createProposal(proposerAddress, title, description, programCategory, recipient, amount, durationHours, invoiceNumber) {
    const data = this.getData();
    const parsedAmount = parseFloat(amount);

    // Safety Invariant 1: Single spend ceiling (Max 50% of balance)
    const maxAllowed = (data.treasuryBalance * 0.5);
    if (parsedAmount > maxAllowed) {
      throw new Error(`Invariant Violation: Single proposal cannot exceed 50% of treasury (${maxAllowed.toFixed(4)} ETH)!`);
    }

    // Safety Invariant 2: Cannot exceed liquid available balance
    if (parsedAmount > data.treasuryBalance) {
      throw new Error(`Invariant Violation: Treasury balance (${data.treasuryBalance} ETH) is insufficient for ${parsedAmount} ETH!`);
    }

    if (parsedAmount <= 0) {
      throw new Error("Proposal amount must be greater than zero.");
    }

    // Safety Invariant 3: Minimum active members check
    if (data.members.length < 2) {
      throw new Error("Invariant Violation: Minimum 2 active members required to create governance proposals.");
    }

    const member = data.members.find(m => m.address.toLowerCase() === proposerAddress.toLowerCase());
    const proposerName = member ? member.name : "Member " + proposerAddress.slice(0, 6);

    const newId = (data.proposals.length > 0 ? Math.max(...data.proposals.map(p => p.id)) : 0) + 1;
    const duration = (durationHours || 24) * 3600 * 1000;

    const newProposal = {
      id: newId,
      title: title,
      description: description,
      programCategory: programCategory,
      recipient: recipient,
      recipientName: "Vendor (" + recipient.slice(0, 8) + "..." + recipient.slice(-4) + ")",
      invoiceNumber: invoiceNumber || ("INV-" + Math.floor(1000 + Math.random()*9000)),
      amount: parsedAmount,
      snapshotMembers: data.members.length,
      forVotes: 1, // Proposer automatic vote
      againstVotes: 0,
      voters: [proposerAddress],
      executed: false,
      executedAt: null,
      txHash: null,
      deadline: Date.now() + duration,
      proposer: proposerAddress,
      proposerName: proposerName
    };

    data.proposals.unshift(newProposal);
    this.saveData(data);

    // Sync to backend API if available
    if (typeof window !== "undefined" && window.fetch) {
      fetch("/api/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposer: proposerAddress,
          proposerName,
          title,
          description,
          programCategory,
          recipient,
          amount: parsedAmount,
          durationHours,
          invoiceNumber: newProposal.invoiceNumber
        })
      }).catch(() => {});
    }

    return newProposal;
  }

  castVote(proposalId, voterAddress, support) {
    const data = this.getData();
    const proposal = data.proposals.find(p => p.id === parseInt(proposalId));

    if (!proposal) throw new Error("Proposal not found");
    if (proposal.executed) throw new Error("Proposal is already executed");
    if (proposal.voters && proposal.voters.map(v => v.toLowerCase()).includes(voterAddress.toLowerCase())) {
      throw new Error("Member has already cast a vote for this proposal!");
    }

    if (!proposal.voters) proposal.voters = [];
    proposal.voters.push(voterAddress);

    if (support) {
      proposal.forVotes += 1;
    } else {
      proposal.againstVotes += 1;
    }

    this.saveData(data);

    if (typeof window !== "undefined" && window.fetch) {
      fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, voter: voterAddress, support })
      }).catch(() => {});
    }

    return proposal;
  }

  executeProposal(proposalId, callerAddress, customTxHash) {
    const data = this.getData();
    const proposal = data.proposals.find(p => p.id === parseInt(proposalId));

    if (!proposal) throw new Error("Proposal not found");
    if (proposal.executed) throw new Error("Safety Invariant: Proposal already executed! Cannot double spend.");

    // Quorum Invariant: Minimum 30% of snapshot members (and at least 2 votes)
    const snapshot = proposal.snapshotMembers || data.members.length;
    const minQuorum = Math.max(2, Math.floor((snapshot * 30) / 100));
    const totalVotes = proposal.forVotes + proposal.againstVotes;

    if (totalVotes < minQuorum) {
      throw new Error(`Quorum Invariant: ${totalVotes}/${minQuorum} votes cast. Quorum threshold not reached.`);
    }

    // Governance Invariant: Approval threshold
    if (proposal.forVotes <= proposal.againstVotes) {
      throw new Error("Decision Invariant: Proposal was rejected by members (No >= Yes)");
    }

    // Safety Invariant: Contract can never pay out more than it holds
    if (proposal.amount > data.treasuryBalance) {
      throw new Error(`Safety Invariant: Contract balance (${data.treasuryBalance} ETH) insufficient for ${proposal.amount} ETH!`);
    }

    // Deduct from treasury balance
    data.treasuryBalance = parseFloat((data.treasuryBalance - proposal.amount).toFixed(4));
    proposal.executed = true;
    proposal.executedAt = new Date().toISOString().replace("T", " ").substring(0, 16);
    proposal.txHash = customTxHash || ("0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join(""));

    // Update Program allocated status
    const program = data.programs.find(pr => pr.club === proposal.programCategory || proposal.programCategory.includes(pr.club));
    if (program) {
      program.allocatedAmount = parseFloat((program.allocatedAmount + proposal.amount).toFixed(4));
      program.status = "Approved & Disbursed";
    }

    // Add to central immutable audit log
    data.transactionLogs.unshift({
      id: "tx_" + Date.now(),
      type: "PAYOUT",
      title: proposal.title,
      program: proposal.programCategory,
      amount: proposal.amount,
      from: "Club Treasury Vault",
      to: proposal.recipient,
      recipientName: proposal.recipientName,
      invoiceNumber: proposal.invoiceNumber,
      approvedBy: `Council Vote (${proposal.forVotes} Yes - ${proposal.againstVotes} No)`,
      status: "Executed On-Chain",
      txHash: proposal.txHash,
      timestamp: proposal.executedAt,
      description: `Automated on-chain disbursement executed by ${callerAddress.slice(0, 8)}... directly to recipient ${proposal.recipient.slice(0, 8)}... for '${proposal.programCategory}'. Invoice: ${proposal.invoiceNumber}`
    });

    this.saveData(data);

    if (typeof window !== "undefined" && window.fetch) {
      fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, caller: callerAddress, txHash: proposal.txHash })
      }).catch(() => {});
    }

    return proposal;
  }

  registerMember(accountAddress, name, clubAffiliation, verificationId) {
    const data = this.getData();
    const exists = data.members.find(m => m.address.toLowerCase() === accountAddress.toLowerCase());
    if (exists) {
      throw new Error("Address is already a registered member!");
    }

    const newMember = {
      address: accountAddress,
      name: name,
      club: clubAffiliation,
      role: "Club Representative",
      verificationId: verificationId || ("STU-2026-" + Math.floor(1000 + Math.random()*9000)),
      isVerified: true,
      joinedAt: new Date().toISOString().substring(0, 10)
    };

    data.members.push(newMember);
    this.saveData(data);
    return newMember;
  }
}

// Global Store Instance
const store = new StoreManager();
