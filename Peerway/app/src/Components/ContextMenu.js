import React, { Component } from "react";
import { StyleSheet, Modal, TouchableOpacity, View } from "react-native";
import StyleMain from "../Stylesheets/StyleMain";
import Text from "./Text";
import ButtonText from "./ButtonText";
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default class ContextMenu extends Component {
    constructor(props) {
        super(props);

        this.state = {
            shown: false
        }
    }

    Show() {
        this.setState({shown: true});
        this.forceUpdate();
    }

    Hide() {
        this.setState({shown: false});
        if (this.props.onClose) {
            this.props.onClose();
        }
    }

    render() {
        const getButton = (key, text, onPress) => {
            return (
                <TouchableOpacity
                    key={key}
                    onPress={onPress}
                    style={[StyleMain.button, styles.button]}
                >
                    <ButtonText>{text}</ButtonText>
                </TouchableOpacity>
            );
        };

        const getCloseButton = () => {
            return (
                <TouchableOpacity onPress={() => this.Hide()} style={styles.closeButton}>
                    <Icon
                        name="close"
                        size={42}
                        color="black"
                    />
                </TouchableOpacity>
            );
        };

        const getTitleText = () => {
            return this.props.title && this.props.title.length != 0 ? (
                <Text style={{fontSize: 24}}>{this.props.title}</Text>
            ) : (<></>);
        };

        const getOptions = () => {
            options = [];
            if ("options" in this.props) {
                for (let i in this.props.options) {
                    options.push(
                        getButton(
                            i,
                            this.props.options[i].name,
                            this.props.options[i].onPress
                        )
                    );
                }
            }
            return options;
        }

        return (
            <Modal
                transparent={true}
                visible={this.state.shown}
                position={"center"}
            >
                <View style={[StyleMain.popupBackground, this.props.style]}>
                    <View style={StyleMain.popup}>
                        {getTitleText()}
                        {getCloseButton()}
                        <Text style={{marginTop: 5}}>{this.props.content ? this.props.content : ""}</Text>
                        <View style={{justifyContent: "space-evenly", width: "100%"}}>
                            {getOptions()}
                        </View>
                    </View>
                </View>
            </Modal>
        );
    }
}

const styles = StyleSheet.create({
    closeButton: {
        position: "absolute",
        right: 10,
        top: 10
    },
    button: {
        width: "100%",
        height: 48,
        padding: 10,
        marginTop: 5
    }
});
