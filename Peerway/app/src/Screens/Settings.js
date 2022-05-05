import { CommonActions } from "@react-navigation/native";
import React from "react";
import { StyleSheet, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import HandleEffect from "../Components/HandleEffect";
import Database from "../Database";
import { Log } from "../Log";
import Colors from "../Stylesheets/Colors";
import StyleMain from "../Stylesheets/StyleMain";
import DefaultSettings from "../DefaultSettings";
import Popup from "../Components/Popup";
import RNFS from "react-native-fs";
import Peerway from "../Peerway";
import Widget from "../Components/Widget";

export default class Settings extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            settings: JSON.parse(JSON.stringify(DefaultSettings)),
            popup: {
                title: "",
                content: ""
            },
        }

        this.popup = React.createRef();

        this.Init();
    }

    Init() {
        Object.keys(this.state.settings).forEach((key) => {
            if (Database.userdata.contains(key)) {
                let value = Database.userdata.getString(key);
                this.state.settings[key] = typeof(this.state.settings[key]) === "number" ? 
                    parseFloat(value) : value;
            } else {
                Database.userdata.set(key, this.state.settings[key]);
            }
        });
    }

    OnOpen() {
        Log.Debug("OPENED SETTINGS SCREEN");
        this.Init();
    }

    DeleteAllChats() {
        Log.Debug("DELETING ALL CHATS...");
        Database.Execute("DELETE FROM ChatMembers");
        Database.Execute("DELETE FROM Messages");
        Database.Execute("DELETE FROM Chats");
    }

    DeleteAllPeers() {
        Log.Debug("DELETING ALL PEERS...");
        let activeId = Database.active.getString("id");
        Database.Execute("DELETE FROM Messages WHERE [from] != ?", [activeId]);
        Database.Execute("DELETE FROM Posts WHERE author != ?", [activeId]);
        Database.Execute("DELETE FROM Peers");
    }

    DeleteAllPosts() {
        Log.Debug("DELETING ALL POSTS...");
        Database.Execute("DELETE FROM Posts");
    }

    DeleteAllMedia() {
        Log.Debug("DELETING ALL MEDIA...");
        Database.Execute("DELETE FROM MediaCache");
        RNFS.unlink(Peerway.GetMediaPath()).catch((e) => {
            // Do nothing
        });
    }

    render() {
        return (
            <View style={[StyleMain.background]}>
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => { this.OnOpen() }}/>

                <Popup
                    title={this.state.popup.title}
                    content={this.state.popup.content}
                    positiveText={this.state.popup.positiveText}
                    positiveOnPress={this.state.popup.positiveOnPress}
                    negativeText={this.state.popup.negativeText}
                    negativeOnPress={this.state.popup.negativeOnPress}
                    onClose={this.state.popup.onClose}
                    ref={this.popup}
                />

                <ScrollView>
                    <Widget.Button
                        style={StyleMain.button}
                        title="Sharing & Privacy Settings"
                        onPress={() => this.props.navigation.navigate("SharingPrivacySettings")}
                    />

                    <Widget.Text title="Signal Server URL" name="SignalServerURL" parent={this}/>
                    <Widget.Numeric title="Maximum posts cached per user" name="CachePostLimitPerUser" parent={this}/>
                    <Widget.Button
                        style={[StyleMain.button, styles.widgetButton]}
                        title="Delete All Chats"
                        onPress={() => {
                            let confirmPopup = {
                                title: "Delete All Chats",
                                content: "Are you sure you wish to delete all chats? This will remove you from all associated chats and delete the history from your device.",
                                positiveText: "Yes",
                                positiveOnPress: () => this.DeleteAllChats(),
                                negativeText: "No"
                            }
                            this.popup.current.Show();
                            this.setState({popup: confirmPopup});
                        }}
                    />
                    <Widget.Button
                        style={[StyleMain.button, styles.widgetButton]}
                        title="Delete All Peers"
                        onPress={() => {
                            let confirmPopup = {
                                title: "Delete All Peers",
                                content: "Are you sure you wish to delete all peers? This will remove all data associated with other peers, including chat messages and cached posts.",
                                positiveText: "Yes",
                                positiveOnPress: () => this.DeleteAllPeers(),
                                negativeText: "No"
                            }
                            this.popup.current.Show();
                            this.setState({popup: confirmPopup});
                        }}
                    />
                    <Widget.Button
                        style={[StyleMain.button, styles.widgetButton]}
                        title="Delete All Posts"
                        onPress={() => {
                            let confirmPopup = {
                                title: "Delete All Posts",
                                content: "Are you sure you wish to delete all posts? This will remove all posts you have created as well as cached posts from other users.",
                                positiveText: "Yes",
                                positiveOnPress: () => this.DeleteAllPosts(),
                                negativeText: "No"
                            }
                            this.popup.current.Show();
                            this.setState({popup: confirmPopup});
                        }}
                    />
                    <Widget.Button
                        style={[StyleMain.button, styles.widgetButton]}
                        title="Delete All Media"
                        onPress={() => {
                            let confirmPopup = {
                                title: "Delete All Media",
                                content: "Are you sure you wish to delete all media? Messages and posts you have created will not be able to load associated media.",
                                positiveText: "Yes",
                                positiveOnPress: () => this.DeleteAllMedia(),
                                negativeText: "No"
                            }
                            this.popup.current.Show();
                            this.setState({popup: confirmPopup});
                        }}
                    />
                </ScrollView>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    widgetButton: {
        backgroundColor: Colors.button,
        height: 40,
        marginTop: 12
    }
});
