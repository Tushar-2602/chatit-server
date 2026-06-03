# Chatit Documentation

## Introduction

ChatIt is an easy-to-use real-time communication library built on WebSocket and JWT for Node.js.

It consists of two packages:

### chatit-server

- NPM: https://www.npmjs.com/package/chatit-server
- GitHub: https://github.com/Tushar-2602/chatit-server

### chatit-client

- NPM: https://www.npmjs.com/package/chatit-client
- GitHub: https://github.com/Tushar-2602/chatit-client

Documentation for both packages is available in their respective GitHub README files.

### Features

- Direct messaging
- Group messaging
- Offline synchronization
- Message sequencing
- Delivery acknowledgements
- JWT-based authentication
- Horizontal scaling with Redis

ChatIt helps you build reliable real-time chat applications with minimal setup.


# Installation

## Server

```bash
npm install chatit-server
```

### Optional Dependencies

```bash
npm install redis      # For horizontal scaling
npm install mongodb    # For message persistence
```

---

## Client

```bash
npm install chatit-client
```

---

# Quick Demo

## 1. Start the Server

**server.js**

```js
import { Chatit } from "chatit-server";

// Custom server configuration
// const app = new Chatit({
//   serverId: "1d01a835-dd7f-4381-a48d-3a1b3902f53b",
//   tokenKey: "1d01rf35-dd7f-4381-a48d-3a1b3902f53b", -> used when JWT auth is implemented
//   userId: "1d4wa835-dd7f-4381-a48d-3a1b3902f53b", used when JWT auth is not implemented
// });

const app = new Chatit(); // Generates a random serverId

app.on("warning", (data) => {
  console.log(data);
});

try {
  await app.connectPort(5000);
  console.log("WebSocket server running on port 5000");
} catch (e) {
  console.log(e);
}
```

Run:

```bash
node server.js
```

---

## 2. Create User 1

**client-user1.js**

```js
import { ChatitClient } from "chatit-client";

const app = new ChatitClient({
  url: "ws://localhost:5000",
  userId: "user1",

  // Required only when authentication is enabled
  // token: "<JWT_TOKEN>"
});

app.connect();

app.on("directMessage", (event) => {
  console.log(event.payload);
});
```

Run:

```bash
node client-user1.js
```

---

## 3. Create User 2

**client-user2.js**

```js
import { ChatitClient } from "chatit-client";

const app = new ChatitClient({
  url: "ws://localhost:5000",
  userId: "user2",

  // Required only when authentication is enabled
  // token: "<JWT_TOKEN>"
});

app.connect();

setTimeout(async () => {
  console.log("Sending message to user1");

  const response = await app.sendDirectMessage(
    "user1",
    "hello"
  );

  const { messageId } = response.data;

  console.log("Message ID:", messageId);
}, 2000);
```

Run:

```bash
node client-user2.js
```

---

## Expected Output

### user2 terminal

```txt
Sending message to user1

Message ID: 6e6cdb59-c5c7-4d0c-8d0a-9ef2a4d53d0a

{
  msgType: 'system',
  subType: 'ackSent',
  messageId: '739aa41b-da5a-491b-82b1-edb221a90247'
}

{
  msgType: 'system',
  subType: 'ackDelivered',
  messageId: '739aa41b-da5a-491b-82b1-edb221a90247',
  fromUserId: 'user1',
  timestamp: 1780483345094
}
```

### user1 terminal

```txt
hello
```

The message sent by **user2** is delivered to **user1** through the Chatit WebSocket server.


---

# Features

## Core Features (No Additional Dependencies)

### Direct Messaging

Send messages directly to a user using only:

* userId
* payload

```text
userA → userB
```

---

### System Messaging

Send messages from a client to the backend server.

Useful for:

* commands
* notifications
* custom events

---

### Delivery Acknowledgements

Every message can generate two acknowledgements:

#### ackSent

Triggered when ChatIt successfully forwards the message to the destination user.

#### ackDelivered

Triggered when the destination client receives the message.

This provides end-to-end delivery tracking.

---

### JWT Authentication

Clients can authenticate using JWT tokens issued by the backend.

```text
Client → JWT → ChatIt Server
```

---

### Single Server Mode

Without Redis:

* Supports one server instance
* One thread
* One serverId

---

# MongoDB Features

Enable MongoDB support using:

```js
await chatit.addMongo(connenctionUrl/client);
```

---

## Group Messaging

Send messages to entire groups using:

```text
groupId
```

---

## Message Persistence

All messages except system messages are automatically stored.

Stored:

* Direct messages
* Group messages

Not stored:

* System messages

---

## Offline Message Synchronization (To be implemented)

When a user reconnects:

* Missed messages are synchronized automatically
* No manual recovery required


---

## Message Sequencing

ChatIt guarantees ordering.

### sequenceNumber

Global sequence for the recipient.

### windowSequenceNumber

Sequence between a peer or a group, e.g. all messages between user1 and user2 will have sequence numbers seperate from their global sequence numbers.

---

# Redis Features

Enable Redis support using:

```js
await chatit.addRedis(connenctionUrl/client);
```

---

## Horizontal Scaling

Supports:

* Multiple instance of chatit-server (each running on a single independent thread)
* Multiple servers

Each instance must have a unique:

```text
serverId
```

---

## Rate Limiting

Configurable limits:

* Connections per userId
* Message frequency
* Message size

---

# Server API

## Success response Pattern ->

```js
{
  success:True,
  code:201,
  data:{...} // If any data is reurned like websocketServer 
}
```
---
## Error Response Pattern ->

```js
{
  success:False,
  code:1000, -> default error code something went wrong
  data:{}  
}
```
---


## attachServer()

Attach ChatIt to an existing HTTP server.

```js
const response = chatit.attachServer(server);
const { wss } = response.data; // wss-> websocketServer
```

### Parameters

| Name   | Type        |
| ------ | ----------- |
| server | http.Server |

### Returns

```js
{
  wss
}
```

---

## connectPort()

Create server directly from available port number.

```js
const response = chatit.connectPort(3000);
const { server, wss } = response.data; // server -> httpServer created from port number
```

### Parameters

| Name | Type   |
| ---- | ------ |
| port | number |

### Returns

```js
{
  server,
  wss
}
```

---

## addRedis()

```js
await chatit.addRedis(redisUrl/redisClient);
```

### Parameters

```ts
string | RedisClient
```

Keep the url or client same for all instances for horizontal scaling|

Must use official:

```bash
npm install redis
```


---

## closeRedis()

```js
await chatit.closeRedis();
```

Closes Redis connection.

---

## addMongo()

```js
await chatit.addMongo(mongoUrl);
```

### Parameters

```ts
string | MongoClient
```
Keep the url or client same for all instances for horizontal scaling|

Requires:

```bash
npm install mongodb
```

---

## closeMongo()

```js
await chatit.closeMongo();
```

Closes Mongo connection and Redis connection if active.

---

## setServerId()

```js
import { randomUUID } from "node:crypto";

const serverId = randomUUID(); 
chatit.setServerId(serverId);
```

### Parameters

```ts
string -> must be unique, uuid is preferred
```

---

## getServerId()

```js
const response = chatit.getServerId();
const { serverId } = response.data;
```

Returns:

```ts
{
  serverId
}
```

---

## Rate Limit Configuration

### setMaxConnectionPerUserId()

```js
chatit.setMaxConnectionPerUserId(100);
```

Maximum  connections allowed from one userId

### Parameters

```ts
number -> default 100
```



---

### setMaxConnectionPerUserIdPerServer()

```js
chatit.setMaxConnectionPerUserIdPerServer(100);
```

Maximum  connections allowed from one userId per instance

### Parameters

```ts
number -> default 100
```

---

### setMaxMessageGap()

```js
chatit.setMaxMessageGap(1);
```

Minimum milliseconds gap between messages.

### Parameters

```ts
number -> default 100
```

---

### setMaxMessageLength()

```js
chatit.setMaxMessageLength(100);
```

Maximum payload length.

### Parameters

```ts
number -> default 100
```


---

# Group Management

## addToGroup()

```js
await chatit.addToGroup(groupId, userIds);
```
This adds the userIds passed in the group which has given groupId, if no group exist with the given groupId, then a new group is created and the members are added to it 
### Parameters

```ts
groupId -> String
userIds -> String | Array of strings
```

---

## removeFromGroup()

```js
await chatit.removeFromGroup(groupId, userIds);
```

This removes the userIds passed in the group which has given groupId, if a person doesnt exist in a group, it does nothing

---

## getGroupMembers()

```js
const response = await chatit.getGroupMembers(groupId);

const {userIds} = response.data;

```

### Parameters

```ts
string
```

Returns:

```js

  {
    userIds: ["user1"] -> array of userIds present in the specified group id
  }

```

---

## deleteGroup()

```js
await chatit.deleteGroup(groupId);
```
Removes all members and delete that group

### Parameters

```ts
string
```


---

## sendSystemMessageToGroup()

```js
await chatit.sendSystemMessageToGroup(groupId, payload);
```
This sends the message in payload to all the members in group

### Parameters

```ts
groupId -> string
payload -> string
```

---

## sendSystemMessageToUser()

```js
await chatit.sendSystemMessageToUser(userId, payload);
```
This sends the message in payload to the specified userId

### Parameters

```ts
userId -> string
payload -> string
```
---

## setTokenKey()

Sets the secret key used for generating and verifying authentication tokens.

```js
await chatit.setTokenKey("my-secret-key");
```

### Parameters

```ts
string
```



---

## getTokenKey()

Returns the currently configured token key.

```js
const response = await chatit.getTokenKey();

const {tokenKey} = response.data;
```


Returns:

```js
{
  tokenKey
}
```

---

## removeTokenKey()

Removes the configured token key.

```js
await chatit.removeTokenKey();
```



---

## generateToken()

Generates a JWT token for a user using userId.

```js
const response = await chatit.generateToken(userId,seconds);

const { token } = response.data;

```

### Parameters

```ts
userId: string -> generated token for this userId
seconds: number -> vallid for this many seconds
```


Returns:

```js
{
  token: "eyJhbGciOiJIUzI1NiIs..."
}
```

---

# Client API

## connect()

```js
const response = await chatit.connect({
  url,
  token,
  userId
});

const { socket } = response.data;

```
This connects the client with the websocket using the specified parameters, you have to send url everytime but if auth is implemented then send only token, else send only your userId

### Parameters

```ts
url -> string
token -> string
userId -> string
```


---

## disconnect()

```js
chatit.disconnect();
```
Disconnects from the websocketServer.

---

## changeConfig()

```js
chatit.changeConfig({
  url,
  token,
  userId
});
```
This is used to change config (the latest configs will be implemented)

### Parameters

```ts
url -> string
token -> string
userId -> string
```
---

## getConfig()

```js
const response = chatit.getConfig();

const {config} = response.data;
```

Returns:

```js
{
  config: {
    url,
    token,
    userId
  }
}
```

---

## sendDirectMessage()

```js
await chatit.sendDirectMessage(
  userId,
  payload
);
```
Sends the payload to the specified userId with your userId as recipient 

### Parameters

```ts
payload -> string
userId -> string
```
Returns:

```js

 {
  messageId: '1d01a835-dd7f-4381-a48d-3a1b3902f53b'

}

```
---

## sendGroupMessage()

```js
await chatit.sendGroupMessage(
  groupId,
  payload
);
```

Sends the payload to all the members of the specified groupId with your userId as recipient 

### Parameters

```ts
payload -> string
groupId -> string
```

Returns:

```js

 {
  messageId: '1d01a835-dd7f-4381-a48d-3a1b3902f53b'

}

```

---

## sendSystemMessage()

```js
await chatit.sendSystemMessage(
 payload
);
```
Sends the payload to the system with your userId as recipient 

### Parameters

```ts
payload -> string
```
Returns:

```js

 {
  messageId: '1d01a835-dd7f-4381-a48d-3a1b3902f53b'

}

```

---

# Client Events

## directMessage -> emits when you recieve direct message from a user

```js
socket.on("directMessage", data => {});
```

Returns:

```js

 {
  msgType: 'direct',
  destinationUserId: 'user1',
  payload: 'hellod',
  messageId: '1d01a835-dd7f-4381-a48d-3a1b3902f53b',
  fromUserId: 'user',
  timestamp: 1780215275807,
  sequenceNumber: 7,
  windowSequenceNumber: 3
}

```


---

## groupMessage

```js
socket.on("groupMessage", data => {});
```
  Returns:

```js
{
  msgType: 'group',
  groupId: 'g12',
  payload: 'hellog',
  messageId: 'f49475bd-55d7-47aa-b370-d4e4fe7b260d',
  fromUserId: 'user',
  timestamp: 1780215275804,
  destinationUserId: 'user',
  sequenceNumber: 4,
  windowSequenceNumber: 4
}
 

```
---

## systemMessage

```js
socket.on("systemMessage", data => {});
```
  Returns:

```js
{
  destinationUserId: 'user',
  msgType: 'system',
  subType: 'custom',
  payload: 'hello'
}
 

```
---

## ackSent

```js
socket.on("ackSent", data => {});
```
  Returns:

```js
{
  msgType: 'system',
  subType: 'ackSent',
  messageId: '1d01a835-dd7f-4381-a48d-3a1b3902f53b'
}
 

```
---

## ackDelivered

```js
socket.on("ackDelivered", data => {});
```
  Returns:

```js
{
  msgType: 'system',
  subType: 'ackDelivered',
  messageId: '1d01a835-dd7f-4381-a48d-3a1b3902f53b',
  fromUserId: 'user1',
  timestamp: 1780215276402
}
 

```
---

## errorMessage

```js
socket.on("errorMessage", data => {});
```
  Returns:

```js
 
 { 
   error,
   messageId,
   code
 }
 

```
---

# Server Events

## messageFromUser

```js
chatit.on("messageFromUser", data => {});
```
  Returns:

```js

{
  msgType: 'system',
  subType: 'custom',
  payload: 'hellos',
  fromUserId: 'user',
  timestamp: 1780215275808
} 

```
---

## warning

```js
chatit.on("warning", warning => {});
```
  Returns:

```js

 {
    message: `serverId not given, server id 1d01a835-dd7f-4381-a48d-3a1b3902f53b is assigned`
    }


```
---

## redisConnection

```js
chatit.on("redisConnection", msg => {});
```
  Returns:

```js

 "Redis connected"

```
---
## redisConnectionClose

```js
chatit.on("redisConnectionClose", msg => {});
```
  Returns:

```js

 "redis closed gracefully"

```
---

## mongoConnection

```js
chatit.on("mongoConnection", msg => {});
```
  Returns:

```js

"Mongo collections and indexes set up successfully"
 

```
---

## mongoConnectionClose

```js
chatit.on("mongoConnectionClose", msg => {});
```
  Returns:

```js
"Mongo connection closed successfully"
 

```
---

# Response Format

## Success

```js
{
  success: true,
  code: 201,
  data: {}
}
```

## Error

```js
{
  success: false,
  code: 1000,
  data: {}
}
```


---
# Error Codes

## Server Errors

Errors thrown by ChatIt server APIs.

| Code | Message                                                         |
| ---- | --------------------------------------------------------------- |
| 1001 | maxConnectionPerUserId must be a number greater than 0          |
| 1002 | maxMessageGap must be a non-negative number                     |
| 1003 | maxMessageLength must be a number greater than 0                |
| 1004 | maxConnectionPerUserIdPerServer must be a number greater than 0 |
| 1005 | userId required                                                 |
| 1006 | message required                                                |
| 1007 | ChatIt: httpServer is required                                  |
| 1008 | ChatIt: port is required                                        |
| 1009 | Invalid serverId                                                |
| 1010 | Cannot change serverId after server has started                 |
| 1011 | ServerId is not set                                             |
| 1012 | Redis package not installed. Run: npm install redis             |
| 1013 | Provide a valid Redis URL or node-redis client                  |
| 1014 | Redis connection test failed                                    |
| 1015 | MongoDB package not installed. Run: npm install mongodb         |
| 1016 | mongoDb not connected                                           |
| 1017 | error adding to group, check groupId and userId                 |
| 1018 | Some users already exist, rest inserted                         |
| 1019 | Invalid token                                                   |
| 1020 | Token key not set                                               |
| 1021 | Token key not set                                               |
| 1022 | userId required                                                 |
| 1023 | expiry time required                                            |
| 1024 | Invalid or expired token                                        |
| 1025 | mongo not connected                                             |

---

## Client Errors

Errors sent from the server to connected clients.

| Code | Message                            |
| ---- | ---------------------------------- |
| 1001 | max connections reached            |
| 1002 | max connections per server reached |
| 1003 | max connections reached            |
| 1004 | Invalid payload received           |
| 1005 | User is not a member of this group |
| 1006 | group functionality not available  |
| 1007 | Authentication token missing       |
| 1008 | Invalid token payload              |
| 1009 | userId required                    |
| 1010 | if you are not running client on browser then install websocket package, for node js run: npm install ws                    |

---

## ChatIt Client Errors

Errors generated by the ChatIt client library.

| Code | Message                 |
| ---- | ----------------------- |
| 1001 | msgType missing         |
| 1002 | WebSocket not connected |
|      |                         |




