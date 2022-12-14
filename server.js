require('dotenv').config();
var myCoin = {
    "name": "VXXL",
    "symbol": "VXXL",
    "algorithm": "scrypt", //or "sha256", "scrypt-jane", "scrypt-n", "quark", "x11"
    "txMessages": false, //or true (not required, defaults to false)
    "reward": "POS"
};
console.log(process.env);
var Stratum = require('stratum-pool');

var ports = {};
ports[process.env.DAEMON_DIFF1_PORT]= { //A port for your miners to connect to
            "diff": 200000, //the pool difficulty for this port

            /* Variable difficulty is a feature that will automatically adjust difficulty for
               individual miners based on their hashrate in order to lower networking overhead */
            "varDiff": {
                "minDiff": 30000, //Minimum difficulty
                "maxDiff": 100000000, //Network difficulty will be used if it is lower than this
                "targetTime": 15, //Try to get 1 share per this many seconds
                "retargetTime": 90, //Check to see if we should retarget every this many seconds
                "variancePercent": 30 //Allow time to very this % from target without retargeting
            }
        };

ports[process.env.DAEMON_DIFF2_PORT]={ //A port for your miners to connect to
            "diff": 10000000, //the pool difficulty for this port

            /* Variable difficulty is a feature that will automatically adjust difficulty for
               individual miners based on their hashrate in order to lower networking overhead */
            "varDiff": {
                "minDiff": 30000, //Minimum difficulty
                "maxDiff": 100000000, //Network difficulty will be used if it is lower than this
                "targetTime": 15, //Try to get 1 share per this many seconds
                "retargetTime": 90, //Check to see if we should retarget every this many seconds
                "variancePercent": 30 //Allow time to very this % from target without retargeting
            }
        };

ports[process.env.DAEMON_DIFF3_PORT]={ //Another port for your miners to connect to, this port does not use varDiff
            "diff": 256 //The pool difficulty
        };

var pool = Stratum.createPool({

    "coin": myCoin,

    "address": process.env.REWARD_ADDRESS, //Address to where block rewards are given
    "blockRefreshInterval": 10000, //How often to poll RPC daemons for new blocks, in milliseconds

    /* How many milliseconds should have passed before new block transactions will trigger a new
       job broadcast. */
    "txRefreshInterval": 20000,

    /* Some miner apps will consider the pool dead/offline if it doesn't receive anything new jobs
       for around a minute, so every time we broadcast jobs, set a timeout to rebroadcast
       in this many seconds unless we find a new job. Set to zero or remove to disable this. */
    "jobRebroadcastTimeout": 55,

    //instanceId: 37, //Recommend not using this because a crypto-random one will be generated

    /* Some attackers will create thousands of workers that use up all available socket connections,
       usually the workers are zombies and don't submit shares after connecting. This features
       detects those and disconnects them. */
    "connectionTimeout": 600, //Remove workers that haven't been in contact for this many seconds

    /* Sometimes you want the block hashes even for shares that aren't block candidates. */
    "emitInvalidBlockHashes": false,

    /* We use proper maximum algorithm difficulties found in the coin daemon source code. Most
       miners/pools that deal with scrypt use a guesstimated one that is about 5.86% off from the
       actual one. So here we can set a tolerable threshold for if a share is slightly too low
       due to mining apps using incorrect max diffs and this pool using correct max diffs. */
    "shareVariancePercent": 10,

    /* Enable for client IP addresses to be detected when using a load balancer with TCP proxy
       protocol enabled, such as HAProxy with 'send-proxy' param:
       http://haproxy.1wt.eu/download/1.5/doc/configuration.txt */
    "tcpProxyProtocol": false,

    /* If a worker is submitting a high threshold of invalid shares we can temporarily ban their IP
       to reduce system/network load. Also useful to fight against flooding attacks. If running
       behind something like HAProxy be sure to enable 'tcpProxyProtocol', otherwise you'll end up
       banning your own IP address (and therefore all workers). */
    "banning": {
        "enabled": true,
        "time": 600, //How many seconds to ban worker for
        "invalidPercent": 50, //What percent of invalid shares triggers ban
        "checkThreshold": 500, //Check invalid percent when this many shares have been submitted
        "purgeInterval": 300 //Every this many seconds clear out the list of old bans
    },

    /* Each pool can have as many ports for your miners to connect to as you wish. Each port can
       be configured to use its own pool difficulty and variable difficulty settings. varDiff is
       optional and will only be used for the ports you configure it for. */
    "ports": ports,


    /* Recommended to have at least two daemon instances running in case one drops out-of-sync
       or offline. For redundancy, all instances will be polled for block/transaction updates
       and be used for submitting blocks. Creating a backup daemon involves spawning a daemon
       using the "-datadir=/backup" argument which creates a new daemon instance with it's own
       RPC config. For more info on this see:
          - https://en.bitcoin.it/wiki/Data_directory
          - https://en.bitcoin.it/wiki/Running_bitcoind */
    "daemons": [
        {   //Main daemon instance
            "host": process.env.DAEMON_HOST,
            "port": parseInt(process.env.DAEMON_PORT, 10),
            "user": process.env.DAEMON_USER,
            "password": process.env.DAEMON_PASSWORD,
        },
    ],


    /* This allows the pool to connect to the daemon as a node peer to receive block updates.
       It may be the most efficient way to get block updates (faster than polling, less
       intensive than blocknotify script). It requires additional setup: the 'magic' field must
       be exact (extracted from the coin source code). */
    "p2p": {
        "enabled": false,

        /* Host for daemon */
        "host": "127.0.0.1",

        /* Port configured for daemon (this is the actual peer port not RPC port) */
        "port": 19333,

        /* If your coin daemon is new enough (i.e. not a shitcoin) then it will support a p2p
           feature that prevents the daemon from spamming our peer node with unnecessary
           transaction data. Assume its supported but if you have problems try disabling it. */
        "disableTransactions": true,

        /* Magic value is different for main/testnet and for each coin. It is found in the daemon
           source code as the pchMessageStart variable.
           For example, litecoin mainnet magic: http://git.io/Bi8YFw
           And for litecoin testnet magic: http://git.io/NXBYJA */
        "magic": "fcc1b7dc"
    }

}, function(ip, port, workerName, password, callback){ //stratum authorization function
   if (callback) {
      callback({
        error: null,
        authorized: true,
        disconnect: false
      });
   }
});


pool.on('share', function(isValidShare, isValidBlock, data){

    if (isValidBlock)
        console.log('Block found');
    else if (isValidShare)
        console.log('Valid share submitted');
    else if (data.blockHash)
        console.log('We thought a block was found but it was rejected by the daemon');
    else
        console.log('Invalid share submitted')

    console.log('share data: ' + JSON.stringify(data));
});



/*
'severity': can be 'debug', 'warning', 'error'
'logKey':   can be 'system' or 'client' indicating if the error
            was caused by our system or a stratum client
*/
pool.on('log', function(severity, logKey, logText){
    console.log(severity + ': ' + '[' + logKey + '] ' + logText);
});

pool.start();
