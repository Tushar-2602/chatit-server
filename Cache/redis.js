import { Chatty } from "../Core/src.js";
import { awaitWithTimeout } from "../Utils/awaitTimeoutHelper.js";
import { updateConnectionMap,subscribePubSub,subscribeStreams, closeRedis } from "./redisUtils.js";
import { emitError } from "../Utils/error.js";

Chatty.prototype.addRedis = async function (input) {
    try {
        let redisClient;

        // CASE 1: user passed URL
         if (typeof input === "string") {
            let createClient;

            try {
               const { createClient } = await import("redis");
               redisClient = createClient({ url: input });
            } catch (e) {
                //console.log(e);
                
                throw new Error(
                    "Redis package not installed. Run: npm install redis"
                );
            }

        }  
        // CASE 2: user passed client
        else if (input && typeof input.publish === "function" && typeof input.duplicate === "function") {
            redisClient = input;
        } 
        else {
            throw new Error("Provide a valid Redis URL or node-redis client");
        }

        // connect if not connected
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }

        // test connection
        try {
            await awaitWithTimeout(redisClient.ping());
        } catch (e) {
            throw new Error("Redis connection test failed");
        }

        // duplicate clients
        const pub = redisClient.duplicate();
        const sub = redisClient.duplicate();
        const stream = redisClient.duplicate();
        const general = redisClient.duplicate();

        await Promise.all([
            pub.connect(),
            sub.connect(),
            stream.connect(),
            general.connect()
        ]);

        // store clients
        this.config.redis = {
            base: redisClient,
            pub,
            sub,
            stream,
            general,
            isConnected: true
        };

        // initialize features
        await subscribePubSub(this);
        await subscribeStreams(this);
        await updateConnectionMap(this);
        this.emit("redisConnection","Redis connected")

    } catch (err) {
        emitError(this, err);
        throw err;
    }
};

Chatty.prototype.closeRedis = async function () {
    try {
       closeRedis(this)
    } catch (err) {
        emitError(this, err);
        throw err;
    }
};

