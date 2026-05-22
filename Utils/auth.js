import { Chatty } from "../Core/src.js";
import { emitError } from "./error.js";
import { sendWsError } from "./error.js";
Chatty.prototype.setTokenKey = async function (tokenKey) {
    try {
        if (!tokenKey || typeof tokenKey !== "string" || tokenKey.trim() === "") {
            throw new Error("Invalid token");
        }

        this.config.tokenKey = tokenKey;

    } catch (err) {
        emitError(this, err);
        throw err;
    }
};

Chatty.prototype.getTokenKey = async function () {
    try {
        if (!this.config.tokenKey) {
            throw new Error("Token key not set");
        }

        return this.config.tokenKey;

    } catch (err) {
        emitError(this, err);
        throw err;
    }
};

Chatty.prototype.removeTokenKey = async function () {
    try {
        delete this.config.tokenKey;
    } catch (err) {
        emitError(this, err);
        throw err;
    }
};

Chatty.prototype.generateToken = async function (userId, expiresIn) {
    try {
        if (!this.config.tokenKey) {
            throw new Error("Token key not set");
        }

        if (!userId || typeof userId !== "string" || userId.trim() === "") {
            throw new Error("userId required");
        }

        if (!expiresIn || typeof expiresIn !== "number") {
            throw new Error("expiry time required");
        }


        // generate token

        const jwtModule = await import("jsonwebtoken");
        const jwt = jwtModule.default;

        const token = jwt.sign(
            { userId: userId },
            this.config.tokenKey,
            { expiresIn: expiresIn }
        );

        return token;

    } catch (err) {
        emitError(this, err);
        throw err;
    }
};

const verifyJwt = async (ws,tokenKey, token) => {

    const jwtModule = await import("jsonwebtoken");
    const jwt = jwtModule.default;

    try {
        return jwt.verify(token, tokenKey);
    } catch {
            
        throw new Error("Invalid or expired token");
    }
};

export const authenticateConnection = async (instance, url, ws) => {

    // JWT authentication mode
    if (instance.config.tokenKey) {

        const token = url.searchParams.get("token");

        if (!token || typeof token !== "string" || token.trim() === "") {
            sendWsError(ws, "Authentication token missing", 1000)
            throw new Error("Authentication token missing");
        }

        try {
            const decoded = await verifyJwt(ws,instance.config.tokenKey, token);
            
            if (!decoded?.userId) {
                sendWsError(ws, "Invalid token payload", 1001)
                throw new Error("Invalid token payload");
            }
            
            return decoded.userId;
        } catch (error) {
            sendWsError(ws,error,1002)
            throw error;
        }
    }

    // Direct userId mode (no JWT)
    const userId = url.searchParams.get("userId");

    if (!userId || typeof userId !== "string" || userId.trim() === "") {
        sendWsError(ws, "userId required ", 1002)
        throw new Error("userId required (authentication disabled)");
    }

    return userId;
};