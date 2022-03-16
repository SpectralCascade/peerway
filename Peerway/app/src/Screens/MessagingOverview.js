import { StyleSheet, View, Image, TouchableOpacity, ScrollView, FlatList, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { Component } from 'react';
import StyleMain from '../Stylesheets/StyleMain';
import Text from '../Components/Text';
import Database from '../Database';
import Icon from 'react-native-vector-icons/MaterialIcons'; 
import Colors from '../Stylesheets/Colors';
import HandleEffect from '../Components/HandleEffect';
import { io } from 'socket.io-client';
import Constants from '../Constants';
import AppState from '../AppState';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc'
import Log from "../Log";

const topbarHeight = 56;
const iconSize = 56;
const paddingAmount = 8;

export default class MessagingOverview extends Component {

    // List of peers that need to be connected.
    peersToConnect = [];
    // Peer entities that have been requested to connect, keyed by client id.
    peersPending = {};
    // ICE candidates that need to be sent once a peer has accepted the connection.
    pendingCandidates = {};

    // Setup initial state
    constructor(props) {
        super(props);
        this.state = {
            // The id of the current active entity
            id: "",
            chats: []
        }

        // As the constructor will be called before 
        if (this.state.id.length == 0) {
            this.state.id = Database.active.getString("id");
        }

        AppState.connection = React.createRef();

        //Database.active.delete("chats");

        // CONSIDER: Move this elsewhere?
        this.connectToSignalServer();
    }

    // Callback on navigating to this screen.
    OnOpen() {
        Log.Debug("OPENED MESSAGING OVERVIEW");

        this.state.id = Database.active.getString("id");
        // Load up cached chats
        let chatIds = [];
        if (Database.active.contains("chats")) {
            chatIds = JSON.parse(Database.active.getString("chats"));
            Log.Debug("Chats = " + JSON.stringify(chatIds));
        }
        this.state.chats = [];
        for (let i in chatIds) {
            let id = chatIds[i];
            if (Database.active.contains("chat." + id)) {
                let meta = JSON.parse(Database.active.getString("chat." + id));

                // Create a chat entry for the UI
                this.state.chats.push({
                    id: id,
                    name: meta.name,
                    message: {
                        content: "...", // TODO: insert last message text
                        timestamp: (new Date(meta.received)).toLocaleDateString("en-GB")
                    },
                    icon: meta.icon,
                    read: meta.read
                });
            } else {
                Log.Error("Chat " + id + " does not exist, but is listed!");
            }
        }

        // Connect to peers to update chats
        this.SetupCallbacks();
        this.SyncPeers();

        this.forceUpdate();
    }

    // Configure callbacks for setting up a WebRTC connection
    SetupCallbacks() {
        AppState.connection.current.off("PeerConnectionRequest");
        AppState.connection.current.on("PeerConnectionRequest", (socket) => { this.OnConnectionRequest(socket); });

        AppState.connection.current.off("PeerConnectionAccepted");
        AppState.connection.current.on("PeerConnectionAccepted", (socket) => { this.OnConnectionAccepted(socket); });

        AppState.connection.current.off("ice-candidate");
        AppState.connection.current.on("ice-candidate", incoming => { this.OnReceivedNewCandidate(incoming); });

        AppState.connection.current.off("EntityMetaResponse");
        AppState.connection.current.on("EntityMetaResponse", (meta) => { this.OnEntityMetaResponse(meta); });
    }

    // Handle receiving data from peer.
    OnPeerData(event) {
        // Listener for receiving messages from the peer
        Log.Debug("Message received from peer:\n" +  JSON.stringify(event));
    };

    // Send data to a specified peer.
    SendPeerData(id, data) {
        AppState.channels[id].send(data);
    }

    // Send a request to connect to a specified entity.
    SendConnectionRequest(id, clientId) {
        // The client ID is required due to potential for duplicate entity IDs on the server.
        this.peersPending[id] = clientId;
        // Create local peer connection config
        AppState.peers[id] = this.CreatePeerCall(id);
        // Create a data channel for data transfer with the remote peer.
        AppState.channels[id] = AppState.peers[id].createDataChannel(this.state.id + "[->]" + id);
        
        // listen to incoming messages from the other peer once a connection is established.
        AppState.channels[id].onmessage = (event) => this.OnPeerData(event);
    }
    
    // Respond to an offer to connect to a peer.
    OnConnectionRequest(peer) {
        Log.Info("Received request to connect from peer with id " + peer.local);

        if (this.peersToConnect.length == 0) {
            if (Database.active.contains("peers")) {
                // Syncing may not have taken place yet, or this entity has never interacted with peers.
                this.peersToConnect = JSON.parse(Database.active.getString("peers"));
            } else {
                this.peersToConnect = [];
            }
        }

        let meta = {};
        // TODO check in JSON object - might be faster than an array.
        if (this.peersToConnect.includes(peer.local)) {
            meta = Database.active.getString("peer." + peer.local);

            // TODO: Check peer is genuine (verify signature)
            
            // Remove from peers waiting to be connected
            let toRemove = this.peersToConnect.indexOf(peer.local);
            if (toRemove >= 0) {
                this.peersToConnect.splice(toRemove, 1);
            }
        } else {
            // Not seen this peer before, add to the database
            Database.AddPeer(peer.local);
            meta = Database.active.getString("peer." + peer.local);
        }

        // Check to ensure the peer isn't blocked.
        if (!meta.blocked) {
            this.peersPending[peer.local] = peer.caller;

            // Setup the local peer connection and prepare the appropriate channel for receiving data.
            // The ID passed in is the entity ID of the peer requesting this connection;
            // it has no relevance to the returned value.
            AppState.peers[peer.local] = this.CreatePeerAnswer(peer.local);
            // Setup event handler for creation of the data channel by the remote peer. 
            AppState.peers[peer.local].ondatachannel = (event) => {
                // Create a channel for data transfer to the other peer.
                AppState.channels[peer.local] = event.channel;
                AppState.channels[peer.local].onmessage = (e) => this.OnPeerData(e);
                Log.Info("Connection established to peer." + peer.local);
                this.SendPeerData(peer.local, "TEST DATA MESSAGE from " + this.state.id);
            }

            // Accept the call request
            AppState.peers[peer.local].setRemoteDescription(new RTCSessionDescription(peer.sdp)).then(() => {}).then(() => {
                Log.Debug("Creating WebRTC answer...");
                return AppState.peers[peer.local].createAnswer();
            }).then(answer => {
                Log.Debug("Setting local SDP of the client...");
                return AppState.peers[peer.local].setLocalDescription(answer);
            }).then(() => {
                let payload = {
                    local: peer.remote,
                    remote: peer.local,
                    target: peer.caller,
                    caller: peer.target,
                    sdp: AppState.peers[peer.local].localDescription
                }
                Log.Info("Accepting request from peer." + peer.local);
                AppState.connection.current.emit("AcceptPeerRequest", payload);
            });
        } else {
            Log.Info("Discarding request received to connect to blocked peer." + peer.local);
        }
    }

    // Handle acception of a connection request to a peer.
    OnConnectionAccepted(payload) {
        Log.Info("Connection to peer." + payload.local + " accepted, setting SDP.");
        AppState.peers[payload.local].setRemoteDescription(new RTCSessionDescription(payload.sdp)).then(() => {
            // Check for any pending ICE candidates
            if (payload.local in this.pendingCandidates) {
                Log.Verbose("Some ICE candidates are pending, sending to peer." + payload.local);
                for (i in this.pendingCandidates[payload.local]) {
                    this.OnPeerConnectionCandidate((this.pendingCandidates[payload.local])[i], payload.local);
                }
                delete this.pendingCandidates[payload.local];
            }
        }).catch(
            e => Log.Error("Failed to handle WebRTC connection answer. ", e)
        );
    }

    // Handle response to a request to get entity meta
    OnEntityMetaResponse(meta) {
        Log.Debug("Meta response: " + JSON.stringify(meta));
        if (meta.available) {
            // Check if the entity is supposed to be connected to.
            if (this.peersToConnect.includes(meta.id)) {
                // Make a connection request
                Log.Info("Sending connection request to peer." + meta.id + " of client " + meta.clientId);
                this.SendConnectionRequest(meta.id, meta.clientId);
            } else {
                // Might have a use case, e.g. interacting with a new entity for the first time.
                Log.Debug("peer." + meta.id + " not in expected peersToConnect array " + JSON.stringify(this.peersToConnect));
            }
        }
    }

    // Callback for handling local ICE candidates.
    // Takes remote entity id to which the candidate pertains.
    OnPeerConnectionCandidate(e, id) {
        if (AppState.peers[id].remoteDescription == null) {
            // Caller may find ICE candidates before the peer is ready to accept them
            if (!(id in this.pendingCandidates)) {
                this.pendingCandidates[id] = [];
            }
            this.pendingCandidates[id].push(e);
        } else if (e.candidate) {
            let payload = {
                local: this.state.id,
                remote: id,
                target: this.peersPending[id], // Target client id
                candidate: e.candidate, // ICE candidate
            };
            Log.Verbose(
                "Sending new ice-candidate from " + payload.local +
                " to " + payload.remote + " client " + payload.target
            );
            AppState.connection.current.emit("ice-candidate", payload);
        }
    }

    // Handle changes in connection state for a particular peer call connection.
    OnPeerCallChange(connection, id) {
        if (AppState.peers[id].connectionState === "connected") {
            delete this.peersPending[id];
            Log.Info("Connection established to peer." + id);
        } else {
            Log.Info("Connection call state to peer." + id + " changed to: " + AppState.peers[id].connectionState);
        }
    }

    // Add relayed ICE candidate message from the peer we're trying to connect to.
    OnReceivedNewCandidate(incoming) {
        Log.Verbose("Received new ICE candidate from " + incoming.local);
        AppState.peers[incoming.local].addIceCandidate(
            new RTCIceCandidate(incoming.candidate)
        ).catch(e => Log.Error(e));
    }

    // Callback to respond to WebRTC negotiation. Actually makes the initial peer connection request.
    // Takes the ID of the remote peer to connect to.
    HandleNegotiationNeededEvent(id) {
        // Make sure this is actually a peer we want to connect to.
        if (id in this.peersPending) {
            Log.Verbose("Sending peer request to client " + this.peersPending[id] + " (entity " + id + ")");
            AppState.peers[id].createOffer().then(offer => {
                Log.Info("Setting local SDP for peer." + id + "...");
                return AppState.peers[id].setLocalDescription(offer);
            }).then(() => {
                let payload = {
                    local: this.state.id, // id of active entity
                    remote: id, // Target entity id
                    target: this.peersPending[id], // Target client
                    caller: AppState.connection.current.id, // This client
                    sdp: AppState.peers[id].localDescription,
                };
                Log.Verbose("Sending peer request to signalling server...");
                AppState.connection.current.emit("SendPeerRequest", payload);
            }).catch(err => Log.Error("Error handling negotiation needed event", err));
        } else {
            Log.Error("No known peer pending with client id " + id + " - aborting connection request.");
        }
    }

    // Create a call to a particular peer (specified by entity id).
    CreatePeerCall(id) {
        Log.Info("Setting up WebRTC connection to peer " + id);
        
        let peer = this.CreatePeerConnection();
        let targetId = id;

        // Callback when a new ICE candidate is found for the peer connection.
        peer.onicecandidate = (e) => this.OnPeerConnectionCandidate(e, targetId);
        // Callback when negotiation is required (only when calling)
        peer.onnegotiationneeded = () => this.HandleNegotiationNeededEvent(targetId);
        // Callback when connection state changes
        peer.onconnectionstatechange = (connection) => this.OnPeerCallChange(connection, targetId);

        return peer;
    }

    // Create an answer to a peer call request.
    CreatePeerAnswer(id) {
        let peer = this.CreatePeerConnection();

        // Callback when a new ICE candidate is found for the peer connection.
        peer.onicecandidate = (e) => this.OnPeerConnectionCandidate(e, id);

        return peer;
    }

    // Creates a WebRTC connection object.
    CreatePeerConnection() {
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

    // Synchronise messages and content with known peers, in order of peers last interacted with.
    SyncPeers() {
        this.peersToConnect = [];
        if (Database.active.contains("peers")) {
            this.peersToConnect = JSON.parse(Database.active.getString("peers"));
            Log.Debug("Ready to sync " + this.peersToConnect.length + " peer(s): " + JSON.stringify(this.peersToConnect));
        }
        for (let i in this.peersToConnect) {
            // Get local peer metadata
            let id = this.peersToConnect[i];
            Log.Debug("Syncing peer." + id);
            let meta = JSON.parse(Database.active.getString("peer." + id));
            // Don't sync with blocked peers.
            if (!meta.blocked) {
                // Check with the server whether the peer is connected
                Log.Verbose("Requesting entity meta for peer." + id);
                let params = { id: id };
                AppState.connection.current.emit("GetEntityMeta", params);
            }
        }
    }

    // TODO: Move this connection setup code somewhere else
    connectToSignalServer() {
        if (AppState.connection.current && AppState.connection.current.connected) {
            return;
        }

        AppState.connection.current = io.connect("http://" + Constants.server_ip + ":" + Constants.port);

        // Setup the entity on the server so others can see it listed
        let profile = JSON.parse(Database.active.getString("profile"));
        let entity = {
            id: this.state.id,
            name: profile.name,
            avatar: profile.avatar
        };

        AppState.connection.current.on("SetupResult", (success) => {
            if (success) {
                Log.Info("Server successfully setup entity connection.");
                this.SyncPeers();
            } else {
                Log.Error("Server failed to setup entity connection.");
            }
        });

        AppState.connection.current.emit("SetupEntity", entity);
    }

    render() {
        const onCreateChat = () => {
            this.props.navigation.navigate("RequestChat");
        };

        const onOpenChat = (chat) => {
            chat = chat != null ? this.state.chats.find((item) => item.id === chat.id) : null;
            if (chat != null) {
                chat.read = true;
                this.forceUpdate();
                this.props.navigation.navigate("Chat");
            }
        };

        return (
            <SafeAreaView style={StyleMain.background}>
                
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => { this.OnOpen() }}/>

                <View style={styles.topbar}>
                    <TouchableOpacity style={[styles.menuButton]}>
                        <Icon name="menu" size={topbarHeight * 0.9} color="black" style={[]} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.settingsButton]}>
                        <Icon name="settings" size={topbarHeight * 0.9} color="black" style={[]} />
                    </TouchableOpacity>
                </View>
                <View style={styles.edge}></View>

                <FlatList
                    data={this.state.chats}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <View>
                        <TouchableOpacity onPress={() => onOpenChat(item)} style={styles.chatContainer}>
                            <View style={styles.chatIcon}></View>
                            <View style={styles.chatContent}>
                                <Text
                                    numberOfLines={1}
                                    style={[styles.chatContentHeader, {fontWeight: item.read ? "normal" : "bold"}]}>
                                    {item.name}
                                </Text>
                                <Text
                                    numberOfLines={1}
                                    style={[styles.chatContentMessage, {color: item.read ? "#999" : "#000", fontWeight: item.read ? "normal" : "bold"}]}
                                >
                                    {item.message.content}
                                </Text>
                            </View>
                            <Text style={styles.chatTimestamp}>{item.message.timestamp}</Text>
                        </TouchableOpacity>
                        <View style={[StyleMain.edge, {backgroundColor: "#ccc"}]}></View>
                        </View>
                    )}
                />

                <TouchableOpacity onPress={() => onCreateChat()} style={styles.newChatButton}>
                    <Icon name="chat" size={iconSize * 0.8} color="white" />
                </TouchableOpacity>

            </SafeAreaView>
        );
    }
}

const dimensions = Dimensions.get("window");

const styles = StyleSheet.create({
    chatContainer: {
        height: 70,
        backgroundColor: "#fff",
        justifyContent: "center",
    },
    chatContent: {
        position: "absolute",
        left: paddingAmount + paddingAmount + iconSize,
        width: dimensions.width - (paddingAmount * 4 + iconSize * 2),
    },
    chatContentHeader: {
        fontSize: 16,
        color: "#000",
        flex: 1
    },
    chatContentMessage: {
        color: "#999",
        flex: 1,
    },
    chatIcon: {
        position: "absolute",
        left: paddingAmount,
        width: iconSize,
        height: iconSize,
        backgroundColor: Colors.avatarBackground,
        borderRadius: 10000
    },
    chatTimestamp: {
        position: "absolute",
        right: paddingAmount,
        top: paddingAmount
    },
    menuButton: {
        position: "absolute",
        left: 0
    },
    newChatButton: {
        position: "absolute",
        right: paddingAmount * 5,
        bottom: paddingAmount * 7,
        width: iconSize * 1.2,
        height: iconSize * 1.2,
        borderRadius: 10000,
        backgroundColor: Colors.button,
        justifyContent: "center",
        alignItems: "center"
    },
    settingsButton: {
        position: "absolute",
        right: 0
    },
    topbar: {
        height: topbarHeight,
        backgroundColor: "#fff",
        justifyContent: "center"
    },
})
