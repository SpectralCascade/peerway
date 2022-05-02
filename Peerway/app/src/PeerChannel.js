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

// Wrapper for a WebRTC connection to a peer, as well as peer authentication & data encryption.
export default class PeerChannel {
    // Constructor takes the id of the peer this channel is associated with, the local active entity ID,
    // and a signalling server connection.
    constructor(id, activeId, server) {
        Log.Debug("Creating new PeerChannel for peer." + id);

        // ID of the peer
        this.id = id;
        // Is this peer available on the server?
        this.online = false;
        // Is this peer connected over WebRTC?
        this.connected = false;
        // Is this peer currently establishing a WebRTC connection?
        this.connecting = false;
        // Signalling server connection
        this.server = server;
        // Callback handler for establishment of WebRTC connection. Only called for the initiator.
        // You should use addListener() if you want to handle connection establishment.
        this.onCallSuccess = () => {};

        // Peer request handlers
        this.requests = {
            cert: {
                issue: (data) => this._Unhandled(data),
                present: (data) => this._Unhandled(data),
                verify: (data) => this._Unhandled(data)
            },
            chat: {
                invite: (data) => this._Unhandled(data),
                message: (data) => this._Unhandled(data),
                update: (data) => this._Unhandled(data)
            },
            connected: (data) => this._OnConnected(data.ts),
            data: {
                ack: () => {},
                begin: (data) => this._OnDataBegin(data),
                end: (data) => this._OnDataEnd(data)
            },
            media: {
                request: (data) => this._Unhandled(data)
            },
            peer: {
                sub: (data) => this._Unhandled(data),
                unsub: (data) => this._Unhandled(data),
                update: (data) => this._Unhandled(data)
            },
            post: {
                publish: (data) => this._Unhandled(data),
                request: (data) => this._Unhandled(data),
                response: {
                    begin: (data) => this._Unhandled(data),
                    error: (data) => Log.Error(data.error)
                }
            },
            sync: (data) => this._Unhandled(data)
        };

        // "Private" WebRTC and event bits

        // All events
        this._events = {};
        // Event handler count
        this._handleCount = 0;

        // The client ID of the remote peer
        this._clientId = "";
        // The local peer ID
        this._activeId = activeId;
        // WebRTC channel for sending and receiving data
        this._channel = null;
        // The WebRTC connection to the peer
        this._peer = null;
        // Pending ICE candidates
        this._pendingCandidates = [];
        // Timestamp at which connection was last established
        this._connectionTS = "";
        // Data buffer being received
        this._pendingData = null;

        // Setup server callbacks
        this.server.on("Answer/" + id, (socket) => this._OnConnectionAccepted(socket));
        this.server.on("ICE/" + id, (incoming) => this._OnReceivedNewCandidate(incoming));
        this.server.on("Meta/" + id, (data) => this._OnEntityMetaResponse(data));
        //this.server.on("Disconnect/" + id, (data) => this._emit("disconnected", {}));
    }

    // Create an EventListener. Returns the listener.
    addListener(eventType, listener) {
        this._handleCount++;
        return new EventListener(this._events, eventType, this._handleCount.toString(), listener);
    }

    // Emit an event.
    _emit(eventType, ...args) {
        if (eventType in this._events) {
            Object.keys(this._events[eventType]).forEach((key) => {
                this._events[eventType][key].invoke(...args);
            });
        }
    }

    // Remove all EventListener instances of a given event type.
    removeAllListeners(eventType) {
        if (eventType in this._events) {
            Object.keys(this._events[eventType]).forEach((key) => {
                delete this._events[eventType][key];
            });
        }
    }

    // Attempt to connect to the peer with the specified server clientId.
    Connect(clientId=null) {
        this.connected = false;
        this.connecting = true;
        // Try and find the peer on the server just using the ID
        if (!clientId) {
            Log.Debug("Requesting entity meta for peer." + this.id);
            this.server.emit("GetEntityMeta", { id: this.id });
        } else {
            this.online = true;
            this._SendConnectionRequest(clientId);
        }
    }

    // Check whether this peer is online or not. Returns true if connected, even if not online via server.
    IsAvailable() {
        return this.online || this.connected;
    }

    // Send JSON request to the peer. Returns true if the request was sent, or false if disconnected.
    SendRequest(data) {
        if (this.connected) {
            let raw = JSON.stringify(data);
            this._channel.send(raw);
            return true;
        }
        return false;
    }

    // Return the state of the WebRTC connection
    GetConnectionState() {
        return this._peer ? this._peer.connectionState : "disconnected";
    }
    
    // For use with data >16 kiB, see https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels
    // Data must be an Uint8Array. Optionally specify a filename to save it as.
    SendBytes(data, mime="text/json", filename="") {
        if (!this.connected) {
            return false;
        }

        // Indicate that we're about to send data chunks to the peer
        this.SendRequest({
            type: "data.begin",
            from: this._activeId,
            mime: mime,
            size: data.byteLength,
            filename: filename
        });

        // TODO check this sends large amounts of data correctly e.g. videos
        // Thankfully, it can be assumed that the data will be sent in order
        // https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/ordered
        this._channel.send(data);

        // Finished sending data, indicate this to the peer
        this.SendRequest({
            type: "data.end",
            from: this._activeId,
            mime: mime,
            size: data.byteLength,
            filename: filename
        });

        return true;
    }

    // Sends a file to the specified peer.
    SendFile(path, onDelivered=null, mime="application/octet-stream") {
        return RNFS.readFile(path, "base64").then((data) => {
            // TODO handle connection loss!
            if (onDelivered != null) {
                // Add data acknowledgement handler
                this.requests.data.ack = () => {
                    delete this.requests.data.ack;
                    if (onDelivered != null) {
                        onDelivered(path);
                    }
                };
            }
            let bin = Buffer.from(data, "base64");
            let sentBytes = this.SendBytes(
                new Uint8Array(bin.buffer, bin.byteOffset, bin.length),
                mime,
                path.split("/").pop()
            );
            if (!sentBytes) {
                return Promise.reject("Not connected to peer." + this.id);
            }
            return Promise.resolve();
        });
    }

    // Send several files to the specified peer.
    SendFiles(paths, onDelivered=null, mime="application/octet-stream") {
        const nextPath = paths.shift();
        if (nextPath) {
            return this.SendFile(nextPath, onDelivered, mime).then(
                () => this.SendFiles(paths, onDelivered, mime)
            );
        }
        return Promise.resolve();
    }

    //
    // "Private" methods
    //

    // Handle response from server for GetEntityMeta request.
    _OnEntityMetaResponse(meta) {
        if (meta.available) {
            // Peer is available on the signal server
            if (!this.online) { 
                this.online = true;
                this._emit("onlineChange", {});
            }
            // Check if the peer is blocked or not before initiating connection
            let query = Database.Execute("SELECT blocked FROM Peers WHERE id='" + meta.id + "'");
            if (query.data.length != 0 && query.data[0].blocked) {
                Log.Info("Not connecting to peer." + meta.id + " as they are blocked.");
            } else if (meta.clientId) {
                // Make a connection request, with the provided client ID
                this.Connect(meta.clientId);
            } else {
                Log.Error("Meta clientId is invalid. Meta: " + JSON.stringify(meta));
            }
        } else {
            // Peer is unavailable on the signal server
            if (this.online != false) {
                this.online = false;
                this._emit("onlineChange", {});
            }
            Log.Debug("Peer." + meta.id + " is unavailable, cannot connect.");
        }
    }

    // Default request handler
    _Unhandled(data) {
        Log.Debug("Received unhandled request from peer." + this.id + " of type " + data.type);
    }

    // Handle receiving data from the peer over WebRTC
    _OnPeerData(event, from) {
        if (typeof(event.data) === "string" && event.data.startsWith("{")) {
            this._OnRequest(JSON.parse(event.data));
        } else if (typeof(event.data) === "object" && this._pendingData != null) {
            Log.Debug("Received binary from peer." + from + " = " + JSON.stringify(event));
            this._pendingData = Buffer.concat([this._pendingData, Buffer.from(event.data)]);
        } else {
            Log.Warning("Received unknown data from peer." + from + ": " + JSON.stringify(event));
        }
    };

    // Handle requests from the peer
    _OnRequest(data) {
        if (!("type" in data)) {
            Log.Warning("Received invalid request from peer." + this.id);
            return;
        }

        let split = data.type.split(".");
        let handler = this.requests[split.shift()];
        for (let i in split) {
            handler = handler[split.shift()]
            if (!handler) {
                break;
            }
        }
        
        if (handler && handler != null && typeof handler === "function") {
            handler(data);
        } else {
            Log.Warning("Received invalid request from peer." + this.id + " of type: " + data.type);
        }
    }

    // Handle large amounts of data from peer
    _OnDataBegin(data) {
        Log.Debug("Preparing to receive binary data from peer." + this.id);
        if (this._pendingData != null) {
            Log.Warning("New data being received but peer has not sent data.end request.");
        }
        this._pendingData = Buffer.alloc(0);
    }

    // Finish parsing large amounts of data from peer
    _OnDataEnd(data) {
        if (this._pendingData != null) {
            // Acknowledge that the data was received
            this.SendRequest({
                type: "data.ack"
            });

            // Disallow paths! Must be just a file name
            if (data.filename.includes("/") || data.filename.includes("\\")) {
                Log.Error("data.end: filename \"" + data.filename + "\" must be end point, NOT a path.");
            } else if (data.filename.length > 0) {
                // Save as binary file (base64 string)
                // TODO avoid gross base64 conversion. Should just be able to save directly to binary.
                let content = this._pendingData.toString("base64");
                // Save media types in media, other files in generic download directory
                let dir = data.mime.startsWith("image/") || data.mime.startsWith("video/") ? 
                    Constants.GetMediaPath(this._activeId) : Constants.GetDownloadPath(this._activeId);
                let path = dir + "/" + data.filename;

                RNFS.mkdir(dir).then(() => {
                    return RNFS.writeFile(path, content, "base64");
                }).then(() => {
                    return RNFS.stat(path);
                }).then((res) => {
                    Log.Info("Saved file from peer." + this.id + " at " + path + " successfully with size " + res.size);
                }).catch((e) => { Log.Error("Failed to save data to " + path + " due to " + e); });
            } else if (data.mime === "text/json") {
                // Convert to JSON and pass to regular handler
                let content = JSON.parse(this._pendingData.toString());
                this._OnRequest(content);
            } else {
                Log.Error("data.end: Mime type must be text/json or have a valid filename specified. Received: " + data.mime);
            }
            this._pendingData = null;
        } else {
            Log.Warning("data.end received but never got data.begin request from peer." + this.id);
        }
    }

    // Creates a WebRTC connection object.
    _CreatePeerConnection() {
        return new RTCPeerConnection({
            iceServers: [
                {
                    urls: "stun:" + Constants.server_ip + ":3478"
                },
                {
                    urls: "turn:" + Constants.server_ip + ":3478",
                    username: "peerway",
                    credential: "peerway"
                },
            ]
        });
    }

    // Callback for handling local ICE candidates.
    // Takes remote entity id to which the candidate pertains.
    _OnPeerConnectionCandidate(e, id) {
        if (this._peer.remoteDescription == null) {
            // Caller may find ICE candidates before the peer is ready to accept them
            this._pendingCandidates.push(e);
        } else if (e.candidate) {
            let payload = {
                local: this._activeId,
                remote: id,
                target: this._clientId, // Target client id
                candidate: e.candidate, // ICE candidate
            };
            Log.Verbose(
                "Sending new ice-candidate from " + payload.local +
                " to " + payload.remote + " client " + payload.target
            );
            this.server.emit("ice-candidate", payload);
        }
    }

    _OnConnected(ts) {
        if (this._peer.connectionState === "connected") {
            this._connectionTS = ts;
            this.connected = true;
            this.connecting = false;
            Log.Info("Connection established to peer." + this.id);

            if (this.onCallSuccess) {
                this.onCallSuccess();
            }

            this._emit("connected", {});
        } else {
            Log.Warning("Peer acknowledged non-existent connection!");
        }
    }

    // Add relayed ICE candidate message from the peer we're trying to connect to.
    _OnReceivedNewCandidate(incoming) {
        Log.Verbose("Received new ICE candidate from " + incoming.local);
        this._peer.addIceCandidate(
            new RTCIceCandidate(incoming.candidate)
        ).catch((e) => Log.Error(e));
    }

    // Callback to respond to WebRTC negotiation. Actually makes the initial peer connection request.
    // Takes the ID of the remote peer to connect to.
    _HandleNegotiationNeededEvent() {
        Log.Verbose("Sending peer request to client " + this._clientId + " (entity " + this.id + ")");
        this._peer.createOffer().then(offer => {
            Log.Info("Setting local SDP for peer." + this.id + "...");
            return this._peer.setLocalDescription(offer);
        }).then(() => {
            let payload = {
                local: this._activeId, // id of active entity
                remote: this.id, // Target entity id
                target: this._clientId, // Target client
                caller: this.server.id, // This client
                sdp: this._peer.localDescription,
            };
            Log.Verbose("Sending peer request to signalling server...");
            this.server.emit("Call", payload);
        }).catch((e) => Log.Error("Error handling negotiation needed event: " + e));
    }

    // Start to establish a WebRTC connection
    _SendConnectionRequest(clientId) {
        Log.Info("Setting up WebRTC connection to peer." + this.id + " (client ID: " + clientId + ")");

        // The client ID is required due to potential for duplicate entity IDs on the server.
        this._clientId = clientId;
        
        // Create local peer connection config
        this._peer = this._CreatePeerConnection();
        // Callback when a new ICE candidate is found for the peer connection.
        this._peer.onicecandidate = (e) => this._OnPeerConnectionCandidate(e, this.id);
        // Callback when negotiation is required (only when calling)
        this._peer.onnegotiationneeded = () => this._HandleNegotiationNeededEvent(this.id);

        // Create a data channel for data transfer with the remote peer.
        this._channel = this._peer.createDataChannel(this.id);
        
        // Listen to incoming messages from the other peer once a connection is established.
        this._channel.onmessage = (event) => this._OnPeerData(event, this.id);
    }

    // Respond to an offer to connect to a peer with WebRTC.
    _OnConnectionRequest(peer) {
        Log.Info("Answering connection request from peer." + peer.local);

        this._clientId = peer.caller;

        // Setup the local peer connection and prepare the appropriate channel for receiving data.
        // The ID passed in is the entity ID of the peer requesting this connection;
        // it has no relevance to the returned value.
        this._peer = this._CreatePeerConnection();
        this._peer.onicecandidate = (e) => this._OnPeerConnectionCandidate(e, this.id);
        
        // Setup event handler for creation of the data channel by the remote peer. 
        this._peer.ondatachannel = (event) => {
            // Create a channel for data transfer to the other peer.
            this._channel = event.channel;
            this._channel.onmessage = (e) => this._OnPeerData(e, peer.local);
            this._connectionTS = (new Date()).toISOString();
            this.connected = true;
            this.connecting = false;
            Log.Info("Connection established to peer." + peer.local);

            // Inform the peer that the connection is established.
            this.SendRequest({
                type: "connected",
                from: peer.remote,
                ts: this._connectionTS
            });

            this._emit("connected", {});
        }

        // Accept the call request
        this._peer.setRemoteDescription(new RTCSessionDescription(peer.sdp)).then(() => {}).then(() => {
            Log.Debug("Creating WebRTC answer...");
            return this._peer.createAnswer();
        }).then(answer => {
            Log.Debug("Setting local SDP of the client...");
            return this._peer.setLocalDescription(answer);
        }).then(() => {
            let payload = {
                local: peer.remote,
                remote: peer.local,
                target: peer.caller,
                caller: peer.target,
                sdp: this._peer.localDescription
            }
            Log.Info("Accepting request from peer." + peer.local);
            this.server.emit("Answer", payload);
        });
    }

    // Handle acception of a connection request to a peer.
    _OnConnectionAccepted(payload) {
        Log.Info("Connection to peer." + payload.local + " accepted, setting SDP.");
        this._peer.setRemoteDescription(new RTCSessionDescription(payload.sdp)).then(() => {
            // Check for any pending ICE candidates
            for (let i in this._pendingCandidates) {
                this._OnPeerConnectionCandidate(this._pendingCandidates[i], payload.local);
            }
            this._pendingCandidates = [];
        }).catch((e) => Log.Error("Failed to handle WebRTC connection answer: " + e));
    }

}
