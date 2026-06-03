import { sendWsError } from "../Utils/error.js";
import { getActiveServersForUser,publishToServers } from "../Cache/redisUtils.js";
import { getAllUserSockets } from "../Utils/getAllSocketUsers.js";
import { handleGroupMsg } from "../Groups/groupUtils.js";

export const onMessageHandler = async (instance, payload, ws) => {
  let data ={};

  
  const now = Date.now();
  const MAX_GAP = instance.config.maxMessageGap || 1000;

  const redisClient = instance.config?.redis?.base;
  const key = `ws:msg:${ws.userId}`;


  // ---------------- REDIS ----------------
  if (instance.config.redis?.isConnected && redisClient) {
   
    //console.log("1");
      const last = await redisClient.get(key); // string or null

      if (last && (now - Number(last)) < MAX_GAP) {
        sendWsError(ws,"Rate limit exceeded",2008);
        return;
      }

      // update timestamp
      await redisClient.set(key, now);

      // optional TTL (avoid stale keys)
      await redisClient.expire(key, Math.ceil(MAX_GAP/60));
      //console.log("8");
   
  }

  // ---------------- FALLBACK ----------------
  else {
    const userId = ws.userId;
    const last = instance.config?.lastMessageMap.get(userId);

    if (last && (now - last) < MAX_GAP) {
      sendWsError(ws,"Rate limit exceeded",3008);
      return;
    }

    instance.config?.lastMessageMap.set(userId, now);
    
  }

 

  // 1️⃣ Parse message
  try {

    data = JSON.parse(payload.toString());
    data.fromUserId = ws.userId;
    data.timestamp = Date.now();
    
  } catch (err) {
    //emitError(instance,"Invalid JSON received")
    sendWsError(ws,"Invalid JSON received",1003)
    return;
  }

  const { msgType } = data;

  if (!msgType) {
    //emitError(instance,"msgType missing")
    sendWsError(ws,"msgType missing",1004)
    return;
  }


  // 2️⃣ Dispatch to specific handler
  try {
    switch (msgType) {
      case "direct":
        await handleDirectMsg(instance, data, ws);
        break;

      case "group":
        await handleGroupMsg(instance, data, ws);
        break;

      case "system":
        await handleSystemMsg(instance, data, ws);
        break;

      default:
        //emitError(instance,`Unknown msgType: ${msgType}`)
        sendWsError(ws,`Unknown msgType: ${msgType}`,1005)
    }

  } catch (err) {
    
    throw err;
    
  }
   
};

export const handleDirectMsg = async (instance, data, ws) => {
  const { destinationUserId, payload, fromUserId,messageId,timestamp } = data;
  
  if (!destinationUserId || typeof destinationUserId !== "string" || destinationUserId.trim()=="") {
    sendWsError(ws, "destinationUserId required", 1006);
    return;
  }
  
  if (!payload || typeof payload !== "string" ||payload.trim()=="") {
    sendWsError(ws, "payload required", 1007);
    return;
  }
  
  if(payload.size > instance.config?.maxMessageLength){
    sendWsError(ws,"Invalid payload received",1003)
    return;
    }
  
  const redisConfig = instance.config.redis;
  
  // 🔴 REDIS FLOW
  if (redisConfig?.isConnected) {
    try {
      const redis = redisConfig.general;
      const pub = redisConfig.pub;
      // data.serverId = instance.config.serverId; ????
      // data.socketId = ws.socketId;
      
      // create deterministic chatId (sorted to avoid duplicates)
      const chatId = [fromUserId, destinationUserId].sort().join("_");
      
      



// get global sequence number for destination user id




const seqKey = `sequenceCounter_${destinationUserId}`;

// Try to initialize first (only once)
if (instance.config?.mongo?.isConnected) {
  const exists = await redis.exists(seqKey);

  if (!exists) {
    const db = instance.config.mongo.db;

    const maxSeq = await db.collection("userMessages").findOne(
      { destinationUserId },
      { sort: { seq: -1 }, projection: { seq: 1 } }
    );

    const mongoSeq = maxSeq?.seq || 0;

    await redis.set(seqKey, mongoSeq, {
      NX: true,
      EX: 259200
    });
  }
}

// Single increment
const seq = await redis.incr(seqKey);



// attach
data.sequenceNumber = seq;

await sendAckSent(instance,ws,{fromUserId,messageId,seq});


// get windows sequence number for chat id 
const windowSeqKey = `windowSequenceCounter_${chatId}`;

if (instance.config?.mongo?.isConnected) {
  const exists = await redis.exists(windowSeqKey);

  if (!exists) {
    const db = instance.config.mongo.db;

    const maxWindowSeq = await db.collection("messageInfo").findOne(
      { chatId },
      { sort: { windowSequenceNumber: -1 }, projection: { windowSequenceNumber: 1 } }
    );

    const mongoWindowSeq = maxWindowSeq?.windowSequenceNumber || 0;

    await redis.set(windowSeqKey, mongoWindowSeq, {
      NX: true,
      EX: 259200
    });
  }
}

// Correct key here
const windowSeq = await redis.incr(windowSeqKey);

// attach
data.windowSequenceNumber = windowSeq;


  const db = instance.config?.mongo?.db;
    const userMessages = db.collection("userMessages");
    const messageInfo = db.collection("messageInfo");

    

    // Insert into messageInfo (actual message data)
    await messageInfo.insertOne({
        messageId,
        payload,
        chatId,
        windowSequenceNumber:windowSeq,
        userIdFrom:fromUserId
    });
    // Insert into userMessages (for receiver querying)
    await userMessages.insertOne({
        messageId,
        destinationUserId,
        sequenceNumber:seq,
        type:"direct",
        timestamp
    });



    // 4. get active servers
    const activeServers = await getActiveServersForUser(redis, destinationUserId);

    if (activeServers.length === 0) {
      return;
    }

    // 5. publish with seq
    await publishToServers(pub, activeServers, data);
    
//console.log("2");
    return;
  } catch (err) {
    //emitError(instance, err);
    // fallback to local delivery
    throw err;
  }
}
else{
    // 🟢 LOCAL DELIVERY (fallback / single server)
  // Get correct value from Mongo
  if (instance.config?.mongo?.isConnected) {
    const db = instance.config?.mongo?.db;
  const userMessages = db.collection("userMessages");
    const messageInfo = db.collection("messageInfo");
    const counters = db.collection("counters");

    
const chatId = [fromUserId, destinationUserId].sort().join("_");
    // 🔥 Atomic increment for sequenceNumber
    const seqResult = await counters.findOneAndUpdate(
        { _id: `sequenceNumber_${destinationUserId}` },
        { $inc: { value: 1 } },
        { upsert: true, returnDocument: "after" }
    );
   // console.log(seqResult);
    
    const sequenceNumber = seqResult.value;

    // 🔥 Atomic increment for windowSequenceNumber
    const winResult = await counters.findOneAndUpdate(
        { _id: `windowSequenceNumber_${chatId}` },
        { $inc: { value: 1 } },
        { upsert: true, returnDocument: "after" }
    );

    const windowSequenceNumber = winResult.value;

    // Insert into userMessages
    await userMessages.insertOne({
        messageId,
        destinationUserId,
        sequenceNumber,
        type:"direct",
        timestamp
    });

    // Insert into messageInfo
    await messageInfo.insertOne({
        messageId,
        payload,
        chatId,
        windowSequenceNumber,
        userIdFrom:fromUserId
    });
    data.sequenceNumber = sequenceNumber;

    
    data.windowSequenceNumber = windowSequenceNumber;
    
    
  }
    
  
  
  const receiverSockets = getAllUserSockets(instance,destinationUserId);
 // console.log(receiverSockets);
  
 await sendAckSent(instance,ws,{fromUserId,messageId});
 
  if (!receiverSockets || receiverSockets.length === 0) {
  //  sendWsError(ws,"userId not connected",1008)
    return;
  }
  
  const message = JSON.stringify(data);
  
  for (const socket of receiverSockets) {
    if (socket.readyState === socket.OPEN) {
      socket.send(message);
    }
  }
  }

};

export const handleSystemMsg = async (instance, data, ws) => {
   if (data?.subType == "ack") {
     try {
        
 
         const { messageId,sequenceNumber,fromUserId } = data;

         if (!messageId) return;
 
         let metaData = null;
 
         // 1. Try Redis (if connected)
         if (instance.config?.redis?.isConnected) {
             try {
                 const redisKey = `ack:${messageId}`;
                 const result = await instance.config.redis.base.get(redisKey);
 
                 if (result) {
                     metaData = JSON.parse(result);
                 }
                 //console.log("5");
             } catch (err) {
              //emitError(instance,"Redis fetch error: " + err)
              throw err
             }
         }
 
         // 2. Fallback to in-memory map
         if (!metaData) {
            const {meta,timer} = instance.config?.acknowledgementMap?.get(messageId);
            clearTimeout(timer)
            metaData=meta
         }
 
         // 3. If still not found → exit
         if (!metaData) return;
 
         const { serverId, socketId, userId } = metaData;

         if (sequenceNumber && ws.sequenceNumber<sequenceNumber) {
          ws.sequenceNumber=sequenceNumber;
          ws.isSeqUpdated = true;
        }
         // 4. If same server → send directly
         const destinationUserConnections = instance.config.connectionMap?.get(userId);
         let targetSocket=null;
         if (destinationUserConnections){

           targetSocket = destinationUserConnections.get(socketId);
         }
         if (targetSocket) {
 
             try {
                 data.subType = "ackDelivered"
                 delete data.sequenceNumber;
                 targetSocket.send(JSON.stringify(data));
                 
             } catch (err) {
                 //emitError(instance,"WebSocket send error: " + err)
                 throw err;
             }
         } else {
             // 5. Different server → publish to Redis
             if (!instance.config?.redis?.isConnected) return;
 
             const channel = `message_${serverId}`;
 
             const payload = {
                 ...data,
                 socketId,
                 userId
             };
 
             try {
                 await instance.config?.redis.pub.publish(
                     channel,
                     JSON.stringify(payload)
                 );
                 //console.log("6");
             } catch (err) {
                 //emitError(instance,"Redis publish error: "+err)
                 throw err;
             }
         }
 
     } catch (err) {
      //console.log(err);
      
         //emitError("handleSystemMsg error: "+ err)
         throw err
     }
   }

   // left to review
else if (data?.subType === "messageRequestWithSequenceNumber") {
     const {
  startingSequenceNumber,
  endingSequenceNumber,
  limit
} = data;

if (!instance?.config?.mongo?.isConnected) {
  sendWsError(ws,"service not available",1003);
  return;
}
// 🔥 Required validations
if (limit === undefined) {
  sendWsError(ws,"limit undefined",1001);
  return;
}

// limit validation
if (limit <= 0 || limit > 100) {
 sendWsError(ws,"limit must be between 1 to 100",1002);
  return;
}

const db = instance.config.mongo.db;
const userMessages = db.collection("userMessages");

// 🔥 Query
const query = {
  userIdTo: ws.userId
};

// sequence filter object
const sequenceFilter = {};

// Optional upper bound
if (endingSequenceNumber !== undefined) {
  sequenceFilter.$lte = endingSequenceNumber;
}

// Optional lower bound
if (startingSequenceNumber !== undefined) {
  sequenceFilter.$gte = startingSequenceNumber;
}

// Only add sequenceNumber if filters exist
if (Object.keys(sequenceFilter).length > 0) {
  query.sequenceNumber = sequenceFilter;
}

const pipeline = [
  { $match: query },

  // largest sequence numbers first
  { $sort: { sequenceNumber: -1 } },

  // always apply limit
  { $limit: limit },

  {
    $lookup: {
      from: "messageInfo",
      localField: "messageId",
      foreignField: "messageId",
      as: "messageInfo"
    }
  },

  {
    $unwind: {
      path: "$messageInfo",
      preserveNullAndEmptyArrays: true
    }
  },

  {
    $project: {
      _id: 0,
      messageId: 1,
      timestamp: 1,
      sequenceNumber: 1,
      userIdTo: 1,
      type: 1,

      payload: "$messageInfo.payload",
      chatId: "$messageInfo.chatId",
      windowSequenceNumber: "$messageInfo.windowSequenceNumber",
      userIdFrom: "$messageInfo.userIdFrom"
    }
  }
];

const messages = await userMessages.aggregate(pipeline).toArray();

// 🔥 Response
ws.send(JSON.stringify({
  msgType:"system",
  subType: "messageResponseWithSequenceNumber",
  messages
}));
    }

    // ping pong
    else if (data?.subType == "ping") {
      ws.send(JSON.stringify({
  msgType:"system",
  subType: "pong"
}));
    }
    // sequence no. update
    else if (data?.subType == "updateSequenceNumber") {
      const {sequenceNumber} = data;
      const userId = ws.userId;
      if (!sequenceNumber || sequenceNumber<1 || !isNaN(sequenceNumber)) {
        sendWsError(ws,"wrong sequence number",1004);
        return;
      }
      if(ws.sequenceNumber<sequenceNumber){
        ws.sequenceNumber=sequenceNumber;
      }
    }

    else if (data?.subType == "custom") {
      instance.emit("messageFromUser",data)
    }

};

export const sendAckSent = async (instance, ws, {
  fromUserId,
  messageId
}) => {
    try {
        // 1. Send ACK-SENT to sender immediately
        ws.send(JSON.stringify({
            msgType: "system",
            subType: "ackSent",
            messageId
        }));

        const meta = {
            userId: fromUserId,
            socketId: ws.socketId,
            serverId: instance.config.serverId
        };

        // 2. If Redis is connected → store in Redis with TTL
        if (instance.config?.redis?.isConnected) {
            try {
                const key = `ack:${messageId}`;
                await instance.config.redis.base.set(
                    key,
                    JSON.stringify(meta),
                    { EX: 100 } // 100 seconds TTL
                );
            } catch (err) {
                 //emitError(instance,err)
                 throw err
            }
        } 
        // 3. Fallback → store in memory with timeout cleanup
        else {
            const ackMap = instance.config.acknowledgementMap;

            const timer=setTimeout(() => {
                ackMap.delete(messageId);
            }, 500 * 1000);

            ackMap.set(messageId, {meta,timer});



            // add this timeout in ack map and clear it upon read
        }

    } catch (err) {
        throw err
    }
};
