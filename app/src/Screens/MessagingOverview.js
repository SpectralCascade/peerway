import { StyleSheet, View, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import StyleMain from '../Stylesheets/StyleMain';
import ButtonText from '../Components/ButtonText';
import Text from '../Components/Text';
import AppVersion from '../AppVersion';
import Database from '../Database';
import { MaterialIcons } from '@expo/vector-icons'; 

export default function MessagingOverview(props) {
    React.useEffect(() => {
        return props.navigation.addListener('focus', () => {
            console.log("OPENED MESSAGING OVERVIEW");
        });
    });

    return (
        <SafeAreaView style={StyleMain.background}>
            <MaterialIcons name="menu" size={24} color="black" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    aboutButton: {
        height: 50,
        backgroundColor: "#55f",
    }
})
