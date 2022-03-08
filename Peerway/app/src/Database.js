import 'react-native-get-random-values';
import { MMKV } from 'react-native-mmkv';
import {v1 as uuidv1, v4 as uuidv4 } from 'uuid';
import AppKeys from './AppKeys';

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
    // Metadata for direct messaging with other entities.
    chats: {
        // Example chat with unique id
        "<uuid-generated-id>": {
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
    }
};

export default class Database {

    // All chat content for the active entity, by chat ID.
    static chats = {};
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
        let chatData = {
            name: "name" in meta ? meta.name : isGroup ? "group." + meta.id : members[0].name,
            members: "members" in meta ? meta.members : [],
            received: "received" in meta ? meta.received : (new Date()).getUTCMilliseconds(),
            updated: "updated" in meta ? meta.updated : (new Date()).getUTCMilliseconds(),
            read: "read" in meta ? meta.read : false,
            muted: "muted" in meta ? meta.muted : false,
            blocked: "blocked" in meta ? meta.blocked : false,
            icon: "icon" in meta ? meta.icon : (isGroup ? "" : members[0].avatar),
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
        this.active.set("chat.meta." + meta.id, JSON.stringify(chatData));

        return meta.id;
    }

}
