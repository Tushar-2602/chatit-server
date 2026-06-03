import { onConnectionHandler } from "../Core/sockets.js";
import { startPingPong } from "./wssPingPong.js";
// import { emitError } from "./error.js";
import { closeRedis } from "../Cache/redisUtils.js";
import { closeMongo } from "../Database/mongoUtils.js";

export async function attachWSS(instance, server) {

  const { WebSocketServer } = await import("ws");

  const wss = new WebSocketServer({ server });

  instance.config.server = server;
  instance.config.wss = wss;

  wss.on("connection", (ws, req) => onConnectionHandler(instance, ws, req));

  wss.on("error", (err) => {
    throw err
  });

  wss.on("close", () => onWssServerCloseHandler(instance));

  await startPingPong(instance)

  return wss;
}

const onWssServerCloseHandler = (instance) => {
  instance.emit("shutDown");

  try {

    delete instance.config.wss;
    delete instance.config.server;
    delete instance.config.wssConnectionType;
    clearInterval(instance.config.wssInterval)
    // if (instance.config.redis?.isConnected) {
    //   closeRedis(instance)
    // }
    if (instance.config.mongo?.isConnected) {
      closeMongo(instance)
    }
  } catch (err) {
    throw err
   }
}