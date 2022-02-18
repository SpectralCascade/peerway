import { Dimensions, StyleSheet } from 'react-native';

const dimensions = Dimensions.get('window');

const StyleMain = StyleSheet.create({
    background: {
        flex: 1,
        backgroundColor: '#CCF',
    },
    button: {
        width: "100%",
        height: 70,
        backgroundColor: "#fc5c65",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 40,
    },
    buttonText: {
        color: "#fff",
        fontFamily: "monospace",
    },
    mainContent: {
        flex: 1,
        justifyContent: "flex-end",
        alignItems: "center"
    },
    logo: {
        width: dimensions.width,
        height: dimensions.height / 2
    },
    logoContainer: {
        flex: 1,
        justifyContent: "flex-start",
        alignItems: "center"
    },
    text: {
        color: "#000",
    },
});

export default StyleMain;