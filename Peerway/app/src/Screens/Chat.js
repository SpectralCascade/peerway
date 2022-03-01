import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Actions, GiftedChat, InputToolbar } from 'react-native-gifted-chat'
import StyleMain from '../Stylesheets/StyleMain';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc'
import { io } from "socket.io-client";
import HandleEffect from '../Components/HandleEffect';

const server_ip = "192.168.0.59";
const port = 20222;

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
        this.chatID = props.route.params.chatID;
    }

    // Called when the screen is opened.
    onOpen() {
        console.log("OPENED CHAT with id: " + this.chatID);

        // Setup connection to the signal server
        // TODO handle connection failure
        this.socket.current = io.connect("http://" + server_ip + ":" + port.toString());

        console.log("setup connection to server");
        // Join the chat
        this.socket.current.emit("join room", this.chatID);

        // Await other user(s) to join the chat
        this.socket.current.on("other user", id => {
            this.callUser(id);
            this.other.current = id;
        });

        // Ditto
        this.socket.current.on("user joined", id => {
            this.other.current = id;
        });

        this.socket.current.on("offer", this.handleOffer);

        this.socket.current.on("answer", this.handleAnswer);

        this.socket.current.on("ice-candidate", this.handleNewICECandidateMsg);

        this.forceUpdate();
    }

    callUser(id) {
        // This will initiate the call for the receiving peer
        console.log("[INFO] Initiated a call")
        this.peer.current = Peer(id);
        this.sendChannel.current = this.peer.current.createDataChannel("sendChannel");
        
        // listen to incoming messages from other peer
        this.sendChannel.current.onmessage = handleReceiveMessage;
    }

    Peer(userID) {
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
        peer.onicecandidate = handleICECandidateEvent;
        peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);
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
            this.socket.current.emit("offer", payload);
        }).catch(err => console.log("Error handling negotiation needed event", err));
    }

    handleOffer(incoming) {
        /*
        Here we are exchanging config information
        between the peers to establish communication
        */
        console.log("[INFO] Handling Offer")
        this.peer.current = Peer();
        this.peer.current.ondatachannel = (event) => {
            this.sendChannel.current = event.channel;
            this.sendChannel.current.onmessage = handleReceiveMessage;
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
            this.socket.current.emit("answer", payload);
        })
    }

    handleAnswer(message){
        // Handle answer by the receiving peer
        const desc = new RTCSessionDescription(message.sdp);
        this.peer.current.setRemoteDescription(desc).catch(e => console.log("Error handle answer", e));
    }
    
    handleReceiveMessage(e){
        // Listener for receiving messages from the peer
        console.log("[INFO] Message received from peer", e.data);
        const msg = [
            {
                _id: Math.random(1000).toString(), // TODO: use proper IDs...
                text: e.data,
                createdAt: new Date(),
                user: {
                    _id: 2,
                },
            }
        ];
        setMessages(previousMessages => GiftedChat.append(previousMessages, msg))
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
                target: otherUser.current,
                candidate: e.candidate,
            }
            this.socket.current.emit("ice-candidate", payload);
        }
    }

    handleNewICECandidateMsg(incoming) {
        const candidate = new RTCIceCandidate(incoming);

        this.peer.current.addIceCandidate(candidate).catch(e => console.log(e));
    }

    sendMessage(previousMessages) {
        // Send the last message
        this.sendChannel.current.send(this.state.messages[0].text);
        this.state.messages = GiftedChat.append(previousMessages, this.state.messages);
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
                    onSend={(currentMessages) => this.sendMessage(currentMessages)}
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