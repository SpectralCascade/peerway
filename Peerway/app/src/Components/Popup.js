import React, { Component } from "react";
import { StyleSheet, Modal, TouchableOpacity, View, BackHandler } from "react-native";
import StyleMain from "../Stylesheets/StyleMain";
import Text from "./Text";
import ButtonText from "./ButtonText";
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Log } from "../Log";

export default class Popup extends Component {
    constructor(props) {
        super(props);

        this.state = {
            shown: false
        }
    }

    UpdateButtonStates() {
        this.hasPosButton = this.props.positiveText && this.props.positiveText.length > 0;
        this.hasNegButton = this.props.negativeText && this.props.negativeText.length > 0;
        this.showCloseButton = this.props.onClose || (!this.hasPosButton && !this.hasNegButton);
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
        this.UpdateButtonStates();

        const getButton = (text, onPress) => {
            return (
                <TouchableOpacity onPress={onPress} style={[StyleMain.button, styles.button]}>
                    <ButtonText>{text}</ButtonText>
                </TouchableOpacity>
            );
        };

        const getPosButton = () => {
            return this.hasPosButton ?
                getButton(
                    this.props.positiveText,
                    this.props.positiveOnPress ? () => {
                        this.props.positiveOnPress();
                        this.Hide();
                    } : () => this.Hide()
                ) : (<></>);
        };

        const getNegButton = () => {
            return this.hasNegButton ?
            getButton(
                this.props.negativeText,
                this.props.negativeOnPress ? () => {
                    this.props.negativeOnPress();
                    this.Hide();
                } : () => this.Hide()
            ) : (<></>);
        };

        const getCloseButton = () => {
            return this.showCloseButton ? (
                <TouchableOpacity onPress={() => this.Hide()} style={styles.closeButton}>
                    <Icon
                        name="close"
                        size={42}
                        color="black"
                    />
                </TouchableOpacity>
            ) : (<></>);
        };

        const getTitleText = () => {
            return this.props.title && this.props.title.length != 0 ? (
                <Text style={{fontSize: 24}}>{this.props.title}</Text>
            ) : (<></>);
        };

        return (
            <Modal
                transparent={true}
                visible={this.state.shown}
                position={"center"}
                onRequestClose={() => {
                    if (this.showCloseButton) {
                        this.Hide();
                    }
                }}
            >
                <View style={[StyleMain.popupBackground, this.props.style]}>
                    <View style={StyleMain.popup}>
                        {getTitleText()}
                        {getCloseButton()}
                        <Text style={{marginTop: 5}}>{this.props.content ? this.props.content : ""}</Text>
                        <View style={{flexDirection: "row", justifyContent: "space-evenly"}}>
                            {getPosButton()}
                            {getNegButton()}
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
        width: "45%",
        height: 48,
        padding: 10,
        margin: "2.5%"
    }
});
