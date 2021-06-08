const vETH = artifacts.require("vETH");

const CHAIN_ID = {
  mainnet: 1,
  ropsten: 3,
  kovan: 42,
  bsc: 56,
  bsc_testnet: 97,
};

module.exports = function (deployer, network) {
  if (network == "ropsten") {
    deployer.deploy(
      vETH,
      "0xc778417e063141139fce010982780140aa0cd5ab",
      {
        gas: 2000000,
        overwrite: false,
        chainId: CHAIN_ID[network],
      }
    );
  }
};