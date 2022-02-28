import 'react-native-get-random-values';
import { MMKV } from 'react-native-mmkv';
import {v1 as uuidv1, v4 as uuidv4 } from 'uuid';
import AppKeys from './AppKeys';

// Local user data, tracking entities and general app settings.
const userdata = new MMKV({ id: "userdata", encryptionKey: AppKeys.userdata });

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
            // Locks that can only be opened by a corresponding permission key.
            // Note that only administrators are allowed to generate new shared locks,
            // but every verified member has the shared locks. Shared locks can only be given
            // by a verified administrator.
            locks: {
                // Lock for verifying this identity, NEVER shared with another entity.
                id: "<generated-lock>",
                // Lock for reading messages.
                rx: "<shared-lock>",
                // Lock for sending messages.
                tx: "<shared-lock>",
                // Lock for verifying an administrator.
                admin: "<shared-lock>"
            },
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

    // Changes the current active entity storage slot.
    static SwitchActiveEntity(id) {
        if (id == null || id == "") {
            this.active = null;
        } else {
            this.active = this.entities[id];
        }
        return this.active;
    }

    // Creates a new entity storage slot and automatically sets the active slot.
    static CreateEntity() {
        // Generated ID for this entity, based on timestamp & MAC address.
        id = uuidv1();
        
        // Randomly generated encryption key for the entity data.
        // This way, if another user gets access to the entity data, they need the key to access it.
        // In future, this could be a user password or pin instead of RNG UUID.
        key = uuidv4();

        //console.log("Created id " + id + " and key: " + key);
        // Create new entity storage slot
        this.entities[id] = new MMKV({
            id: id,
            encryptionKey: key
        });

        // Add entity to userdata.
        userdata.set(id, key);

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
        if (userdata.contains(id)) {
            userdata.delete(id);
        }
        return success;
    }

}
