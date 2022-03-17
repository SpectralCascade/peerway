# Peerway
A peer-to-peer social media platform for mobile that doesn't store data on servers.

## Components
Peerway consists of two main components.
- The mobile app itself (written in JS with React Native)
- A NodeJS server for establishing peer-to-peer connections over the internet.

## Peerway API: Basic usage
The mobile client includes a class that acts as an API for connecting to the signalling server and synchronising data between peers on the network.

```js
import Database from "src/Database";
import Peerway from "src/Peerway";

// Create an entity and set the active entity to it
Database.SwitchActiveEntity(Database.CreateEntity());

// Setup a callback to handle connection to the signalling server
Peerway.onServerConnected = (id) => {
    // Synchronise all known peers
    Peerway.SyncPeers();
};

Peerway.ConnectToSignalServer("http://192.168.0.x:20222");

```

### TODOs
- Move entity management methods for the active entity from Database into Peerway
