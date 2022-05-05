import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from "react-native-webrtc";
import { io } from "socket.io-client";
import Database from "./Database";
import { Log } from "./Log";
import RNFS from "react-native-fs";
import Constants from "./Constants";
import { EventListener } from "./Components/EventListener";
import { v1 as uuidv1 } from "uuid";
import { RSA } from "react-native-rsa-native";
import { Buffer } from 'buffer';
import Notif from "./Notif";
import PeerChannel from "./PeerChannel";

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
    // Callback when an avatar has been modified.
    onAvatarChange = (id) => {};

    //
    // "Private" members
    //

    // All peer connections (PeerChannel instances)
    peers = {};

    // Connected peers that are verified, keyed by entity ID.
    _verified = {};
    // URL of the current signal server
    _signalServerURL = "";
    // The id of the entity that is connected to the signal server
    _activeId = "";
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
        return Constants.GetDownloadPath(this._activeId);
    }

    // Path to the folder where media is stored for the active entity.
    GetMediaPath() {
        return Constants.GetMediaPath(this._activeId);
    }

    // Create a certificate to use for comms authentication (returns a promise).
    CreateCertificate() {
        return RSA.generateKeys(4096).then(keys => {
            let data = {
                private: keys.private, // Private key
                certificate: {
                    public: keys.public, // Public key
                    issuer: this._activeId, // Who issued this certificate?
                    created: (new Date()).toISOString(), // The time when this certificate was issued
                    version: Constants.authVersion // What version is this certificate?
                }
            };

            return data;
        });
    }

    IssueCertificate(id) {
        // Issue certificate
        return this.CreateCertificate().then((cert) => {
            Log.Debug("Issuing certificate...");
            // Save the private key
            Database.Execute(
                "UPDATE Peers SET verifier=?, issued=? WHERE id=?",
                [cert.private, JSON.stringify(cert.certificate), id]
            );

            // Issue the certificate
            // TODO send only to the specific client!
            this.SendRequest(id, {
                type: "cert.issue",
                cert: cert.certificate
            });
        }).catch((e) => {
            Log.Error("Failed to create certificate. " + e);
        });
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
        this.server.on("Call", (socket) => { this._OnConnectionRequest(socket); });
        this.server.on("EntityMetaResponse", (meta) => { this._OnEntityMetaResponse(meta); });
        this.server.on("PushNotification", (notif) => {
            let peer = this.GetPeerChannel(notif.from);
            if (peer.connected) {
                // Early out, could be an unverified peer making a security breach attempt
                // Though it's more likely the peer was somehow disconnected without informing this entity
                // TODO ensure that this never happens
                Log.Error("Ignoring received push notification as peer." + peer.id + " should be using WebRTC connection!");
            } else {
                peer._OnRequest(notif.notif);
            }
        });
        this.server.on("Sync", (request) => {
            return this._OnPeerSync(
                this.GetPeerChannel(request.from),
                request.data
            );
        });

        entity.avatar.base64 = Database.active.getString("avatar");
        this.server.emit("SetupEntity", entity);
    }

    // Get an existing peer channel, or create one with callbacks configured
    GetPeerChannel(id) {
        if (!(id in this.peers)) {
            // First create a communication channel for the peer, then configure request handlers
            let peer = new PeerChannel(id, this._activeId, this.server);

            // Peer authentication
            peer.requests.cert.issue = (data) => this._OnCertificateIssued(peer, data);
            peer.requests.cert.present = (data) => this._OnCertificatePresented(peer, data);
            peer.requests.cert.verify = (data) => this._OnVerifyRequest(peer);
            
            // Chats
            peer.requests.chat.message = (data) => this._OnChatMessage(peer, data);
            peer.requests.chat.update = (data) => this._OnUpdateChat(peer, data);
            peer.requests.chat.request = (data) => this._OnChatRequest(peer, data);

            // Media files request
            peer.requests.media.request = (data) => this._OnMediaRequest(peer, data);

            // Peer sub/unsub and profile updates
            peer.requests.peer.sub = (data) => this._OnPeerSubToggle(peer, true);
            peer.requests.peer.unsub = (data) => this._OnPeerSubToggle(peer, false);
            peer.requests.peer.update = (data) => this._OnUpdatePeer(peer, data);

            // Posts
            peer.requests.post.publish = (data) => this._OnPostPublished(peer, data);
            peer.requests.post.request = (data) => this._OnPostRequest(peer, data);
            peer.requests.post.response.begin = (data) => this._OnPostResponse(data);

            // Synchronisation
            peer.requests.sync = (data) => this._OnPeerSync(peer, data);

            this.peers[id] = peer;
        }
        return this.peers[id];
    }

    // Get the metadata for a private chat, or create one if it doesn't exist already
    GetPrivateChat(id) {
        // Find an existing private chat with the peer
        let query = Database.Execute(
            "SELECT * FROM (" + 
                "SELECT Chats.type, ChatMembers.peer, ChatMembers.chat FROM Chats " +
                "INNER JOIN ChatMembers ON ChatMembers.peer=?) " +
            "WHERE type = 0",
            [id]
        );

        let meta = {};
        if (query.data.length > 0) {
            // Private chat already exists with this peer, open it
            meta.id = query.data[0].chat;
            Log.Debug("Private chat already exists, opening chat." + meta.id);
        } else {            
            // Private chat creation, type 0
            let allMembers = [this._activeId, id];
            meta = Database.CreateChat(
                allMembers,
                { type: 0, read: 1 }
            );

            // TODO make sure this is secure, connect to the peer and verify or issue cert first?
            let sendChatRequest = (id) => {
                Log.Debug("Sending chat request to peer." + id);
                this.SendRequest(id, {
                    type: "chat.request",
                    chatId: meta.id,
                    from: this._activeId,
                    name: meta.name,
                    members: allMembers,
                    key: meta.key,
                    version: meta.version,
                    group: 0 // Not a group chat, but a private chat
                });
            };

            // Issue a certificate to the peer if necessary - by requesting to chat with them,
            // you are implicitly trusting them.
            let query = Database.Execute(
                "SELECT id FROM Peers WHERE id=? AND verifier!=''",
                [id]
            );
            if (query.data.length != 0) {
                sendChatRequest(id);
            } else {
                this.IssueCertificate(id).then(() => {
                    Log.Debug("Certificate issued!");
                    sendChatRequest(id);
                }).catch((e) => Log.Error(e));
            }

            console.log("Created chat with id " + meta.id);
        }

        return meta;
    }

    // TODO handle receiving a certificate
    _OnCertificateIssued(from, data) {
        let query = Database.Execute("SELECT verifier,certificate FROM Peers WHERE id=?", [from.id]);
        if (query.data.length == 0) {
            // Never interacted with the peer before, treat with caution as a new trust request
        } else {
            // A new certificate is being issued
            /*if (!this._verified[from.id]) {
                if (this.ConnectToPeer(from.id)) {
                    let listener = null;
                    listener = this.addListener("peer.verified", (verified) => {
                        if (verified) {
                            
                        }
                        listener.remove();
                    });
                    this._VerifyPeer(from.id);
                } else {
                    Log.Warning("Cannot verify peer that is not directly connected.");
                }
            }
            if (query.data[0].certificate.length == 0) {
                // 
            } else {
            }*/
        }
    }

    // Attempt to connect to a specified peer
    // Returns false if connectionState is "connected" or "connecting".
    ConnectToPeer(id, onConnected=null) {
        let peer = this.GetPeerChannel(id);
        if (peer.connecting || peer.connected) {
            Log.Debug("Already " + (peer.connecting ? "connecting" : "connected") + " to peer." + id);
        } else {
            // Setup connection handler
            peer.onCallSuccess = () => {
                // Sync profile data first
                this.SyncPeers({ general: this.GetSyncConfigGeneral(id) });

                if (onConnected) {
                    onConnected(peer.id);
                }
            }
            peer.Connect();
            return true;
        }
        return false;
    }

    // Get general entity sync data
    GetSyncConfigGeneral(id=null) {
        let query = Database.Execute(
            "SELECT id, updated FROM Peers" + (id != null ? " WHERE id=?" : ""),
            (id != null ? [id] : [])
        );
        return query.data.length > 0 ? query.data : undefined;
    }

    // Get cached posts sync data
    GetSyncConfigPosts(peerId, cacheLimit) {
        // Get all cached posts
        let query = Database.Execute(
            "SELECT id,author,version FROM Posts WHERE author=? ORDER BY created DESC LIMIT ?",
            [peerId, cacheLimit]
        );
        return query.data.length > 0 ? query.data : undefined;
    }

    // Get sync options for different data groups
    GetSyncOptions(general, chats, posts) {
        let options = {};
        let query = {};

        if (general) {
            options.general = this.GetSyncConfigGeneral();
        }

        if (chats) {
            // First, get the most recent chat message from each peer in each chat
            query = Database.Execute(
                "SELECT * FROM (SELECT DISTINCT chat, MAX(created) AS created, [from] FROM Messages " +
                    "WHERE [from] != ? ORDER BY created DESC) " + 
                    "WHERE created IS NOT NULL",
                [this._activeId]
            );
            options.chats = query.data.length > 0 ? query.data : undefined;
        }

        if (posts) {
            query = Database.Execute("SELECT pub FROM Subscriptions WHERE sub=?", [this._activeId]);
            if (query.data.length > 0) {
                let peers = {};
                let cachePostLimitPerUser = parseInt(Database.userdata.getString("CachePostLimitPerUser"));
                for (let i in query.data) {
                    let peer = query.data[i].pub;

                    let config = Peerway.GetSyncConfigPosts(peer, cachePostLimitPerUser);
                    peers[peer] = config;
                }
                options.posts = peers;
                options.cachePostLimitPerUser = cachePostLimitPerUser;
            }
        }

        return options;
    }

    // Additional options can be specified to configure how the sync will work.
    // See README.md for details on these options.
    SyncPeers(options = {}) {
        Log.Debug("Syncing peers...");

        // Sync requests, by peer ID
        let requests = {};

        // Handle general peer data
        if (options.general) {
            for (let i = 0, counti = options.general.length; i < counti; i++) {
                let peer = options.general[i];
                if (!(peer.id in requests)) {
                    requests[peer.id] = { general: peer.updated };
                } else {
                    requests[peer.id].general = peer.updated;
                }
            }
        }

        // Handle chats
        if (options.chats) {
            for (let i = 0, counti = options.chats.length; i < counti; i++) {
                let message = options.chats[i];
                if (!(message.from in requests)) {
                    requests[message.from] = { chats: {} };
                } else if (!("chats" in requests[message.from])) {
                    requests[message.from].chats = {};
                }
                // Map the timestamp
                // CONSIDER: Instead of doing this for every post, get the latest peer chats update time?
                requests[message.from].chats[message.chat] = message.created;
            }
        }

        // Handle posts
        if (options.posts) {
            for (let i = 0, counti = options.posts.length; i < counti; i++) {
                let post = options.posts[i];
                if (!(post.author in requests)) {
                    requests[post.author] = { posts: {} };
                } else if (!("posts" in requests[post.author])) {
                    requests[post.author].posts = {};
                }
                // Map the version (timestamp doesn't matter for specific posts)
                // CONSIDER: Rather than doing this for every post, get the latest peer posts update time?
                requests[post.author].posts[post.id] = post.version;
            }
        }

        // Send off the sync requests
        let peers = Object.keys(requests);
        for (let i = 0, counti = peers.length; i < counti; i++) {
            let id = peers[i];
            let data = requests[id];
            Log.Debug("peer = " + JSON.stringify(data));
            data.type = "sync";
            if (options.ts) {
                data.ts = options.ts;
            }
            Log.Debug("Syncing peer." + id);
            
            // Not using SendRequest here as we don't want to force connection unless necessary
            let peer = this.GetPeerChannel(id);
            if (peer.connected) {
                Log.Debug("Connection attempt to sync");
                peer.SendRequest(data);
            } else {
                Log.Debug("Syncing via server");
                // Try the sync request via the server
                this.server.emit("Sync", { target: id, data: data });
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
        let query = Database.Execute("SELECT * FROM Chats WHERE id=?", [message.chat]);
        if (query.data.length > 0) {
            // Load the chat data
            let meta = query.data[0];
            
            let timeNow = new Date();
            let isoTime = timeNow.toISOString();
            let id = uuidv1();
            Database.Execute(
                "INSERT INTO Messages (chat,id,[from],created,content,mime) VALUES (?,?,?,?,?,?)",
                [meta.id, id, message.from, isoTime, message.content, message.mime]
            );
            
            // Update the last message sent of the chat
            meta.lastMessage = message.mime.startsWith("text") ? message.content : message.mime;
            Database.Execute("UPDATE Chats SET lastMessage=? WHERE id=?", [id, meta.id]);

            // Get members of the chat
            let targets = [];
            query = Database.Execute("SELECT * FROM ChatMembers WHERE chat=?", [meta.id]);
            for (let i = 0, counti = query.data.length; i < counti; i++) {
                // Skip self
                if (query.data[i].peer === message.from) {
                    continue;
                }
                targets.push(query.data[i].peer);
            }

            // Now send out a notification to all peers in the chat
            // TODO: ENCRYPT NOTIFICATION CONTENT
            this.MulticastRequest(targets, {
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

    // Send a request to a peer or list of peers, even if they're not connected.
    SendRequest(id, data) {
        let peer = this.GetPeerChannel(id);
        if (peer.connected) {
            peer.SendRequest(data);
        } else {
            // Try to connect before sending the request
            let listener = peer.addListener("connected", (result) => {
                listener.remove();
                if ("available" in result && !result.available) {
                    // TODO try sending as a push notification if possible
                } else if (result.error) {
                    // An error occurred during the connection attempt
                    Log.Error(result.error);
                } else {
                    // Connection successful, send the request directly.
                    peer.SendRequest(data);
                }
            });
            // Attempt to connect to the peer
            this.ConnectToPeer(id);
        }
    }

    // Send a request to multiple entities
    MulticastRequest(entities, data) {
        Log.Debug("Sending request to entities: " + JSON.stringify(entities));
        for (let i = 0, counti = entities.length; i < counti; i++) {
            this.SendRequest(entities[i], data);
        }
    }

    // Connect if not already, then do something. onConnect takes false if connection failed.
    TryConnectThen(id, onConnect) {
        let peer = this.GetPeerChannel(id);
        if (peer.connected) {
            onConnect(true);
        } else {
            // Try to connect before sending the request
            let listener = peer.addListener("connected", (result) => {
                listener.remove();
                if ("available" in result && !result.available) {
                    // TODO try sending as a push notification if possible
                    onConnect(false);
                } else if (result.error) {
                    // An error occurred during the connection attempt
                    Log.Error(result.error);
                    onConnect(false);
                } else {
                    onConnect(true);
                }
            });
            // Attempt to connect to the peer
            this.ConnectToPeer(id);
        }
    }

    //
    // "Private" methods
    //
    
    // TODO refactor to use new peer request
    _OnPeerSync(from, data) {
        Log.Debug("Received sync request from peer." + from.id);

        // Load local peer data
        let query = Database.Execute("SELECT * FROM Peers WHERE id=?", [from.id]);

        // Track whether actual data syncing takes place
        let didSync = false;
        
        if ("general" in data) {
            let profile = JSON.parse(Database.active.getString("profile"));
            
            // Compare ISO timestamps
            if (data.general !== profile.updated) {
                Log.Debug("Profile discrepancy detected, updating remote peer." + from.id);

                // Update the peer
                let sendUpdate = () => {
                    this.SendRequest(from.id,
                        {
                            ts: (new Date()).toISOString(),
                            type: "peer.update",
                            profile: profile,
                            from: this._activeId
                        }
                    );
                }

                // Send over avatar
                if ("ext" in profile.avatar) {
                    RNFS.readFile(this.GetAvatarPath(this._activeId, profile.avatar.ext), "base64").then((data) => {
                        this.TryConnectThen(
                            from.id,
                            (success) => {
                                if (!success) {
                                    Log.Warning("Could not connect to update peer." + from.id);
                                    return;
                                }
                                // TODO handle connection loss!
                                from.requests.data.ack = (data) => {
                                    delete from.requests.data.ack;
                                    Log.Debug("Received data ACK, successfully delivered avatar to peer." + from.id);
                                    sendUpdate();
                                };
                                let bin = Buffer.from(data, "base64");
                                // TODO check if this is suitable or if SendFile would be better
                                from.SendBytes(
                                    new Uint8Array(bin.buffer, bin.byteOffset, bin.length),
                                    profile.avatar.mime,
                                    this._activeId + "." + profile.avatar.ext
                                );
                            }
                        );
                    }).catch((e) => {
                        Log.Error(e);
                        sendUpdate();
                    });
                }

                didSync = true;
            }
        }

        // Synchronise subscriptions
        if ("sub" in data) {
            Log.Debug("Syncing subscriptions...");
            // Register subscription to this entity
            this._OnPeerSubToggle(from, data.sub);

            /*
            // TODO check if there is a mismatch between registered subscriptions remotely
            query = Database.Execute(
                "SELECT * FROM Subscriptions WHERE pub='" + from.id + "' AND sub='" + this._activeId + "'"
            );
            let subbed = query.data.length > 0;
            if (subbed != data.config.subscription.pub) {
                this.SendRequest(from.id, {
                    type: subbed ? "peer.sub" : "peer.unsub"
                });
            }
            */
        }

        // Sync chats
        if ("chats" in data) {
            Log.Debug("Syncing chats...");
            let chats = Object.keys(data.chats);
            for (let i in chats) {
                let id = chats[i];
                let created = data.chats[id];

                // Check if the chat exists
                query = Database.Execute("SELECT * FROM Chats WHERE id=?", [id]);
                if (query.data.length > 0) {
                    Log.Debug("Syncing chat." + id);
                    let localChat = query.data[0];

                    // TODO verify the other peer is actually part of this chat before collecting messages

                    // Get all messages this entity has sent in the selected chat since last message
                    query = Database.Execute(
                        "SELECT * FROM Messages WHERE chat = ? AND [from] = ? AND created > ?",
                        [id, this._activeId, created]
                    );

                    if (query.data.length > 0) {
                        // Update the remote peer's chat data accordingly
                        this.SendRequest(from.id,
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
                    Log.Debug("No such chat." + id);
                }
            }
        }

        // Sync posts
        if ("posts" in data && "cachePostLimitPerUser" in data) {
            Log.Debug("Syncing posts...");
            // Get the latest posts, up to the limit
            query = Database.Execute(
                "SELECT id,version FROM Posts WHERE author=? ORDER BY created DESC LIMIT ?",
                [this._activeId, data.cachePostLimitPerUser]
            );
            for (let i in query.data) {
                let post = query.data[i];
                
                if (!(post.id in data.posts) || post.version !== data.posts[post.id]) {
                    this.SendRequest(from.id, {
                        type: "post.publish",
                        id: post.id,
                        created: post.created
                    });
                    didSync = true;
                }
            }
        }

        if (didSync && !("ts" in data)) {
            // Store time of this sync with the peer
            let ts = (new Date()).toISOString();
            Database.Execute("UPDATE Peers SET sync=? WHERE id=?", [ts, from.id]);
            let options = this.GetSyncOptions("general" in data, "chats" in data, "posts" in data);
            options.ts = ts;
            this.SyncPeers(options);
        } else if ("ts" in data) {
            Database.Execute("UPDATE Peers SET sync=? WHERE id=?", [data.ts, from.id]);
        }
    }

    // Handle chat request
    _OnChatRequest(from, data) {
        // TODO notify and let user accept or reject

        // TODO REMOVE THIS DEBUG CODE BEFORE RELEASE
        Database.CreateChat(data.members, {
            id: data.chatId,
            name: data.name,
            updated: data.updated,
            type: data.group,
            key: data.key,
            version: data.version,
            accepted: 0
        });
        this.emit("chat.request", from.id, data);
    }

    // Handle chat message
    _OnChatMessage(from, data) {
        // TODO reject messages from chats that the user hasn't accepted or has blocked
        Log.Debug("Received chat message from peer." + from.id);

        // Add the message to the database
        Database.Execute(
            "INSERT INTO Messages (chat,id,[from],created,content,mime) VALUES (?,?,?,?,?,?)",
            [data.chat, data.id, from.id, data.created, data.content, data.mime]
        );
        
        // Update the last message sent of the chat
        Database.Execute("UPDATE Chats SET lastMessage=?, read=? WHERE id=?", [data.id, 0, data.chat]);

        let query = Database.Execute("SELECT * FROM Chats WHERE id=?", [data.chat]);

        let chat = query.data.length != 0 ? query.data[0] : {};

        query = Database.Execute("SELECT * FROM Peers WHERE id=?", [from.id]);
        let peer = query.data.length != 0 ? query.data[0] : {};

        let avatar = peer.id && peer.avatar ? Peerway.GetAvatarPath(peer.id, peer.avatar, "file://") : "";
        // TODO only show when not in messaging overview or chat itself
        Notif.Message(chat, data, peer, avatar);

        if (!data.mime.startsWith("text/")) {
            // Request the media automagically
            this.SendRequest(from.id, {
                type: "media.request",
                filename: data.content,
                mime: data.mime
            });
        } else {
            this.emit("chat.message", from.id, data);
        }
    }

    // Handle a post being published
    _OnPostPublished(from, data) {
        Log.Debug("Received notification of post being published by peer." + from.id);
        this.SendRequest(from.id, {
            type: "post.request",
            id: data.id
        });
    }

    // Handle a request to send a particular post
    _OnPostRequest(from, data) {
        Log.Debug("Received request for post." + data.id);
        // TODO check sharing permissions before sending
        let query = Database.Execute(
            "SELECT * FROM Posts WHERE id=? AND author=?", [data.id, this._activeId]
        );
        if (query.data.length == 0) {
            this.SendRequest(from.id, {
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
            from.SendBytes(new Uint8Array(bin.buffer, bin.byteOffset, bin.length));
            let media = JSON.parse(query.data[0].media);
            let delivered = 0;
            from.SendFiles(media, (path) => {
                delivered++;
                if (delivered >= media.length) {
                    Log.Debug("All files delivered for post." + data.id);
                }
            }).then(() => {
                // All files should have been sent at least by this point
                from.SendRequest({
                    type: "post.response.end",
                    id: data.id
                });
            }).catch((e) => Log.Error("Could not deliver files to peer." + from + " due to: " + e));
        }
    }

    // Handle initial post response (before the files arrive)
    _OnPostResponse(data) {
        Database.CachePost(data.post);
    }

    _OnMediaRequest(from, data) {
        // TODO check if peer is allowed the file first, and make sure filename is stripped!
        from.SendFile(this.GetMediaPath() + "/" + data.filename, null, data.mime).catch((e) => 
            Log.Error("Could not send file: " + e)
        );
    }

    // Handle updated peer data
    _OnUpdatePeer(from, data) {
        Log.Debug("Received update for peer." + from.id);
        let avatarExt = "avatar" in data.profile && "ext" in data.profile.avatar ? data.profile.avatar.ext : "";
        Database.Execute(
            "UPDATE Peers SET name=?, avatar=?, updated=? WHERE id=?",
            [data.profile.name, avatarExt, data.profile.updated, from.id]
        );
        let avatarPath = this.GetMediaPath() + "/" + from.id + "." + avatarExt;
        RNFS.exists(avatarPath).then((exists) => {
            if (exists) {
                let path = this.GetPeerPath(from.id) + "." + avatarExt;
                RNFS.mkdir(this.GetPeerPath(from.id) + "/").then(() => RNFS.moveFile(avatarPath, path)).then(() => {
                    Peerway.MarkAvatarPathDirty(from.id);
                    Log.Debug("Updated avatar for peer." + from.id);
                }).catch((e) => {
                    Log.Error("Failed to mkdir or move file. " + e);
                });
            } else {
                Log.Warning("Cannot update avatar file for peer." + from.id + ", no such path " + avatarPath);
            }
        }).catch((e) => {
            Log.Error("Failed to determine if file exists. " + e);
        });
    }

    // Handle updated chat messages
    _OnUpdateChat(from, data) {
        for (let i = 0, counti = data.messages.length; i < counti; i++) {
            // TODO validate received messages

            Log.Debug("Updating chat." + data.chat + " from peer." + from.id);
            let query = Database.Execute(
                "SELECT id FROM Messages WHERE chat=? AND id=?",
                [data.chat, data.messages[i].id]
            );

            if (query.data.length > 0) {
                // Existing message that has been edited and needs to be updated
                Database.Execute(
                    "UPDATE Messages SET content=? WHERE chat=? AND id=?",
                    [data.messages[i].content, data.chat, data.messages[i].id]
                );
            } else {
                // Unbeforeseen, treat as a new message
                this._OnChatMessage(from, data.messages[i]);
            }
        }
    }

    // Handle peer subscribing or unsubscribing
    _OnPeerSubToggle(from, sub) {
        Log.Debug("Received " + (sub ? "subscription" : "unsubscription") + " from peer." + from.id);
        if (sub) {
            Database.Execute(
                "INSERT OR IGNORE INTO Subscriptions (pub,sub) VALUES (?,?)",
                [this._activeId, from.id]
            );
        } else {
            Database.Execute("DELETE FROM Subscriptions WHERE pub=? AND sub=?", [this._activeId, from.id]);
        }
    }

    // Encrypt data for a peer, returns a promise.
    _EncryptForPeer(id, data) {
        let query = Database.Execute("SELECT verifier FROM Peers WHERE id=?", [id]);
        if (query.data.length != 0) {
            if (query.data[0].verifier.length != 0) {
                return RSA.encrypt(data, query.data[0].verifier);
            } else {
                return Promise.reject("No verifier exists for peer." + id);
            }
        }
        return Promise.reject("No such known peer." + id);
    }

    // Decrypt data from a peer, returns a promise.
    _DecryptFromPeer(id, data) {
        let query = Database.Execute("SELECT certificate FROM Peers WHERE id=?", [id]);
        if (query.data.length != 0) {
            if (query.data[0].certificate.length != 0) {
                return RSA.decrypt(data, JSON.parse(query.data[0].certificate).public);
            } else {
                return Promise.reject("No certificate exists for peer." + id);
            }
        }
        return Promise.reject("No such known peer." + id);
    }

    // Check if a remote connected peer has a valid certificate.
    _VerifyPeer(id) {
        let query = Database.Execute("SELECT certificate FROM Peers WHERE id=?", [id]);
        if (query.data.length != 0 && query.data[0].certificate.length != 0) {
            this._SendPeerData(id, JSON.stringify({
                type: "cert.verify"
            }));
        } else {
            // Don't even bother 
            Log.Error("No certificate available for verifying peer." + id);
        }
    }

    // Respond to a request to verify
    _OnVerifyRequest(from) {
        let query = Database.Execute("SELECT certificate FROM Peers WHERE id=?", [from.id]);
        if (query.data.length != 0 && query.data[0].certificate.length != 0) {
            // Encrypt the certificate - only the real entity should be allowed to read it!
            this._EncryptForPeer(from.id, query.data[0].certificate).then((encrypted) => {
                from.SendRequest({
                    type: "cert.present",
                    cert: encrypted
                });
            }).catch((e) => Log.Error(e));
        } else {
            Log.Warning("Peer." + from.id + " requesting verification but has no recorded certificate.");
        }
    }

    // Called when a remote peer responds to a verification request.
    _OnCertificatePresented(from, data) {
        // Decrypt the data and verify that it's the same as the recorded certificate
        // TODO callback onVerifyPeer
        this._DecryptFromPeer(from.id, data.cert).then((decrypted) => {
            let query = Database.Execute("SELECT issued FROM Peer WHERE id=?", [from.id]);
            // Compare the certificate with the one issued
            this._verified[from.id] = query.data.length != 0 && query.data[0].issued === decrypted;
            if (this._verified[from.id]) {
                Log.Info("Peer." + from.id + " verified successfully.");
            } else {
                // Verification failed!
                Log.Warning("PEER." + from.id + " FAILED VERIFICATION");
            }
        }).catch((e) => Log.Error(e));
    }

    // Respond to an offer to connect to a peer.
    _OnConnectionRequest(peer) {
        Log.Info("Received request to connect from peer." + peer.local);

        let meta = {};
        meta = Database.AddPeer(peer.local, {}, false);

        // Check to ensure the peer isn't blocked.
        if (!meta.blocked) {
            this.GetPeerChannel(peer.local)._OnConnectionRequest(peer);
        } else {
            Log.Info("Discarding request received to connect to blocked peer." + peer.local);
        }
    }

}

// Global instance grants access to the API
let Peerway = new PeerwayAPI();
export default Peerway;
