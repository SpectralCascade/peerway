import React from 'react';
import StyleMain from '../Stylesheets/StyleMain';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Image, View } from 'react-native';
import { Log } from '../Log';

// Takes an object and size, then displays the avatar
export default function Avatar(props) {
    let icon = null;
    
    if (typeof(props.avatar) === "string") {
        icon = props.avatar.length > 0 ? (
            <Image
                source={{uri: props.avatar}}
                style={[StyleMain.avatar, {width: props.size, height: props.size}, props.style]}
            />
        ) : (
            <Icon
                name="account"
                size={props.size}
                color="white"
                style={[{position: "absolute"}, props.style]}
            />
        );
    } else {
        icon = (
            <Image
                source={{uri: "data:" + props.avatar.mime + ";base64," + props.avatar.base64}}
                style={[StyleMain.avatar, {width: props.size, height: props.size}, props.style]}
            />
        );
    }

    let toRender = icon;
    if (props.status) {
        let sizeStatus = props.size / 4.5;
        let pad = props.size / 30;
        toRender = (
            <>
                {icon}
                <View style={{
                    backgroundColor: "#0f0",
                    borderRadius: 100000,
                    width: sizeStatus,
                    height: sizeStatus,
                    right: pad,
                    bottom: pad,
                    position: "absolute"
                }}>
                </View>
            </>
        );
    }
    return toRender;
}
