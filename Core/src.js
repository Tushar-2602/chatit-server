import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";


export class Chatty extends EventEmitter {
  constructor(options = {}) {
    super();

    // config setup

    this.config = {
      connectionMap: new Map(), // used to store websocket connections on this server map(userId,map(socketId,ws))
      tokenKey: options.tokenKey, // used for auth if enabled
      acknowledgementMap: new Map(), // used to ack when redis isn't connected
      lastMessageMap: new Map(),

      maxConnectionPerUserId:100,
      maxMessageGap:5000,
      maxMessageLength:100,
      maxConnectionPerUserIdPerServer:100,

    };


    // serverId setup

    if (!options.serverId || typeof options.serverId !== "string" || options.serverId.trim() === "") {
      const randomServerId = randomUUID();  //serverId must be unique in cluster
      this.config.serverId = randomServerId
      process.nextTick(() => {
        this.emit("warning", {
          message: `serverId not given, server id {${randomServerId}} is assigned`
        });
      });
      // check unique server id
    } else {
      this.config.serverId = options.serverId;
    }


    // tokenKey setup

    if (!this.config.tokenKey) {
      process.nextTick(() => {
        this.emit("warning", {
          message: "Authentication tokenKey not set. JWT authentication will be disabled."
        });
      });
    }



  }
}