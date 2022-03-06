import { Dimensions, StyleSheet } from 'react-native';
import Colors from './Colors'

const dimensions = Dimensions.get('window');

const StyleMain = StyleSheet.create({
    avatar: {
        backgroundColor: Colors.avatarBackground,
        borderRadius: 10000,
    },
    background: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    button: {
        width: "100%",
        height: 70,
        backgroundColor: Colors.button,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 40,
    },
    buttonText: {
        color: Colors.buttonText,
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
    edge: {
        height: 1,
        backgroundColor: "#000"
    },
    logo: {
        width: dimensions.width,
        height: dimensions.height / 2
    },
    logoContainer: {
        flex: 1,
        alignItems: "center"
    },
    mainContent: {
        flex: 1,
        padding: 12,
    },
    text: {
        color: Colors.text,
    },
    textInput: {
        backgroundColor: Colors.textInput,
        color: Colors.text,
        minHeight: 40,
        borderWidth: 1,
        justifyContent: "center",
        paddingHorizontal: 12
    },
    textInputMultiline: {
        textAlignVertical: "top",
        backgroundColor: Colors.textInput,
        minHeight: 40,
        borderWidth: 1,
        padding: 12,
    }
});

export default StyleMain;