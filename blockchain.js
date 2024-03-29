
const crypto = require('crypto');
const EC = require('elliptic').ec; //npm install elliptic
const ec = new EC('secp256k1');
const debug = require('debug')('acoin:blockchain');

class Transaction {

    constructor(fromAddress, toAddress, amount) {
        this.fromAddress = fromAddress;
        this.toAddress = toAddress;
        this.amount = amount;
        this.timestamp = Date.now();
    }
    
    //this is to sign the key
    calculateHash() {
        return crypto.createHash('sha256')
            .update(this.fromAddress + this.toAddress + this.amount + this.timestamp)
            .digest('hex');
    }

    signTransaction(signingKey) {
        //transaction can be signed only by 'sender'
        if (signingKey.getPublic('hex') !== this.fromAddress) {
            throw new Error('You cannot sign transaction for other wallet');
        }

        const hashTx = this.calculateHash();
        console.log("Transaction hash : " + hashTx);
        const sig = signingKey.sign(hashTx, 'base64');
        this.signature = sig.toDER('hex');

    }

    isValid(){
        if (this.fromAddress === null) return true; //in case this is reward transaction

        if (!this.signature || this.signature.length === 0) {
            throw new Error('Transaction is not signed');
        }

        const publicKey = ec.keyFromPublic(this.fromAddress, 'hex');
        return publicKey.verify(this.calculateHash(), this.signature);

    }

}

class Block {
    
    constructor(timestamp, transactions, previousHash = '') {
        this.timestamp = timestamp;
        this.transactions = transactions;
        this.previousHash = previousHash;
        this.blockHash = this.calculateHash();
        this.nonce = 0;
    }

    //this is for block tracking
    calculateHash() {
        return crypto.createHash('sha256')
            .update(this.previousHash + this.timestamp + JSON.stringify(this.transactions) + this.nonce)
            .digest('hex');
    }

    mineBlock(difficulty) {
        console.log(this.blockHash);
        while(this.blockHash.substring(0, difficulty) !== Array(difficulty + 1).join("0")) {
            this.nonce++;
            this.blockHash = this.calculateHash();
        }
        console.log("Block mined : " + this.blockHash);
    }

    hasValidTransactions(){
        
        for(const tx of this.transactions){
            if(!tx.isValid()){
                return false;
            }
        }
        return true;
    }

}

class Blockchain {
    
    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.difficulty = 2;
        this.pendingTransactions = [];
        this.miningReward = 100;
    }

    createGenesisBlock() {
        return new Block("01-01-2021", [], "0");
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    minePendingTransactions(minerAddress) {

        const rewardTx = new Transaction(null, minerAddress, this.miningReward);
        this.pendingTransactions.push(rewardTx);

        let block = new Block(Date.now(), this.pendingTransactions); //replace with transaction selection logic in real world
        block.mineBlock(this.difficulty);

        console.log("Block is successfully mined!\n");

        this.chain.push(block);

        this.pendingTransactions = [];
    }

    addTransaction(transaction) {

        if (!transaction.fromAddress || !transaction.toAddress){
            throw new Error("Transaction must include from and to address");
        }

        if (!transaction.isValid()){
            throw new Error("Cannot add invalid transaction to the chain");
        }

        if (transaction.amount <= 0) {
            throw new Error('Transaction amount should be higher than 0');
          }
          
        this.pendingTransactions.push(transaction);
        debug('transaction added: %s', transaction);

    }

    getBalanceOf(address) {
        let balance = 0;
        for(const block of this.chain){
            for (const trans of block.transactions){
                if (trans.fromAddress === address) {
                    balance -= trans.amount;
                }
                if (trans.toAddress === address) {
                    balance += trans.amount;
                }
            }
        }
        return balance;
    }

    getAllTransactionsForWallet(address) {
        const txs = [];
    
        for (const block of this.chain) {
          for (const tx of block.transactions) {
            if (tx.fromAddress === address || tx.toAddress === address) {
              txs.push(tx);
            }
          }
        }
    
        debug('get transactions for wallet count: %s', txs.length);
        return txs;
    }

    isChainValid() {
        for (let i = 1; i < this.chain.length; i++){ //skipped 0th block i.e. genesis block
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i-1];

            if (!currentBlock.hasValidTransactions()) {
                return false;
            }
            if (currentBlock.blockHash !== currentBlock.calculateHash()){
                return false;
            }

            if (currentBlock.previousHash !== previousBlock.blockHash) {
                return false;
            }
        }
        return true;
    }

}

module.exports.Blockchain = Blockchain;
module.exports.Block = Block;
module.exports.Transaction = Transaction;
