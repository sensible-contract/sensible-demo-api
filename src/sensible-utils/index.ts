import { Wallet } from "@sensible-contract/abstract-wallet";
import * as bsv from "@sensible-contract/bsv";
import { BN } from "@sensible-contract/bsv";
import {
  createNftGenesisTx,
  createNftMetaDataTx,
  createNftMintTx,
  createNftTransferTx,
  getNftGenesisInfo,
  getNftGenesisInput,
  getNftInput,
  NftMetaData,
  NftSigner,
  selectNftSigners,
} from "@sensible-contract/nft-js";
import { SensiblequeryProvider } from "@sensible-contract/providers";
import {
  defaultRabinSigner,
  getSignerConfigs,
} from "@sensible-contract/rabin-signer-list";
import { P2PKH_UNLOCK_SIZE } from "@sensible-contract/sdk-core";
import {
  createTokenGenesisTx,
  createTokenIssueTx,
  createTokenTransferCheckContractTx,
  createTokenTransferTx,
  getTokenGenesisInfo,
  getTokenGenesisInput,
  getTokenInputs,
  selectTokenSigners,
  TokenSigner,
} from "@sensible-contract/token-js";
import {
  TokenTransferCheckFactory,
  TOKEN_TRANSFER_TYPE,
} from "@sensible-contract/token-js/lib/contract-factory/tokenTransferCheck";
import { TxComposer } from "@sensible-contract/tx-composer";
import { toDecimalUnit } from "./utils";
type TokenAmount = {
  amount: string;
  decimal: number;
  uiAmount: string;
};

type Token = {
  codehash: string;
  genesis: string;
  sensibleId?: string;
};

type Utxo = {
  txId: string;
  outputIndex: number;
  satoshis: number;
  address: string;
};
async function sleep(time: number) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(0);
    }, time * 1000);
  });
}
function toTokenAmount(
  balance: string,
  pendingBalance: string,
  decimal: number
) {
  let bnAmount = BN.fromString(balance, 10).add(
    BN.fromString(pendingBalance, 10)
  );

  let tokenAmount: TokenAmount = {
    amount: bnAmount.toString(10),
    decimal,
    uiAmount: toDecimalUnit(bnAmount.toString(10), decimal),
  };
  return tokenAmount;
}

type NFT = {
  codehash: string;
  genesis: string;
  sensibleId?: string;
  tokenIndex?: string;
};

type TxOptions = {
  onlyEstimateFee?: boolean;
  noBroadcast?: boolean;
};

const DEFAULT_TX_OPTIONS: TxOptions = {
  onlyEstimateFee: false,
  noBroadcast: false,
};

let nftSignerMap: { [key: string]: NftSigner } = {};
async function getNftSigner(
  rabinPubKeyHashArrayHash: string = defaultRabinSigner.rabinPubKeyHashArrayHash
) {
  if (nftSignerMap[rabinPubKeyHashArrayHash])
    return nftSignerMap[rabinPubKeyHashArrayHash];
  let signerConfigs = getSignerConfigs(rabinPubKeyHashArrayHash);
  let _res = await selectNftSigners(signerConfigs);
  let signer = new NftSigner({
    signerConfigs: _res.signers,
    signerSelecteds: _res.signerSelecteds,
  });
  nftSignerMap[rabinPubKeyHashArrayHash] = signer;
  return signer;
}

let tokenSignerMap: { [key: string]: TokenSigner } = {};
async function getTokenSigner(
  rabinPubKeyHashArrayHash: string = defaultRabinSigner.rabinPubKeyHashArrayHash
) {
  if (tokenSignerMap[rabinPubKeyHashArrayHash])
    return tokenSignerMap[rabinPubKeyHashArrayHash];
  let signerConfigs = getSignerConfigs(rabinPubKeyHashArrayHash);
  let _res = await selectTokenSigners(signerConfigs);
  let signer = new TokenSigner({
    signerConfigs: _res.signers,
    signerSelecteds: _res.signerSelecteds,
  });
  tokenSignerMap[rabinPubKeyHashArrayHash] = signer;
  return signer;
}

export class Sensible {
  public wallet: Wallet;
  public provider: SensiblequeryProvider;
  constructor(provider: SensiblequeryProvider, wallet: Wallet) {
    this.provider = provider;
    this.wallet = wallet;
  }

  //bsv
  async getBsvBalance() {
    let address = await this.wallet.getAddress();
    let balance = await this.provider.getBalance(address);
    return balance;
  }

  private async mergeBsv() {
    const txComposer = new TxComposer();
    let address = await this.wallet.getAddress();
    let utxos = await this.provider.getUtxos(address);
    utxos.forEach((v, index) => {
      txComposer.appendP2PKHInput({
        address: new bsv.Address(v.address),
        txId: v.txId,
        outputIndex: v.outputIndex,
        satoshis: v.satoshis,
      });
      txComposer.addInputInfo({
        inputIndex: index,
      });
    });
    txComposer.appendChangeOutput(new bsv.Address(address));
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);

    await this.provider.broadcast(txComposer.getRawHex());
    return {
      utxo: {
        txId: txComposer.getTxId(),
        outputIndex: 0,
        satoshis: txComposer.getOutput(0).satoshis,
        address: address,
      },
      rawTransaction: txComposer.getRawHex(),
    };
  }

  async transferBsv(to: string, amount: number) {
    const txComposer = new TxComposer();
    let address = await this.wallet.getAddress();
    let utxos = await this.provider.getUtxos(address);
    utxos.forEach((v, index) => {
      txComposer.appendP2PKHInput({
        address: new bsv.Address(v.address),
        txId: v.txId,
        outputIndex: v.outputIndex,
        satoshis: v.satoshis,
      });
      txComposer.addInputInfo({
        inputIndex: index,
      });
    });
    txComposer.appendP2PKHOutput({
      address: new bsv.Address(to),
      satoshis: amount,
    });
    txComposer.appendChangeOutput(new bsv.Address(address));
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);

    await this.provider.broadcast(txComposer.getRawHex());
    return txComposer.getTxId();
  }

  async transferBsvArray(
    arr: { to: string; amount: number }[],
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
    const txComposer = new TxComposer();
    let address = await this.wallet.getAddress();
    let utxos = await this.provider.getUtxos(address);
    utxos.forEach((v, index) => {
      txComposer.appendP2PKHInput({
        address: new bsv.Address(v.address),
        txId: v.txId,
        outputIndex: v.outputIndex,
        satoshis: v.satoshis,
      });
      txComposer.addInputInfo({
        inputIndex: index,
      });
    });
    arr.forEach((v) => {
      txComposer.appendP2PKHOutput({
        address: new bsv.Address(v.to),
        satoshis: v.amount,
      });
    });

    txComposer.appendChangeOutput(new bsv.Address(address));
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);

    if (options.noBroadcast) {
      return { rawtx: txComposer.getRawHex() };
    } else {
      let txid = await this.provider.broadcast(txComposer.getRawHex());
      return { txid };
    }
  }

  async transferAllBsv(to: string) {
    const txComposer = new TxComposer();
    let address = await this.wallet.getAddress();
    let utxos = await this.provider.getUtxos(address);
    let amount = 0;
    utxos.forEach((v, index) => {
      txComposer.appendP2PKHInput({
        address: new bsv.Address(v.address),
        txId: v.txId,
        outputIndex: v.outputIndex,
        satoshis: v.satoshis,
      });
      txComposer.addInputInfo({
        inputIndex: index,
      });
      amount += v.satoshis;
    });
    let outputIndex = txComposer.appendP2PKHOutput({
      address: new bsv.Address(to),
      satoshis: amount,
    });

    const unlockSize = txComposer.getTx().inputs.length * P2PKH_UNLOCK_SIZE;
    let fee = Math.ceil(
      (txComposer.getTx().toBuffer().length + unlockSize) * txComposer.feeRate
    );
    txComposer.getOutput(outputIndex).satoshis -= fee;

    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);

    return await this.provider.broadcast(txComposer.getRawHex());
  }

  //token
  async genesisToken(
    {
      tokenSigner,
      tokenName,
      tokenSymbol,
      decimalNum,
    }: {
      tokenSigner?: TokenSigner;
      tokenName: string;
      tokenSymbol: string;
      decimalNum: number;
    },
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
    if (!tokenSigner) tokenSigner = await getTokenSigner();
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    let utxos = await this.provider.getUtxos(address);
    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    let fee = createTokenGenesisTx.estimateFee({ utxoMaxCount: utxos.length });
    if (options.onlyEstimateFee) return { fee };
    if (balance < fee) throw "Insufficient Bsv Balance.";
    let { txComposer } = await createTokenGenesisTx({
      tokenSigner,
      tokenName,
      tokenSymbol,
      utxos,
      genesisPublicKey: publicKey,
      decimalNum,
    });
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);
    let token = getTokenGenesisInfo(tokenSigner, txComposer.getRawHex());

    if (options.noBroadcast) {
      return { token, rawtx: txComposer.getRawHex() };
    } else {
      let txid = await this.provider.broadcast(txComposer.getRawHex());
      return { token, txid };
    }
  }

  async issueToken(
    {
      token,
      tokenAmount,
      receiverAddress,
      allowIncreaseIssues = false,
    }: {
      token: Token;
      tokenAmount: string;
      receiverAddress?: string;
      allowIncreaseIssues?: boolean;
    },
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    if (!receiverAddress) receiverAddress = address;
    let utxos = await this.provider.getUtxos(address);

    let { genesisInput, genesisContract } = await getTokenGenesisInput(
      this.provider,
      { sensibleId: token.sensibleId }
    );

    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    let fee = createTokenIssueTx.estimateFee({
      genesisInput,
      allowIncreaseIssues,
      utxoMaxCount: utxos.length,
    });
    if (options.onlyEstimateFee) return { fee };
    if (balance < fee) throw "Insufficient Bsv Balance.";

    let tokenSigner = await getTokenSigner(
      genesisInput.rabinPubKeyHashArrayHash
    );

    let { txComposer } = await createTokenIssueTx({
      tokenSigner,
      genesisInput,
      genesisContract,
      utxos,
      allowIncreaseIssues,
      receiverAddress,
      tokenAmount,
    });
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);

    if (options.noBroadcast) {
      return { rawtx: txComposer.getRawHex() };
    } else {
      let txid = await this.provider.broadcast(txComposer.getRawHex());
      return { txid };
    }
  }

  async transferToken(
    {
      token,
      receivers,
      opreturnData,
    }: {
      token: Token;
      receivers: {
        address: string;
        amount: string;
      }[];
      opreturnData?: any;
    },
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
    let address = await this.wallet.getAddress();
    let { utxos } = await this.mergeToken(token);

    let tokenUtxos = await this.provider.getTokenUtxos(
      token.codehash,
      token.genesis,
      address,
      { cursor: 0, size: 20 }
    );
    let tokenInputs = await getTokenInputs(this.provider, {
      tokenUtxos,
      codehash: token.codehash,
      genesis: token.genesis,
    });

    let tokenOutputs = receivers;
    let changeAmount = tokenInputs
      .reduce((pre, cur) => pre.add(cur.tokenAmount), BN.Zero)
      .sub(
        receivers.reduce(
          (pre, cur) => pre.add(BN.fromString(cur.amount, 10)),
          BN.Zero
        )
      );

    if (changeAmount.gt(BN.Zero)) {
      tokenOutputs.push({
        address,
        amount: changeAmount.toString(10),
      });
    }

    let tokenTransferType = TokenTransferCheckFactory.getOptimumType(
      tokenInputs.length,
      tokenOutputs.length
    );

    let fee1 = createTokenTransferCheckContractTx.estimateFee({
      tokenTransferType,
      utxoMaxCount: utxos.length,
    });
    let fee2 = createTokenTransferTx.estimateFee({
      tokenInputs,
      tokenOutputs,
      tokenTransferType,
      utxoMaxCount: 1,
      opreturnData,
    });
    let fee = fee1 + fee2;
    if (options.onlyEstimateFee) return { fee };
    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    if (balance < fee) throw "Insufficient Bsv Balance.";

    let tokenSigner = await getTokenSigner(
      tokenInputs[0].rabinPubKeyHashArrayHash
    );

    let ret0 = await createTokenTransferCheckContractTx({
      tokenTransferType,
      tokenInputCount: tokenInputs.length,
      tokenOutputs,
      tokenID: tokenInputs[0].tokenID,
      codehash: token.codehash,
      utxos,
    });
    let sigResults0 = await this.wallet.signTransaction(
      ret0.txComposer.getRawHex(),
      ret0.txComposer.getInputInfos()
    );
    ret0.txComposer.unlock(sigResults0);

    utxos = [
      {
        txId: ret0.txComposer.getTxId(),
        outputIndex: 1,
        satoshis: ret0.txComposer.getOutput(1).satoshis,
        address: address,
      },
    ];

    let ret1 = await createTokenTransferTx({
      tokenSigner,
      tokenInputs,
      tokenOutputs,
      transferCheckContract: ret0.transferCheckContract,
      transferCheckTxComposer: ret0.txComposer,
      utxos,
      opreturnData,
    });

    let sigResults1 = await this.wallet.signTransaction(
      ret1.txComposer.getRawHex(),
      ret1.txComposer.getInputInfos()
    );
    ret1.txComposer.unlock(sigResults1);

    if (options.noBroadcast) {
      return {
        rawtxs: [ret0.txComposer.getRawHex(), ret1.txComposer.getRawHex()],
      };
    } else {
      let txid1 = await this.provider.broadcast(ret0.txComposer.getRawHex());
      let txid2 = await this.provider.broadcast(ret1.txComposer.getRawHex());
      return {
        txids: [txid1, txid2],
      };
    }
  }

  async mergeToken(token: Token) {
    let opreturnData = null;
    let address = await this.wallet.getAddress();
    let utxos = await this.provider.getUtxos(address);

    //check bsv utxos count
    if (utxos.length > 3) {
      let _res = await this.mergeBsv();
      utxos = [_res.utxo];
    }

    //merge up 100 times.
    for (let i = 0; i < 100; i++) {
      let { utxoCount } = await this.provider.getTokenBalance(
        token.codehash,
        token.genesis,
        address
      );
      if (utxoCount <= 3) break;

      let tokenUtxos = await this.provider.getTokenUtxos(
        token.codehash,
        token.genesis,
        address,
        { cursor: 0, size: 20 }
      );
      let tokenInputs = await getTokenInputs(this.provider, {
        tokenUtxos,
        codehash: token.codehash,
        genesis: token.genesis,
      });

      let tokenSigner = await getTokenSigner(
        tokenInputs[0].rabinPubKeyHashArrayHash
      );

      let tokenOutputs = [
        {
          address,
          amount: tokenInputs
            .reduce((pre, cur) => pre.add(cur.tokenAmount), BN.Zero)
            .toString(10),
        },
      ];
      let ret0 = await createTokenTransferCheckContractTx({
        tokenTransferType: TOKEN_TRANSFER_TYPE.IN_20_OUT_3,
        tokenInputCount: tokenInputs.length,
        tokenOutputs,
        tokenID: tokenInputs[0].tokenID,
        codehash: token.codehash,
        utxos,
      });
      let sigResults0 = await this.wallet.signTransaction(
        ret0.txComposer.getRawHex(),
        ret0.txComposer.getInputInfos()
      );
      ret0.txComposer.unlock(sigResults0);

      utxos = [
        {
          txId: ret0.txComposer.getTxId(),
          outputIndex: 1,
          satoshis: ret0.txComposer.getOutput(1).satoshis,
          address: address,
        },
      ];

      let ret1 = await createTokenTransferTx({
        tokenSigner,
        tokenInputs,
        tokenOutputs,
        transferCheckContract: ret0.transferCheckContract,
        transferCheckTxComposer: ret0.txComposer,
        utxos,
        opreturnData,
      });

      let sigResults1 = await this.wallet.signTransaction(
        ret1.txComposer.getRawHex(),
        ret1.txComposer.getInputInfos()
      );
      ret1.txComposer.unlock(sigResults1);

      let txid_0 = await this.provider.broadcast(ret0.txComposer.getRawHex());
      let txid_1 = await this.provider.broadcast(ret1.txComposer.getRawHex());
      await sleep(2);
      utxos = [
        {
          txId: ret1.txComposer.getTxId(),
          outputIndex: 1,
          satoshis: ret1.txComposer.getOutput(1).satoshis,
          address,
        },
      ];
    }

    return {
      utxos,
    };
  }

  async getTokenBalance(token: Token) {
    let address = await this.wallet.getAddress();
    let { balance, pendingBalance, decimal, utxoCount } =
      await this.provider.getTokenBalance(
        token.codehash,
        token.genesis,
        address
      );
    return toTokenAmount(balance, pendingBalance, decimal);
  }

  async getTokenSummarys({ cursor, size }: { cursor: number; size: number }) {
    let address = await this.wallet.getAddress();
    let _res = await this.provider.getTokenList(address);
    return _res.list.map((v) => {
      return {
        codehash: v.codehash,
        genesis: v.genesis,
        sensibleId: v.sensibleId,
        symbol: v.symbol,
        tokenAmount: toTokenAmount(v.balance, v.pendingBalance, v.decimal),
      };
    });
  }
  //nft
  async genesisNft(
    {
      nftSigner,
      totalSupply,
    }: {
      nftSigner?: NftSigner;
      totalSupply: string;
    },
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
    if (!nftSigner) nftSigner = await getNftSigner();
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    let utxos = await this.provider.getUtxos(address);

    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    let fee = createNftGenesisTx.estimateFee({
      utxoMaxCount: utxos.length,
    });
    if (options.onlyEstimateFee) return { fee };
    if (balance < fee) throw "Insufficient Bsv Balance.";

    let { txComposer } = await createNftGenesisTx({
      nftSigner,
      utxos,
      genesisPublicKey: publicKey,
      totalSupply,
    });
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);
    let nft = getNftGenesisInfo(nftSigner, txComposer.getRawHex());

    if (options.noBroadcast) {
      return { nft, rawtx: txComposer.getRawHex() };
    } else {
      let txid = await this.provider.broadcast(txComposer.getRawHex());
      return { nft, txid };
    }
  }

  async mintNft(
    {
      nft,
      receiverAddress,
      metaData,
    }: {
      nft: NFT;
      metaData: NftMetaData;
      receiverAddress?: string;
    },
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    if (!receiverAddress) receiverAddress = address;
    let utxos = await this.provider.getUtxos(address);

    let { genesisInput, genesisContract } = await getNftGenesisInput(
      this.provider,
      {
        codehash: nft.codehash,
        genesis: nft.genesis,
        sensibleId: nft.sensibleId,
      }
    );

    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    let fee1 = createNftMetaDataTx.estimateFee({
      metaData,
      utxoMaxCount: utxos.length,
    });
    let fee2 = createNftMintTx.estimateFee({ genesisInput, utxoMaxCount: 1 });
    let fee = fee1 + fee2;
    if (options.onlyEstimateFee) return { fee };
    if (balance < fee) throw "Insufficient Bsv Balance.";

    let nftSigner = await getNftSigner(genesisInput.rabinPubKeyHashArrayHash);

    let nftMetaDataRet = await createNftMetaDataTx({
      utxos,
      metaData,
    });

    let sigResults0 = await this.wallet.signTransaction(
      nftMetaDataRet.txComposer.getRawHex(),
      nftMetaDataRet.txComposer.getInputInfos()
    );
    nftMetaDataRet.txComposer.unlock(sigResults0);

    utxos = [
      {
        txId: nftMetaDataRet.txComposer.getTxId(),
        outputIndex: 1,
        satoshis: nftMetaDataRet.txComposer.getOutput(1).satoshis,
        address: address,
      },
    ];
    let { txComposer } = await createNftMintTx({
      nftSigner,
      genesisInput,
      genesisContract,
      utxos,
      receiverAddress,
      metaTxId: nftMetaDataRet.txComposer.getTxId(),
      metaOutputIndex: 0,
    });
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);

    if (options.noBroadcast) {
      return {
        rawtxs: [nftMetaDataRet.txComposer.getRawHex(), txComposer.getRawHex()],
      };
    } else {
      let txid0 = await this.provider.broadcast(
        nftMetaDataRet.txComposer.getRawHex()
      );
      let txid1 = await this.provider.broadcast(txComposer.getRawHex());
      return { txids: [txid0, txid1] };
    }
  }

  async transferNft(
    {
      nft,
      receiverAddress,
      utxos,
      opreturnData,
    }: {
      nft: NFT;
      receiverAddress?: string;
      utxos?: Utxo[];
      opreturnData?: any;
    },
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    if (!receiverAddress) receiverAddress = address;
    if (!utxos) utxos = await this.provider.getUtxos(address);

    let nftUtxoDetail = await this.provider.getNftUtxoDetail(
      nft.codehash,
      nft.genesis,
      nft.tokenIndex
    );
    let nftUtxo = {
      txId: nftUtxoDetail.txid,
      outputIndex: nftUtxoDetail.vout,
      tokenAddress: nftUtxoDetail.address,
      tokenIndex: nftUtxoDetail.tokenIndex,
    };
    let nftInput = await getNftInput(this.provider, {
      codehash: nft.codehash,
      genesis: nft.genesis,
      nftUtxo,
    });

    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    let fee = createNftTransferTx.estimateFee({
      nftInput,
      utxoMaxCount: utxos.length,
      opreturnData,
    });
    if (options.onlyEstimateFee) return { fee };
    if (balance < fee) throw "Insufficient Bsv Balance.";

    let nftSigner = await getNftSigner(nftInput.rabinPubKeyHashArrayHash);

    let { txComposer } = await createNftTransferTx({
      nftSigner,
      nftInput,
      utxos,
      receiverAddress,
      opreturnData,
    });
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);

    if (options.noBroadcast) {
      return { rawtx: txComposer.getRawHex() };
    } else {
      let txid = await this.provider.broadcast(txComposer.getRawHex());
      return { txid };
    }
  }

  async getNftMetaData(provider: SensiblequeryProvider, { nft }: { nft: NFT }) {
    let nftUtxo = await provider.getNftUtxoDetail(
      nft.codehash,
      nft.genesis,
      nft.tokenIndex
    );
    if (!nftUtxo) {
      throw new Error("no such nft");
    }
    let rawhex = await provider.getRawTxData(nftUtxo.metaTxId);
    let tx = new bsv.Transaction(rawhex);
    let jsondata =
      tx.outputs[nftUtxo.metaOutputIndex].script.chunks[2].buf.toString();
    let data = JSON.parse(jsondata);
    return data;
  }
}
