import { LibError,LibReturn } from "../Utils/error.js";

Chatty.prototype.setMaxConnectionPerUserId = async function (value) {
    try {
        if (typeof value !== "number" || value < 1) {
            throw new Error("maxConnectionPerUserId must be a number greater than 0");
        }
        this.config.maxConnectionPerUserId = value;
        return new LibReturn()
    } catch (err) {
      
        throw new LibError(err,1001);
    }
};

Chatty.prototype.setMaxMessageGap = async function (value) {
    try {
        if (typeof value !== "number" || value < 0) {
            throw new Error("maxMessageGap must be a non-negative number");
        }
        this.config.maxMessageGap = value;
        return new LibReturn()
    } catch (err) {
     
        throw new LibError(err,1002);
    }
};

Chatty.prototype.setMaxMessageLength = async function (value) {
    try {
        if (typeof value !== "number" || value < 1) {
            throw new Error("maxMessageLength must be a number greater than 0");
        }
        this.config.maxMessageLength = value;
        return new LibReturn()
    } catch (err) {
     
        throw new LibError(err,1003);
    }
};

Chatty.prototype.setMaxConnectionPerUserIdPerServer = async function (value) {
    try {
        if (typeof value !== "number" || value < 1) {
            throw new Error("maxConnectionPerUserIdPerServer must be a number greater than 0");
        }
        this.config.maxConnectionPerUserIdPerServer = value;
        return new LibReturn()
    } catch (err) {
     
        throw new LibError(err,1004);
    }
};