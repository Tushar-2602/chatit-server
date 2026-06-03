// import { emitError } from "../Utils/error.js";
import { getAllUserSockets } from "../Utils/getAllSocketUsers.js";

export const handleGeneralMsgOnRedis = async (instance,data) => {
const { destinationUserId} = data;

const receiverSockets = getAllUserSockets(instance,destinationUserId);

  if (!receiverSockets || receiverSockets.size === 0) {

    return;
  }

  const message = JSON.stringify(data);

  // send message to all active sockets of that user
  for (const socket of receiverSockets) {
    if (socket.readyState === socket.OPEN) {
      socket.send(message);
    }
  }

  // TODO add to streams for mongo update
}



export const handleSystemMsgOnRedis = async (instance, data) => {
    try {
        if (!data || data.subType !== "ack") return;

        const { userId, socketId } = data;
        if (!userId || !socketId) return;

        // 1. Find user connections
        const userConnections = instance.config.connectionMap?.get(userId);
        if (!userConnections) return;

        const targetSocket = userConnections.get(socketId);
        if (!targetSocket) return;

        // 2. Prepare payload (remove routing fields)
        const payload = {
            ...data,
            subType: "ackDelivered"
        };

        delete payload.socketId;
        delete payload.sequenceNumber;

        // 3. Send to websocket
        try {
            targetSocket.send(JSON.stringify(payload));
           // console.log("7");
        } catch (err) {
            // emitError("handleSystemMsg error: "+ err);
            throw err
        }

       

    } catch (err) {
        throw err
    }
};


