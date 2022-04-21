import { StyleSheet, View, Image, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import StyleMain from '../Stylesheets/StyleMain';
import ButtonText from '../Components/ButtonText';
import Text from '../Components/Text';
import AppVersion from '../AppVersion';
import Database from '../Database';
import Constants from "../Constants";
import { Log } from '../Log';

export default function SetupScreen(props) {
    React.useEffect(() => {
        return props.navigation.addListener('focus', () => {
            console.log("OPENED SETUP SCREEN");
            Database.SwitchActiveEntity(null);
        });
    });

    return (
        <SafeAreaView style={StyleMain.background}>

            <View style={StyleMain.logoContainer}>
                <Image style={StyleMain.logo} source={require("../../assets/Logo.png")} />
                <Text style={{margin: 10, fontSize: 36, fontWeight: "bold", fontFamily: "monospace"}}>Peerway</Text>
            </View>
            
            <View style={StyleMain.bottomContent}>
                <TouchableOpacity style={StyleMain.button} onPress={() => props.navigation.navigate("EditProfile")}>
                    <ButtonText>Create Account</ButtonText>
                </TouchableOpacity>

                <TouchableOpacity style={[StyleMain.button, styles.aboutButton]} onPress={() => {
                    Linking.openURL(Constants.website).catch((e) => Log.Error(e));
                }}>
                    <ButtonText>About</ButtonText>
                </TouchableOpacity>
            </View>

            <View style={{marginTop: 30}}>
                <Text style={{textAlign: "right"}}>Version {AppVersion.text}</Text>
            </View>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    aboutButton: {
        height: 50,
        backgroundColor: "#55f",
    }
})
