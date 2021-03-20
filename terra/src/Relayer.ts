import { MonitoringData } from 'Monitoring';
import Web3 from 'web3';
import { TransactionConfig, Transaction } from 'web3-core';
import MinterAbi from './config/MinterAbi';
import WrappedTokenAbi from './config/WrappedTokenAbi';
import HDWalletProvider from '@truffle/hdwallet-provider';
import BigNumber from 'bignumber.js';

const ETH_MNEMONIC = process.env.ETH_MNEMONIC as string;
const ETH_SIGNER_INDEXES = ((process.env.ETH_SIGNER_INDEXES as string) || '')
  .split(',')
  .map((v) => parseInt(v))
  .filter(Boolean);

const ETH_URL = process.env.ETH_URL as string;
const ETH_DONATION = process.env.ETH_DONATION as string;
const ETH_NETWORK_NUMBER = parseInt(process.env.ETH_NETWORK_NUMBER as string);

export interface RelayData {
  transactionConfig: TransactionConfig;
  signedTxData: string;
  txHash: string;
  createdAt: number;
}

export class Relayer {
  web3: Web3;
  fromAddress: string;
  signerAddresses: string[];

  constructor() {
    const web3 = new Web3();
    const provider = new HDWalletProvider({
      mnemonic: ETH_MNEMONIC,
      providerOrUrl: ETH_URL,
      numberOfAddresses: 10,
    });

    this.signerAddresses = [];
    for (const idx of ETH_SIGNER_INDEXES) {
      this.signerAddresses.push(provider.getAddress(idx));
    }

    // Must do sort for proper sig check
    this.signerAddresses = this.signerAddresses.sort();

    provider.engine.stop();
    web3.setProvider(provider);

    this.web3 = web3;
    this.fromAddress = provider.getAddress();
  }

  loadNonce(): Promise<number> {
    return this.web3.eth.getTransactionCount(this.fromAddress, 'pending');
  }

  async transferOwnership(
    minterAddr: string,
    tokenContractAddr: string,
    nonce: number,
    gasPrice: string
  ): Promise<RelayData> {
    const contract = new this.web3.eth.Contract(WrappedTokenAbi);
    const data = contract.methods.transferOwnership(minterAddr).encodeABI();

    const transactionConfig: TransactionConfig = {
      from: this.fromAddress,
      to: tokenContractAddr,
      value: '0',
      gas: 100000,
      gasPrice,
      data,
      nonce,
      chainId: ETH_NETWORK_NUMBER,
    };

    const signedTransaction = await this.web3.eth.signTransaction(
      transactionConfig
    );
    const txHash = this.web3.utils.sha3(signedTransaction.raw) as string;

    return {
      transactionConfig,
      signedTxData: signedTransaction.raw,
      txHash,
      createdAt: new Date().getTime(),
    };
  }

  async build(
    monitoringData: MonitoringData,
    nonce: number,
    minterNonce: number,
    gasPrice: string
  ): Promise<RelayData> {
    // Check the address is valid
    let recipient = monitoringData.to;
    if (!Web3.utils.isAddress(monitoringData.to)) {
      recipient = ETH_DONATION;
    }

    const amount = monitoringData.amount + '000000000000';

    let data: string;
    let contractAddr: string;
    if (monitoringData.minterAddr) {
      const contract = new this.web3.eth.Contract(MinterAbi);
      contractAddr = monitoringData.minterAddr as string;

      const txHash = '0x' + monitoringData.txHash;
      const signData = this.web3.utils.soliditySha3(
        minterNonce.toString(),
        txHash
      ) as string;
      const signatures = await this.generateSignatures(signData);

      data = contract.methods
        .mint(
          monitoringData.contractAddr,
          recipient,
          amount,
          txHash,
          signatures
        )
        .encodeABI();
    } else {
      const contract = new this.web3.eth.Contract(WrappedTokenAbi);

      contractAddr = monitoringData.contractAddr;
      data = contract.methods.mint(recipient, amount).encodeABI();
    }

    const transactionConfig: TransactionConfig = {
      from: this.fromAddress,
      to: contractAddr,
      value: '0',
      gas: 100000,
      gasPrice,
      data,
      nonce,
      chainId: ETH_NETWORK_NUMBER,
    };

    const signedTransaction = await this.web3.eth.signTransaction(
      transactionConfig
    );
    const txHash = this.web3.utils.sha3(signedTransaction.raw) as string;

    return {
      transactionConfig,
      signedTxData: signedTransaction.raw,
      txHash,
      createdAt: new Date().getTime(),
    };
  }

  async increaseGasPrice(
    relayData: RelayData,
    targetGasPrice: BigNumber
  ): Promise<RelayData> {
    if (
      targetGasPrice.gt(
        new BigNumber(
          relayData.transactionConfig.gasPrice as string
        ).multipliedBy(1.1)
      )
    ) {
      relayData.transactionConfig.gasPrice = targetGasPrice.toFixed(0);

      const signedTransaction = await this.web3.eth.signTransaction(
        relayData.transactionConfig
      );

      relayData.txHash = this.web3.utils.sha3(signedTransaction.raw) as string;
      relayData.signedTxData = signedTransaction.raw;
      relayData.createdAt = new Date().getTime();
    }

    return relayData;
  }

  relay(relayData: RelayData): Promise<string> {
    return new Promise((resolve, reject) => {
      this.web3.eth
        .sendSignedTransaction(relayData.signedTxData)
        .on('transactionHash', resolve)
        .on('error', reject);
    });
  }

  getGasPrice(): Promise<string> {
    return this.web3.eth.getGasPrice();
  }

  getTransaction(txHash: string): Promise<Transaction> {
    return this.web3.eth.getTransaction(txHash);
  }

  async generateSignatures(data: string): Promise<string[]> {
    const signatures: string[] = await Promise.all(
      this.signerAddresses.map((acc) =>
        this.generateSignature.call(this, data, acc)
      )
    );

    return signatures;
  }

  async generateSignature(data: string, acc: string): Promise<string> {
    return fixSignature(await this.web3.eth.sign(data, acc));
  }
}

function fixSignature(signature: string): string {
  // in geth its always 27/28, in ganache its 0/1. Change to 27/28 to prevent
  // signature malleability if version is 0/1
  // see https://github.com/ethereum/go-ethereum/blob/v1.8.23/internal/ethapi/api.go#L465
  let v = parseInt(signature.slice(130, 132), 16);
  if (v < 27) {
    v += 27;
  }

  const vHex = v.toString(16);
  return signature.slice(0, 130) + vHex;
}
