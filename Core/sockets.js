
import { URL } from "url";
import { handlePingPong } from "../Utils/wssPingPong.js";
import { authenticateConnection } from "../Utils/auth.js";
import { emitError, sendWsError } from "../Utils/error.js";
import { onMessageHandler } from "../Controller/messageController.js";
import { randomUUID } from "crypto";
import { getAllUserSockets } from "../Utils/getAllSocketUsers.js";

export const onConnectionHandler = async (instance, ws, req) => {
    try {


        const url = new URL(req.url, `http://${req.headers.host}`); // build url from request object

        const userId = await authenticateConnection(instance, url, ws); // user needs to send token if auth enabled else userId 

        const maxConnectionPerUserId = instance.config.maxConnectionPerUserId;
        if (maxConnectionPerUserId) {

            if (instance.config.redis?.isConnected) {
            // increment first (atomic)
            const redisClient=instance.config.redis?.base;
            const key = `ws:conn:${userId}`;
        const count = await redisClient.incr(key);


        if (count > maxConnectionPerUserId) {
          // rollback
          await redisClient.decr(key);
          sendWsError(ws,"max connections reached",1010);
          throw "max connections reached";
        }
        const maxConnectionPerUserIdPerServer = instance.config.maxConnectionPerUserIdPerServer;

        if (maxConnectionPerUserIdPerServer) {
            const  userConnections = getAllUserSockets(instance,userId);
            const currentConnections = userConnections.length;
            if (currentConnections>=maxConnectionPerUserIdPerServer) {
                sendWsError(ws,"max connections per server reached",1010);
                throw "max connections reached";
            }
        }

        }
        else{
            const  userConnections = getAllUserSockets(instance,userId);
            const currentConnections = userConnections.length;
            if (currentConnections>=maxConnectionPerUserId) {
                sendWsError(ws,"max connections reached",1010);
                throw "max connections reached";
            }
        }
        }

        ws.userId = userId;
        ws.socketId = randomUUID();
        ws.sequenceNumber = -1;



        // Store connection in map with socketId and userId
        const map = instance.config.connectionMap;

        if (!map.has(userId)) {
            map.set(userId, new Map());
        }

        map.get(userId).set(ws.socketId, ws);

        
        
        await handlePingPong(instance, ws); // attach ping pong utilities to ws


        ws.on("close", () => onConnectionCloseHandler(instance, ws));

        ws.on("error", (err) => {
            emitError(instance, err)
            try { ws.terminate(); } catch { }
        });

        ws.on("message", (data) => onMessageHandler(instance, data, ws));


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
                pipeline.set(heartbeatKey, "1", {
                    EX: 45
                });
                pipeline.exec();
            }
        } catch (error) {

        }
        ws.send(JSON.stringify({
                msgType: "system",
                subType: "userId",
                userId
            }));

    } catch (err) {

        emitError(instance, err);
        
        try { ws.close(); } catch { }
    }
};

export const onConnectionCloseHandler = async (instance, ws) => {
    const userId = ws.userId;
    const socketId = ws.socketId;

    if (!userId || !socketId) return;

    const userConnections = instance.config?.connectionMap?.get(userId);

    if (userConnections) {
        userConnections.delete(socketId);

        if (userConnections.size === 0) {
            instance.config.connectionMap.delete(userId);



            try {
                if (instance.config.redis?.isConnected) {

                    const redis = instance.config.redis?.general;
                    const key = `ws:conn:${userId}`;
                    const current = await redis.decr(key);

                    
                    const pipeline = redis.multi();
                    
                    if (current <= 0) {
                       pipeline.del(key);
                    }
                    const serverId = instance.config.serverId;

                    const heartbeatKey = `connectionMap_${userId}:${serverId}`;
                    const setKey = `connectionMap_${userId}`;
                    

                    // remove server from user set
                    pipeline.sRem(setKey, serverId);

                    // delete heartbeat key
                    pipeline.del(heartbeatKey);

                    // remove set if empty
                    pipeline.sCard(setKey);

                    pipeline.exec();
                }
            } catch (error) {
                emitError(instance, error);
            }

        }
    }
    const sequenceNumber = ws.sequenceNumber;
    const deadConnecionsSequence = instance.config.deadConnecionsSequence;
    const isSeqUpdated =ws.isSeqUpdated;
    if(sequenceNumber>-1 && isSeqUpdated === true){
        deadConnecionsSequence.set(userId,sequenceNumber);
    }



}