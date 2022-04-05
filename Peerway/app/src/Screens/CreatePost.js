import { CommonActions } from "@react-navigation/native";
import React from "react";
import { StyleSheet, ScrollView, TextInput, TouchableOpacity, View, Keyboard } from "react-native";
import ButtonText from "../Components/ButtonText";
import HandleEffect from "../Components/HandleEffect";
import Text from "../Components/Text";
import Constants from "../Constants";
import Database from "../Database";
import { Log } from "../Log";
import Colors from "../Stylesheets/Colors";
import StyleMain from "../Stylesheets/StyleMain";

export default class CreatePost extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            text: "",
            media: []
        };

        this.Init();
    }

    Init() {
        // TODO
    }

    OnOpen() {
        Log.Debug("OPENED POST CREATION SCREEN");
        this.Init();
        // Auto-close when keyboard is hidden
        this.sub = Keyboard.addListener("keyboardDidHide", () => {
            this.sub.remove();
            this.state = {};
            this.props.navigation.goBack();
        });
    }

    // Create the post in the database and publish it
    PublishPost() {
        // TODO
        Log.Debug("PUBLISHING POST...");
        this.sub.remove();
        this.props.navigation.goBack();
    }

    render() {
        return (
            <View style={[StyleMain.background]}>
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => { this.OnOpen() }}/>

                <ScrollView style={{padding: 10}}>
                    <TextInput
                        onChangeText={(text) => this.setState({text: text}) } 
                        style={[{
                            textAlignVertical: "top",
                            color: "black",
                            fontSize: 18
                        }]}
                        value={this.state.text}
                        autoFocus
                        placeholder="Wazzup?"
                        placeholderTextColor="#999"
                        multiline={true}
                    />
                </ScrollView>

                <TouchableOpacity
                    style={[StyleMain.button, {}]}
                    onPress={() => this.PublishPost()}
                >
                    <ButtonText style={{color: Colors.buttonText, fontSize: 18}}>Publish</ButtonText>
                </TouchableOpacity>
            </View>
        );
    }
}

const styles = StyleSheet.create({
});
