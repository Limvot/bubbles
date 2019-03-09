import React from 'react'
import { Button, Text, View, TextInput, FlatList, TouchableWithoutFeedback, YellowBox } from 'react-native';
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

export class LoginScreen extends React.Component {
    static navigationOptions = {
        title: 'Welcome',
    };
    constructor(props) {
        super(props);
        this.state = { server: "https://room409.xyz",
                       user: "miloignis",
                       password: "hunter2",
        };
    }
    render() {
        const {navigate} = this.props.navigation;
        return (
            <View>
                <TextInput
                    onChangeText={(text) => {
                        this.setState((previousState) => ({server: text}));
                    }}
                    defaultValue={this.state.server}
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
                        console.log("logging in with " + this.state.server + ", " + this.state.user + ", " + this.state.password)
                        client = sdk.createClient(this.state.server);
                        client.login("m.login.password", {"user": this.state.user,
                                                          "password": this.state.password })
                            .then((response) => {
                                console.log("logged in, have token: " + response.access_token)
                                client.startClient();
                                client.once('sync', (state, prevState, res) => {
                                    console.log("all synced!")
                                    navigate('Rooms', {somin: 'walla'})
                                })
                            });
                    } }
                />
            </View>
        );
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
