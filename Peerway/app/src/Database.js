import 'react-native-get-random-values';
import { MMKV } from 'react-native-mmkv';
import {v1 as uuidv1, v4 as uuidv4 } from 'uuid';
import AppKeys from './AppKeys';
import RNFS from "react-native-fs";
import Log from './Log';
import { Buffer } from 'buffer';

// This entity example shows what the different key-value fields are used for.
// Note that the actual storage stores non-primitive objects as JSON strings.
// Also note that content data is not stored in the entity storage object itself.
const ExampleEntity = {
    // The unique id of this entity.
    id: "<uuid-generated-id>",
    // The storage encryption key for this entity.
    encryptionKey: "<uuid-generated-key>",
    // Information displayed on the entity profile.
    profile: {
        name: "Alex",
        dob: "<serialised-date>",
        location: "UK",
        website: "https://example.com",
        bio: "I enjoy reading and writing code."
    },
    // A digital signature, used to verify that messages etc. are genuinely from this entity.
    signature: {
        public: "<public-signature-key>",
        private: "<private-signature-key>",
        expires: "<serialised-date-timestamp>"
    },
    // Array of all peer entity IDs this entity has interactions with, ordered by most recent interaction.
    peers: [],
    // Metadata regarding other peers this entity has interacted with historically.
    // Example peer with unique id
    "peer.<peer-entity-id>": {
        // Name of the peer
        name: "Bob",
        // Path to the peer avatar image file
        avatar: "<path-to-avatar-image>",
        // Is this peer a mutual?
        mutual: "<boolean>",
        // Is this peer blocked?
        blocked: "<boolean>",
        // The time at which this peer was last synced with
        sync: "<serialised-date-timestamp>",
        // A public verification key for checking digital signatures from this peer.
        verifier: "<public-signature-key>"
    },
    // Array of all chats this entity is part of, ordered by most recent interaction.
    chats: [],
    // Metadata for direct messaging with other entities.
    // Example chat with unique id
    "chat.<uuid-generated-id>": {
        // Name of the chat.
        name: "John Smith",
        // Which entities are part of the chat along with permission keys.
        members: [
            {
                // ID of the listed entity.
                id: "<entity-id>",
                // Key chat permissions.
                keys: {
                    // Key for verifying identity, only shared with this member.
                    id: "<generated-key>",
                    // Key for reading messages in the chat.
                    rx: "<generated-key>",
                    // Key for sending messages in the chat.
                    tx: "<generated-key>",
                    // This key indicates whether the listed entity has administrator privileges.
                    // Only a select few entities have this key.
                    admin: "<generated-key>"
                }
            }
        ],
        // When was the last message received from this chat?
        received: "<serialised-date>",
        // When was the last update to this chat (considers last message received time)?
        updated: "<serialised-date>",
        // Is this chat flagged as read?
        read: false,
        // Is this chat muted?
        muted: false,
        // Is this chat blocked?
        blocked: false,
        // The image used as the chat icon.
        icon: "<icon-image-base64-string>"
    }
};

export default class Database {

    // All entities, by entity ID.
    static entities = {};
    static active = null;

    // Local user data, tracking entities and general app settings.
    static userdata = new MMKV({ id: "userdata", encryptionKey: AppKeys.userdata });

    // Changes the current active entity storage slot.
    static SwitchActiveEntity(id) {
        if (id == null || id == "") {
            this.userdata.set("active", "");
            this.active = null;
        } else {
            this.userdata.set("active", id);
            // Load the MMKV instance if not already loaded
            let key = this.userdata.getString(id);
            if (!(id in this.entities)) {
                console.log("Loading active entity " + id + "...");
                this.entities[id] = new MMKV({
                    id: id,
                    encryptionKey: key
                });
            }
            this.active = this.entities[id];
        }
        return this.active;
    }

    // Creates a new entity storage slot and automatically sets the active slot.
    static CreateEntity() {
        // Generated ID for this entity, based on timestamp & MAC address.
        let id = uuidv1();
        
        // Randomly generated encryption key for the entity data.
        // This way, if another user gets access to the entity data, they need the key to access it.
        // In future, this could be a user password or pin instead of RNG UUID.
        let key = uuidv4();

        //console.log("Created id " + id + " and key: " + key);
        // Create new entity storage slot
        this.entities[id] = new MMKV({
            id: id,
            encryptionKey: key
        });
        this.entities[id].set("id", id);

        // Add entity to userdata.
        this.userdata.set(id, key);

        return id;
    }

    // Deletes an existing entity storage slot.
    static DeleteEntity(id) {
        success = false;
        // First, delete the entity data
        if (id in this.entities) {
            if (this.entities[id] != null) {
                // This part actually clears the data from storage
                this.entities[id].clearAll();
                success = true;
            }
            delete this.entities[id];
        }
        // Then delete the entity entry from userdata
        if (this.userdata.contains(id)) {
            this.userdata.delete(id);
        }
        return success;
    }

    // Create a new chat for the currently active entity with other entities.
    // Takes a list of members (NOT including the active entity) and optional meta to copy.
    static CreateChat(members, meta={}) {
        let isGroup = members.length > 1;

        if (meta == undefined) {
            meta = {};
        }

        if (!("id" in meta)) {
            // Generated ID for this chat, based on timestamp & MAC address.
            meta.id = uuidv1();
        }
        
        // Generate chat metadata
        let timeNow = Date.now();
        let chatData = {
            name: "name" in meta ? meta.name : isGroup ? "group." + meta.id : members[0].name,
            members: members,
            received: "received" in meta ? meta.received : timeNow,
            updated: "updated" in meta ? meta.updated : timeNow,
            read: "read" in meta ? meta.read : false,
            muted: "muted" in meta ? meta.muted : false,
            blocked: "blocked" in meta ? meta.blocked : false,
            icon: "icon" in meta ? meta.icon : (isGroup ? "" : members[0].avatar),
            // Number of messages the active entity has sent in this chat
            sent: 0,
            // Who sent the last message?
            lastFrom: "",
            // The last message content
            lastMessage: ""
        };
        
        // Generate member entries if necessary
        if (chatData.members.length == 0) {
            for (let member in members) {
                chatData.members.push({
                    id: member.id,
                    keys: {
                        // TODO digital signature and encryption keys
                    }
                });
            }
        }

        // Create a chat entry
        this.active.set("chat." + meta.id, JSON.stringify(chatData));

        return meta.id;
    }

    // Store some syncable content in a big data file.
    // Every 50 messages, start a new index pointer, based partly on very crude estimate of
    // 100 billion daily messages / 2 billion users for WhatsApp
    // https://techcrunch.com/2020/10/29/whatsapp-is-now-delivering-roughly-100-billion-messages-a-day/
    static Store(mmkv, path, data, itemsPerBlock = 50) {
        // Get full path
        let key = path;
        path = RNFS.DocumentDirectoryPath + "/" + path;

        // Function to append the data
        const Append = () => {
            // Update the index first
            // Broad phase indexing by month and year, then by every itemsPerBlock block
            let createdOn = "created" in data ? new Date(data.created) : Date.now();
            let storeTime = createdOn.getUTCFullYear().toString() + "/" + createdOn.getUTCMonth().toString();
            let lookup = mmkv.contains(key) ? JSON.parse(mmkv.getString(key)) : {
                // The year and month at which this index begins
                began: storeTime,
                // Number of bytes used by the file
                bytes: 0,
                // Total items in the entire file
                items: 0,
                // Array indexed by year and month. E.g. if start = "2022/3" then that corresponds to
                // index 0, "2022/4" corresponds to index 1, "2022/12" corresponds to index 9 etc.
                index: []
            };

            // Get the array index from the current year/month
            const GetIndex = (start, current) => {
                let split = start.split('/');
                let startYear = parseInt(split[0]);
                let startMonth = parseInt(split[1])
                split = current.split('/');
                let currentYear = parseInt(split[0]);
                let currentMonth = parseInt(split[1]);

                // Get the year index, then add the month difference
                return ((currentYear - startYear) * 12) + (currentMonth - startMonth);
            };

            let currentIndex = GetIndex(lookup.began, storeTime);
            while (lookup.index.length <= currentIndex) {
                lookup.index.push({});
            }

            // Now add the inner block pointers
            if (!("start" in lookup.index[currentIndex])) {
                lookup.index[currentIndex] = {
                    // Byte position pointer to this part of the file
                    start: lookup.bytes,
                    // Byte end position of this part of the file
                    end: lookup.bytes,
                    // Number of items for this month of the year
                    items: 0,
                    // Array of blocks, of max size itemsPerBlock items
                    blocks: [{
                        // The cumulative byte position (to be added to the month of the year position)
                        pos: 0,
                        // The size of this block in bytes
                        len: 0,
                        // The number of items in this block, up to itemsPerBlock
                        items: 0
                    }],
                };
            }

            // Raw data to be appended to the file
            let raw = JSON.stringify(data);
            let bytes = Buffer.byteLength(string, 'utf8');

            // Actually add the item to the block
            lookup.bytes += bytes;
            lookup.index[currentIndex].items++;
            lookup.index[currentIndex].end += bytes;

            let blockIndex = lookup.index[currentIndex].blocks.length - 1;
            lookup.index[currentIndex].blocks[blockIndex].items++;
            lookup.index[currentIndex].blocks[blockIndex].len += bytes;

            // Add a new block for next time
            if (lookup.index[currentIndex].blocks[blockIndex].items >= itemsPerBlock) {
                lookup.index[currentIndex].blocks.push({
                    pos: lookup.index[currentIndex].blocks[blockIndex].pos + lookup.index[currentIndex].blocks[blockIndex].len,
                    len: 0,
                    items: 0
                });
                lookup.index[currentIndex].blocks[blockIndex].pos;
            }

            // Append the actual data to the file
            RNFS.appendFile(path, raw);

            // Finally, save the index
            mmkv.set(key, JSON.stringify(lookup));
        };

        if (!RNFS.exists(path)) {
            // Create a file
            RNFS.writeFile(path, "", 'utf8').then((success) => {
                Log.Info("Finished creating file at path: " + path);
                if (success) {
                    Append();
                }
            }).catch((err) => {
                Log.Error(err);
            });
        } else {
            Append();
        }
    }

    static MarkPeerInteraction(id, peers=[], index=-1) {
        if (peers.length == 0) {
            peers = JSON.parse(this.active.getString("peers"));
        }

        if (index < 0) {
            index = peers.indexOf(id);
        }

        // Move to top of the list
        // TODO: more efficient solution?
        let bottom = peers.length > 1 ? peers.slice(index, index + 1) : [];
        let top = peers.length > 1 ? peers.slice(0, Math.max(0, index)) : [];
        peers = [id].concat(top.concat(bottom));

        this.active.set("peers", JSON.stringify(peers));
    }

    // Add a peer entry to the database, if it isn't already there
    static AddPeer(id, markInteraction=true) {
        let peers = [];
        if (this.active.contains("peers")) {
            console.log("Database contains peers array");
            peers = JSON.parse(this.active.getString("peers"));
        } else {
            console.log("Database DOES NOT contain peers array");
        }

        let index = peers.indexOf(id);
        if (index >= 0) {
            console.log("peer." + id + " already exists, no need to add new.");
            if (markInteraction) {
                this.MarkPeerInteraction(id, peers, index);
            }
        } else {
            // Add to the front of the list
            console.log("Adding NEW peer to list: peer." + id);
            this.active.set("peers", JSON.stringify(([id].concat(peers))));
            this.active.set("peer." + id, JSON.stringify({
                name: "",
                avatar: "",
                mutual: false,
                blocked: false,
                sync: "",
                verifier: ""
            }));
        }
        
    }

}
