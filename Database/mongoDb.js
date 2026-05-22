import { Chatty } from "../Core/src.js";
import { awaitWithTimeout } from "../Utils/awaitTimeoutHelper.js";
import { closeMongo, setupMongoCollections } from "./mongoUtils.js";
import { emitError } from "../Utils/error.js";

let _MongoClient;

async function getMongoClient() {
    if (_MongoClient) return _MongoClient;

    try {
        const mod = await import("mongodb");
        _MongoClient = mod.MongoClient;
        return _MongoClient;
    } catch {
        throw new Error(
            "MongoDB package not installed. Run: npm install mongodb"
        );
    }
}

Chatty.prototype.addMongo = async function (input, options = {}) {
    try {
        let db,client,connectionType;

        // CASE 1: user passed connection string
        if (typeof input === "string") {
            const MongoClient = await getMongoClient();

            const clientConnection = new MongoClient(input, options);
            await clientConnection.connect();

            // default DB OR user-provided dbName
            db = clientConnection.db(options.dbName || "chatty-database");
            client=clientConnection
            connectionType="string";
        }
        // CASE 2: user passed db instance (mongoClient.db())
        else if (input && typeof input.collection === "function") {
            db = input;
            client=null;
            connectionType="client";
        }
        else {
            throw new Error(
                "Provide a MongoDB URI or db instance (mongoClient.db())"
            );
        }

        // Test connection
        const adminDb = db.admin();
        const res = await awaitWithTimeout(adminDb.ping());

        if (!res || res.ok !== 1) {
            throw new Error("MongoDB ping failed");
        }

        // Store in config
        this.config.mongo = {
            db,
            isConnected: true,
            client,
            connectionType
        };

        // Setup collections (if defined)
        if (typeof setupMongoCollections === "function") {
            await setupMongoCollections(this);
        }

        this.emit(
            "warning",
            "Make sure database is empty else it may cause future errors"
        );

    } catch (err) {
        if (this.config.mongo) {
            this.config.mongo.isConnected = false;
        }
        emitError(this, err);
        throw err;
    }
};


Chatty.prototype.closeMongo = async function (input, options = {}) {
    return await closeMongo(this);
}