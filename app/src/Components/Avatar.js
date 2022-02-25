import React from 'react';
import StyleMain from '../Stylesheets/StyleMain';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'react-native';

// Takes an object and size, then displays the avatar
export default function Avatar(props) {

    if (props.avatar != "") {
        var avatar = JSON.parse(props.avatar);
        return (
            <Image
                source={{uri: "data:" + avatar.mime + ";base64," + avatar.data}}
                style={[StyleMain.avatar, {width: props.size, height: props.size}]}
            />
        );
    }
    return (
        <MaterialCommunityIcons
            name="account"
            size={props.size}
            color="white"
            style={{position: "absolute"}}
        />
    );
}
