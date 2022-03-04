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
    "<entity-id>": {
        "<client-socket-id>": {
            name: "<entity-name>",
            avatar: "<entity-avatar>"
        },
    }
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
            sortedClientsAlphanumeric.sort((a, b) => {
                return (entities[clients[a].entityId])[a].name.localeCompare(
                    (entities[clients[b].entityId])[b].name
                );
            });
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
            let entityId = clients[socket.id];
            console.log("Client " + socket.id + " disconnected, removing entity " + entityId);

            // Remove from sorted client list(s)
            let clientIndex = sortedClientsAlphanumeric.indexOf(socket.id);
            sortedClientsAlphanumeric.splice(clientIndex, 1);

            // Remove from entities
            let index = entities[entityId].indexOf(socket.id);
            entities[entityId].splice(index, 1);

            // Finally, remove the client entry
            delete clients[socket.id];
        }
    });

    // Handle initial setup of an entity.
    // Without this, it's not allowed for clients to connect with other peers.
    // NOTE: When switching active entity, the client should disconnect and reconnect before emitting this.
    socket.on("SetupEntity", (entity) => {
        // Only do this once while the entity is connected
        // Extra conditions handle cases where an entity is connected on multiple devices
        // CONSIDER: How are multiple connections to the same entity be handled? (group client entries by validated signatures?)
        // What to do about id theft, if anything? (should probably leave this to client side handling)
        if (!(socket.id in clients) && (!(entity.id in entities) || !(socket.id in entities[entity.id]))) {
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
    // Options:
    /*
    {
        page: 1, // Page number, starting from 1.
        sort: "alphanumeric", // Sorting applied, if any.
    }
    */
    socket.on("ListEntities", options => {
        const perPage = 50;

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
                name: entity.name,
                avatar: entity.avatar,
            });
        }

        // Send list back to the client
        socket.emit("ListEntitiesResponse", listing);
    });

    // Callback to handle a peer joining a chat
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

    /*
        The initiating peer offers a connection
    */
    socket.on('offer', payload => {
        console.log("Received offer from payload " + payload.target);
        io.to(payload.target).emit('offer', payload);
    });

    /*
        The receiving peer answers (accepts) the offer
    */
    socket.on('answer', payload => {
        console.log("Answered offer from payload " + payload.target);
        io.to(payload.target).emit('answer', payload);
    });

    socket.on('ice-candidate', incoming => {
        console.log("Setting up ice candidate " + JSON.stringify(incoming.candidate));
        io.to(incoming.target).emit('ice-candidate', incoming.candidate);
    })
});

server.listen(port, () => console.log("Server listening on port " + port));
