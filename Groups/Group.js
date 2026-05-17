import randomUUID  from "crypto";
import { Chatty } from "../Core/src.js";
import { emitError } from "../Utils/error.js";
import { getAllUserSockets } from "../Utils/getAllSocketUsers.js";
Chatty.prototype.addToGroup = async function (grpId, userIds) {
    try {
        const db = this.config?.mongo?.db;
        const groupInfo = db.collection("groupInfo");

        // Normalize input → always array
        const idsArray = Array.isArray(userIds) ? userIds : [userIds];

        const docs = idsArray.map(userId => ({
            groupId:grpId,
            userId,
            joinedAt: new Date()
        }));

        // Insert all, ignore duplicates
        const result = await groupInfo.insertMany(docs, {
            ordered: false // 🔥 continue even if duplicates occur
        });

        return result

     
    } catch (err) {
        // Ignore duplicate key errors
        if (err.code === 11000) {
            return { message: "Some users already exist, rest inserted" };
        }

        emitError(this, err);
        throw err;
    }
};

Chatty.prototype.removeFromGroup = async function (grpId, userIds) {
    try {
    
        const groupInfo = db.collection("groupInfo");

        // Normalize input → always array
        const idsArray = Array.isArray(userIds) ? userIds : [userIds];

        const result = await groupInfo.deleteMany({
            grpId,
            userId: { $in: idsArray }
        });
        return result
     

    } catch (err) {
        emitError(this, err);
        throw err;
    }
};

Chatty.prototype.sendSystemMessageToGroup = async function (groupId,payload) {
    try {
       //const { groupId, payload, fromUserId, messageId, timestamp } = data;
       
               const db = this.config?.mongo?.db;
               const redis = this.config?.redis?.base;
       
       
       
               // 2. Get group members
               const members = await db.collection("groupInfo")
                   .find(
                       { groupId },
                       { projection: { _id: 0, userId: 1 } }
                   )
                   .toArray();
       
               let userIds = members.map(m => m.userId);
               // ✅ membership validation
    //    if (!userIds.includes(fromUserId)) {
    //        console.log(fromUserId);
    //        console.log(userIds);
           
           
    //        sendWsError(ws, "User is not a member of this group", 403);
    //        return; // stop further execution
    //    }
       
       
       
               // =========================================
               // 🔢 SEQUENCE NUMBERS (NOT IMPLEMENTED)
               // =========================================
       
              // const windowSequenceNumber = await getWindowSequenceNumber(instance, groupId);                 // TODO
       
       
               // =========================================
               // 💾 STORE MESSAGE (MongoDB)
               // =========================================
       
            //    const messageInfoDoc = {
            //        messageId,
            //        payload,
            //        chatId: groupId,
            //        windowSequenceNumber,
            //        userIdFrom: fromUserId,
            //        timestamp
            //    };
       
            //    const userMessagesDocs = [];
       
            //    const sequenceMap = new Map();
       
            //    for (const userId of userIds) {
            //        const seq = await getSequenceNumber(instance, userId);
            //        sequenceMap.set(userId, seq);
       
            //        userMessagesDocs.push({
            //            messageId,
            //            timestamp,
            //            sequenceNumber: seq,
            //            destinationUserId: userId,
            //            type: "group"
            //        });
            //    }
       
            //    await Promise.all([
            //        db.collection("messageInfo").insertOne(messageInfoDoc),
            //        userMessagesDocs.length
            //            ? db.collection("userMessages").insertMany(userMessagesDocs)
            //            : null
            //    ]);
       
            //    sendAckSent(instance, ws, { fromUserId, messageId });
       
       
               // =========================================
               // 🚀 REDIS FLOW (PIPELINED)
               // =========================================
               if (this.config?.redis?.isConnected) {
           const redis = this.config.redis.general;
       
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
                   //const userSeq = sequenceMap.get(userId);
       
                   publishTasks.push(
                       redis.publish(
                           `message_${serverId}`,
                           JSON.stringify({
                               destinationUserId: userId,
      msgType: "system",
      subType: "custom",
      payload
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
                   const connectionMap = this.config.connectionMap;
       
                   for (const userId of userIds) {
                       const sockets = getAllUserSockets(this,userId);
                       if (!sockets) continue;
       
                       //const userSeq = sequenceMap.get(userId);
       
                       const userMessage = {
                                      destinationUserId: userId,
      msgType: "system",
      subType: "custom",
      payload
                                   
                       };
       
                       for (const clientWs of sockets.values()) {
    clientWs.send(JSON.stringify(userMessage));
}
                   }
               }
       

    } catch (err) {
        emitError(this,err)
      //  throw err;
    }
};

Chatty.prototype.getGroupMembers = async function (grpId) {
    try {
        
        const groupInfo = db.collection("groupInfo");

        const docs = await groupInfo
            .find({ grpId }, { projection: { _id: 0, userId: 1 } })
            .toArray();

        // Extract userIds
        const userIds = docs.map(doc => doc.userId);

        return userIds;

    } catch (err) {
        emitError(this, err);
        throw err;
    }
};


// Chatty.prototype.createGroup = async function (userIds) {
//     try {
        
//         const groupInfo = db.collection("groupInfo");

//         // Normalize input → always array
//         const idsArray = Array.isArray(userIds) ? userIds : [userIds];

//         if (!idsArray.length) {
//             throw new Error("At least one user required");
//         }

//         // Generate groupId
//         const grpId = randomUUID();

//         const docs = idsArray.map(userId => ({
//             grpId,
//             userId,
//             joinedAt: new Date()
//         }));

//         await groupInfo.insertMany(docs);

//         return grpId;

//     } catch (err) {
//         emitError(this, err);
//         throw err;
//     }
// };
Chatty.prototype.deleteGroup = async function (grpId) {
    try {
     
        const groupInfo = db.collection("groupInfo");

        const result = await groupInfo.deleteMany({ grpId });

        return {
            deletedCount: result.deletedCount
        };

    } catch (err) {
        emitError(this, err);
        throw err;
    }
};
