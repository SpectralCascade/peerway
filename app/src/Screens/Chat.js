import React, { useState, useCallback, useEffect } from 'react'
import { KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { Actions, GiftedChat, InputToolbar } from 'react-native-gifted-chat'
import StyleMain from '../Stylesheets/StyleMain';

export default function Chat(props) {
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        setMessages([{
            _id: 1,
            text: 'Hello, world!\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\nwow what a long message this is\n\n\n\n\ncrazy',
            createdAt: new Date(),
            user: {
                _id: 2,
                name: 'React Native',
                avatar: 'https://placeimg.com/140/140/any',
            }
        },
        {
            _id: 2,
            text: 'woah\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\nwoah',
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

    const renderActions = props => {
        return (<Actions
            {...props}
            containerStyle={styles.actions}
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
                alwaysShowSend
                scrollToBottom
                renderActions={renderActions}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    inputToolbar: {
    },
    actions: {
    }
});
