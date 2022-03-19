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
            }*/],
            block: 0,
            loadedTS: 0,
            began: 0
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
            //Log.Debug("Opened chat data file, loaded block: " + JSON.stringify(block));
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

    LoadMessages() {
        Log.Debug("Attempting to load more messages...");

        // Must have just opened the chat, need to initialise to most recent time
        if (this.state.loadedTS == 0) {
            Log.Debug("Initialising chat messages");
            // Set initial timestamp to next month, so the first loop does nothing
            let nextMonth = new Date(Date.now());
            nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
            this.state.loadedTS = nextMonth.valueOf();
            this.state.block = -1;
        }

        let date = new Date(this.state.loadedTS);
        this.state.loadedTS = date.valueOf();
        let meta = {};

        // Check if there are actually any messages
        if (Database.active.contains(this.GetChatDataPath())) {
            let didLoad = false;
            while (!("blocks" in meta) && this.state.began < this.state.loadedTS) {
                meta = Database.GetStoreMeta(Database.active, this.GetChatDataPath(), this.state.loadedTS);
                let hasBlocks = "blocks" in meta;
                if (this.state.block < 0) {
                    // Start from end block
                    this.state.block = hasBlocks ? meta.blocks.length - 1 : -1;
                }

                if (this.state.block >= 0) {
                    // Now actually try to load the block
                    this.LoadMessageBlock(this.state.loadedTS, this.state.block).then(() => {
                        this.forceUpdate();
                    });
                    this.state.block--;
                    if (this.state.block < 0) {
                        date.setUTCMonth(date.getUTCMonth() - 1);
                        this.state.loadedTS = date.valueOf();
                    }
                    didLoad = true;
                    // Exit out of the loop, job here is done
                    break;
                } else {
                    // Go back a month
                    date.setUTCMonth(date.getUTCMonth() - 1);
                    this.state.loadedTS = date.valueOf();
                }
            }

            if (!didLoad) {
                Log.Debug("No earlier messages to load.");
            }
        }
    }

    // Called when the screen is opened.
    OnOpen() {
        this.chatId = this.props.route.params.chatId;
        console.log("OPENED CHAT with id: " + this.chatId);
        let key = this.GetChatDataPath();
        this.state.began = Database.active.contains(key) ?
            JSON.parse(Database.active.getString(key)).began : Date.now();

        // Find the most recent messages
        this.state.messages = [];
        this.state.loadedTS = 0;
        this.LoadMessages();

        // TODO indicate that messages are loading
    }

    SendMessage(message) {
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
    RenderInputToolbar(props) {
        return (<InputToolbar
            {...props}
            containerStyle={styles.inputToolbar}
        />);
    };

    // Callback to render the actions when pressed in the input toolbar
    RenderActions(props) {
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
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => this.OnOpen()}/>

                {/* Setup the chat component */}
                <GiftedChat
                    messages={this.state.messages}
                    renderInputToolbar={(props) => this.RenderInputToolbar(props)}
                    onSend={(message) => this.SendMessage(message)}
                    user={{
                        _id: 1,
                    }}
                    scrollToBottom
                    renderActions={(props) => this.RenderActions(props)}
                    loadEarlier
                    infiniteScroll
                    onLoadEarlier={() => this.LoadMessages()}
                    textInputStyle={styles.inputToolbar}
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
