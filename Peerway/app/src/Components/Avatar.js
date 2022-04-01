import React from 'react';
import StyleMain from '../Stylesheets/StyleMain';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Image } from 'react-native';
import { Log } from '../Log';

// Takes an object and size, then displays the avatar
export default function Avatar(props) {
    
    if (typeof(props.avatar) === "string") {
        return props.avatar.length > 0 ? (
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
        return (
            <Image
                source={{uri: "data:" + props.avatar.mime + ";base64," + props.avatar.base64}}
                style={[StyleMain.avatar, {width: props.size, height: props.size}, props.style]}
            />
        );
    }
}
