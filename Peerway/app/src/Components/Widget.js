import React from "react";
import Database from "../Database";
import { TextInput, TouchableOpacity, View, StyleSheet } from "react-native";
import NumericInput from "react-native-numeric-input";
import Text from "../Components/Text";
import ButtonText from "../Components/ButtonText";
import Colors from "../Stylesheets/Colors";
import StyleMain from "../Stylesheets/StyleMain";
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const toggleHeight = 48;
const togglePadding = 24;

function RenderHelpButton(params) {
    let button = (<></>);
    if (params.onPress) {
        button = (
            <TouchableOpacity style={{justifyContent: "center", paddingHorizontal: 10}} {...params}>
                <Icon name="help-circle" size={32} color="black"/>
            </TouchableOpacity>
        );
    }
    return button;
}

export default {
    // Settings text input widget
    Text: (params) => {
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
    },
    Numeric: (params) => {
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
    },
    Button: (params) => {
        let renderIcon = (<></>);
        if (params.icon) {
            renderIcon = (
                <View style={styles.buttonIcon}>
                    <Icon name={params.icon} size={toggleHeight} color="black" />
                </View>
            );
        }

        return (
            <TouchableOpacity {...params} style={[params.style]}>
                <View style={params.icon ? {flexDirection: "row", alignItems: "center"} : {justifyContent: "center"} }>
                    {renderIcon}
                    <ButtonText>{params.title}</ButtonText>
                </View>
            </TouchableOpacity>
        );
    },
    ButtonToggle: (params) => {
        return (
            <TouchableOpacity onPress={() => {
                params.parent.state.settings[params.name] = !params.parent.state.settings[params.name];
                params.parent.setState({settings: params.parent.state.settings});
                Database.userdata.set(
                    params.name,
                    params.parent.state.settings[params.name].toString()
                );
            }} style={[styles.toggleContainer, params.style]}>
                <View style={styles.toggleTextAndHelp}>
                    <RenderHelpButton onPress={params.onHelpPress} />
                    <View style={{justifyContent: "center", flexDirection: "row", width: "75%"}}>
                        <Text style={styles.toggleText}>{params.title}</Text>
                    </View>
                </View>
                <View style={[styles.toggleButton, {
                    backgroundColor: params.parent.state.settings[params.name] ? "#0f0" : "#999"
                }]}>
                    <Icon
                        name={params.parent.state.settings[params.name] ? "toggle-switch" : "toggle-switch-off-outline"}
                        size={toggleHeight}
                        color="black"
                    />
                </View>
            </TouchableOpacity>
        );
    }
}

const styles = StyleSheet.create({
    buttonIcon: {
        justifyContent: "center",
        alignContent: "center",
        marginRight: 10
    },
    toggleContainer: {
        flexDirection: "row",
        backgroundColor: "#fff",
        minHeight: toggleHeight
    },
    toggleButton: {
        width: "25%",
        height: "100%",
        right: 0,
        paddingHorizontal: togglePadding,
        justifyContent: "center",
        alignContent: "center"
    },
    toggleText: {
        paddingVertical: 10,
    },
    toggleTextAndHelp: {
        flexDirection: "row",
        width: "75%",
    }
});
