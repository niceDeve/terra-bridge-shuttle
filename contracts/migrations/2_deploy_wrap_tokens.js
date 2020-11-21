const WrappedLuna = artifacts.require("WrappedLuna");
const WrappedUST = artifacts.require("WrappedUST");
const WrappedKRT = artifacts.require("WrappedKRT");
const WrappedSDT = artifacts.require("WrappedSDT");
const WrappedMNT = artifacts.require("WrappedMNT");
const WrappedMIR = artifacts.require("WrappedMIR");

module.exports = function(deployer) {
  deployer.deploy(WrappedLuna);
  deployer.deploy(WrappedUST);
  deployer.deploy(WrappedKRT);
  deployer.deploy(WrappedSDT);
  deployer.deploy(WrappedMNT);
  deployer.deploy(WrappedMIR);
};
