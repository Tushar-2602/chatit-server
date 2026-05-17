import { Chatty } from "../Core/src.js";
import { emitError } from "../Utils/error.js";
import { getActiveServersForUser,publishToServers } from "../Cache/redisUtils.js";
import { getAllUserSockets } from "../Utils/getAllSocketUsers.js";
Chatty.prototype.sendSystemMessageToUser = async function (userId, message) {
  try {
    if (!userId) throw new Error("userId required");
    if (!message) throw new Error("message required");

    const redisConfig = this.config.redis;

    // unified payload
    const data = {
      destinationUserId: userId,
      msgType: "system",
      subType: "custom",
      payload: message
    };

    // 🔴 REDIS FLOW
    if (redisConfig?.isConnected) {
      try {
        const redis = redisConfig.general;
        const pub = redisConfig.pub;

        // 1. get active servers
        const activeServers = await getActiveServersForUser(redis, userId);

        if (activeServers.length > 0) {
          // 2. reuse your function
          await publishToServers(pub, activeServers, data);
          return true;
        }
      } catch (err) {
        console.error("Redis system message failed:", err);
        // fallback continues
      }
    }

    // 🟢 LOCAL FALLBACK
    const sockets = getAllUserSockets(this,userId);
    if (!sockets || sockets.size === 0) return;

    const msg = JSON.stringify(data);

    for (const ws of sockets) {
      if (ws.readyState === ws.OPEN) {
        ws.send(msg);
      }
    }

  } catch (err) {
    emitError(this, err);
    //return false;
    
  }
};