import React, { Component } from "react"
import { Text as RawText } from "react-native";
import StyleMain from "../Stylesheets/StyleMain";

class Text extends Component {
    render() {
        return (
            <RawText style={[StyleMain.text, this.props.style]}>
                {this.props.children}
            </RawText>
        );
    }
}

export default Text;
