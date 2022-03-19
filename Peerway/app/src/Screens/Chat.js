import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Actions, GiftedChat, InputToolbar } from 'react-native-gifted-chat'
import StyleMain from '../Stylesheets/StyleMain';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc'
import { io } from "socket.io-client";
import HandleEffect from '../Components/HandleEffect';
import Database from '../Database';
import Constants from '../Constants';
import { Log } from '../Log';
import Peerway from '../Peerway';

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

        // Get the chat ID
        this.chatId = props.route.params.chatId;
    }
    
    GetChatDataPath() {
        return "chats/" + Database.active.getString("id") + ".chat." + this.chatId + ".json";
    }

    // Load a block of messages
    LoadMessageBlock(timestamp, index) {
        return Database.Load(
            Database.active,
            this.GetChatDataPath(),
            timestamp,
            index
        ).then((block) => {
            Log.Debug("Opened chat data file, loaded block: " + JSON.stringify(block));
            for (let i = block.length - 1; i >= 0; i--) {
                let item = block[i];
                this.state.messages.push({
                    _id: this.state.messages.length + 1,
                    // TODO show multimedia
                    text: item.mime.startsWith("text") ? item.content : item.mime,
                    createdAt: item.created,
                    user: {
                        _id: 1,
                        name: "You",
                        // TODO use active entity avatar
                        avatar: "https://placeimg.com/140/140/any"
                    }
                });
            }
        }).catch((err) => {
            Log.Error("Could not load messages for chat." + this.chatId + ": " + err);
        });
    }

    // Called when the screen is opened.
    onOpen() {
        this.chatId = this.props.route.params.chatId;
        console.log("OPENED CHAT with id: " + this.chatId);

        // Find the most recent messages
        this.state.messages = [];
        let date = new Date(Date.now());
        let millis = date.valueOf();
        let meta = {};

        // Check if there are actually any messages
        if (Database.active.contains(this.GetChatDataPath())) {
            let began = JSON.parse(Database.active.getString(this.GetChatDataPath())).began;
            while (!("blocks" in meta) && began < millis) {
                millis = date.valueOf();
                meta = Database.GetStoreMeta(Database.active, this.GetChatDataPath(), millis);
                if ("blocks" in meta) {
                    // Show most recent messages
                    this.LoadMessageBlock(millis, meta.blocks.length - 1).then(() => { this.forceUpdate(); });
                } else {
                    // Go back a month
                    date.setUTCMonth(date.getUTCMonth() - 1);
                }
            }
        }

        // TODO indicate that messages are loading
    }

    sendMessage(message) {
        // Send the last message
        this.state.messages = GiftedChat.append(this.state.messages, message);
        Peerway.SendChatMessage({
            for: this.chatId,
            author: Database.active.getString("id"),
            mime: "text/plain",
            content: this.state.messages[0].text
        });
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
                    onSend={(message) => this.sendMessage(message)}
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
        color: "#000"
    },
    actions: {
    }
});
