import { sendAckSent } from "../Controller/messageController.js"
// import { emitError } from "../Utils/error.js";
import { sendWsError } from "../Utils/error.js";

export const handleGroupMsg = async (instance, data, ws) => {
    try {

        const { groupId, payload, fromUserId, messageId, timestamp } = data;

        const db = instance.config?.mongo?.db;
                if(!db){
                    sendWsError(ws,"group functionality not available",1006,messageId)
                }
        const redis = instance.config?.redis?.base;
        
    if(payload.size > instance.config?.maxMessageLength){
    sendWsError(ws,"Invalid payload received",1004,messageId)
    return;
    }



        // 2. Get group members
        const members = await db.collection("groupInfo")
            .find(
                { groupId },
                { projection: { _id: 0, userId: 1 } }
            )
            .toArray();

        let userIds = members.map(m => m.userId);
        // ✅ membership validation
if (!userIds.includes(fromUserId)) {
    //console.log(fromUserId);
    //console.log(userIds);
    
    
    sendWsError(ws, "User is not a member of this group", 1005,messageId);
    return; // stop further execution
}



        // =========================================
        // 🔢 SEQUENCE NUMBERS (NOT IMPLEMENTED)
        // =========================================

        const windowSequenceNumber = await getWindowSequenceNumber(instance, groupId);                 // TODO


        // =========================================
        // 💾 STORE MESSAGE (MongoDB)
        // =========================================

        const messageInfoDoc = {
            messageId,
            payload,
            chatId: groupId,
            windowSequenceNumber,
            userIdFrom: fromUserId,
            timestamp
        };

        const userMessagesDocs = [];

        const sequenceMap = new Map();

        for (const userId of userIds) {
            const seq = await getSequenceNumber(instance, userId);
            sequenceMap.set(userId, seq);

            userMessagesDocs.push({
                messageId,
                timestamp,
                sequenceNumber: seq,
                destinationUserId: userId,
                type: "group"
            });
        }

        await Promise.all([
            db.collection("messageInfo").insertOne(messageInfoDoc),
            userMessagesDocs.length
                ? db.collection("userMessages").insertMany(userMessagesDocs)
                : null
        ]);

        await sendAckSent(instance, ws, { fromUserId, messageId });


        // =========================================
        // 🚀 REDIS FLOW (PIPELINED)
        // =========================================
        if (instance.config?.redis?.isConnected) {
    const redis = instance.config.redis.general;

    // =========================================
    // 🔍 FETCH CONNECTION MAP (parallel)
    // =========================================
    const keys = userIds.map(userId => `connectionMap_${userId}`);

    const results = await Promise.all(
        keys.map(key => redis.sMembers(key))
    );

    // =========================================
    // 🧠 BUILD server → users map
    // =========================================
    const serverToUsersMap = new Map();

    results.forEach((serverIds, index) => {
        const userId = userIds[index];

        (serverIds || []).forEach(serverId => {
            if (!serverToUsersMap.has(serverId)) {
                serverToUsersMap.set(serverId, []);
            }
            serverToUsersMap.get(serverId).push(userId);
        });
    });

    // =========================================
    // 🚀 PUBLISH (parallel)
    // =========================================
    const publishTasks = [];

    for (const [serverId, users] of serverToUsersMap.entries()) {
        for (const userId of users) {
            const userSeq = sequenceMap.get(userId);

            publishTasks.push(
                redis.publish(
                    `message_${serverId}`,
                    JSON.stringify({
                        destinationUserId: userId,
                    
                                ...data,
                                sequenceNumber: userSeq,
                                windowSequenceNumber,
                                timestamp
                            
                        
                    })
                )
            );
        }
    }

    await Promise.all(publishTasks);
}

        // =========================================
        // ⚡ FALLBACK (NO REDIS)
        // =========================================
        else {
            const connectionMap = instance.config.connectionMap;

            for (const userId of userIds) {
                const sockets = connectionMap?.get(userId);
                if (!sockets) continue;

                const userSeq = sequenceMap.get(userId);

                const userMessage = {

                        ...data,
                        destinationUserId:userId,
                        sequenceNumber: userSeq,
                        windowSequenceNumber,
                        timestamp
                    
                };

                for (const [, clientWs] of sockets) {
                    clientWs.send(JSON.stringify(userMessage));
                }
            }
        }

    } catch (err) {
        //emitError(instance, err);
        throw err;
    }
};

const getWindowSequenceNumber = async (instance, groupId) => {
    if (instance.config.redis?.isConnected) {
        const redis = instance.config.redis?.general
        // get windows sequence number for chat id 
        const windowSeqKey = `windowSequenceCounter_${groupId}`;

        // Step 1: try increment directly

        if (instance.config?.mongo?.isConnected) {
            // Key did not exist before → we might need initialization
            const exists = await redis.exists(windowSeqKey);
            if (!exists) {

                // Get correct value from Mongo
                const db = instance.config?.mongo?.db;
                const maxWindowSeq = await db.collection("messageInfo").findOne(
                    { chatId:groupId },
                    { sort: { windowSequenceNumber: -1 }, projection: { windowSequenceNumber: 1 } }
                );

                const mongoWindowSeq = maxWindowSeq?.windowSequenceNumber || 0;

                // Try to initialize (only one wins)
                redis.set(windowSeqKey, mongoWindowSeq, {
                    NX: true,
                    EX: 259200
                }); //3 days expiry
            }
        }

        let windowSeq = await redis.incr(windowSeqKey);

        // attach
        return windowSeq
    }

    if (instance.config.mongo?.isConnected) {
        const db = instance.config.mongo?.db
        const counters = db.collection("counters")
        const winResult = await counters.findOneAndUpdate(
            { _id: `windowSequenceNumber_${groupId}` },
            { $inc: { value: 1 } },
            { upsert: true, returnDocument: "after" }
        );

        return winResult.value;
    }

    return null;



}

const getSequenceNumber = async (instance, destinationUserId) => {
    if (instance.config.redis?.isConnected) {
        const redis = instance.config.redis?.general
        // get windows sequence number for chat id 
        const seqKey = `sequenceCounter_${destinationUserId}`;

        // Step 1: try increment directly
        
        if (instance.config?.mongo?.isConnected) {
            // key did not exist before → we might need initialization
            const exists = await redis.exists(seqKey);
            
            if (!exists) {
                // Get correct value from Mongo
                const db = instance.config?.mongo?.db;
            const maxSeq = await db.collection("userMessages").findOne(
                { destinationUserId },
                { sort: { sequenceNumber: -1 }, projection: { sequenceNumber: 1 } }
            );
            
            const mongoSeq = maxSeq?.sequenceNumber || 0;
            
            // Try to initialize (only one wins)
            redis.set(seqKey, mongoSeq, {
                NX: true,
                EX: 259200
            }); //3 days expiry
            
            }
            
        }
        let seq = await redis.incr(seqKey);


        // attach
        return seq
    }

    if (instance.config.mongo?.isConnected) {
        const db = instance.config.mongo?.db
        const counters = db.collection("counters")
        const seqResult = await counters.findOneAndUpdate(
            { _id: `sequenceNumber_${destinationUserId}` },
            { $inc: { value: 1 } },
            { upsert: true, returnDocument: "after" }
        );

        return seqResult.value;
    }

    return null;
}