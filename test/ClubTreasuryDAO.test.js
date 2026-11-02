const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ClubTreasuryDAO Production Safety Invariants & Governance", function () {
  let ClubTreasuryDAO;
  let treasury;
  let deployer, leadRobotics, leadCultural, vendorStage, vendorSensors, nonMember;

  const ORG_NAME = "Inter-College Spring Fiesta 2026";

  beforeEach(async function () {
    [deployer, leadRobotics, leadCultural, vendorStage, vendorSensors, nonMember] = await ethers.getSigners();

    ClubTreasuryDAO = await ethers.getContractFactory("ClubTreasuryDAO");
    treasury = await ClubTreasuryDAO.deploy(
      ORG_NAME,
      "Alex Chen",
      "Student Council",
      "STU-2026-CH-0192"
    );
    await treasury.waitForDeployment();

    // Register additional club leads as verified members (with student IDs)
    await treasury.connect(deployer).registerMember(
      leadRobotics.address,
      "Priya Sharma",
      "Robotics Club",
      "STU-2026-ROBO-4819"
    );
    await treasury.connect(deployer).registerMember(
      leadCultural.address,
      "Rohan Verma",
      "Cultural Guild",
      "STU-2026-ARTS-8391"
    );
  });

  describe("1. Treasury Deposit & Open Contribution Invariant", function () {
    it("Allows anyone (sponsors, students, alumni) to deposit SepoliaETH", async function () {
      const depositAmount = ethers.parseEther("2.5");
      await expect(
        deployer.sendTransaction({
          to: await treasury.getAddress(),
          value: depositAmount,
        })
      ).to.emit(treasury, "FundsDeposited");

      const balance = await treasury.getTreasuryBalance();
      expect(balance).to.equal(depositAmount);
    });

    it("Allows contribution with public audit note", async function () {
      const depositAmount = ethers.parseEther("1.0");
      await expect(
        nonMember.sendTransaction({
          to: await treasury.getAddress(),
          value: depositAmount,
          data: treasury.interface.encodeFunctionData("contribute", ["Alumni Sponsorship - Batch 2020"]),
        })
      ).to.emit(treasury, "FundsDeposited");
    });
  });

  describe("2. No-Backdoor & Single-Member Invariant", function () {
    it("Deployer or members have NO backdoor withdraw function", async function () {
      expect(treasury.withdraw).to.be.undefined;
      expect(treasury.emergencyWithdraw).to.be.undefined;
      expect(treasury.drain).to.be.undefined;
    });

    it("Non-members cannot create proposals or vote", async function () {
      await expect(
        treasury.connect(nonMember).createProposal(
          "Secret Withdrawal",
          "Try to drain",
          "Hack",
          nonMember.address,
          ethers.parseEther("0.1"),
          300
        )
      ).to.be.revertedWith("ClubTreasury: Caller is not a registered member");
    });
  });

  describe("3. Decision-Making & Governance Rules", function () {
    beforeEach(async function () {
      // Fund treasury with 5 ETH
      await deployer.sendTransaction({
        to: await treasury.getAddress(),
        value: ethers.parseEther("5.0"),
      });
    });

    it("Creates a valid proposal with estimated program expense", async function () {
      const amount = ethers.parseEther("1.2"); // <= 50% of 5 ETH
      const tx = await treasury.connect(leadRobotics).createProposal(
        "Autonomous Maze Bot Arena & Sensors",
        "Materials for Arduino kits, arena plyboards, ultrasonic sensors",
        "Robotics & Hardware",
        vendorSensors.address,
        amount,
        180 // 3 minutes
      );

      await expect(tx).to.emit(treasury, "ProposalCreated");
      const p = await treasury.proposals(1);
      expect(p.recipient).to.equal(vendorSensors.address);
      expect(p.amount).to.equal(amount);
      expect(p.executed).to.be.false;
      expect(p.snapshotMembers).to.equal(3);
    });

    it("Rejects proposal exceeding 50% max spend ceiling (Safety Invariant)", async function () {
      const excessiveAmount = ethers.parseEther("3.0"); // > 50% of 5 ETH
      await expect(
        treasury.connect(leadCultural).createProposal(
          "Massive Stage",
          "Too expensive",
          "Cultural",
          vendorStage.address,
          excessiveAmount,
          180
        )
      ).to.be.revertedWith("ClubTreasury: Invariant violation: Amount exceeds 50% single spend ceiling");
    });

    it("Prevents retroactive voting: members joining AFTER proposal creation cannot vote", async function () {
      await treasury.connect(leadRobotics).createProposal(
        "Stage Audio & Microphones",
        "Acoustic rentals for main auditorium",
        "Cultural & Arts",
        vendorStage.address,
        ethers.parseEther("0.8"),
        180
      );

      // New member joins after proposal
      const [, , , , , , lateJoiner] = await ethers.getSigners();
      if (lateJoiner) {
        await treasury.connect(deployer).registerMember(
          lateJoiner.address,
          "Late Joiner",
          "General",
          "STU-LATE-001"
        );

        await expect(
          treasury.connect(lateJoiner).vote(1, true)
        ).to.be.revertedWith("ClubTreasury: Member joined after proposal creation");
      }
    });

    it("Executes passed proposal and pays DIRECTLY to the vendor, not admin", async function () {
      const amount = ethers.parseEther("0.75");
      await treasury.connect(leadCultural).createProposal(
        "Main Stage Sound Consoles",
        "Direct rental contract with SoundCraft Ltd",
        "Cultural & Arts",
        vendorStage.address,
        amount,
        180
      );

      // Members vote
      await treasury.connect(deployer).vote(1, true);
      await treasury.connect(leadRobotics).vote(1, true);

      // Fast-forward time past deadline
      await ethers.provider.send("evm_increaseTime", [200]);
      await ethers.provider.send("evm_mine");

      const vendorInitialBalance = await ethers.provider.getBalance(vendorStage.address);

      // Execute permissionlessly
      await expect(treasury.connect(nonMember).executeProposal(1))
        .to.emit(treasury, "ProposalExecuted");

      const vendorFinalBalance = await ethers.provider.getBalance(vendorStage.address);
      expect(vendorFinalBalance - vendorInitialBalance).to.equal(amount);

      const p = await treasury.proposals(1);
      expect(p.executed).to.be.true;

      // Cannot re-execute
      await expect(treasury.connect(deployer).executeProposal(1)).to.be.revertedWith(
        "ClubTreasury: Proposal already executed"
      );
    });

    it("Rejects execution if rejected by majority votes", async function () {
      await treasury.connect(leadRobotics).createProposal(
        "Overpriced T-Shirts",
        "Silk printed hoodies",
        "Merchandise",
        vendorSensors.address,
        ethers.parseEther("0.5"),
        180
      );

      // Majority votes NO
      await treasury.connect(deployer).vote(1, false);
      await treasury.connect(leadCultural).vote(1, false);

      await ethers.provider.send("evm_increaseTime", [200]);
      await ethers.provider.send("evm_mine");

      await expect(treasury.connect(leadRobotics).executeProposal(1)).to.be.revertedWith(
        "ClubTreasury: Proposal rejected by members or quorum not met"
      );
    });
  });
});
