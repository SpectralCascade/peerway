import React from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, Image } from 'react-native';
import { Actions, GiftedChat, InputToolbar, Send } from 'react-native-gifted-chat'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; 
import ImagePicker from 'react-native-image-crop-picker';
import StyleMain from '../Stylesheets/StyleMain';
import HandleEffect from '../Components/HandleEffect';
import Database from '../Database';
import Constants from '../Constants';
import { Log } from '../Log';
import Peerway from '../Peerway';
import Text from "../Components/Text";
import RNFS from "react-native-fs";
import {v1 as uuidv1, v4 as uuidv4 } from 'uuid';
import Colors from '../Stylesheets/Colors';

const iconSize = 72;

export default class Chat extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            messages: [],
            media: [],
            loadedTS: "",
            began: 0
        };

        // Get the chat ID
        this.chatId = props.route.params.chatId;
        this.activeId = Database.active.getString("id");
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
            "SELECT * FROM Messages WHERE chat=? AND created < ? ORDER BY created DESC LIMIT ?",
            [this.chatId, this.state.loadedTS, Constants.messagesPerLoad]
        );
        if (query.data.length > 0) {
            for (let i in query.data) {
                let message = query.data[i];

                let fromActive = message.from === this.activeId;
                let peer = this.peers[message.from];
                let isImage = message.mime.startsWith("image/");
                let isText = message.mime.startsWith("text/");

                let filePath = isImage || !isText ? 
                    "file://" + Peerway.GetMediaPath() + "/" + message.content : "";
                
                this.state.messages.push({
                    _id: this.state.messages.length + 1,
                    text: isText ? message.content : undefined,
                    image: isImage ? filePath : undefined,
                    video: !isImage && !isText ? filePath : undefined,
                    createdAt: message.created,
                    user: {
                        _id: message.from,
                        name: fromActive ? "You" : (peer ? peer.name : message.from),
                        avatar: peer && peer.avatar.length > 0 ?
                            Peerway.GetAvatarPath(message.from, peer.avatar, "file://") : ""
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
            "INNER JOIN ChatMembers ON ChatMembers.peer=Peers.id AND ChatMembers.chat=?) " +
            "WHERE id != ? ",
            [this.chatId, this.activeId]
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
                Log.Debug("Received chat message");
                let peer = this.peers[message.from];

                // Automatically mark as read
                Database.Execute("UPDATE Chats SET read=? WHERE id=?", [1, this.chatId]);

                let isImage = message.mime.startsWith("image/");
                let isText = message.mime.startsWith("text/");

                let filePath = isImage || !isText ? 
                    "file://" + Peerway.GetMediaPath() + "/" + message.content : "";

                // Add the message to the UI
                this.state.messages.unshift({
                    _id: this.state.messages.length + 1,
                    // TODO show multimedia
                    text: isText ? message.content : undefined,
                    image: isImage ? filePath : undefined,
                    video: !isImage && !isText ? filePath : undefined,
                    createdAt: message.created,
                    user: {
                        _id: from,
                        name: peer ? peer.name : message.from,
                        avatar: peer && peer.avatar.length > 0 ?
                            Peerway.GetAvatarPath(message.from, peer.avatar, "file://") : ""
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
        delete message[0].image;

        if (message[0].text.length != 0) {
            // Send the message
            this.state.messages = GiftedChat.append(this.state.messages, message);
            Peerway.SendChatMessage({
                chat: this.chatId,
                from: this.activeId,
                mime: "text/plain",
                content: this.state.messages[0].text
            });
        }

        // Send media separately
        let profile = JSON.parse(Database.active.getString("profile"));
        for (let i in this.state.media) {
            let media = this.state.media[i];
            let isImage = media.mime.startsWith("image/");
            let path = Peerway.GetMediaPath() + "/" + media.key + "." + media.ext;
            RNFS.exists(path).then((exists) => {
                Log.Debug("path " + path + " exists? " + exists);
            }).catch((e) => Log.Error(e));
            // TODO add support for arbitrary files
            let added = [{
                _id: this.state.messages.length + 1,
                image: isImage ? "file://" + path : undefined,
                video: !isImage ? "file://" + path : undefined,
                createdAt: (new Date()).toISOString(),
                user: {
                    _id: this.activeId,
                    name: profile.name,
                    avatar: profile.avatar.length > 0 ?
                        Peerway.GetAvatarPath(this.activeId, profile.avatar, "file://") : ""
                }
            }]
            this.state.messages = GiftedChat.append(this.state.messages, added);
            Peerway.SendChatMessage({
                chat: this.chatId,
                from: this.activeId,
                mime: media.mime,
                content: media.key + "." + media.ext
            });
        }
        this.state.media = [];

        this.forceUpdate();
    }

    // Callback to render the input toolbar
    RenderInputToolbar(props) {
        const onRemove = (item) => {
            let index = this.state.media.findIndex((v) => v.key === item.key);
            if (index >= 0) {
                this.state.media.splice(index, 1);
                this.setState({media: this.state.media});
                Log.Debug("Removed media " + item.key);
            } else {
                Log.Warning("Could not locate media in list with key " + item.key);
            }
        };

        const getMediaList = () => (
            <FlatList
                horizontal
                data={this.state.media}
                keyExtractor={item => item.key}
                renderItem={({ item }) => {
                    let path = Peerway.GetMediaPath() + "/" + item.key + "." + item.ext;
                    return (
                        <View style={styles.mediaListItem}>
                            {(item.mime.startsWith("image/") ? 
                                (<Image source={{uri: "file://" + path}} style={styles.mediaListImage}/>)
                              : (<>
                                    <Icon name="file-video" size={iconSize} color="black" />
                                </>)
                            )}
                            <TouchableOpacity style={styles.removeMedia} onPress={() => onRemove(item)}>
                                <Icon name="close-circle" size={24} color="#555" />
                            </TouchableOpacity>
                        </View>
                    );
                }}
                style={styles.mediaList}
            />
        );

        return (
            <>
                <InputToolbar
                    {...props}
                    containerStyle={[styles.inputToolbar]}
                    renderAccessory={this.state.media.length > 0 ? () => getMediaList() : undefined}
                    accessoryStyle={styles.mediaListLayout}
                />
            </>
        );
    }

    // TODO add support for arbitrary files & make this an inline widget like discord does
    OnPressActionButton() {
        
        const addMedia = (id, ext, hash, mime) => {
            Log.Debug("Added media " + id);
            this.state.media.push({
                key: id,
                ext: ext,
                mime: mime,
                hash: hash,
            });
            this.setState({media: this.state.media});
        };
        
        const copyAndAddMedia = (path, ext, hash, mime) => {
            let id = uuidv4();
            RNFS.mkdir(Peerway.GetMediaPath()).then(() => {
                return RNFS.copyFile(
                    path,
                    Peerway.GetMediaPath() + "/" + id + "." + ext
                );
            }).then(() => {
                let query = Database.Execute(
                    "INSERT INTO MediaCache VALUES (?,?,?,?,?)",
                    [id, hash, ext, this.activeId, mime]
                );

                //if (query.success) {
                addMedia(id, ext, hash, mime);
                //} else {
                //    Promise.reject("Failed to insert media into database.");
                //}
            }).catch((e) => {
                Log.Error("Failed to copy file: " + e);
            });
        };

        ImagePicker.openPicker({
            multiple: true,
            mediaType: "any",
            writeTempFile: true
        }).then((data) => {
            for (let i in data) {
                // Compute hash and compare
                RNFS.hash(data[i].path, "md5").then((hash) => {
                    let ext = data[i].path.split('.').pop();
                    let query = Database.Execute(
                        "SELECT * FROM MediaCache WHERE author=? AND hash=? AND ext=?",
                        [this.activeId, hash, ext]
                    );

                    if (query.data.length != 0) {
                        // File already exists, no need to copy
                        addMedia(query.data[0].id, ext, hash, query.data[0].mime);
                    } else {
                        copyAndAddMedia(data[i].path, ext, hash, data[i].mime);
                    }
                }).catch((e) => {
                    Log.Error("Error while adding media to cache: " + e);
                });
            }
        }).catch((e) => {
            Log.Error(e);
        });
    }

    // Callback to render the actions when pressed in the input toolbar
    RenderActions(props) {
        return (
            <Actions
                {...props}
                onPressActionButton={() => this.OnPressActionButton()}
                containerStyle={styles.actions}
            />
        );
    };

    RenderSend({onSend, text, sendButtonProps, ...props}) {
        return (
            <Send
                {...props}
                text={text}
                onSend={onSend}
                sendButtonProps={{
                    ...sendButtonProps,
                    onPress: () => {
                        let toSend = text ? text.trim() : "";
                        onSend({text: toSend}, true);
                        return this.state.media.length != 0 || toSend.length != 0;
                    },
                }}
                containerStyle={{alignItems: "center", justifyContent: "center", padding: 5}}
            >
                <View style={styles.sendButton}>
                    <Icon name="send" size={32} color={Colors.button} />
                </View>
            </Send>
        );
    }

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
                    alwaysShowSend={this.state.media.length != 0}
                    scrollToBottom
                    renderActions={(props) => this.RenderActions(props)}
                    renderSend={(props) => this.RenderSend(props)}
                    loadEarlier
                    infiniteScroll
                    onLoadEarlier={() => this.LoadMessages()}
                    textInputStyle={styles.inputToolbar}
                    onPressAvatar={(user) => this.OnPressAvatar(user)}
                    minInputToolbarHeight={this.state.media.length > 0 ? 96 + 40 : undefined}
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
    },
    mediaList: {
    },
    mediaListLayout: {
        height: 96,
        width: "100%",
        backgroundColor: "white",
        padding: 5
    },
    mediaListItem: {
        backgroundColor: Colors.avatarBackground,
        borderRadius: 5,
        margin: 5,
        padding: 2,
        justifyContent: "center",
        alignItems: "center",
        width: iconSize + 4,
        height: iconSize + 4
    },
    mediaListImage: {
        width: iconSize,
        height: iconSize
    },
    removeMedia: {
        position: "absolute",
        top: 5,
        right: 5,
        backgroundColor: "white",
        borderRadius: 10000,
    },
    sendButton: {
        justifyContent: "center",
        alignItems: "center"
    }
});
