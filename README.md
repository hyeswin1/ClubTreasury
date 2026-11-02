# ClubTreasury DAO 🏛️
### Transparent, Accountable & Hard-to-Abuse Shared Funds for Student Clubs

> **Campus Event Atmosphere**: *Inter-College Spring Tech & Cultural Fiesta 2026*  
> Built with Solidity smart contracts on the Ethereum Sepolia testnet, persistent disk-backed database indexer, HTML5, TailwindCSS, vanilla JavaScript, and dual-layer storage.

---

## 📌 Background & Motivation
In student clubs, cultural associations, and campus federations, pooled money typically sits in a bank account or personal UPI/Venmo handle held by one or two individuals.
- **The Problem**: Decisions happen in private chats, receipts get lost, vendors are paid haphazardly, and months later nobody can say with confidence who approved what, where the funds went, or whether it was worth it.
- **The Solution**: **ClubTreasury DAO** replaces blind trust with on-chain cryptographic enforcement. All funds enter an autonomous smart contract vault with **zero admin backdoors**. Spending requires member voting, and payouts disburse directly to vendor addresses with permanent, public audit logs.

---

## 💾 Storage Architecture: Real-World Usable & Non-Volatile

To address the common vulnerability of dApp demos where data vanished upon browser reset, **ClubTreasury DAO** implements a **3-Tier Storage Hierarchy**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        3-TIER STORAGE ENGINE                           │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Immutable Blockchain (Ethereum Sepolia Testnet)                     │
│    • Real smart contract vault held at deployed address                │
│    • Events (FundsDeposited, ProposalCreated, VoteCast, Executed)     │
│    • Never vanishes, permanently verifiable on Sepolia Etherscan       │
│                                                                        │
│ 2. Persistent Backend Server & Disk Database (database/treasury_db.json│
│    • Node.js native zero-dependency server (`npm start`)              │
│    • Holds structured metadata, vendor invoices, institutional IDs     │
│    • Persists across all devices, browsers, and reboots               │
│                                                                        │
│ 3. Client-Side Resilient Cache (localStorage / IndexedDB)              │
│    • Instant offline fallback if backend or network is intermittent    │
│    • Auto-syncs with backend API (`/api/data`) upon reconnection       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Critical Smart Contract Upgrades & Security Fixes

Based on security audit findings, the Solidity smart contract (`contracts/ClubTreasuryDAO.sol`) includes explicit defenses against real-world governance attacks:

1. **Anti-Single-Member Drain Invariant (`MIN_ACTIVE_MEMBERS = 2`)**:
   - Prevents an attacker from deploying a contract with 1 sole member, self-proposing, self-voting, and draining the treasury without oversight. At least 2 verified members must be active.
2. **Snapshot Members Quorum Calculation (`p.snapshotMembers`)**:
   - Quorum is calculated against member count *at proposal creation time*, preventing attackers from manipulating live member counts through targeted leave/rejoin cycles.
3. **Anti-Retroactive Voting Lock (`joinedAt <= p.createdAt`)**:
   - Addresses joining *after* a proposal is created are cryptographically blocked from voting on that proposal, preventing flash-membership vote swings.
4. **50% Single-Spend Ceiling (`MAX_SPEND_PERCENTAGE = 50`)**:
   - No single proposal can drain more than half of the treasury, protecting community liquidity.
5. **Committed Funds Accounting (`committedFunds`)**:
   - Funds for active/passed proposals are reserved, preventing concurrent proposal race-condition overdrafts.
6. **Student Institutional ID Verification**:
   - Members register with institutional student IDs or verified college emails (`verificationId`), preventing anonymous Sybil takeover.

---

## 🏆 Answers to the 4 Judge Evaluation Criteria

### 1. Who is allowed to do what?
| Role | How to Become One | Allowed Actions | Restricted Actions |
| :--- | :--- | :--- | :--- |
| **Any Contributor / Sponsor** | Anyone with SepoliaETH (students, alumni, corporate sponsors). | • Deposit funds at any time directly or with an audit memo via `treasury.html`. | • Cannot withdraw funds.<br>• Cannot vote unless registered as a member. |
| **Club Lead / Council Member** | Registered via onboarding with institutional student ID (`registerMember`). | • Create spending proposals for club program expenses.<br>• Vote (Yes/No) on active proposals. | • Cannot withdraw funds to their personal wallet.<br>• Cannot double-vote. |
| **Public Observer / Auditor** | Anyone viewing the dApp or Sepolia block explorer. | • Inspect all proposal votes, programs, and balance breakdowns.<br>• Trigger execution of passed proposals once voting conditions are met.<br>• Export complete audit logs to CSV or JSON. | • Cannot vote without membership. |
| **Contract Deployer** | The account that deploys the Solidity contract. | • Has **zero** special administrative rights.<br>• Only registered as the initial founding representative to bootstrap proposals. | • **CANNOT** withdraw or drain funds.<br>• **CANNOT** alter voting results.<br>• **CANNOT** change rules post-deployment. |

---

### 2. How a decision about money gets made?
Spending is governed strictly by smart contract code, never by a person:
```
                    [ 1. Expense Need Identified ]
             (Robotics arena, Audio gear, Hackathon prizes)
                                   │
                                   ▼
                [ 2. Proposal Created On-Chain ]
       (Must specify Title, Category, Direct Vendor Address,
        Amount <= 50% Cap, Invoice #, and Snapshot Members)
                                   │
                                   ▼
                [ 3. Open Democratic Member Voting ]
             (1 Member = 1 Vote; Anti-retroactive lock)
                                   │
                                   ▼
            [ 4. Cryptographic Validation Checks ]
       - Has voting deadline passed?
       - Quorum reached? (>= 30% of snapshot members)
       - Approval threshold met? (Yes Votes > No Votes)
       - Uncommitted treasury balance >= Requested Amount?
                                   │
                                   ▼
                [ 5. Automated Direct Execution ]
    (Triggerable by anyone! Funds pay OUT DIRECTLY to vendor.
     Executed flag flipped to prevent replay / double spending)
```

---

### 3. Why no single person, including the deployer, can quietly misuse the funds?
The smart contract guarantees absolute non-custodial safety through mathematical code invariants:
1. **No Admin / Owner Withdrawal Backdoor**:
   - The Solidity contract contains **NO** `withdraw()`, `emergencyWithdraw()`, or `ownerDrain()` functions.
   - There is literally no bytecode capable of moving funds out of the vault without passing through `executeProposal()`.
2. **Funds Sent Directly to Vendor Address**:
   - Payouts are made directly to the recipient vendor address specified in the proposal (`p.recipient.call{value: p.amount}("")`). Funds never pass through an intermediary treasurer.
3. **Invariant: Contract Never Pays Out More Than It Holds**:
   - Both proposal creation and proposal execution assert `address(this).balance >= amount`.
4. **Anti-Replay & Reentrancy Guards**:
   - Uses OpenZeppelin-standard `nonReentrant` locks and Checks-Effects-Interactions: `p.executed = true` is committed to blockchain state before any ETH transfer occurs.
5. **No Upgradeability Proxies**:
   - Pure, immutable Solidity bytecode. No proxy contracts, no delegatecalls, and no admin keys that can alter logic post-deployment.

---

### 4. What a member can verify publicly afterwards?
Every event is permanently written on the Ethereum blockchain and stored in the persistent database, rendered on `transactionlog.html`:
- **Who requested the money**: Club lead name, student ID, and address.
- **What purpose/program it funded**: E.g. *"Line Array Sound Consoles & Stage Lighting Rig"* under *Cultural & Arts Guild*.
- **Who approved it**: Exact voting margin (e.g. *Council Vote: 4 Yes - 0 No*).
- **Exact recipient**: Vendor entity name, invoice number, and Ethereum address.
- **Block and Tx Hash**: Direct hyperlink to [Sepolia Etherscan](https://sepolia.etherscan.io/) for independent cryptographic verification.
- **Exportable Records**: One-click download of audit logs in CSV and JSON formats.

---

## 🎪 Sample Event Atmosphere: Spring Fiesta 2026

The dApp is pre-configured with a lively campus festival environment featuring 5 student-led clubs with itemized expense requirements:

1. **🤖 Robotics & Hardware Club** (Lead: Priya Sharma)
   - *Estimated*: 0.45 SepoliaETH
   - *Breakdown*: Arena Acrylic Flooring (0.18 ETH), Arduino Mega & Sensors (0.15 ETH), LiPo Batteries (0.12 ETH).
2. **💻 Coding & AI Society** (Lead: Kavya Patel)
   - *Estimated*: 0.60 SepoliaETH
   - *Breakdown*: Cloud GPU Compute Credits (0.30 ETH), Prize Pool (0.20 ETH), Swag & Badges (0.10 ETH).
3. **🎭 Cultural & Performing Arts Guild** (Lead: Rohan Verma)
   - *Estimated*: 0.80 SepoliaETH
   - *Breakdown*: Line Array Speakers & Mixer Rental (0.45 ETH), Par-LED Lighting Rig (0.20 ETH), Wireless Vocal Mics (0.15 ETH).
4. **🎨 Design & Media Collective** (Lead: Ananya Gupta)
   - *Estimated*: 0.25 SepoliaETH
   - *Breakdown*: HDMI 4K Capture Cards (0.12 ETH), Recycled Stage Banners (0.08 ETH), Twitch CDN Overlays (0.05 ETH).
5. **🏆 Sports & E-Sports Council** (Lead: Tanmay Sen)
   - *Estimated*: 0.35 SepoliaETH
   - *Breakdown*: Custom Laser-Engraved Trophies (0.15 ETH), Gigabit Switch Hubs (0.10 ETH), Certified Referee Stipend (0.10 ETH).

---

## 💻 Tech Stack & Architecture

- **Smart Contract Layer**:
  - `Solidity ^0.8.20`
  - Target Network: **Ethereum Sepolia Testnet** (Chain ID: `11155111` / `0xaa36a7`)
  - Automated tests in Hardhat (`test/ClubTreasuryDAO.test.js`)
- **Backend & Database Layer**:
  - **Node.js Native HTTP Server** (`server/server.js`) - zero external npm dependencies!
  - **File-Backed JSON/SQLite Database** (`database/treasury_db.json`) - persists across all sessions and devices.
  - REST API (`/api/data`, `/api/proposal`, `/api/vote`, `/api/execute`, `/api/deposit`, `/api/apply`)
- **Frontend Layer**:
  - Semantic **HTML5** & responsive mobile-first layouts
  - **TailwindCSS** via CDN
  - **Vanilla JavaScript** (Zero bundler complexity)
  - **Ethers.js v5.7.2** for browser Web3 provider integration

---

## 🚀 Quickstart & How to Run

### Step 1: Start the Persistent Backend Server (Recommended)
```bash
npm start
```
This boots the server at `http://localhost:3000` with live persistent storage in `database/treasury_db.json`.

Alternatively, for static-only test:
```bash
python -m http.server 8000
```

### Step 2: Test Governance Workflows
1. **With MetaMask (Sepolia)**:
   - Click **Connect Wallet** — automatically connects and requests switching to Sepolia testnet.
   - Live transactions are submitted on-chain and confirmed.
2. **Without MetaMask (Simulation Sandbox)**:
   - Switch persona using the header dropdown (Alex Chen, Priya Sharma, Rohan Verma, Guest Auditor).
   - Deposit funds in `treasury.html`.
   - Submit proposal in `index.html`.
   - Vote Yes/No and execute payout.
   - Inspect transaction logs in `transactionlog.html`.
   - All changes **persist in `database/treasury_db.json`**!
