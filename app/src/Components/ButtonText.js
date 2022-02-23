import React, { Component } from "react"
import { Text } from "react-native";
import StyleMain from "../Stylesheets/StyleMain";

class ButtonText extends Component {
    render() {
        return (
            <Text {...this.props} style={[StyleMain.text, StyleMain.buttonText, this.props.style]}>
                {this.props.children}
            </Text>
        );
    }
}

export default ButtonText;
