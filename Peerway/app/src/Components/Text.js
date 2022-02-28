import React, { Component } from "react"
import { Text as RawText } from "react-native";
import StyleMain from "../Stylesheets/StyleMain";

export default class Text extends Component {
    render() {
        return (
            <RawText
                {...this.props}
                style={[StyleMain.text, this.props.style]}
            >
                {this.props.children}
            </RawText>
        );
    }
}
