import { CommonActions } from "@react-navigation/native";
import React from "react";
import { StyleSheet, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import NumericInput from "react-native-numeric-input";
import ButtonText from "../Components/ButtonText";
import HandleEffect from "../Components/HandleEffect";
import Text from "../Components/Text";
import Constants from "../Constants";
import Database from "../Database";
import { Log } from "../Log";
import Colors from "../Stylesheets/Colors";
import StyleMain from "../Stylesheets/StyleMain";
import DefaultSettings from "../DefaultSettings";
import Popup from "../Components/Popup";

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

    // Settings text input widget
    WidgetText(params) {
        return (
            <View {...params}>
                <Text style={{paddingBottom: 5, paddingTop: 5}}>{params.title}</Text>
                <TextInput
                    onChangeText={(text) => {
                        params.parent.state.settings[params.name] = text;
                        params.parent.setState({settings: params.parent.state.settings});
                        Database.userdata.set(
                            params.name,
                            params.parent.state.settings[params.name].toString()
                        );
                    }}
                    style={StyleMain.textInput}
                    value={"default" in params ? params.default : params.parent.state.settings[params.name]}
                />
            </View>
        );
    }

    WidgetNumeric(params) {
        return (
            <View {...params}>
                <Text style={{paddingBottom: 5, paddingTop: 5}}>{params.title}</Text>
                <NumericInput
                    inputStyle={{backgroundColor: "white"}}
                    rounded
                    step={1}
                    minValue={0}
                    onChange={(value) => {
                        params.parent.state.settings[params.name] = value;
                        params.parent.setState({settings: params.parent.state.settings});
                        Database.userdata.set(
                            params.name,
                            params.parent.state.settings[params.name].toString()
                        );
                    }}
                    value={"default" in params ? params.default : params.parent.state.settings[params.name]}
                    textColor="black"
                    iconStyle={{ color: "white" }}
                    rightButtonBackgroundColor={Colors.button}
                    leftButtonBackgroundColor={Colors.button}
                />
            </View>
        );
    }

    WidgetButton(params) {
        return (
            <TouchableOpacity {...params}>
                <ButtonText>{params.title}</ButtonText>
            </TouchableOpacity>
        );
    }

    DeleteAllChats() {
        Log.Debug("DELETING ALL CHATS...");
        Database.Execute("DELETE FROM Chats");
    }

    DeleteAllPeers() {
        Log.Debug("DELETING ALL PEERS...");
        let activeId = Database.active.getString("id");
        Database.Execute("DELETE FROM Messages WHERE [from] != '" + activeId + "'");
        Database.Execute("DELETE FROM Posts WHERE author != '" + activeId + "'");
        Database.Execute("DELETE FROM Peers");
    }

    DeleteAllPosts() {
        Log.Debug("DELETING ALL POSTS...");
        Database.Execute("DELETE FROM Posts");
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
                    ref={this.popup}
                />

                <ScrollView style={{padding: 10}}>
                    <this.WidgetText title="Signal Server URL" name="SignalServerURL" parent={this}/>
                    <this.WidgetNumeric title="Maximum posts cached per user" name="CachePostLimitPerUser" parent={this}/>
                    <this.WidgetButton
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
                    <this.WidgetButton
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
                    <this.WidgetButton
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
