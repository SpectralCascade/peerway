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

const topbarHeight = 56;
const iconSize = 56;
const paddingAmount = 8;

export default class MessagingOverview extends Component {

    // List of peers that need to be connected.
    peersToConnect = [];
    // Peer entities that have been requested to connect, keyed by client id.
    peersPending = {};

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
        console.log("OPENED MESSAGING OVERVIEW");
        
        this.state.id = Database.active.getString("id");
        // Load up cached chats
        let chatIds = [];
        if (Database.active.contains("chats")) {
            chatIds = JSON.parse(Database.active.getString("chats"));
            console.log("Chats = " + JSON.stringify(chatIds));
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
                console.log("Error: Chat " + id + " does not exist, but is listed!");
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
        AppState.connection.current.on("ice-candidate", incoming => {
            this.handleNewICECandidateMsg(incoming);
        });

        AppState.connection.current.off("EntityMetaResponse");
        AppState.connection.current.on("EntityMetaResponse", (meta) => { this.OnEntityMetaResponse(meta); });
    }

    // Send a request to connect to a specified entity.
    SendConnectionRequest(id, clientId) {
        console.log("Info: Sending a connection request to connect to entity " + id);

        peersPending[clientId] = id;
        AppState.peers[id] = this.CreatePeer(id);
        AppState.channels[id] = AppState.peers[this.state.id].createDataChannel("sendChannel");
        
        // listen to incoming messages from other peer
        AppState.channels[id].onmessage = (e) => this.handleReceiveMessage(e);
    }
    
    // Respond to an offer to connect to a peer.
    OnConnectionRequest(peer) {
        console.log("Info: Received request to connect to peer with id " + peer.id);

        if (this.peersToConnect.length == 0) {
            // Syncing may not have taken place yet, or this entity has never interacted with peers.
            this.peersToConnect = JSON.parse(Database.active.getString("peers"));
        }

        let meta = {};
        // TODO check in JSON object - might be faster than an array.
        if (peer.id in this.peersToConnect) {
            meta = Database.active.getString("peer." + peer.id);

            // TODO: Check peer is genuine (verify signature)
        } else {
            // Not seen this peer before
            meta = {
                name: peer.name,
                // TODO cache avatar as file and store path instead of base-64 wrapper/string
                avatar: peer.avatar,
                mutual: false,
                blocked: false,
                sync: (new Date()).getMilliseconds(),
                verifier: "" // TODO
            };
            this.peersToConnect.push(peer.id);
            Database.active.set("peers", JSON.stringify(this.peersToConnect));
            Database.active.set("peer." + peer.id, JSON.stringify(meta));
        }

        let toRemove = this.peersToConnect.indexOf(peer.id);
        if (toRemove >= 0) {
            this.peersToConnect.splice(toRemove, 1);
        }

        if (!meta.blocked) {
            // Setup the active entity as a peer and prepare the appropriate channel for receiving data.
            let client = this.CreatePeer(this.state.id);
            client.ondatachannel = (event) => {
                AppState.channels[this.state.id] = event.channel;
                AppState.channels[this.state.id].onmessage = (e) => this.handleReceiveMessage(e);
                console.log("Info: Connection established.");
            }

            // Respond to the offer
            client.setRemoteDescription(new RTCSessionDescription(peer.sdp)).then(() => {}).then(() => {
                return client.createAnswer();
            }).then(answer => {
                return client.setLocalDescription(answer);
            }).then(() => {
                const payload = {
                    target: peer.caller,
                    caller: client.id,
                    sdp: client.localDescription
                }
                AppState.connection.current.emit("AcceptPeerRequest", payload);
            });
        }
    }

    // Handle an answer made by the receiving peer
    OnConnectionAccepted(message) {
        AppState.peers[this.state.id].setRemoteDescription(new RTCSessionDescription(message.sdp)).catch(
            e => console.log("Error: Failed to handle WebRTC connection answer. ", e)
        );
    }

    // Handle message from an ICE candidate
    handleNewICECandidateMsg(incoming) {
        AppState.peers[this.state.id].addIceCandidate(
            new RTCIceCandidate(incoming)
        ).catch(e => console.log(e));
    }

    // Handle response to a request to get entity meta
    OnEntityMetaResponse(meta) {
        console.log("Meta response: " + JSON.stringify(meta));
        if (meta.available) {
            // Check if the entity is supposed to be connected to.
            if (meta.id in this.peersToConnect) {
                // Make a connection request
                console.log("Info: Sending connection request to peer." + meta.id + " of client " + meta.clientId);
                this.SendConnectionRequest(meta.id, meta.clientId);
            } else {
                // Might have a use case, e.g. interacting with a new entity for the first time.
                console.log("Peer not in expected peersToConnect array.");
            }
        }
    }

    // Callback for setting up ICE stuff
    // TODO: figure out how to target the correct peer here
    handleICECandidateEvent(e) {
        if (e.candidate) {
            const payload = {
                target: this.other.current,
                candidate: e.candidate,
            }
            AppState.connection.current.emit("ice-candidate", payload);
        }
    }

    // Callback to respond to WebRTC negotiation. Actually makes the initial peer connection request.
    // TODO: Check that correct peer is being used from AppState
    handleNegotiationNeededEvent(id) {
        if (id in this.peersPending) {
            console.log("Sending peer request to client " + id + " (entity: " + this.peersPending[id] + ")");
            AppState.peers[this.state.id].createOffer().then(offer => {
                return AppState.peers[this.state.id].setLocalDescription(offer);
            }).then(() => {
                const payload = {
                    id: this.peersPending[id],
                    target: id,
                    caller: AppState.connection.current.id,
                    sdp: AppState.peers[this.state.id].localDescription,
                };
                AppState.connection.current.emit("SendPeerRequest", payload);
            }).catch(err => console.log("Error handling negotiation needed event", err));
        } else {
            console.log("Error: No known peer pending with client id " + id + " - aborting connection request.");
        }
    }

    // Creates an RTC peer connection object.
    CreatePeer(id) {
        console.log("Setting up RTC connection for peer " + id);
        // Creates a connection using STUN and TURN servers.
        // TODO: Run local STUN and TURN servers if possible, instead of using these?
        let peer = new RTCPeerConnection({
            iceServers: [
                {
                    urls: "stun:stun.stunprotocol.org"
                },
                {
                    urls: 'turn:numb.viagenie.ca',
                    credential: 'muazkh',
                    username: 'webrtc@live.com'
                },
            ]
        });
        // Callbacks for handling connection steps
        peer.onicecandidate = (e) => this.handleICECandidateEvent(e);
        peer.onnegotiationneeded = () => this.handleNegotiationNeededEvent(id);

        AppState.peers[id] = peer;
        return peer;
    }

    // Synchronise messages and content with known peers, in order of peers last interacted with.
    SyncPeers() {
        this.peersToConnect = [];
        if (Database.active.contains("peers")) {
            this.peersToConnect = JSON.parse(Database.active.getString("peers"));
            console.log("Ready to sync " + this.peersToConnect.length + " peer(s): " + JSON.stringify(this.peersToConnect));
        }
        for (let i in this.peersToConnect) {
            // Get local peer metadata
            let id = this.peersToConnect[i];
            console.log("Syncing peer." + id);
            let meta = JSON.parse(Database.active.getString("peer." + id));
            // Don't sync with blocked peers.
            if (!meta.blocked) {
                // Check with the server whether the peer is connected
                console.log("Info: Requesting entity meta for peer." + id);
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
                console.log("Info: Server successfully setup entity connection.");
                this.SyncPeers();
            } else {
                console.log("Error: Server failed to setup entity connection.");
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
