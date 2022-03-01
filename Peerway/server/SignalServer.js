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

// Callback to handle a peer connection to the server
io.on('connection', socket => {

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
