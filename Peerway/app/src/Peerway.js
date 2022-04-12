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
import { Buffer } from 'buffer';
import Notif from "./Notif";

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
    // Callback when an avatar has been modified.
    onAvatarChange = (id) => {};

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
    // Binary data that is being received
    _pendingData = {};
    // Timestamps of connection establishment to peers
    _peerConnectionTimestamps = {};
    // URL of the current signal server
    _signalServerURL = "";
    // The id of the entity that is connected to the signal server
    _activeId = "";
    // The current syncing configuration in use. Only to be used by the SyncPeers() method.
    _syncConfig = {};
    // Cache of avatar "file://" paths; when an avatar is changed, this is wiped.
    _avatarCache = {};

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

    // Rebuild the cached entry for the specified avatar.
    MarkAvatarPathDirty(id) {
        if (id in this._avatarCache) {
            this._avatarCache[id]++;
            this.onAvatarChange(id);
        } else {
            this._avatarCache[id] = 0;
        }
    }

    // Get the path to an entity avatar image
    // Returns empty string if id or extension are empty
    // TODO force all avatars to use the same image file format (PNG)
    GetAvatarPath(id, ext, prepend="") {
        if (id.length == 0 || !ext || ext.length == 0) {
            return "";
        }
        if (!(id in this._avatarCache)) {
            this._avatarCache[id] = 0;
        }
        return (
            prepend +
            RNFS.DocumentDirectoryPath +
            "/" +
            (id === this._activeId ? id + "." + ext : this._activeId + "/peer/" + id + "." + ext) +
            // Additional bit here forces the Image component using this to update
            (prepend === "file://" ? "?version=" + this._avatarCache[id].toString() : "")
        );
    }

    // Get the path to a chat
    GetChatPath(id) {
        return RNFS.DocumentDirectoryPath + "/" + this._activeId + "/chat/" + id;
    }

    // Get the path to a peer
    GetPeerPath(id) {
        return RNFS.DocumentDirectoryPath + "/" + this._activeId + "/peer/" + id;
    }

    // Get the path to the downloads folder
    GetDownloadPath() {
        return RNFS.DocumentDirectoryPath + "/" + this._activeId + "/Download";
    }

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
        this.server.on("PushNotification", (notif) => { this._OnReceivedJSON(notif.notif, notif.from); });

        // Setup the active entity, sending the avatar if available.
        if ("ext" in entity.avatar) {
            RNFS.readFile(this.GetAvatarPath(entity.id, entity.avatar.ext), "base64").then((data) => {
                entity.avatar.base64 = data;
            }).catch((e) => {
                Log.Error("Could not load entity avatar - " + e);
            }).finally(() => {
                this.server.emit("SetupEntity", entity);
            });
        } else {
            this.server.emit("SetupEntity", entity);
        }
    }

    GetSyncConfigPosts(peerId) {
        let cachePostLimitPerUser = parseInt(Database.userdata.getString("CachePostLimitPerUser"));
        // First get all cached posts and send info about them to check they're up to date
        let posts = [];
        let query = Database.Execute("SELECT id,version FROM Posts WHERE author='" + peerId + "'");
        for (let i in query.data) {
            posts.push({
                id: query.data[i].id,
                version: query.data[i].version
            });
        }
        return { peerId: peerId, posts: posts, cachePostLimitPerUser: cachePostLimitPerUser };
    }

    // Establishes a temporary connection to all known peers and attempts to sync data.
    // Additional options can be specified to configure how the sync will work.
    // See README.md for details on these options.
    SyncPeers(options = {}) {
        this._syncConfig = options;
        this._peersToConnect = "selectedPeers" in options ? options.selectedPeers.slice() : [];
        if (!("selectedPeers" in options)) {
            let query = Database.Execute("SELECT id FROM Peers");
            this._peersToConnect = query.data.length > 0 ? query.data.map(x => x.id) : [];
            Log.Debug("Ready to sync " + this._peersToConnect.length + " peer(s): " + JSON.stringify(this._peersToConnect));
        }
        for (let i in this._peersToConnect) {
            let id = this._peersToConnect[i];
            
            // First check whether already connected to these peers
            if (id in this._peers && this._peers[id] && this._peers[id].connectionState.startsWith("connect")) {
                if (this._peers[id].connectionState === "connecting") {
                    // If it's still connecting, peer syncing should automagically happen on connection
                } else {
                    Log.Debug("Syncing already connected peer." + this._peersToConnect[i]);
                    this._SyncPeer(id, this._syncConfig, (new Date()).toISOString(), true);
                }
            } else {
                Log.Debug("Syncing peer." + id);
                // Check with the server whether the peer is connected
                Log.Debug("Requesting entity meta for peer." + id);
                let params = { id: id };
                this.server.emit("GetEntityMeta", params);
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
        let query = Database.Execute("SELECT * FROM Chats WHERE id='" + message.chat + "'");
        if (query.data.length > 0) {
            // Load the chat data
            let meta = query.data[0];
            
            let timeNow = new Date();
            let isoTime = timeNow.toISOString();
            let id = uuidv1();
            Database.Execute(
                "INSERT INTO Messages (chat,id,[from],created,content,mime) VALUES ('" +
                    meta.id + "','" + // Chat id
                    id + "','" + // Generate an ID for this message
                    message.from + "','" +
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
                if (query.data[i].peer === message.from) {
                    continue;
                }
                targets.push(query.data[i].peer);
            }

            // Now send out a notification to all peers in the chat
            // TODO: ENCRYPT NOTIFICATION CONTENT
            this.NotifyEntities(targets, {
                type: "chat.message",
                id: id,
                chat: message.chat,
                from: message.from,
                created: isoTime,
                content: message.content,
                mime: message.mime
            });
        } else {
            // TODO handle error case where chat doesn't exist
            Log.Error("Cannot send message as there is no such chat." + message.chat);
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
            this.server.emit("PushNotification", { targets: entities, notif: notification, from: this._activeId });
        }
    }

    //
    // "Private" methods
    //

    // Actually sync data with a connected peer.
    // Returns true if syncing begins successfully (i.e. the other peer is connected).
    _SyncPeer(id, config, timestamp, force=false) {
        if (id in this._peers && this._peers[id] && this._peers[id].connectionState === "connected") {
            // Get local peer metadata
            let query = Database.Execute("SELECT * FROM Peers WHERE id='" + id + "'");
            let meta = query.data.length > 0 ? query.data[0] : { sync: (new Date(0)).toISOString() };

            // Send sync request to the peer with the configuration data
            this._SendPeerData(id, JSON.stringify({
                type: "sync",
                from: this._activeId,
                to: id,
                ts: timestamp,
                sync: meta.sync,
                config: config,
                force: force,
                updated: { profile: meta.updated }
            }));
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

    _OnPeerConnected(id, ts) {
        if (id in this._peersPending && id in this._peers && this._peers[id].connectionState === "connected") {
            delete this._peersPending[id];
            this._peerConnectionTimestamps[id] = ts;
            Log.Info("Connection established to peer." + id);

            // Automagically sync with the peer
            if (this._syncConfig) {
                this._SyncPeer(id, this._syncConfig, (new Date()).toISOString(), true);
            }
        } else {
            Log.Warning("Peer acknowledged non-existent connection!");
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

    // For use with data >16 kiB, see https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels
    // Data must be an Uint8Array. Optionally specify a filename to save it as.
    SendBytes(peer, data, mime="text/json", filename="") {
        // Indicate that we're about to send data chunks to the peer
        this._SendPeerData(peer, JSON.stringify({
            type: "data.begin",
            from: this._activeId,
            mime: mime,
            size: data.byteLength,
            filename: filename
        }));

        // TODO check this sends large amounts of data correctly e.g. videos
        this._channels[peer].send(data);

        // Slice up the data into chunks
        // Thankfully, it can be assumed that the data will be sent in order
        // https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/ordered
        /*let start = 0;
        let end = 0;
        for (let i = 0, counti = Math.ceil(data.byteLength / Constants.maxBytesPerDataSend); i < counti; i++) {
            start = i * Constants.maxBytesPerDataSend;
            end = Math.min(start + Constants.maxBytesPerDataSend, counti);
            this._channels[peer].send(data.slice(start, end));
        }*/

        // Finished sending data, indicate this to the peer
        this._SendPeerData(peer, JSON.stringify({
            type: "data.end",
            from: this._activeId,
            mime: mime,
            size: data.byteLength,
            filename: filename
        }));
    }

    // Sends a file to the specified peer.
    SendFile(peer, path, onDelivered=null) {
        return RNFS.readFile(path, "base64").then((data) => {
            // TODO handle connection loss!
            if (onDelivered != null) {
                let listener = Peerway.addListener("data.ack", (from, data) => {
                    if (from === peer) {
                        listener.remove();
                        if (onDelivered != null) {
                            onDelivered(path);
                        }
                    }
                });
            }
            let bin = Buffer.from(data, "base64");
            Peerway.SendBytes(
                peer,
                new Uint8Array(bin.buffer, bin.byteOffset, bin.length),
                "application/octet-stream",
                path.split("/").pop()
            );
        });
    }

    // Send several files to the specified peer.
    SendFiles(peer, paths, onDelivered=null) {
        const nextPath = paths.shift();
        if (nextPath) {
            return this.SendFile(peer, nextPath, onDelivered).then(
                () => this.SendFiles(peer, paths, onDelivered)
            );
        }
        return Promise.resolve();
    }

    // Send data to a specified peer.
    _SendPeerData(id, data) {
        Log.Debug("Sending data to peer." + id);
        this._channels[id].send(data);
    }

    // Handle receiving data from peer over WebRTC.
    _OnPeerData(event, from) {
        if (typeof(event.data) === "string" && event.data.startsWith("{")) {
            this._OnReceivedJSON(JSON.parse(event.data), from);
        } else if (typeof(event.data) === "object" && from in this._pendingData) {
            Log.Debug("Received binary from peer." + from + " = " + JSON.stringify(event));
            this._pendingData[from] = Buffer.concat([this._pendingData[from], Buffer.from(event.data)]);
        } else {
            Log.Warning("Received unknown data from peer." + from + ": " + JSON.stringify(event));
        }
    };

    // Listener for receiving JSON from peers.
    _OnReceivedJSON(data, from) {
        Log.Debug("Data received from peer." + from);
        switch (data.type) {
            case "chat.message":
                this._OnChatMessage(from, data);
                break;
            case "post.publish":
                this._OnPostPublished(from, data);
                break;
            case "post.request":
                this._OnPostRequest(from, data);
                break;
            case "post.response.begin":
                this._OnPostResponse(from, data);
                break;
            case "post.response.error":
                Log.Error(data.error);
                break;
            case "connected":
                this._OnPeerConnected(from, data.ts);
                break;
            case "sync":
                this._OnPeerSync(from, data);
                break;
            case "chat.update":
                this._OnUpdateChat(from, data);
                break;
            case "data.begin":
                this._OnDataBegin(from, data);
                break;
            case "data.end":
                this._OnDataEnd(from, data);
                break;
            case "peer.update":
                this._OnUpdatePeer(from, data);
                break;
            case "peer.sub":
                this._OnPeerSubToggle(from, true);
                break;
            case "peer.unsub":
                this._OnPeerSubToggle(from, false);
                break;
            case "chat.request":
                this._OnChatRequest(from, data);
                break;
            default:
                this.emit(data.type, from, data);
                break;
        }
    }

    _OnDataBegin(from, data) {
        Log.Debug("Preparing to receive binary data from peer." + from);
        if (from in this._pendingData) {
            Log.Warning("New data being received but peer has not sent data.end request.");
        }
        this._pendingData[from] = Buffer.alloc(0);
    }

    _OnDataEnd(from, data) {
        if (from in this._pendingData) {
            // Acknowledge that the data was received
            this._SendPeerData(from, JSON.stringify({
                type: "data.ack"
            }));

            // Disallow paths! Must be just a file name
            if (data.filename.includes("/") || data.filename.includes("\\")) {
                Log.Error("data.end: filename \"" + data.filename + "\" must be end point, NOT a path.");
            } else if (data.filename.length > 0) {
                // Save as binary file (base64 string)
                // TODO avoid gross base64 conversion. Should just be able to save directly to binary.
                let content = this._pendingData[from].toString("base64");
                let dir = this.GetDownloadPath();
                let path = dir + "/" + data.filename;
                RNFS.mkdir(dir).then(() => {
                    return RNFS.writeFile(path, content, "base64");
                }).then(() => {
                    return RNFS.stat(path);
                }).then((res) => {
                    Log.Info("Saved file from peer." + from + " at " + path + " successfully with size " + res.size);
                }).catch((e) => { Log.Error("Failed to save data to " + path + " due to " + e); });
            } else if (data.mime === "text/json") {
                // Convert to JSON and pass to regular handler
                let content = JSON.parse(this._pendingData[from].toString());
                this._OnReceivedJSON(content, from);
            } else {
                Log.Error("data.end: Mime type must be text/json or have a valid filename specified. Received: " + data.mime);
            }
            delete this._pendingData[from];
        } else {
            Log.Warning("data.end received but never got data.begin request from peer." + from);
        }
    }

    _OnPeerSync(from, data) {
        Log.Debug("Received sync request from peer." + from + " for entity " + data.to);

        // Load local peer data
        let query = Database.Execute("SELECT * FROM Peers WHERE id='" + from + "'");
        if (query.data.length == 0) {
            // TODO validate and verify peer before any notification callbacks
            // Early out, this peer isn't valid!
            return;
        }

        let forceSyncTime = (new Date(0)).toISOString();
        // Have we never sent a sync request to the remote peer?
        let neverGotSyncRequest = query.data[0].sync === forceSyncTime;
        // Has the remote peer never sent a sync request to the local peer?
        let neverSentSyncRequest = data.sync === forceSyncTime;
        Log.Debug("Remote last sync: " + data.sync + " | Local last sync: " + query.data[0].sync);
        // Send a sync request on the first ever sync between the peers,
        // or if there's a difference between last sync timestamps.
        let syncRequired = data.force || (neverGotSyncRequest && neverSentSyncRequest) || 
            (!neverGotSyncRequest && query.data[0].sync !== data.sync);

        // Track whether actual data syncing takes place
        let didSync = false;
        
        // Always sync entity profile
        let profile = JSON.parse(Database.active.getString("profile"));
        
        // Compare ISO timestamps
        if (data.updated.profile !== profile.updated) {
            Log.Debug("Profile desync detected, updating remote peer." + from);

            let sendUpdate = () => {
                Log.Debug("Sending peer.update to peer." + from);
                Peerway.NotifyEntities([from],
                    {
                        ts: (new Date()).toISOString(),
                        type: "peer.update",
                        profile: profile,
                        from: this._activeId
                    }
                );
            }

            // Send over avatar first
            // TODO check if avatar needs to be sent or not rather than just sending every time
            if ("ext" in profile.avatar) {
                RNFS.readFile(this.GetAvatarPath(this._activeId, profile.avatar.ext), "base64").then((data) => {
                    // TODO handle connection loss!
                    let listener = Peerway.addListener("data.ack", (from, data) => {
                        listener.remove();
                        Log.Debug("Received data ACK, proceeding to update remote peer." + from);
                        sendUpdate();
                    });
                    let bin = Buffer.from(data, "base64");
                    Peerway.SendBytes(
                        from,
                        new Uint8Array(bin.buffer, bin.byteOffset, bin.length),
                        profile.avatar.mime,
                        this._activeId + "." + profile.avatar.ext
                    );
                }).catch((e) => {
                    Log.Error(e);
                    // Send update anyway, nevermind the avatar
                    Log.Debug("Sending peer update anyway");
                    sendUpdate();
                });
            }

            didSync = true;
        }

        // Synchronise subscriptions
        if ("sub" in data.config) {
            Log.Debug("Syncing subscriptions...");
            // Register subscription to this entity
            this._OnPeerSubToggle(from, data.config.sub);

            /*
            // TODO check if there is a mismatch between registered subscriptions remotely
            query = Database.Execute(
                "SELECT * FROM Subscriptions WHERE pub='" + from + "' AND sub='" + this._activeId + "'"
            );
            let subbed = query.data.length > 0;
            if (subbed != data.config.subscription.pub) {
                this.NotifyEntities([from], {
                    type: subbed ? "peer.sub" : "peer.unsub"
                });
            }
            */
        }

        // Sync chats
        if ("chats" in data.config) {
            Log.Debug("Syncing chats...");
            for (let i in data.config.chats) {
                // Check if the chat exists
                query = Database.Execute("SELECT * FROM Chats WHERE id='" + data.config.chats[i].id + "'");
                if (query.data.length > 0) {
                    Log.Debug("Syncing chat." + data.config.chats[i].id);
                    let localChat = query.data[0];

                    // TODO verify the other peer is actually part of this chat before collecting messages

                    // Get all messages this entity has sent in the selected chat since last message
                    query = Database.Execute(
                        "SELECT * FROM Messages " + 
                        "WHERE chat = '" + localChat.id + "' " +
                        "AND [from] = '" + this._activeId + "' " +
                        "AND created > '" + data.config.chats[i].lastMessageTS + "'"
                    );

                    if (query.data.length > 0) {
                        // Update the remote peer's chat data accordingly
                        this.NotifyEntities([from],
                            {
                                type: "chat.update",
                                chat: localChat.id,
                                from: this._activeId,
                                messages: query.data
                            }
                        );
                        didSync = true;
                    }

                } else {
                    Log.Debug("No such chat." + data.config.chats[i].id);
                }
            }
        }

        // Sync posts
        if ("posts" in data.config && data.config.cachePostLimitPerUser) {
            Log.Debug("Syncing posts...");
            // Get the latest posts, up to the limit
            query = Database.Execute(
                "SELECT id,version FROM Posts WHERE " + 
                    "author='" + this._activeId + "' " + 
                    "ORDER BY created DESC LIMIT " + data.config.cachePostLimitPerUser
            );
            let posts = data.config.posts.map(x => x.id);
            for (let i in query.data) {
                let post = query.data[i];
                Log.Debug("Post = " + JSON.stringify(post));
                let index = posts.indexOf(post.id);
                // Check if remote peer has the post and the post is up to date
                if (index < 0 || data.config.posts[index].version != post.version) {
                    // Notify remote peer about the post so it can be requested
                    this.NotifyEntities([from], {
                        type: "post.publish",
                        id: post.id,
                        created: post.created
                    })
                }
            }
        }

        if ((!data.force && syncRequired) || didSync) {
            // Store time of this sync with the peer
            Database.Execute(
                "UPDATE Peers SET sync='" + data.ts + "' " +
                "WHERE id='" + from + "'"
            );
        }

        // Send a sync request right back at the remote peer.
        if (syncRequired) {
            this._SyncPeer(from, data.config, data.ts);
        }
    }

    // Handle chat request
    _OnChatRequest(from, data) {
        // TODO notify and let user accept or reject
        // TODO REMOVE THIS DEBUG CODE BEFORE RELEASE
        Database.CreateChat(data.members, {
            id: data.chatId,
            name: data.name,
            updated: data.updated
        });
        this.emit("chat.request", from, data);
    }

    // Handle chat message
    _OnChatMessage(from, data) {
        // TODO reject messages from chats that the user hasn't accepted or has blocked
        Log.Debug("Received chat message from peer." + from);

        // Add the message to the database
        Database.Execute(
            "INSERT INTO Messages (chat,id,[from],created,content,mime) VALUES ('" +
                data.chat + "','" +
                data.id + "','" +
                from + "','" +
                data.created + "','" +
                data.content + "','" + // TODO only insert text content; link to non-text content
                data.mime + "'" + 
            ")"
        );
        
        // Update the last message sent of the chat
        Database.Execute(
            "UPDATE Chats SET lastMessage='" + data.id + "', read=" + 0 + " WHERE id='" + data.chat + "'"
        );

        let query = Database.Execute("SELECT * FROM Chats WHERE id='" + data.chat + "'");

        let chat = query.data.length != 0 ? query.data[0] : {};

        query = Database.Execute("SELECT * FROM Peers WHERE id='" + from + "'");
        let peer = query.data.length != 0 ? query.data[0] : {};

        let avatar = peer.id && peer.avatar ? Peerway.GetAvatarPath(peer.id, peer.avatar, "file://") : "";
        // TODO only show when not in messaging overview or chat itself
        Notif.Message(chat, data, peer, avatar);

        this.emit("chat.message", from, data);
    }

    // Handle a post being published
    _OnPostPublished(from, data) {
        Log.Debug("Received notification of post being published by peer." + from);
        if (from in this._peers) {
            this.NotifyEntities([from], {
                type: "post.request",
                id: data.id
            });
        }
    }

    // Handle a request to send a particular post
    _OnPostRequest(from, data) {
        Log.Debug("Received request for post." + data.id);
        // TODO check sharing permissions before sending
        let query = Database.Execute(
            "SELECT * FROM Posts WHERE id='" + data.id + "' AND author='" + this._activeId + "'"
        );
        if (query.data.length == 0) {
            this.NotifyEntities([from], {
                type: "post.response.error",
                error: "No such post with id " + data.id
            });
        } else {
            // Send the post and associated files
            let response = {
                type: "post.response.begin",
                post: query.data[0]
            };
            let bin = Buffer.from(JSON.stringify(response), "utf8");
            this.SendBytes(from, new Uint8Array(bin.buffer, bin.byteOffset, bin.length));
            let media = JSON.parse(query.data[0].media);
            let delivered = 0;
            this.SendFiles(from, media, (path) => {
                delivered++;
                if (delivered >= media.length) {
                    Log.Debug("All files delivered for post." + data.id);
                }
            }).then(() => {
                // All files should have been sent at least by this point
                this._SendPeerData(from, JSON.stringify({
                    type: "post.response.end",
                    id: data.id
                }));
            }).catch((e) => Log.Error("Could not deliver files to peer." + from + " due to: " + e));
        }
    }

    // Handle initial post response (before the files arrive)
    _OnPostResponse(from, data) {
        Database.CachePost(data.post);
    }

    // Handle updated peer data
    _OnUpdatePeer(from, data) {
        Log.Debug("Received update for peer." + from);
        let avatarExt = "avatar" in data.profile && "ext" in data.profile.avatar ? data.profile.avatar.ext : "";
        Database.Execute(
            "UPDATE Peers SET name='" + data.profile.name + "', " + 
            "avatar='" + avatarExt + "', " + 
            "updated='" + data.profile.updated + "' " +
            "WHERE id='" + from + "'"
        );
        let avatarPath = this.GetDownloadPath() + "/" + from + "." + avatarExt;
        RNFS.exists(avatarPath).then((exists) => {
            if (exists) {
                let path = this.GetPeerPath(from) + "." + avatarExt;
                RNFS.mkdir(this.GetPeerPath(from) + "/").then(() => RNFS.moveFile(avatarPath, path)).then(() => {
                    Peerway.MarkAvatarPathDirty(from);
                    Log.Debug("Updated avatar for peer." + from);
                }).catch((e) => {
                    Log.Error("Failed to mkdir or move file. " + e);
                });
            } else {
                Log.Verbose("Cannot update avatar file for peer." + from + ", no such path " + avatarPath);
            }
        }).catch((e) => {
            Log.Error("Failed to determine if file exists. " + e);
        });
    }

    // Handle updated chat messages
    _OnUpdateChat(from, data) {
        for (let i = 0, counti = data.messages.length; i < counti; i++) {
            // TODO validate received messages

            Log.Debug("Updating chat." + data.chat + " from peer." + from);
            let query = Database.Execute(
                "SELECT id FROM Messages " +
                "WHERE chat='" + data.chat + "' AND id='" + data.messages[i].id + "'"
            );

            if (query.data.length > 0) {
                // Existing message that has been edited and needs to be updated
                Database.Execute(
                    "UPDATE Messages SET content='" + data.messages[i].content + "' " +
                    "WHERE chat='" + data.chat + "' AND id='" + data.messages[i].id + "'"
                );
            } else {
                // Unbeforeseen, treat as a new message
                this._OnChatMessage(from, data.messages[i]);
            }
        }
    }

    // Handle peer subscribing or unsubscribing
    _OnPeerSubToggle(from, sub) {
        Log.Debug("Received " + (sub ? "subscription" : "unsubscription") + " from peer." + from);
        if (sub) {
            Database.Execute(
                "INSERT OR IGNORE INTO Subscriptions (pub,sub) VALUES (" +
                    "'" + this._activeId + "','" + from + "')"
            );
        } else {
            Database.Execute(
                "DELETE FROM Subscriptions WHERE pub='" + this._activeId + "' AND sub='" + from + "'"
            );
        }
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
        this._channels[id].onmessage = (event) => this._OnPeerData(event, id);
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
                this._channels[peer.local].onmessage = (e) => this._OnPeerData(e, peer.local);
                // Record connection timestamp
                this._peerConnectionTimestamps[peer.local] = (new Date()).toISOString();
                Log.Info("Connection established to peer." + peer.local);

                // Send acknowledgement of connection
                this.NotifyEntities([peer.local], {
                    type: "connected",
                    from: peer.remote,
                    ts: this._peerConnectionTimestamps[peer.local]
                });
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
                for (let i in this._pendingCandidates[payload.local]) {
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
