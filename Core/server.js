import { attachWSS } from "../Utils/attachWssToServer.js";
import { Chatty } from "./src.js";
import {  LibError,LibReturn } from "../Utils/error.js";

Chatty.prototype.attachServer = async function (httpServer) {   // attach to server given by user
    try {

        // check server

        if (!httpServer) {
            throw new LibError("Chatty: httpServer is required",1007,{})
        }


        const wss = await attachWSS(this, httpServer); // attach websocket and server 

        this.config.wssConnectionType = "Server";

        return new LibReturn({wss})

    } catch (err) {
       // emitError(this, err);
        throw new LibError(err);
    }
};

Chatty.prototype.connectPort = async function (port) {   // make http server on port given by user then connect 
    try {

        const { createServer } = await import("node:http");

        if (!port) {
            throw new LibError("Chatty: port is required",1008)
        }

        const server = createServer();   // create server

       const wss = await attachWSS(this, server);  // attach websocket and server

        await new Promise((resolve, reject) => {   // run server
            server.once("error", reject);
            server.listen(port, resolve);
        });

        this.config.wssConnectionType = "Port"

        return new LibReturn({server,wss})

    } catch (err) {
        // emitError(this, err)
        throw new LibError(err);
    }
};
Chatty.prototype.shutdown = async function () {
    try {
        if (this.config.wssConnectionType == "Port") { // if port was given close both server and wss

            const server = this.config.server;

            await closeClientsAndServer(this);

            if (server) {
                await new Promise((resolve) => {
                    server.close(() => {
                        resolve();
                    });
                });
            }

        } else if (this.config.wssConnectionType == "Server") {  // if server was given close only wss
            await closeClientsAndServer(this);
        }

return new LibReturn()

    } catch (err) {
        // emitError(this, err);
        throw new LibError(err);
    }
};

const closeClientsAndServer = async (instance) => {
    const wss = instance.config.wss

    // Stop the WebSocket server from recieving new connections
    wss.close(); 

    // Close all active WebSocket connections
    for (const ws of wss.clients) {
        ws.terminate(); // force close
    }


}

Chatty.prototype.setServerId = async function (serverId) {  // cant change if server is running 
    try {

        if (!serverId || typeof serverId !== "string" || serverId.trim() === "") {
            throw new LibError("Invalid serverId",1009)
        }

        // Prevent changing serverId after server started
        if (this.config.server || this.config.wss || this.config.wssConnectionType) {
           
            throw new LibError("Cannot change serverId after server has started",1010)
        }

        this.config.serverId = serverId;
return new LibReturn()

    } catch (err) {
        // emitError(this, err);
        throw new LibError(err);
    }
};

Chatty.prototype.getServerId = async function () {
    try {

        if (!this.config || !this.config.serverId) {
            
            throw new LibError("ServerId is not set",1011);
        }

        return new LibReturn({serverId:this.config.serverId})

    } catch (err) {
        // emitError(this, err);
        throw new LibError(err);
    }
};

