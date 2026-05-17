import { closeRedis } from "../Cache/redisUtils.js";

export const closeMongo = async (instance) => {
    try {
        const mongoConfig = instance.config?.mongo;

        if (mongoConfig.isConnectionType == "client") {
            console.log("Mongo connection safe to close");
            return;
        }

        await mongoConfig.client.close();

        console.log("Mongo connection closed successfully");

        // Optional: cleanup reference
        instance.config.mongo = null;
        if (instance.config?.redis?.isConnected) {
            await closeRedis(instance);
        }

    } catch (err) {
        console.error("Error while closing Mongo connection:", err);
    }
};
export const setupMongoCollections = async (instance) => {
    const db = instance.config.mongo.db;

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