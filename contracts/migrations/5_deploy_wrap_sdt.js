const WrappedSDT = artifacts.require("WrappedSDT");

const CHAIN_ID = {
  mainnet: 1,
  ropsten: 3,
  kovan: 42,
  bsc: 56,
  bsc_testnet: 97,
};

module.exports = function (deployer, network) {
  if (
    network == "mainnet" ||
    network == "ropsten" ||
    network == "bsc" ||
    network == "bsc_testnet"
  ) {
    deployer.deploy(WrappedSDT, {
      gas: 5000000,
      overwrite: false,
      chainId: CHAIN_ID[network],
    });
  }
};
