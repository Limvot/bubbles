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
import sdk from 'matrix-js-sdk'

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
                client = sdk.createClient(creds)
                client.startClient();
                client.once('sync', (state, prevState, res) => {
                    console.log("all synced!")
                    this.setState((previousState) => ({loggingIn: false}));
                    navigate('Rooms', {somin: 'walla'})
                })
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
                            client = sdk.createClient(this.state.homeserverUrl);
                            client.login("m.login.password", {"user": this.state.user,
                                                              "password": this.state.password })
                                .then((response) => {
                                    console.log("logged in, have token: " + response.access_token)
                                    this.setState((previousState) => ({loggingIn: true}));
                                    saveCreds(this.state.homeserverUrl, response.user_id, response.access_token, response.device_id)
                                    client.startClient();
                                    client.once('sync', (state, prevState, res) => {
                                        console.log("all synced!")
                                        this.setState((previousState) => ({loggingIn: false}));
                                        navigate('Rooms', {somin: 'walla'})
                                    })
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
