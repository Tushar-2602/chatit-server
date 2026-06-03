import { handleGeneralMsgOnRedis,handleSystemMsgOnRedis } from "./handleMessage.js";
// import { emitError } from "../Utils/error.js";

export const subscribePubSub = async (instance) => {
    const sub = instance.config.redis.sub;
    const serverId = instance.config.serverId;

    await sub.subscribe(`message_${serverId}`, (message) => {
        try {
            const data = JSON.parse(message);
            if (data.subType == "ack") {
              handleSystemMsgOnRedis(instance, data);
              return 
            }
            handleGeneralMsgOnRedis(instance, data);
           
            

        } catch (err) {
            //emitError(instance, err);
            throw err;
        }
    });
};

export const subscribeStreams = async (instance) => {
   
};

export const updateConnectionMap = async (instance) => {

    const redis = instance.config.redis.general;
    const serverId = instance.config.serverId;
    const connectionMap = instance.config.connectionMap;

    try {

        const pipeline = redis.multi();

        for (const userId of connectionMap.keys()) {

            const setKey = `connectionMap_${userId}`;
            const heartbeatKey = `connectionMap_${userId}:${serverId}`;

            // add serverId to set
            pipeline.sAdd(setKey, serverId);

            // heartbeat key with ttl
            pipeline.set(heartbeatKey, 1, {
                EX: 45
            });

        }

        await pipeline.exec();

    } catch (err) {
        throw err
    }
};

export const closeRedis = async (instance) => {
  const redis = instance.config?.redis;
  if (!redis) return;

  const clients = [redis.base,redis.pub,redis.sub,redis.stream,redis.general];

  await Promise.all(
    clients.map(async (client) => {
      if (!client) return;

      try {
        if (client.isOpen) {
          await client.quit();   // graceful close
          // console.log("redis closed gracefully");
          instance.emit("redisConnectionClose","redis closed gracefully")
          
        }
      } catch {
        try {
          client.disconnect();   // force close
          // console.log("redis closed forcefully");
          instance.emit("redisConnectionClose","redis closed forcefully")
        } catch {}
      }
    })
  );

  delete instance.config.redis;
};

export const getActiveServersForUser = async (redis, userId) => {
  const setKey = `connectionMap_${userId}`;
  const serverIds = await redis.sMembers(setKey);
  //console.log("3");

  if (!serverIds || serverIds.length === 0) return [];
if (Math.random() > 0.1 || 1) { //|| 1 for testing 
  return serverIds;
  // just trust set
}

  const pipeline = redis.multi();

  for (const serverId of serverIds) {
    const heartbeatKey = `connectionMap_${userId}:${serverId}`;
    pipeline.exists(heartbeatKey);
  }

  const results = await pipeline.exec();

  const activeServers = [];
  const staleServers = [];

  results.forEach((res, idx) => {
    const serverId = serverIds[idx];
    const exists = res[1]; // redis v4 format [err, result]

    if (exists) {
      activeServers.push(serverId);
    } else {
      staleServers.push(serverId);
    }
  });

  // cleanup stale servers
  if (staleServers.length > 0) {
    await redis.sRem(setKey, staleServers);
  }

  return activeServers;
};

export const publishToServers = async (pubClient, serverIds, data) => {

  const message = JSON.stringify(data);

  const pipeline = pubClient.multi();

  for (const serverId of serverIds) {
    const channel = `message_${serverId}`;
    pipeline.publish(channel, message);
  }

  await pipeline.exec();
  //console.log("4");
};

