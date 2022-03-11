export default {
    // Connection to the signalling server
    connection: null,
    // Connections to other peers, keyed by entity ID.
    peers: {},
    // Data send channels to connected peers
    channels: {}
}
