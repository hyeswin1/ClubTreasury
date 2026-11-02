const hre = require("hardhat");

async function main() {
  console.log("----------------------------------------------------");
  console.log("Deploying ClubTreasuryDAO to Sepolia Testnet...");
  console.log("----------------------------------------------------");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer Address:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer Balance:", hre.ethers.formatEther(balance), "ETH");

  const organizationName = "Inter-College Spring Tech & Cultural Fiesta 2026";
  const initialMemberName = "Alex Chen";
  const initialClubAffiliation = "Student Council Treasury Representative";
  const initialVerificationId = "STU-2026-CH-0192";

  const ClubTreasuryDAO = await hre.ethers.getContractFactory("ClubTreasuryDAO");
  const treasury = await ClubTreasuryDAO.deploy(
    organizationName,
    initialMemberName,
    initialClubAffiliation,
    initialVerificationId
  );

  await treasury.waitForDeployment();
  const address = await treasury.getAddress();

  console.log("\n====================================================");
  console.log(" ClubTreasuryDAO successfully deployed!");
  console.log(" Contract Address:", address);
  console.log(" Network: Sepolia (Chain ID: 11155111)");
  console.log(" Organization:", organizationName);
  console.log(" Founding Rep:", initialMemberName);
  console.log("====================================================\n");
  console.log("To interact on the frontend, paste this address into the contract address input in index.html!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
