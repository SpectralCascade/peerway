import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Actions, GiftedChat, InputToolbar } from 'react-native-gifted-chat'
import StyleMain from '../Stylesheets/StyleMain';
import HandleEffect from '../Components/HandleEffect';
import Database from '../Database';
import Constants from '../Constants';
import { Log } from '../Log';
import Peerway from '../Peerway';

export default class Chat extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            messages: [],
            loadedTS: "",
            began: 0
        };

        // Get the chat ID
        this.chatId = props.route.params.chatId;
        this.activeId = "";
        this.peers = {};
    }
    
    GetChatDataPath() {
        return "chats/" + Database.active.getString("id") + ".chat." + this.chatId + ".json";
    }

    LoadMessages() {
        Log.Debug("Attempting to load more messages...");

        // Must have just opened the chat, need to initialise
        if (this.state.loadedTS === "") {
            Log.Debug("Initialising chat messages");
            this.state.loadedTS = (new Date(Date.now())).toISOString();
        }
        
        // Get the last N messages
        // TODO make this async
        let query = Database.Execute(
            "SELECT * FROM Messages " +
                "WHERE chat='" + this.chatId + "' AND created < '" + this.state.loadedTS + "' " +
                "ORDER BY created DESC " +
                "LIMIT " + Constants.messagesPerLoad
        );
        if (query.data.length > 0) {
            for (let i in query.data) {
                let message = query.data[i];

                let fromActive = message.from === this.activeId;
                let peer = this.peers[message.from];
                this.state.messages.push({
                    _id: this.state.messages.length + 1,
                    // TODO show multimedia content
                    text: message.mime.startsWith("text") ? message.content : message.mime,
                    createdAt: message.created,
                    user: {
                        _id: message.from,
                        name: fromActive ? "You" : (peer ? peer.name : message.from),
                        avatar: peer && peer.avatar.length > 0 ?
                            "file://" + Peerway.GetAvatarPath(message.from, peer.avatar) : ""
                    }
                });
            }
            // Set loaded timestamp to latest loaded message timestamp
            this.state.loadedTS = query.data[query.data.length - 1].created;
        } else {
            Log.Debug("No more messages to load.");
        }

        this.forceUpdate();
    }

    // Called when the screen is opened.
    OnOpen() {
        this.chatId = this.props.route.params.chatId;
        console.log("OPENED CHAT with id: " + this.chatId);

        this.activeId = Database.active.getString("id");
        let key = this.GetChatDataPath();
        this.state.began = Database.active.contains(key) ?
            JSON.parse(Database.active.getString(key)).began : Date.now();

        // Load all peers for the chat
        this.peers = {};
        let query = Database.Execute(
            "SELECT * FROM (" + 
            "SELECT Peers.id, Peers.name, Peers.avatar, ChatMembers.peer, ChatMembers.chat FROM Peers " +
            "INNER JOIN ChatMembers ON ChatMembers.peer=Peers.id AND ChatMembers.chat='" + this.chatId + "') " +
            "WHERE id != '" + this.activeId + "' "
        );
        for (let i in query.data) {
            this.peers[query.data[i].id] = query.data[i];
        }

        // Find the most recent messages
        this.state.messages = [];
        this.state.loadedTS = "";
        this.LoadMessages();

        // Handle chat messages
        if (this.onChatMessage) {
            this.onChatMessage.remove();
        }
        this.onChatMessage = Peerway.addListener("chat.message", (from, message) => {
            if (message.chat === this.chatId) {
                let peer = this.peers[message.from];

                // Automatically mark as read
                Database.Execute("UPDATE Chats SET read=" + 1 + " WHERE id='" + this.chatId + "'");

                // Add the message to the UI
                this.state.messages.unshift({
                    _id: this.state.messages.length + 1,
                    // TODO show multimedia
                    text: message.content,//.startsWith("text") ? message.content : message.mime,
                    createdAt: message.created,
                    user: {
                        _id: from,
                        name: peer ? peer.name : message.from,
                        avatar: peer && peer.avatar.length > 0 ?
                            "file://" + Peerway.GetAvatarPath(message.from, peer.avatar) : ""
                    }
                });
                this.forceUpdate();
            }
        });

        // TODO indicate that messages are loading
    }

    OnClose() {
        Log.Debug("CLOSING CHAT");
        if (this.onChatMessage) {
            this.onChatMessage.remove();
            this.onChatMessage = null;
        }
    }

    OnPressAvatar(user) {
        this.props.navigation.navigate("Profile", { peerId: user._id });
    }

    SendMessage(message) {
        // Send the last message
        this.state.messages = GiftedChat.append(this.state.messages, message);
        Peerway.SendChatMessage({
            chat: this.chatId,
            from: Database.active.getString("id"),
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
        return (<Actions {...props} containerStyle={styles.actions} />);
    };

    // Main render call
    render() {
        return (
            <View style={StyleMain.background}>
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => { this.OnOpen() }}/>
                <HandleEffect navigation={this.props.navigation} effect="blur" callback={() => { this.OnClose() }}/>

                {/* Setup the chat component */}
                <GiftedChat
                    messages={this.state.messages}
                    renderInputToolbar={(props) => this.RenderInputToolbar(props)}
                    onSend={(message) => this.SendMessage(message)}
                    user={{
                        _id: this.activeId,
                    }}
                    scrollToBottom
                    renderActions={(props) => this.RenderActions(props)}
                    loadEarlier
                    infiniteScroll
                    onLoadEarlier={() => this.LoadMessages()}
                    textInputStyle={styles.inputToolbar}
                    onPressAvatar={(user) => this.OnPressAvatar(user)}
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
