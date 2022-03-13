// Includes
const express =  require('express');
const http = require('http');
const socket = require('socket.io');

// Setup server and connection web socket
const app = express();
const server = http.createServer(app);
const io = socket(server);
const rooms = {};
const port = 20222;

// Info on connected and previously connected clients
var clients = {
    /*
    "<socket-id>": {
        entityId: "<entity-id>",
        socket: <socket-object>
    }
    */
};

// Dictionary of connected entities. Note that the same entity may be connected more than once;
// this could be due to a user with an instance on multiple devices, id theft,
// or in the rarest case (to the point it's almost impossible) there's a uuid collision.
var entities = {
    /*
    "<entity-id>": [
        {
            socketId: "<client-socket-id>",
            name: "<entity-name>",
            avatar: "<entity-avatar>"
        },
        {
            socketId: "<client-socket-id>",
            name: "<entity-name>",
            avatar: "<entity-avatar>"
        },
        etc...
    ]
    */
};

// Bool that keeps track of whether the alphanumeric clients list needs sorting or not.
var needSortAlphanumeric = true;

// List of clients sorted alphanumerically
var sortedClientsAlphanumeric = [];

// Sorts the appropriate entity list
function sortClients(mode) {
    switch (mode) {
        case "alphanumeric":
            // TODO
            /*sortedClientsAlphanumeric.sort((a, b) => {
                return ((entities[clients[a].entityId])[a]).name.localeCompare(
                    ((entities[clients[b].entityId])[b]).name
                );
            });*/
            needSortAlphanumeric = false;
            break;
    }
}

// Callback to handle a peer connection to the server
// TODO validate received data for all event handlers! Otherwise a DOS attack could crash server easily.
io.on('connection', socket => {

    // Handle disconnection from a client
    socket.on("disconnect", reason => {
        // See https://socket.io/docs/v4/server-socket-instance/#events
        if (reason === "client namespace disconnect") {
            // TODO
        } else if (reason === "ping timeout") {
            // TODO: Timeout, the client or this server may have lost connection
        } else if (reason === "transport close") {
            // TODO: User has lost connection somehow
        } else if (reason === "transport error") {
            // Mysterious reason! No idea what error... but something broke with the connection.
        }

        // Remove from clients and entity listings
        if (socket.id in clients) {
            let entityId = clients[socket.id].entityId;
            console.log("Info: Client " + socket.id + " disconnected, removing entity " + entityId);

            // Remove from sorted client list(s)
            let clientIndex = sortedClientsAlphanumeric.indexOf(socket.id);
            sortedClientsAlphanumeric.splice(clientIndex, 1);

            // Remove from entities
            let index = entities[entityId].findIndex(entity => entity.socketId === socket.id);
            if (index >= 0) {
                entities[entityId].splice(index, 1);
            }

            // Finally, remove the client entry
            delete clients[socket.id];
        }
    });

    // Handle initial setup of an entity.
    // Without this, it's not allowed for clients to connect with other peers.
    // NOTE: When switching active entity, the client should disconnect and reconnect before emitting this.
    // TODO: Obtain and validate the digital signature of the entity before completing setup.
    socket.on("SetupEntity", (entity) => {
        // Only do this once while the entity is connected
        // Extra conditions handle cases where an entity is connected on multiple devices
        if (!(socket.id in clients) && (!(entity.id in entities) ||
            (entities[entity.id].findIndex(entity => entity.socketId === socket.id) < 0))
        ) {
            // Track the entity client
            clients[socket.id] = {
                entityId: entity.id,
                socket: socket
            }
            if (!(entity.id in entities)) {
                entities[entity.id] = [];
            }
            // TODO: Handle updates to entity avatar and name
            entities[entity.id].push({
                socketId: socket.id,
                name: entity.name,
                avatar: entity.avatar,
            });
            
            // Add to the client list(s)
            sortedClientsAlphanumeric.push(socket.id);
            needSortAlphanumeric = true;

            console.log("Info: Setup entity " + entity.id + " for client socket " + socket.id);
        } else {
            // CONSIDER: send error info back to client indicating they're already setup
            console.log("Warn: Entity " + entity.id + " is already setup for client socket " + socket.id);
        }
    });

    // Handle request for listing entities connected to this server.
    // Sends back up to a maximum of 50 entities per page.
    // NOTE: It's possible for the same entity to appear more than once.
    // This is because it's possible for the same entity to have multiple connections.
    // CONSIDER: Change event name to better reflect the note above.
    // TODO: Respond with digital signature public key as one of the fields per entity/client.
    // TODO: Optionally omit fields such as avatar, name etc.
    // Options:
    /*
    {
        page: 1, // Page number, starting from 1.
        sort: "alphanumeric", // Sorting applied, if any.
    }
    */
    socket.on("ListEntities", options => {
        const perPage = 50;

        if (options === undefined) {
            options = {};
        }

        let page = "page" in options ? Math.min(Math.floor(sortedClientsAlphanumeric.length / perPage), Math.max(0, options.page - 1)) : 0;
        // TODO: Handle sorting option
        let sort = "sort" in options ? options.sort : "alphanumeric";

        // Sort the list first if necessary
        if (needSortAlphanumeric) {
            sortClients(sort);
        }

        // Entities list to be sent back to the client
        listing = [];

        // Return 50 entities from that page
        let start = page * perPage;
        let counti = Math.min(start + perPage, sortedClientsAlphanumeric.length);
        for (let i = start; i < counti; i++) {
            let socketId = sortedClientsAlphanumeric[i];
            let id = clients[socketId].entityId;
            let entity = entities[id].find(v => v.socketId === socketId);
            listing.push({
                id: id,
                clientId: socketId,
                name: entity.name,
                avatar: entity.avatar,
            });
        }

        // Send list back to the client
        console.log("Info: Responding to ListEntities request from socket " + socket.id);
        socket.emit("ListEntitiesResponse", listing);
    });

    // Handle request to get some meta data on an entity connected to this server.
    // Meta input data requires an entity id at least.
    // Always returns "id" and "available" fields. Also includes clientId if available.
    // Only returns other fields when specified.
    // TODO validate input
    // TODO also provide digital signature public key in order to select the correct entity
    // Example meta request (for getting all entity metadata fields):
    /*
    {
        name: true,
        avatar: true
    }
    */
    socket.on("GetEntityMeta", (request) => {
        let available = request.id in entities;
        let meta = {
            id: request.id,
            available: available,
            // Note: For time being, the first entity is used until digital signatures are supported.
            clientId: (available ? entities[request.id][0].socketId : undefined),
            name: available && request["name"] ? entities[request.id][0].name : undefined,
            avatar: available && request["avatar"] ? entities[request.id][0].avatar : undefined
        }

        // Send back metadata as requested
        console.log("Info: Responding to GetEntityMeta with entity id " + request.id + " from socket " + socket.id);
        socket.emit("EntityMetaResponse", meta);
    });

    // Callback to handle a peer joining a chat
    // TODO: burn this
    socket.on('join room', roomID => {

        console.log("Received join request for chat room " + roomID + " from socket " + socket.id);

        if (rooms[roomID]) {
            // Receiving peer joins the room
            rooms[roomID].push(socket.id)
        } else {
            // Initiating peer create a new room
            rooms[roomID] = [socket.id];
        }

        /*
            If both initiating and receiving peer joins the room,
            we will get the other user details.
            For initiating peer it would be receiving peer and vice versa.
        */
        const otherUser = rooms[roomID].find(id => id !== socket.id);
        if (otherUser) {
            socket.emit("other user", otherUser);
            socket.to(otherUser).emit("user joined", socket.id);
        }
    });

    // A peer wishes to connect to another peer.
    socket.on("SendPeerRequest", payload => {
        console.log("Info: Received peer connection request to client " + payload.target + " from client " + payload.caller);
        io.to(payload.target).emit("PeerConnectionRequest", payload);
    });

    // A peer accepts a request to connect to a peer.
    socket.on("AcceptPeerRequest", payload => {
        console.log("Answered offer from client " + payload.target);
        io.to(payload.target).emit("PeerConnectionAccepted", payload);
    });

    // This is part of the ICE process for connecting peers once a request is accepted.
    socket.on('ice-candidate', incoming => {
        console.log("Sending ice candidate to target client " + incoming.target);
        io.to(incoming.target).emit('ice-candidate', { id: incoming.id, candidate: incoming.candidate });
    })
});

server.listen(port, () => console.log("Server listening on port " + port));
