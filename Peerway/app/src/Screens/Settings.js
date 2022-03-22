import { CommonActions } from "@react-navigation/native";
import React from "react";
import { ScrollView, TextInput, TouchableOpacity, View } from "react-native";
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
            serverURL: "http://" + Constants.server_ip + ":" + Constants.port
        };

        this.Init();
    }

    Init() {
        if (Database.userdata.contains("SignalServerURL")) {
            this.state.serverURL = Database.userdata.getString("SignalServerURL");
        } else {
            Database.userdata.set("SignalServerURL", this.state.serverURL);
        }
    }

    OnOpen() {
        Log.Debug("OPENED SETTINGS SCREEN");
        this.Init();
    }

    render() {
        return (
            <View style={[StyleMain.background]}>
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => { this.OnOpen() }}/>

                <ScrollView>
                    <Text>Signal Server URL</Text>
                    <TextInput
                        onChangeText={(text) => this.setState({serverURL: text}) } 
                        style={StyleMain.textInput}
                        value={this.state.serverURL}
                    ></TextInput>
                </ScrollView>
                <TouchableOpacity
                    style={[StyleMain.button, {backgroundColor: Colors.button, height: 40, marginTop: 12}]}
                    onPress={() => {
                        Database.userdata.set("SignalServerURL", this.state.serverURL);
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