import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from "react-native-webrtc";
import { io } from "socket.io-client";
import Database from "./Database";
import { Log } from "./Log";
import RNFS from "react-native-fs";
import Constants from "./Constants";
import { EventEmitter } from "react-native";
import { EventListener } from "./Components/EventListener";
import { v1 as uuidv1 } from "uuid";
import { RSA } from "react-native-rsa-native";
import { Buffer } from 'buffer';
import Notif from "./Notif";
import Peerway from "./Peerway";

// Wrapper for a WebRTC connection to a peer, as well as peer authentication & data encryption.
class PeerChannel {
    // Constructor takes the id of the peer this channel is associated with, the local active entity ID,
    // and a signalling server connection.
    constructor(id, activeId, server) {
        // ID of the peer
        this.id = id;
        // Is this peer available on the server?
        this.online = false;
        // Is this peer connected over WebRTC?
        this.connected = false;
        // Signalling server connection
        this.server = server;

        // "Private" WebRTC bits

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
        this.server.on("Call/" + id, (socket) => this._OnConnectionRequest(socket));
        this.server.on("Answer/" + id, (socket) => this._OnConnectionAccepted(socket));
        // TODO check this works both ways
        this.server.on("ICE/" + id, (incoming) => this._OnReceivedNewCandidate(incoming));
    }

    // Attempt to connect to the peer.
    Connect() {
        this.connected = false;
        // TODO
    }

    // Check whether this peer is online or not. Returns true if connected, even if not online via server.
    IsAvailable() {
        return this.online || this.connected;
    }

    //
    // "Private" methods
    //

    // Handle receiving data from the peer over WebRTC
    _OnPeerData(event, from) {
        if (typeof(event.data) === "string" && event.data.startsWith("{")) {
            this._OnReceivedJSON(JSON.parse(event.data), from);
        } else if (typeof(event.data) === "object" && this._pendingData != null) {
            Log.Debug("Received binary from peer." + from + " = " + JSON.stringify(event));
            this._pendingData = Buffer.concat([this._pendingData, Buffer.from(event.data)]);
        } else {
            Log.Warning("Received unknown data from peer." + from + ": " + JSON.stringify(event));
        }
    };

    _OnReceivedJSON(data, from) {
        Log.Debug("Data received from peer." + from);
        switch (data.type) {
            case "chat.message":
                Peerway._OnChatMessage(from, data);
                break;
            case "post.publish":
                Peerway._OnPostPublished(from, data);
                break;
            case "post.request":
                Peerway._OnPostRequest(from, data);
                break;
            case "post.response.begin":
                Peerway._OnPostResponse(from, data);
                break;
            case "post.response.error":
                Log.Error(data.error);
                break;
            case "media.request":
                Peerway._OnMediaRequest(from, data);
                break;
            case "connected":
                this._OnPeerConnected(data.ts);
                break;
            case "sync":
                Peerway._OnPeerSync(from, data);
                break;
            case "chat.update":
                Peerway._OnUpdateChat(from, data);
                break;
            case "data.begin":
                this._OnDataBegin(from, data);
                break;
            case "data.end":
                this._OnDataEnd(from, data);
                break;
            case "peer.update":
                Peerway._OnUpdatePeer(from, data);
                break;
            case "peer.sub":
                Peerway._OnPeerSubToggle(from, true);
                break;
            case "peer.unsub":
                Peerway._OnPeerSubToggle(from, false);
                break;
            case "chat.request":
                Peerway._OnChatRequest(from, data);
                break;
            case "cert.verify":
                Peerway._OnVerifyRequest(from, data);
                break;
            case "cert.present":
                Peerway._OnCertificatePresented(from, data);
                break;
            case "cert.issue":
                Peerway._OnCertificateIssued(from, data);
                break;
            default:
                break;
        }
    }

    // For use with data >16 kiB, see https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels
    // Data must be an Uint8Array. Optionally specify a filename to save it as.
    SendBytes(data, mime="text/json", filename="") {
        // Indicate that we're about to send data chunks to the peer
        this._channel.send(JSON.stringify({
            type: "data.begin",
            from: this._activeId,
            mime: mime,
            size: data.byteLength,
            filename: filename
        }));

        // TODO check this sends large amounts of data correctly e.g. videos
        this._channel.send(data);

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
        this._channel.send(JSON.stringify({
            type: "data.end",
            from: this._activeId,
            mime: mime,
            size: data.byteLength,
            filename: filename
        }));
    }

    // Sends a file to the specified peer.
    SendFile(path, onDelivered=null, mime="application/octet-stream") {
        return RNFS.readFile(path, "base64").then((data) => {
            // TODO handle connection loss!
            if (onDelivered != null) {
                let listener = Peerway.addListener("data.ack", (from, data) => {
                    if (from === this.id) {
                        listener.remove();
                        if (onDelivered != null) {
                            onDelivered(path);
                        }
                    }
                });
            }
            let bin = Buffer.from(data, "base64");
            this.SendBytes(
                new Uint8Array(bin.buffer, bin.byteOffset, bin.length),
                mime,
                path.split("/").pop()
            );
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

    // Handle large amounts of data from peer
    _OnDataBegin(from, data) {
        Log.Debug("Preparing to receive binary data from peer." + from);
        if (this._pendingData != null) {
            Log.Warning("New data being received but peer has not sent data.end request.");
        }
        this._pendingData = Buffer.alloc(0);
    }

    // Finish parsing large amounts of data from peer
    _OnDataEnd(from, data) {
        if (this._pendingData != null) {
            // Acknowledge that the data was received
            this._channel.send(JSON.stringify({
                type: "data.ack"
            }));

            // Disallow paths! Must be just a file name
            if (data.filename.includes("/") || data.filename.includes("\\")) {
                Log.Error("data.end: filename \"" + data.filename + "\" must be end point, NOT a path.");
            } else if (data.filename.length > 0) {
                // Save as binary file (base64 string)
                // TODO avoid gross base64 conversion. Should just be able to save directly to binary.
                let content = this._pendingData.toString("base64");
                // Save media types in media, other files in generic download directory
                let dir = data.mime.startsWith("image/") || data.mime.startsWith("video/") ? 
                    this.GetMediaPath() : this.GetDownloadPath();
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
                let content = JSON.parse(this._pendingData.toString());
                this._OnReceivedJSON(content, from);
            } else {
                Log.Error("data.end: Mime type must be text/json or have a valid filename specified. Received: " + data.mime);
            }
            this._pendingData = null;
        } else {
            Log.Warning("data.end received but never got data.begin request from peer." + from);
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

    _OnPeerConnected(ts) {
        if (this._peer.connectionState === "connected") {
            this._connectionTS = ts;
            this.connected = true;
            Log.Info("Connection established to peer." + id);

            Peerway.emit("peer.connected", { id: id });

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
        this._peer.addIceCandidate(
            new RTCIceCandidate(incoming.candidate)
        ).catch((e) => { this.onSyncPeersError({message: e}); });
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
        }).catch((e) => {
            this.onSyncPeersError({message: "Error handling negotiation needed event: " + e});
        });
    }

    // Start to establish a WebRTC connection
    _SendConnectionRequest(clientId) {
        Log.Info("Setting up WebRTC connection to peer." + this.id);

        // The client ID is required due to potential for duplicate entity IDs on the server.
        this._clientId = clientId;
        
        // Create local peer connection config
        this._peer = this._CreatePeerConnection();
        // Callback when a new ICE candidate is found for the peer connection.
        peer.onicecandidate = (e) => this._OnPeerConnectionCandidate(e, this.id);
        // Callback when negotiation is required (only when calling)
        peer.onnegotiationneeded = () => this._HandleNegotiationNeededEvent(this.id);

        // Create a data channel for data transfer with the remote peer.
        this._channel = this._peer.createDataChannel(this.id);
        
        // Listen to incoming messages from the other peer once a connection is established.
        this._channel.onmessage = (event) => this._OnPeerData(event, this.id);
    }

    // Respond to an offer to connect to a peer with WebRTC.
    _OnConnectionRequest(peer) {
        Log.Info("Received request to connect from peer." + peer.local);

        // OLD CODE COMMENTED OUT BELOW NEEDS TO BE KEPT IN PEERWAY.JS
        /*
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
        */

        // Check to ensure the peer isn't blocked.
        //if (!meta.blocked) {
        this._clientId = peer.caller;

        // Setup the local peer connection and prepare the appropriate channel for receiving data.
        // The ID passed in is the entity ID of the peer requesting this connection;
        // it has no relevance to the returned value.
        this._peer = this._CreatePeerAnswer(peer.local);
        // Setup event handler for creation of the data channel by the remote peer. 
        this._peer.ondatachannel = (event) => {
            // Create a channel for data transfer to the other peer.
            this._channel = event.channel;
            this._channel.onmessage = (e) => this._OnPeerData(e, peer.local);
            this._connectionTS = (new Date()).toISOString();
            this.connected = true;
            Log.Info("Connection established to peer." + peer.local);

            // TODO confirm this is always received
            this._channel.send(JSON.stringify({
                type: "connected",
                from: peer.remote,
                ts: this._connectionTS
            }));
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
        //} else {
        //    Log.Info("Discarding request received to connect to blocked peer." + peer.local);
        //}
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
        }).catch(
            (e) => { this.onSyncPeersError({message: "Failed to handle WebRTC connection answer: " + e}); }
        );
    }

}
