import React from 'react';

// This function component is merely a wrapper so useEffect() can be utilised in class components.
export default function HandleEffect(props) {
    React.useEffect(() => {
        return props.navigation.addListener(props.effect, props.callback);
    });

    return (
        <></>
    );
}
