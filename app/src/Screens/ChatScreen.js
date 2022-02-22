import React, { useState, useCallback, useEffect } from 'react'
import { KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { GiftedChat, InputToolbar } from 'react-native-gifted-chat'
import StyleMain from '../Stylesheets/StyleMain';

export default function ChatScreen(props) {
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        setMessages([{
            _id: 1,
            text: 'Hello, world!',
            createdAt: new Date(),
            user: {
                _id: 2,
                name: 'React Native',
                avatar: 'https://placeimg.com/140/140/any',
            }
        }]);
    }, []);

    const onSend = useCallback((messages = []) => {
            setMessages(previousMessages => GiftedChat.append(previousMessages, messages))
    }, []);

    const inputToolbar = props => {
        return (<InputToolbar
            {...props}
            containerStyle={styles.inputToolbar}
        />);
    };

    return (
        <View style={StyleMain.background}>
            <GiftedChat
                messages={messages}
                renderInputToolbar={props => inputToolbar(props)}
                onSend={messages => onSend(messages)}
                user={{
                    _id: 1,
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    inputToolbar: {
    }
});
