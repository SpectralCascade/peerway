import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from "react-native-webrtc";
import { io } from "socket.io-client";
import Database from "./Database";
import { Log } from "./Log";
import RNFS from "react-native-fs";
import Constants from "./Constants";
import { EventEmitter } from "react-native";
import { EventListener } from "./Components/EventListener";
import { v1 as uuidv1 } from "uuid";
import QuickReplies from "react-native-gifted-chat/lib/QuickReplies";

// This class forms the primary API for communicating with peers
class PeerwayAPI {
    //
    // "Public" members
    //
    
    // Socket connection to the server
    server = null;

    // Callback when the active entity has been connected to the signal server.
    onServerConnected = (id) => { Log.Info("Connection established to signal server for entity " + id + "."); };
    // Callback to handle failure to connect the active entity.
    onServerConnectionError = (error) => { Log.Error(error.message); };
    // Callback when peer syncing is done.
    onSyncPeersComplete = () => { Log.Info("Peer syncing has finished."); };
    // Callback when all peers have been synced.
    onSyncPeersError = (error) => { Log.Error(error.message); };

    //
    // "Private" members
    //

    // Peers to be connected to via WebRTC
    _peersToConnect = [];
    // Peer entities that have been requested to connect, keyed by client id.
    _peersPending = {};
    // ICE candidates that need to be sent once a peer has accepted the connection.
    _pendingCandidates = {};
    // Connections to other peers, keyed by entity ID.    
    _peers = {};
    // Data send channels to connected peers
    _channels = {};
    // URL of the current signal server
    _signalServerURL = "";
    // The id of the entity that is connected to the signal server
    _activeId = "";
    // The current syncing configuration in use
    _syncConfig = {};

    // Setup properties
    constructor() {
        // Peers to connect to
        // Is the device currently connected to a signal server AND has the current active entity setup?
        Object.defineProperty(this, "isConnected", {
            get: () => { return this.server != null && this.server.connected && this._activeId === Database.active.getString("id"); }
        });
        this._events = {};
        this._handleCount = 0;
    }

    //
    // Events interface
    //

    addListener(eventType, listener) {
        this._handleCount++;
        return new EventListener(this._events, eventType, this._handleCount.toString(), listener);
    }

    emit(eventType, ...args) {
        if (eventType in this._events) {
            Object.keys(this._events[eventType]).forEach((key) => {
                this._events[eventType][key].invoke(...args);
            });
        }
    }

    removeAllListeners(eventType) {
        if (eventType in this._events) {
            Object.keys(this._events[eventType]).forEach((key) => {
                delete this._events[eventType][key];
            });
        }
    }

    //
    // "Public" API methods
    //

    // Connect to a particular signal server.
    // overrideSocket determines what should happen if already connected to a signal server.
    // If already connected and overrideSocket == false, nothing happens. Otherwise simply disconnects.
    ConnectToSignalServer(url, overrideSocket = false) {
        Log.Debug("Connecting with URL " + url);
        if (this.isConnected) {
            if (overrideSocket || this._signalServerURL !== url) {
                Log.Info("Overriding current signal server connection.");
                this.server.disconnect();
            } else {
                // Early out
                Log.Verbose("Already connected to a signal server, ignoring call to connect to " + url);
                return;
            }
        }

        Log.Info("Connecting to signal server at " + url);
        this._signalServerURL = url;

        // TODO: Callback to error handler if connection fails
        this.server = io.connect(url);

        // Setup the entity on the server so others can see it listed
        let profile = JSON.parse(Database.active.getString("profile"));
        this._activeId = Database.active.getString("id");
        let entity = {
            id: this._activeId,
            name: profile.name,
            avatar: profile.avatar
        };

        // Handle setup of the entity on the server.
        this.server.on("SetupResult", (success) => {
            if (success) {
                Log.Info("Server successfully setup entity connection.");

                // Custom callback to handle completion of the connection
                if (this.onServerConnected) {
                    this.onServerConnected(this._activeId);
                }
            } else if (this.onServerConnectionError) {
                this.onServerConnectionError({ message: "Server failed to setup entity connection." });
            }
        });

        
        // Setup other request handlers
        this.server.on("PeerConnectionRequest", (socket) => { this._OnConnectionRequest(socket); });
        this.server.on("PeerConnectionAccepted", (socket) => { this._OnConnectionAccepted(socket); });
        this.server.on("ice-candidate", incoming => { this._OnReceivedNewCandidate(incoming); });
        this.server.on("EntityMetaResponse", (meta) => { this._OnEntityMetaResponse(meta); });
        this.server.on("PushNotification", (notif) => { this._OnNotification(notif); });

        // Setup the active entity once connected
        this.server.emit("SetupEntity", entity);
    }

    // Establishes a temporary connection to all known peers and attempts to sync data.
    // Additional options can be specified to configure how the sync will work.
    // See README.md for details on these options.
    SyncPeers(options = { config: {} }) {
        this._syncConfig = options.config ? options.config : {};
        this._peersToConnect = "selectedPeers" in options ? options.selectedPeers.slice() : [];
        if (!("selectedPeers" in options)) {
            let query = Database.Execute("SELECT id FROM Peers");
            this._peersToConnect = query.data.length > 0 ? query.data.map(x => x.id) : [];
            Log.Debug("Ready to sync " + this._peersToConnect.length + " peer(s): " + JSON.stringify(this._peersToConnect));
        }
        for (let i in this._peersToConnect) {
            // First check whether already connected to these peers
            let id = this._peersToConnect[i];
            if (id in this._peers && this._peers[id] && this._peers[id].connectionState.startsWith("connect")) {
                if (this._peers[id].connectionState === "connecting") {
                    // If it's still connecting, peer syncing should automagically happen on connection
                } else {
                    Log.Debug("Syncing already connected peer." + this._peersToConnect[i]);
                    this._SyncPeer(id, this._syncConfig);
                }
            } else {
                // Get local peer metadata
                Log.Debug("Syncing peer." + id);
                let query = Database.Execute("SELECT * FROM Peers WHERE id='" + id + "'");
                let meta = query.success && query.data.length > 0 ? {} : query.data[0];
                // Don't sync with blocked peers.
                if (!meta.blocked) {
                    // Check with the server whether the peer is connected
                    Log.Debug("Requesting entity meta for peer." + id);
                    let params = { id: id };
                    this.server.emit("GetEntityMeta", params);
                }
            }
        }
    }

    // Send a message to a particular chat from a specified entity.
    // TODO reuse format for parts of content posts?
    // Defaults to the active entity. Message should be a JSON object in the following format:
    /*
    {
        // ID of the chat
        for: "<chat-id>",
        // Which entity sent this message
        author: "<entity-id>",
        // The content type
        mime: "text/plain",
        // The data content; could be text, an image, or something else.
        content: "bla bla what a cool message"
    }
    */
    SendChatMessage(message) {
        // TODO load database for the "from" entity, rather than using active
        let query = Database.Execute("SELECT * FROM Chats WHERE id='" + message.for + "'");
        if (query.data.length > 0) {
            // Load the chat data
            let meta = query.data[0];
            
            let timeNow = new Date();
            let isoTime = timeNow.toISOString();
            let id = uuidv1();
            Database.Execute(
                "INSERT INTO Messages (chat,id,peer,created,content,mime) VALUES ('" +
                    meta.id + "','" + // Chat id
                    id + "','" + // Generate an ID for this message
                    message.author + "','" +
                    isoTime + "','" +
                    message.content + "','" + // TODO only insert text content; link to non-text content
                    message.mime + "'" + 
                ")"
            );
            
            // Update the last message sent of the chat
            meta.lastMessage = message.mime.startsWith("text") ? message.content : message.mime;
            Database.Execute(
                "UPDATE Chats SET lastMessage='" + id + "' WHERE id='" + meta.id + "'"
            );

            // Get members of the chat
            let targets = [];
            query = Database.Execute(
                "SELECT * FROM ChatMembers WHERE chat='" + meta.id + "'"
            );
            for (let i = 0, counti = query.data.length; i < counti; i++) {
                // Skip self
                if (query.data[i].peer === message.author) {
                    continue;
                }
                targets.push(query.data[i].peer);
            }

            // Now send out a notification to all peers in the chat
            // TODO: ENCRYPT NOTIFICATION CONTENT
            this.NotifyEntities(targets, {
                type: "chat.message",
                id: id,
                for: message.for,
                from: message.author,
                created: isoTime,
                content: message.content,
                mime: message.mime
            });
        } else {
            // TODO handle error case where chat doesn't exist
            Log.Error("Cannot send message as there is no such chat." + message.for);
        }
    }

    // Send a notification to one or more entities
    NotifyEntities(entities, notification) {
        let raw = JSON.stringify(notification);
        //Log.Debug("Sending notification:\n" + raw);
        Log.Debug("Sending notif to entities: " + JSON.stringify(entities));

        // Length can change each iteration, hence no caching
        for (let i = 0; i < entities.length; i++) {
            let id = entities[i];
            if (id in this._peers && this._peers[id] && this._peers[id].connectionState === "connected") {
                // Send directly to connected peers rather than notifying via server when possible
                this._SendPeerData(id, raw);
                entities.splice(i, 1);
            }
        }

        if (entities.length > 0) {
            this.server.emit("PushNotification", { targets: entities, notif: notification });
        }
    }

    //
    // "Private" methods
    //

    // Actually sync data with a connected peer.
    // Returns true if syncing begins successfully (i.e. the other peer is connected).
    _SyncPeer(id, config) {
        if (id in this._peers && this._peers[id] && this._peers[id].connectionState === "connected") {
            // Send sync request to the peer with the configuration data
            this._SendPeerData(id, JSON.stringify({ type: "sync", from: this._activeId, to: id, config: config }));
            return true;
        }
        Log.Warning("Cannot sync with disconnected peer." + id);
        return false;
    }
    
    // Handle response to emitting GetEntityMeta signal server request.
    _OnEntityMetaResponse(meta) {
        Log.Debug("Meta response: " + JSON.stringify(meta));
        if (meta.available) {
            // Check if the entity is supposed to be connected to.
            if (this._peersToConnect.includes(meta.id)) {
                // Make a connection request
                Log.Info("Sending connection request to peer." + meta.id + " of client " + meta.clientId);
                this._SendConnectionRequest(meta.id, meta.clientId);
            } else {
                // Might have a use case, e.g. interacting with a new entity for the first time.
                Log.Debug("peer." + meta.id + " not in expected peersToConnect array " + JSON.stringify(this._peersToConnect));
            }
        } else {
            // Peer is unavailable on the signal server; they are probably offline.
        }
    }

    // Callback for handling local ICE candidates.
    // Takes remote entity id to which the candidate pertains.
    _OnPeerConnectionCandidate(e, id) {
        if (this._peers[id].remoteDescription == null) {
            // Caller may find ICE candidates before the peer is ready to accept them
            if (!(id in this._pendingCandidates)) {
                this._pendingCandidates[id] = [];
            }
            this._pendingCandidates[id].push(e);
        } else if (e.candidate) {
            let payload = {
                local: this._activeId,
                remote: id,
                target: this._peersPending[id], // Target client id
                candidate: e.candidate, // ICE candidate
            };
            Log.Verbose(
                "Sending new ice-candidate from " + payload.local +
                " to " + payload.remote + " client " + payload.target
            );
            this.server.emit("ice-candidate", payload);
        }
    }

    // Handle changes in connection state for a particular peer call connection.
    _OnPeerCallChange(connection, id) {
        if (this._peers[id].connectionState === "connected") {
            delete this._peersPending[id];
            Log.Info("Connection established to peer." + id);

            // Automagically sync with the peer
            if (this._syncConfig) {
                this._SyncPeer(id, this._syncConfig);
            }
        } else {
            Log.Info("Connection call state to peer." + id + " changed to: " + this._peers[id].connectionState);
        }
    }

    // Add relayed ICE candidate message from the peer we're trying to connect to.
    _OnReceivedNewCandidate(incoming) {
        Log.Verbose("Received new ICE candidate from " + incoming.local);
        this._peers[incoming.local].addIceCandidate(
            new RTCIceCandidate(incoming.candidate)
        ).catch((e) => { this.onSyncPeersError({message: e}); });
    }

    // Callback to respond to WebRTC negotiation. Actually makes the initial peer connection request.
    // Takes the ID of the remote peer to connect to.
    _HandleNegotiationNeededEvent(id) {
        // Make sure this is actually a peer we want to connect to.
        if (id in this._peersPending) {
            Log.Verbose("Sending peer request to client " + this._peersPending[id] + " (entity " + id + ")");
            this._peers[id].createOffer().then(offer => {
                Log.Info("Setting local SDP for peer." + id + "...");
                return this._peers[id].setLocalDescription(offer);
            }).then(() => {
                let payload = {
                    local: this._activeId, // id of active entity
                    remote: id, // Target entity id
                    target: this._peersPending[id], // Target client
                    caller: this.server.id, // This client
                    sdp: this._peers[id].localDescription,
                };
                Log.Verbose("Sending peer request to signalling server...");
                this.server.emit("SendPeerRequest", payload);
            }).catch((e) => {
                this.onSyncPeersError({message: "Error handling negotiation needed event: " + e});
            });
        } else {
            Log.Error("No known peer pending with client id " + id + " - aborting connection request.");
        }
    }

    // Create a call to a particular peer (specified by entity id).
    _CreatePeerCall(id) {
        Log.Info("Setting up WebRTC connection to peer " + id);
        
        let peer = this._CreatePeerConnection();
        let targetId = id;

        // Callback when a new ICE candidate is found for the peer connection.
        peer.onicecandidate = (e) => this._OnPeerConnectionCandidate(e, targetId);
        // Callback when negotiation is required (only when calling)
        peer.onnegotiationneeded = () => this._HandleNegotiationNeededEvent(targetId);
        // Callback when connection state changes
        peer.onconnectionstatechange = (connection) => this._OnPeerCallChange(connection, targetId);

        return peer;
    }

    // Create an answer to a peer call request.
    _CreatePeerAnswer(id) {
        let peer = this._CreatePeerConnection();

        // Callback when a new ICE candidate is found for the peer connection.
        peer.onicecandidate = (e) => this._OnPeerConnectionCandidate(e, id);

        return peer;
    }

    // Creates a WebRTC connection object.
    _CreatePeerConnection() {
        // TODO: Run local STUN and TURN servers if possible, instead of using these?
        return new RTCPeerConnection({
            iceServers: [
                {
                    urls: "stun:openrelay.metered.ca:80"
                },
                {
                    urls: 'turn:openrelay.metered.ca:80',
                    username: "openrelayproject",
                    credential: "openrelayproject"
                },
            ]
        });
    }

    // Handle receiving data from peer over WebRTC.
    _OnPeerData(event) {
        if (typeof(event.data) === "string") {
            this._OnNotification(JSON.parse(event.data));
        }
    };

    // Listener for receiving notifications from peers.
    _OnNotification(notif) {
        Log.Debug("Data received from peer." + notif.from);
        switch (notif.type) {
            case "sync":
                this._RespondToSyncRequest(notif.to, notif.from, notif.config);
                break;
            case "chat.request":
                this._OnChatRequest(notif);
                break;
            case "chat.message":
                this._OnChatMessage(notif);
                break;
            default:
                this.emit(notif.type, notif);
                break;
        }
    }

    // Send data to a specified peer.
    _SendPeerData(id, data) {
        Log.Debug("Sending data to peer." + id);
        this._channels[id].send(data);
    }

    _RespondToSyncRequest(to, from, config) {
        Log.Debug("Received sync request from peer." + from + " for entity " + to);
        // Sync chats
        if ("chats" in config) {
            for (i in config.chats) {
                // Select chats in common
                let query = Database.Execute("SELECT * FROM Chats WHERE id='" + config.chats[i].id + "'");
                if (query.data.length > 0) {
                    Log.Debug("Syncing chat." + config.chats[i].id);
                    let localChat = query.data[0];

                    // TODO received timestamp should be of the last message received from the peer

                    // Time that the peer last received a message or change to the chat
                    /*let remoteReceived = new Date(config.chats[i].received);
                    // Time that the peer last sent a message or made a change to the chat
                    let remoteUpdated = new Date(config.chats[i].updated);

                    let localReceived = new Date(localChat.received);
                    let localUpdated = new Date(localChat.updated);

                    if (localReceived > remoteReceived || localUpdated > remoteReceived) {
                        // Need to send new content to peer, locate all relevant messages
                        // TODO: open chat file(s), send relevant content
                    }
                    
                    if (localReceived < remoteReceived || localReceived < remoteUpdated) {
                        // Need to get new content from peer
                        // TODO: once syncing is done, send a sync request to the peer
                    }*/
                } else {
                    Log.Debug("No such chat." + config.chats[i].id);
                }
            }
        }
    }

    // Handle chat request
    _OnChatRequest(data) {
        // TODO notify and let user accept or reject
        // TODO REMOVE THIS DEBUG CODE BEFORE RELEASE
        Database.CreateChat(data.members, {
            id: data.chatId,
            name: data.name,
            updated: data.updated
        });
        this.emit("chat.request", data);
    }

    // Handle chat message
    _OnChatMessage(data) {
        // TODO reject messages from chats that the user hasn't accepted or has blocked
        Log.Debug("Received chat message from peer." + data.from);

        // Add the message to the database
        Database.Execute(
            "INSERT INTO Messages (chat,id,peer,created,content,mime) VALUES ('" +
                data.for + "','" +
                data.id + "','" +
                data.from + "','" +
                data.created + "','" +
                data.content + "','" + // TODO only insert text content; link to non-text content
                data.mime + "'" + 
            ")"
        );
        
        // Update the last message sent of the chat
        Database.Execute(
            "UPDATE Chats SET lastMessage='" + data.id + "', read=" + 0 + " WHERE id='" + data.for + "'"
        );

        this.emit("chat.message", data);
    }

    // Send a request to connect to a specified entity.
    _SendConnectionRequest(id, clientId) {
        // The client ID is required due to potential for duplicate entity IDs on the server.
        this._peersPending[id] = clientId;
        // Create local peer connection config
        this._peers[id] = this._CreatePeerCall(id);
        // Create a data channel for data transfer with the remote peer.
        this._channels[id] = this._peers[id].createDataChannel(this._activeId + "[->]" + id);
        
        // listen to incoming messages from the other peer once a connection is established.
        this._channels[id].onmessage = (event) => this._OnPeerData(event);
    }
    
    // Respond to an offer to connect to a peer.
    _OnConnectionRequest(peer) {
        Log.Info("Received request to connect from peer with id " + peer.local);

        // Syncing may not have taken place yet
        if (this._peersToConnect.length == 0) {
            let query = Database.Execute("SELECT id FROM Peers");
            this._peersToConnect = query.data.map(x => x.id);
        }

        let meta = {};
        // Check if peer has been seen before
        let query = Database.Execute("SELECT * FROM Peers WHERE id='" + peer.local + "'");
        if (query.data.length > 0) {
            // Remove from peers waiting to be connected
            let toRemove = this._peersToConnect.indexOf(peer.local);
            if (toRemove >= 0) {
                this._peersToConnect.splice(toRemove, 1);
            }
        } else {
            // Not seen this peer before, add to the database
            meta = Database.AddPeer(peer.local);
        }

        // Check to ensure the peer isn't blocked.
        if (!meta.blocked) {
            this._peersPending[peer.local] = peer.caller;

            // Setup the local peer connection and prepare the appropriate channel for receiving data.
            // The ID passed in is the entity ID of the peer requesting this connection;
            // it has no relevance to the returned value.
            this._peers[peer.local] = this._CreatePeerAnswer(peer.local);
            // Setup event handler for creation of the data channel by the remote peer. 
            this._peers[peer.local].ondatachannel = (event) => {
                // Create a channel for data transfer to the other peer.
                this._channels[peer.local] = event.channel;
                this._channels[peer.local].onmessage = (e) => this._OnPeerData(e);
                Log.Info("Connection established to peer." + peer.local);
            }

            // Accept the call request
            this._peers[peer.local].setRemoteDescription(new RTCSessionDescription(peer.sdp)).then(() => {}).then(() => {
                Log.Debug("Creating WebRTC answer...");
                return this._peers[peer.local].createAnswer();
            }).then(answer => {
                Log.Debug("Setting local SDP of the client...");
                return this._peers[peer.local].setLocalDescription(answer);
            }).then(() => {
                let payload = {
                    local: peer.remote,
                    remote: peer.local,
                    target: peer.caller,
                    caller: peer.target,
                    sdp: this._peers[peer.local].localDescription
                }
                Log.Info("Accepting request from peer." + peer.local);
                this.server.emit("AcceptPeerRequest", payload);
            });
        } else {
            Log.Info("Discarding request received to connect to blocked peer." + peer.local);
        }
    }

    // Handle acception of a connection request to a peer.
    _OnConnectionAccepted(payload) {
        Log.Info("Connection to peer." + payload.local + " accepted, setting SDP.");
        this._peers[payload.local].setRemoteDescription(new RTCSessionDescription(payload.sdp)).then(() => {
            // Check for any pending ICE candidates
            if (payload.local in this._pendingCandidates) {
                Log.Verbose("Some ICE candidates are pending, sending to peer." + payload.local);
                for (i in this._pendingCandidates[payload.local]) {
                    this._OnPeerConnectionCandidate((this._pendingCandidates[payload.local])[i], payload.local);
                }
                delete this._pendingCandidates[payload.local];
            }
        }).catch(
            (e) => { this.onSyncPeersError({message: "Failed to handle WebRTC connection answer: " + e}); }
        );
    }
}

// Global instance grants access to the API
let Peerway = new PeerwayAPI();
export default Peerway;
