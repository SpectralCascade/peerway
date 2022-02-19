import { Dimensions, StyleSheet } from 'react-native';

const dimensions = Dimensions.get('window');

const StyleMain = StyleSheet.create({
    avatar: {
        backgroundColor: "#55C",
        width: "100%",
        height: "100%"
    },
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
    bottomContent: {
        justifyContent: "flex-end",
    },
    center: {
        alignItems: "center",
    },
    datePickerContainer: {
        flexDirection: "row",
        width: "33.33333%",
    },
    datePickerDropdown: {
        height: 40,
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
    mainContent: {
        flex: 1,
        justifyContent: "flex-start",
        padding: 12,
    },
    topContent: {
        justifyContent: "flex-start",
    },
    text: {
        color: "#000",
    },
    textInput: {
        backgroundColor: "#fff",
        height: 40,
        borderWidth: 1,
        padding: 10,
    }
});

export default StyleMain;