import { StyleSheet, View, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import StyleMain from '../Stylesheets/StyleMain';
import ButtonText from '../Components/ButtonText';
import Text from '../Components/Text';
import AppVersion from '../AppVersion';

function SetupScreen({ navigation }) {
    return (
        <SafeAreaView style={StyleMain.background}>
            <View style={StyleMain.mainContent}>
                <View style={StyleMain.logoContainer}>
                    <Image style={StyleMain.logo} source={require("../../assets/adaptive-icon.png")}>
                    </Image>
                    <Text>Your data are belong to... you!</Text>
                </View>

                <TouchableOpacity style={StyleMain.button} onPress={() => navigation.navigate("EditProfile")}>
                    <ButtonText>Create Account</ButtonText>
                </TouchableOpacity>

                <View style={[StyleMain.button, styles.aboutButton]}>
                    <ButtonText>About</ButtonText>
                </View>
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

export default SetupScreen;
