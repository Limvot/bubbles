import React from 'react'
import {
    Button,
    Text,
    View,
    TextInput,
    FlatList,
    TouchableWithoutFeedback,
    YellowBox,
    AsyncStorage,
    ActivityIndicator,
} from 'react-native';
import { GiftedChat } from 'react-native-gifted-chat'
import RNFS from 'react-native-fs'
//import {NotificationsAndroid} from 'react-native-notifications'
import sdk from 'matrix-js-sdk'

rnfs_dir = RNFS.DocumentDirectoryPath;

YellowBox.ignoreWarnings(['Setting a timer'])

let client = null

function messageEventToGiftedChatMessage(room, event) {
  let user = room.getMember(event.getSender());
  let message = {
      _id: event.getId(),
      text: event.getContent().body,
      createdAt: event.getDate(),
      user: {
          _id: user.userId,
          name: user.name,
          avatar: user.getAvatarUrl(client.getHomeserverUrl(),
              100,
              100,
              "scale",
              true,
              true),
      }
  };
 if (event.getContent().msgtype == "m.image") {
     message.image = client.mxcUrlToHttp(event.getContent().url);
 }
 if (event.getContent().msgtype == "m.video") {
     message.video = client.mxcUrlToHttp(event.getContent().url);
 }
  return message;
}
export class ChatScreen extends React.Component {
  static navigationOptions = {
      title: 'Chat',
  };
  state = {
    roomId: null,
    room: null,
    messages: [],
  }

  componentWillMount() {
    const roomId = this.props.navigation.getParam('roomId', 'NO-ID');
    const room = client.getRoom(roomId);
    let messages = room.getLiveTimeline().getEvents()
                       .filter(event => event.getType() == "m.room.message")
                       .reverse()
                       .map((event) => messageEventToGiftedChatMessage(room, event));

    this.setState({
      roomId: roomId,
      room: room,
      messages: messages
    });
    client.on("Room.timeline", (event, eRoom, toStartOfTimeline) => {
        if (eRoom == room && event.getType() == "m.room.message") {
            let message = messageEventToGiftedChatMessage(room, event)
            this.setState(previousState => ({
                messages: toStartOfTimeline ? previousState.messages.concat([message])
                                            : [message].concat(previousState.messages),
            }))
        }
    })
    // we want more scrollback to start with
      client.scrollback(room, 30, () => {})
  }

  onSend(messages = []) {
    for (let message of messages) {
        client.sendEvent(this.state.roomId, "m.room.message",
                         { "body": message.text, "msgtype": "m.text" }, "")
    }
  }

  render() {
    return (
      <GiftedChat
        messages={this.state.messages}
        onSend={messages => this.onSend(messages)}
        loadEarlier={ true }
        onLoadEarlier={ () => client.scrollback(this.state.room, 30, () => {}) }
        scrollToBottom = { true }
        user={{
          _id: client.getUserId(),
        }}
      />
    )
  }
}

function inherits(ctor, superCtor) {
    // Add inherits from Node.js
    // Source:
    // https://github.com/joyent/node/blob/master/lib/util.js
    // Copyright Joyent, Inc. and other Node contributors.
    //
    // Permission is hereby granted, free of charge, to any person obtaining a
    // copy of this software and associated documentation files (the
    // "Software"), to deal in the Software without restriction, including
    // without limitation the rights to use, copy, modify, merge, publish,
    // distribute, sublicense, and/or sell copies of the Software, and to permit
    // persons to whom the Software is furnished to do so, subject to the
    // following conditions:
    //
    // The above copyright notice and this permission notice shall be included
    // in all copies or substantial portions of the Software.
    //
    // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
    // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
    // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
    // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
    // USE OR OTHER DEALINGS IN THE SOFTWARE.
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
            value: ctor,
            enumerable: false,
            writable: true,
            configurable: true,
        },
    });
}

const AsyncDBStore = function AsyncDBStore(opts) {
    sdk.MatrixInMemoryStore.call(this, opts);
    this.startedUp = false;
    this._syncTs = 0;
    this._userModifiedMap = {
        // user_id: timestamp
    };
    this._syncAccumulator = new sdk.SyncAccumulator();
}
inherits(AsyncDBStore, sdk.MatrixInMemoryStore);

AsyncDBStore.prototype.startup = function() {
    console.log("starting up!");
    return RNFS.readFile(rnfs_dir + '/persisted_data').then((saved) => {
        if (saved) {
            console.log("had saved data!");
            saved = JSON.parse(saved);
            this._syncAccumulator.accumulate({
                next_batch: saved.nextBatch,
                rooms: saved.rooms,
                groups: saved.groups,
                account_data: {
                    events: saved.account_data_events,
                },
            });
            saved.user_presence_events.forEach((userId, rawEvent) => {
                const u = new sdk.User(userId);
                if (rawEvent) {
                    u.setPresenceEvent(new sdk.MatrixEvent(rawEvent));
                }
                this._userModifiedMap[u.userId] = u.getLastModifiedTime();
                this.storeUser(u);
            });
        }
    }).catch((err) => {
        console.log(err.message);
    });
};
AsyncDBStore.prototype.getSavedSync = function() {
    console.log("getting saved sync")
    const data = this._syncAccumulator.getJSON();
    if (!data.nextBatch)
        return Promise.resolve(null);
    let copied = JSON.parse(JSON.stringify(data));
    return Promise.resolve(copied);
}
AsyncDBStore.prototype.isNewlyCreated = function() {
    console.log("getting is newly created")
    return RNFS.exists(rnfs_dir + '/persisted_data').then((exists) => !exists);
}
AsyncDBStore.prototype.getSavedSyncToken = function() {
    console.log("getting saved sync token")
    var token = this._syncAccumulator.getNextBatchToken();
    console.log(token);
    return Promise.resolve(token);
}
AsyncDBStore.prototype.deleteAllData = function() {
    throw 'hahahaha';
}
WRITE_DELAY_MS = 1000*60*1; // every minute
AsyncDBStore.prototype.wantsSave = function() {
    console.log("getting wantsSave")
    return Date.now() - this._syncTs > WRITE_DELAY_MS;
}
AsyncDBStore.prototype._reallySave = async function() {
    console.log("really saving")
    this._syncTs = Date.now();
    const syncData = this._syncAccumulator.getJSON();
    let saved = {
        nextBatch: syncData.nextBatch,
        rooms: syncData.roomsData,
        groups: syncData.groupsData,
        account_data_events: new Map(),
        user_presence_events: new Map(),
    };
    for (const u of this.getUsers()) {
        if (this._userModifiedMap[u.userId] === u.getLastModifiedTime())
            continue;
        if (!u.events.presence)
            continue;
        saved.user_presence_events.set(u.userId, u.events.presence.event);
        this._userModifiedMap[u.userId] = u.getLastModifiedTime();
    }

    for (let i = 0; i < syncData.accountData.length; i++) {
        saved.account_data_events.set(syncData.accountData[i].type, syncData.accountData[i]);
    }
    console.log("persisting data");
    await RNFS.writeFile(rnfs_dir + '/persisted_data', JSON.stringify(saved));
}
AsyncDBStore.prototype.save = function() {
    console.log("calling save")
    if (this.wantsSave()) {
        return this._reallySave();
    }
    return Promise.resolve();
}
AsyncDBStore.prototype.setSyncData = function(syncData) {
    console.log("calling setSyncData")
    return Promise.resolve().then(() => {
        this._syncAccumulator.accumulate(syncData)
    });
}
AsyncDBStore.prototype.getOutOfBandMembers = function(roomId) {
    console.log("getting oob_members")
    RNFS.readFile(rnfs_dir + '/oob_members_' + roomId).then(data => JSON.parse(data))
}
AsyncDBStore.prototype.setOutOfBandMembers = async function(roomId, membershipEvents) {
    console.log("setting oob_members")
    await RNFS.writeFile(rnfs_dir + '/oob_members_' + roomId, JSON.stringify(membershipEvents));
}
AsyncDBStore.prototype.clearOutOfBandMembers = async function(roomId) {
    console.log("clearing oob_members")
    await RNFS.unlink(rnfs_dir + '/oob_members_' + roomId);
}
AsyncDBStore.prototype.getClientOptions = function() {
    console.log("gettting client_options")
    RNFS.readFile(rnfs_dir + '/client_options').then(data => {
        console.log("the saved client_options are");
        JSON.parse(data);
    })
}
AsyncDBStore.prototype.storeClientOptions = async function(options) {
    console.log("setting client_options")
    await RNFS.writeFile(rnfs_dir + '/client_options', JSON.stringify(options));
}

function getStore() {
    console.log("getting store");
    return new AsyncDBStore();
}

async function loadCreds() {
    let homeserverUrl = await AsyncStorage.getItem('homeserverUrl');
    let userId = await AsyncStorage.getItem('userId');
    let accessToken = await AsyncStorage.getItem('accessToken');
    let deviceId = await AsyncStorage.getItem('deviceId');
    if (homeserverUrl && userId && accessToken && deviceId) {
        return {
                baseUrl: homeserverUrl,
                accessToken: accessToken,
                userId: userId,
                deviceId: deviceId,
            };
    } else {
        return null;
    }
}

async function saveCreds(homeserverUrl, userId, accessToken, deviceId) {
    await AsyncStorage.setItem('homeserverUrl', homeserverUrl);
    await AsyncStorage.setItem('userId', userId);
    await AsyncStorage.setItem('accessToken', accessToken);
    await AsyncStorage.setItem('deviceId', deviceId);
}

async function removeCreds() {
    await AsyncStorage.removeItem('homeserverUrl');
    await AsyncStorage.removeItem('userId');
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('deviceId');
}

export class LoginScreen extends React.Component {
    static navigationOptions = {
        title: 'Welcome',
    };
    constructor(props) {
        super(props);
        this.state = { homeserverUrl: "https://room409.xyz",
                       user: "miloignis",
                       password: "hunter2",
                       loggingIn: false,
        };
    }
    componentDidMount() {
        const {navigate} = this.props.navigation;
        loadCreds().then(creds => {
            if (creds != null) {
                console.log("NOWOW: Restoring previous session")
                this.setState((previousState) => ({loggingIn: true}));
                // put storage in here
                creds.store = getStore();
                client = sdk.createClient(creds)
                client.store.startup().then(() => {
                    client.startClient();
                    client.once('sync', (state, prevState, res) => {
                        console.log("all synced!")
                        this.setState((previousState) => ({loggingIn: false}));
                        navigate('Rooms', {somin: 'walla'})
                    })
                });
            } else {
                console.log("NOWOW: cannot restore previous session")
            }
        });
    }
    render() {
        const {navigate} = this.props.navigation;
        if (this.state.loggingIn) {
            return (
                <View>
                    <Text>Logging In!</Text>
                    <ActivityIndicator size="large" />
                </View>
            )
        } else {
            return (
                <View>
                    <TextInput
                        onChangeText={(text) => {
                            this.setState((previousState) => ({homeserverUrl: text}));
                        }}
                        defaultValue={this.state.homeserverUrl}
                    />
                    <TextInput
                        onChangeText={(text) => {
                            this.setState((previousState) => ({user: text}));
                        }}
                        defaultValue={this.state.user}
                    />
                    <TextInput
                        onChangeText={(text) => {
                            this.setState((previousState) => ({password: text}));
                        }}
                        defaultValue={this.state.password}
                    />
                    <Button
                        title="Login"
                        onPress={() => {
                            console.log("logging in with " + this.state.homeserverUrl + ", " + this.state.user + ", " + this.state.password)
                            let opts = { baseUrl: this.state.homeserverUrl };
                            opts.store = getStore();
                            client = sdk.createClient(opts);
                            client.login("m.login.password", {"user": this.state.user,
                                                              "password": this.state.password })
                                .then((response) => {
                                    console.log("logged in, have token: " + response.access_token)
                                    this.setState((previousState) => ({loggingIn: true}));
                                    saveCreds(this.state.homeserverUrl, response.user_id, response.access_token, response.device_id)
                                    client.store.startup().then(() => {
                                        client.startClient();
                                        client.once('sync', (state, prevState, res) => {
                                            console.log("all synced!")
                                            this.setState((previousState) => ({loggingIn: false}));
                                            navigate('Rooms', {somin: 'walla'})
                                        })
                                    });
                                });
                        } }
                    />
                </View>
            )
        }
    }
}
function getRooms() {
    return client.getRooms().sort((a,b) => {
                let aEvents = a.getLiveTimeline().getEvents();
                let aMsg = aEvents[aEvents.length-1];
                if (!aMsg) return 1;
                let bEvents = b.getLiveTimeline().getEvents();
                let bMsg = bEvents[bEvents.length-1];
                if (!bMsg) return -1;
                if (aMsg.getTs() > bMsg.getTs()) {
                    return -1;
                } else if (aMsg.getTs() < bMsg.getTs()) {
                    return 1;
                }
                return 0;
            }).map(room => ({key: room.roomId, title: room.name}))
}
export class RoomsScreen extends React.Component {
    static navigationOptions = {
        title: 'Rooms',
    };
    constructor(props) {
        super(props);
        this.state = {
            rooms: [],
        };
    }
    componentWillMount() {
        this.setState(previousState => ({ rooms: getRooms() }));
        client.on("Room.timeline", (event, room, toStartOfTimeline) => {
            //if (event.getType() == "m.room.message") {
                //NotificationsAndroid.localNotification({
                    //title: "First notification",
                    //body: event.getContent().body,
                    //extra: "data",
                //});
            //}
            this.setState(previousState => ({ rooms: getRooms() }));
        })
    }
    render() {
        const {navigate} = this.props.navigation;
        return (
            <View>
                <Button
                    title="Logout"
                    onPress={() => {
                        removeCreds();
                        client.removeAllListeners();
                        client = null;
                        navigate('Login');
                    } }
                />
                <FlatList
                    data={this.state.rooms}
                    renderItem={({item}) =>
                        <View style={ {padding: 10}}>
                            <TouchableWithoutFeedback
                                onPress={ () => navigate('Chat', {roomId: item.key}) }>
                                <Text>{item.title}</Text>
                            </TouchableWithoutFeedback>
                        </View>
                    }
                />
            </View>
        );
    }
}

import {createStackNavigator, createAppContainer} from 'react-navigation'
const MainNavigator = createStackNavigator({
    Login: {screen: LoginScreen},
    Rooms: {screen: RoomsScreen},
    Chat:  {screen: ChatScreen},
});
const App = createAppContainer(MainNavigator);
export default App;
