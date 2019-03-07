import React from 'react'
import { Button, Text, View, TextInput, FlatList, TouchableWithoutFeedback } from 'react-native';
import { GiftedChat } from 'react-native-gifted-chat'
import sdk from 'matrix-js-sdk'

let client = null

export class ChatScreen extends React.Component {
  state = {
    messages: [],
  }

  componentWillMount() {
    const roomId = this.props.navigation.getParam('roomId', 'NO-ID');
    const room = client.getRoom(roomId);
    let messages = room.getLiveTimeline().getEvents()
                       .filter(event => event.getType() == "m.room.message")
                       .reverse()
                       .map(event => {
                           let user = room.getMember(event.getSender());
                           return {
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
                       });

    this.setState({
      messages: messages
    });

  }

  onSend(messages = []) {
    this.setState(previousState => ({
      messages: GiftedChat.append(previousState.messages, messages),
    }))
  }

  render() {
    //const {navigate} = this.props.navigation;
    return (
      <GiftedChat
        messages={this.state.messages}
        onSend={messages => this.onSend(messages)}
        user={{
          _id: 1,
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
                    placeholder="server: https://room409.xyz"
                    onChangeText={(text) => {
                        this.setState((previousState) => ({server: text}));
                    }}
                    defaultValue={this.state.server}
                />
                <TextInput
                    placeholder="username: miloignis"
                    onChangeText={(text) => {
                        this.setState((previousState) => ({user: text}));
                    }}
                    defaultValue={this.state.user}
                />
                <TextInput
                    placeholder="password: hunter2"
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
                                })
                            });
                        navigate('Rooms', {somin: 'walla'})
                    } }
                />
            </View>
        );
    }
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
        client.on("Room.timeline", (event, room, toStartOfTimeline) => {
            console.log("got event!")
            console.log(event.event)
            this.setState(previousState => ({
                rooms: client.getRooms().map(room => ({key: room.roomId, title: room.name}))
            }));
        })
    }
    render() {
        const {navigate} = this.props.navigation;
        return (
            <View>
                <Text>Room list!</Text>
                <FlatList
                    data={this.state.rooms}
                    renderItem={({item}) =>
                        <TouchableWithoutFeedback
                            onPress={ () => navigate('Chat', {roomId: item.key}) }>
                        
                            <Text>{item.key + "/" + item.title}</Text>
                        </TouchableWithoutFeedback>
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
