import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Actions, GiftedChat, InputToolbar } from 'react-native-gifted-chat'
import StyleMain from '../Stylesheets/StyleMain';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc'
import { io } from "socket.io-client";
import HandleEffect from '../Components/HandleEffect';
import Database from '../Database';
import Constants from '../Constants';

export default class Chat extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            messages: [/*{
                _id: 1,
                text: 'Hello, world!\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\nwow what a long message this is\n\n\n\n\ncrazy',
                createdAt: new Date(),
                user: {
                    _id: 2,
                    name: 'React Native',
                    avatar: 'https://placeimg.com/140/140/any',
                }
            },
            {
                _id: 2,
                text: 'woah\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\nwoah',
                createdAt: new Date(),
                user: {
                    _id: 2,
                    name: 'React Native',
                    avatar: 'https://placeimg.com/140/140/any',
                }
            }*/]
        };

        // Connection bits and pieces
        this.socket = React.createRef();
        this.peer = React.createRef();
        this.other = React.createRef();
        this.sendChannel = React.createRef();
        // Get the chat ID
        this.chatID = "debug_chat";//props.route.params.chatID;
    }

    // Called when the screen is opened.
    onOpen() {
        console.log("OPENED CHAT with id: " + this.chatID);

        // Setup connection to the signal server
        // TODO handle connection failure
        this.socket.current = io.connect("http://" + Constants.server_ip + ":" + Constants.port.toString());

        console.log("setup connection to server");
        // Join the chat
        this.socket.current.emit("join room", this.chatID);

        // Another user is already in the chat room, call them.
        this.socket.current.on("other user", id => {
            console.log("Setting up other user...");
            this.callUser(id);
            this.other.current = id;
        });

        // A new user has joined the chat room.
        this.socket.current.on("user joined", id => {
            console.log("user joined");
            this.other.current = id;
        });

        this.socket.current.on("PeerConnectionRequest", (socket) => { this.handleOffer(socket); });

        this.socket.current.on("PeerConnectionAccepted", (socket) => { this.handleAnswer(socket); });

        this.socket.current.on("ice-candidate", (socket) => { this.handleNewICECandidateMsg(socket); });

        this.forceUpdate();
    }

    callUser(id) {
        // This will initiate the call for the receiving peer
        console.log("[INFO] Initiated a call");
        this.peer.current = this.CreatePeer(id);
        this.sendChannel.current = this.peer.current.createDataChannel("sendChannel");
        
        // listen to incoming messages from other peer
        this.sendChannel.current.onmessage = (e) => this.handleReceiveMessage(e);
    }

    CreatePeer(userID) {
        console.log("Creating peer with id " + userID);
        /* 
        Here we are using Turn and Stun server
        (ref: https://blog.ivrpowers.com/post/technologies/what-is-stun-turn-server/)
        */

        const peer = new RTCPeerConnection({
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
        peer.onicecandidate = (e) => this.handleICECandidateEvent(e);
        peer.onnegotiationneeded = () => this.handleNegotiationNeededEvent(userID);
        return peer;
    }

    handleNegotiationNeededEvent(userID){
        // Offer made by the initiating peer to the receiving peer.
        this.peer.current.createOffer().then(offer => {
            return this.peer.current.setLocalDescription(offer);
        }).then(() => {
            const payload = {
                target: userID,
                caller: this.socket.current.id,
                sdp: this.peer.current.localDescription,
            };
            console.log("Sending offer...");
            this.socket.current.emit("SendPeerRequest", payload);
        }).catch(err => console.log("Error handling negotiation needed event", err));
    }

    handleOffer(incoming) {
        /*
            Here we are exchanging config information
            between the peers to establish communication
        */
        console.log("[INFO] Handling Offer")
        this.peer.current = this.CreatePeer(Database.active.getString("id"));
        this.peer.current.ondatachannel = (event) => {
            this.sendChannel.current = event.channel;
            this.sendChannel.current.onmessage = (e) => this.handleReceiveMessage(e);
            console.log('[SUCCESS] Connection established')
        }

        /*
        Session Description: It is the config information of the peer
        SDP stands for Session Description Protocol. The exchange
        of config information between the peers happens using this protocol
        */
        const desc = new RTCSessionDescription(incoming.sdp);

        /* 
        Remote Description : Information about the other peer
        Local Description: Information about you 'current peer'
        */

        this.peer.current.setRemoteDescription(desc).then(() => {
        }).then(() => {
            return this.peer.current.createAnswer();
        }).then(answer => {
            return this.peer.current.setLocalDescription(answer);
        }).then(() => {
            const payload = {
                target: incoming.caller,
                caller: this.socket.current.id,
                sdp: this.peer.current.localDescription
            }
            console.log("Sending answer...");
            this.socket.current.emit("AcceptPeerRequest", payload);
        })
    }

    handleAnswer(message){
        // Handle answer by the receiving peer
        console.log("received answer...");
        const desc = new RTCSessionDescription(message.sdp);
        this.peer.current.setRemoteDescription(desc).catch(e => console.log("Error handle answer", e));
    }
    
    handleReceiveMessage(e){
        // Listener for receiving messages from the peer
        console.log("[INFO] Message received from peer", e.data);
        this.state.messages = GiftedChat.append(this.state.messages, [{
            _id: Math.random(1000).toString(), // TODO: use proper IDs...
            text: e.data,
            createdAt: new Date(),
            user: {
                _id: 2,
            },
        }]);
        this.forceUpdate();
    };

    handleICECandidateEvent(e) {
        /*
        ICE stands for Interactive Connectivity Establishment. Using this
        peers exchange information over the intenet. When establishing a
        connection between the peers, peers generally look for several 
        ICE candidates and then decide which to choose best among possible
        candidates
        */
        if (e.candidate) {
            const payload = {
                target: this.other.current,
                candidate: e.candidate,
            }
            this.socket.current.emit("ice-candidate", payload);
        }
    }

    handleNewICECandidateMsg(incoming) {
        console.log("Received new ice candidate from peer...");
        const candidate = new RTCIceCandidate(incoming.candidate);
        this.peer.current.addIceCandidate(candidate).catch(e => console.log(e));
    }

    sendMessage(messages) {
        // Send the last message
        this.state.messages = GiftedChat.append(this.state.messages, messages);
        console.log("Messages: " + JSON.stringify(this.state.messages));
        this.sendChannel.current.send(this.state.messages[0].text);
        this.forceUpdate();
    }

    // Callback to render the input toolbar
    renderInputToolbar(props) {
        return (<InputToolbar
            {...props}
            containerStyle={styles.inputToolbar}
        />);
    };

    // Callback to render the actions when pressed in the input toolbar
    renderActions(props) {
        return (<Actions
            {...props}
            containerStyle={styles.actions}
        />);
    };

    // Main render call
    render() {
        return (
            <View style={StyleMain.background}>
                {/* Handles screen opening callback */}
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => this.onOpen()}/>

                {/* Setup the chat component */}
                <GiftedChat
                    messages={this.state.messages}
                    renderInputToolbar={(props) => this.renderInputToolbar(props)}
                    onSend={(messages) => this.sendMessage(messages)}
                    user={{
                        _id: 1,
                    }}
                    alwaysShowSend
                    scrollToBottom
                    renderActions={(props) => this.renderActions(props)}
                />
            </View>
        );
    }
}

const styles = StyleSheet.create({
    inputToolbar: {
    },
    actions: {
    }
});
