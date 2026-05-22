import { closeRedis } from "../Cache/redisUtils.js";
import { awaitWithTimeout } from "./awaitTimeoutHelper.js";
import { emitError } from "./error.js";
import { closeMongo } from "../Database/mongoUtils.js";
export const handlePingPong = async (instance,ws) => {
     ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
      try {
        if (instance.config.redis?.isConnected) {
          const redis = instance.config.redis.general
          const pipeline = redis.multi();
          const serverId = instance.config.serverId;
          const userId = ws.userId;
          const heartbeatKey = `connectionMap_${userId}:${serverId}`;
          const setKey = `connectionMap_${userId}`;
          pipeline.sAdd(setKey, serverId);
    
                // heartbeat key with ttl
                pipeline.set(heartbeatKey, 1, {
                    EX: 45
                });
          pipeline.exec();
        }
      } catch (error) {
        
      }
      
      
    });
}

export const startPingPong= async(instance)=>{
    const wss = instance.config.wss;
  const interval = setInterval(async () => {
    console.log("interval");
    
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }

      ws.isAlive = false;

      try {
        ws.ping();
      } catch {
        ws.terminate();
      }
    });

     if (instance.config.redis?.isConnected) {
      try{
             await awaitWithTimeout(instance.config.redis?.base?.ping());
         }
         catch (err) {
             closeRedis(instance)
             emitError(instance,err)
         }
     }
     if (instance.config.mongo?.isConnected) {
      try{
            await awaitWithTimeout(instance.config.mongo?.db?.admin()?.ping());

         }
         catch (err) {
          console.log("mongo closed");
          
             closeMongo(instance)
             emitError(instance,err)
         }
         const db = instance.config.mongo.db;
    const collection = db.collection("syncedSequence");

const bulkOps = [];


wss.clients.forEach((ws) => {
  const isSeqUpdated =ws.isSeqUpdated;
    if (!ws.userId || ws.sequenceNumber == null || ws.userId==-1 || ws.sequenceNumber == -1 || !isSeqUpdated) return;

    bulkOps.push({
  updateOne: {
    filter: { userId: ws.userId },
    update: {
      $max: { sequenceNumber: ws.sequenceNumber }
    },
    upsert: true
  }
});
console.log(ws.userId + " " + ws.sequenceNumber);

});

/// implement dead connectionss
const deadConnecionsSequence = instance.config.deadConnecionsSequence;
for (const [userId, sequenceNumber] of deadConnecionsSequence.entries()) {
  bulkOps.push({
  updateOne: {
    filter: { userId },
    update: {
      $max: { sequenceNumber }
    },
    upsert: true
  }
});
}
deadConnecionsSequence.clear();

// execute in one go (🔥 important)
if (bulkOps.length > 0) {
    await collection.bulkWrite(bulkOps);
}

     }


  }, 30000);

  instance.config.wssInterval=interval
}