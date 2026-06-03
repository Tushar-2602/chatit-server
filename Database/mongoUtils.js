import { closeRedis } from "../Cache/redisUtils.js";
import { LibError } from "../Utils/error.js";

export const closeMongo = async (instance) => {
    try {
        // console.log("close mongo");
        
        const mongoConfig = instance.config?.mongo;
        if (!mongoConfig) {
            throw new LibError("mongo not connected",1025);
            return;
        }

        if (mongoConfig.isConnectionType == "client") {
             instance.config.mongo = null;
        if (instance.config?.redis?.isConnected) {
            await closeRedis(instance);
        }
            return;
            
        }

        await mongoConfig.client.close();

        // Optional: cleanup reference
        instance.config.mongo = null;
        if (instance.config?.redis?.isConnected) {
            await closeRedis(instance);
        }
        
        
        
        instance.emit("mongoConnectionClose","Mongo connection closed successfully")


    } catch (err) {
        throw err
    }
};
export const setupMongoCollections = async (instance) => {
    const db = instance.config?.mongo?.db;

    // USER MESSAGES COLLECTION
    const userMessages = db.collection("userMessages");
    await userMessages.createIndex(
        { userIdTo: 1, sequenceNumber: -1 },
        { name: "userIdTo_sequence_idx" }
    );

    // MESSAGE INFO COLLECTION
    const messageInfo = db.collection("messageInfo");
    await messageInfo.createIndex(
        { messageId: 1 },
        { unique: true, name: "messageId_idx" }
    );
    await messageInfo.createIndex(
        { chatId: 1,windowSequenceNumber: -1 },
        { name: "chatId_windowSequence_idx" }
    );

    // GROUP INFO COLLECTION
    const groupInfo = db.collection("groupInfo");
await groupInfo.createIndex(
    { grpId: 1, userId: 1 },
    { unique: true }
);

    const syncedSequence = db.collection("syncedSequence");
    await syncedSequence.createIndex(
        { userId: 1 },
        { unique: true, name: "userId_idx" }
    );
    instance.emit("mongoConnection","Mongo collections and indexes set up successfully")
    
};