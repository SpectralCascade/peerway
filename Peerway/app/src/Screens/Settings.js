import { CommonActions } from "@react-navigation/native";
import React from "react";
import { StyleSheet, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import ButtonText from "../Components/ButtonText";
import HandleEffect from "../Components/HandleEffect";
import Text from "../Components/Text";
import Constants from "../Constants";
import Database from "../Database";
import { Log } from "../Log";
import Colors from "../Stylesheets/Colors";
import StyleMain from "../Stylesheets/StyleMain";

export default class Settings extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            SignalServerURL: "http://" + Constants.server_ip + ":" + Constants.port
        };

        this.Init();
    }

    Init() {
        Object.keys(this.state).forEach((key) => {
            if (Database.userdata.contains(key)) {
                this.state[key] = Database.userdata.getString(key);
            } else {
                Database.userdata.set(key, this.state[key]);
            }
        });
    }

    OnOpen() {
        Log.Debug("OPENED SETTINGS SCREEN");
        this.Init();
    }

    // Settings text input widget
    WidgetText(params) {
        let change = {};
        return (
            <View {...params}>
                <Text>{params.title}</Text>
                <TextInput
                    onChangeText={(text) => {
                        change[params.name] = text;
                        params.parent.setState(change);
                    }}
                    style={StyleMain.textInput}
                    value={"default" in params ? params.default : params.parent.state[params.name]}
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

    render() {
        return (
            <View style={[StyleMain.background]}>
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => { this.OnOpen() }}/>

                <ScrollView>
                    <this.WidgetText title="Signal Server URL" name="SignalServerURL" parent={this}/>
                    <this.WidgetButton
                        style={[StyleMain.button, styles.widgetButton]}
                        title="Delete All Chats"
                        onPress={() => {
                            // TODO delete all chats
                            Log.Debug("Deleted all chat entries");
                        }}
                    />
                    <this.WidgetButton
                        style={[StyleMain.button, styles.widgetButton]}
                        title="Delete All Peers"
                        onPress={() => {
                            // TODO delete all peers
                            Log.Debug("Deleted all peer entries");
                        }}
                    />
                </ScrollView>

                <TouchableOpacity
                    style={[StyleMain.button, {}]}
                    onPress={() => {
                        Object.keys(this.state).forEach((key) => {
                            Database.userdata.set(key, this.state[key]);
                        });
                        this.props.navigation.dispatch(
                            CommonActions.reset({
                                index: 1,
                                routes: [{ name: 'MessagingOverview' }]
                            })
                        );
                    }}
                >
                    <ButtonText style={{color: Colors.buttonText}}>Save</ButtonText>
                </TouchableOpacity>
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
