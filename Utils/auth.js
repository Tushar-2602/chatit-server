import { Chatty } from "../Core/src.js";
import {  LibError,LibReturn } from "./error.js";
import { sendWsError } from "./error.js";
Chatty.prototype.setTokenKey = async function (tokenKey) {
    try {
        if (!tokenKey || typeof tokenKey !== "string" || tokenKey.trim() === "") {
            throw new LibError("Invalid token",1019);
        }

        this.config.tokenKey = tokenKey;
        return new LibReturn()

    } catch (err) {
        // emitError(this, err);
        throw new LibError(err)
    }
};

Chatty.prototype.getTokenKey = async function () {
    try {
        if (!this.config.tokenKey) {
            throw new LibError("Token key not set",1020);
        }

        return this.config.tokenKey;
        return new LibReturn({tokenKey:this.config.tokenKey})

    } catch (err) {
        
        throw new LibError(err)
    }
};

Chatty.prototype.removeTokenKey = async function () {
    try {
        delete this.config.tokenKey;
        return new LibReturn()
    } catch (err) {
        
        throw new LibError(err)
    }
};

Chatty.prototype.generateToken = async function (userId, expiresIn) {
    try {
        if (!this.config.tokenKey) {
            throw new LibError("Token key not set",1021);
        }

        if (!userId || typeof userId !== "string" || userId.trim() === "") {
            throw new LibError("userId required",1022);
        }

        if (!expiresIn || typeof expiresIn !== "number") {
            throw new LibError("expiry time required",1023);
        }


        // generate token

        const jwtModule = await import("jsonwebtoken");
        const jwt = jwtModule.default;

        const token = jwt.sign(
            { userId: userId },
            this.config.tokenKey,
            { expiresIn: expiresIn }
        );

        
        return new LibReturn({token})

    } catch (err) {
        //emitError(this, err);
        throw new LibError(err)
    }
};

const verifyJwt = async (ws,tokenKey, token) => {

    const jwtModule = await import("jsonwebtoken");
    const jwt = jwtModule.default;

    try {
        return jwt.verify(token, tokenKey);
    } catch {
            
        throw new LibError("Invalid or expired token",1024);
    }
};

export const authenticateConnection = async (instance, url, ws) => {

    // JWT authentication mode
    if (instance.config.tokenKey) {

        const token = url.searchParams.get("token");

        if (!token || typeof token !== "string" || token.trim() === "") {
            sendWsError(ws, "Authentication token missing", 1007)
            //throw new Error("Authentication token missing");
            return;
        }

        try {
            const decoded = await verifyJwt(ws,instance.config.tokenKey, token);
            
            if (!decoded?.userId) {
                sendWsError(ws, "Invalid token payload", 1008)
               // throw new Error("Invalid token payload");
               return;
            }
            
            return decoded.userId;
        } catch (error) {
            //sendWsError(ws,error,1002)
            throw error;
        }
    }

    // Direct userId mode (no JWT)
    const userId = url.searchParams.get("userId");

    if (!userId || typeof userId !== "string" || userId.trim() === "") {
        sendWsError(ws, "userId required ", 1009)
        //throw new Error("userId required (authentication disabled)");
        return;
    }

    return userId;
};