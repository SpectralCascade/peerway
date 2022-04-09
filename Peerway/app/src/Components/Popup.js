import React, { Component } from "react";
import { StyleSheet, Modal, TouchableOpacity, View } from "react-native";
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
        const getButton = (text, onPress) => {
            return (
                <TouchableOpacity onPress={onPress} style={[StyleMain.button]}>
                    <ButtonText>{text}</ButtonText>
                </TouchableOpacity>
            );
        };

        let hasPosButton = this.props.positiveText && this.props.positiveText.length > 0;
        let hasNegButton = this.props.negativeText && this.props.negativeText.length > 0;

        const getPosButton = () => {
            return hasPosButton ?
                getButton(
                    this.props.positiveText,
                    this.props.positiveOnPress ? () => {
                        this.props.positiveOnPress();
                        this.Hide();
                    } : () => this.Hide()
                ) : (<></>);
        };

        const getNegButton = () => {
            return hasNegButton ?
            getButton(
                this.props.negativeText,
                this.props.negativeOnPress ? () => {
                    this.props.negativeOnPress();
                    this.Hide();
                } : () => this.Hide()
            ) : (<></>);
        };

        const getCloseButton = () => {
            return this.props.onClose || (!hasPosButton && !hasNegButton) ? (
                <TouchableOpacity onPress={() => this.Hide()} style={styles.closeButton}>
                    <Icon
                        name="close"
                        size={42}
                        color="black"
                    />
                </TouchableOpacity>
            ) : (<></>);
        };

        return (
            <Modal
                transparent={true}
                visible={this.state.shown}
                position={"center"}
            >
                <View style={[StyleMain.popupBackground, this.props.style]}>
                    <View style={StyleMain.popup}>
                        {getCloseButton()}
                        <Text style={{fontSize: 24}}>{this.props.title ? this.props.title : ""}</Text>
                        <Text>{this.props.content ? this.props.content : ""}</Text>
                        <View style={{flexDirection: "row"}}>
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
    }
});
