import Room from 'ipfs-pubsub-room'
import IPFS from 'ipfs'

import {
  fromEvent,
  merge
} from 'rxjs'

import {
  map,
  filter
} from 'rxjs/operators'

const q = (selector) => document.querySelector(selector)

const ipfs = new IPFS({
  EXPERIMENTAL: {
    pubsub: true
  },
  config: {
    Addresses: {
      Swarm: [
        '/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star'
      ]
    }
  }
})

const state = {
  messageThread: [],
  peerList: [],
  peerMap: new Map(),
  profile: {}
}

// post message events
const postMessageButtonEvents = fromEvent(q('#submit'), 'click')
const postMessageEnterEvents = fromEvent(q('#input'), 'keyup')
  .pipe(
    filter(event => event.code === 'Enter')
  )

const postMessageEvents = merge(
  postMessageButtonEvents,
  postMessageEnterEvents
)

// render peers list
const renderPeerList = (peers) => {
  q('#list').innerHTML = `<ul>${
    peers
      .map(peerId => {
        let profile = state.peerMap.get(peerId)
        return `<li>${profile && profile.nick || 'anonymous'}</li>`
      })
  }</ul>`
}

// render chat thread
const renderMessageThread = (messages) => {
  q('#main').innerHTML = `<ul>${
    messages
      .map(message => {
        let peer = state.peerMap.get(message.id)
        let nick = peer && peer.nick
        return `
	      <li>
	        <span>${nick || 'anonymous'}: ${message.content.message}</span>
	      </li>
	    `
      }).join('')
  }< /ul>`
}

  const broadcast = (room, message) => {
  room.broadcast(message)
}

const broadcastChatMessage = (room, message) => {
  broadcast(room, JSON.stringify({
    type: 'chat',
    message: message
  }))
}

const broadcastNickChange = (room, nick) => {
  broadcast(room, JSON.stringify({
    type: 'nickchange',
    nick: nick
  }))
}

ipfs.on('ready', () => {
  const room = Room(ipfs, 'koji')

  room.on('peer joined', (peerId) => {
    // add to peer list
    state.peerList = [...state.peerList, peerId]

    // add record in peer map
    state.peerMap.set(peerId, {
      ...state.peerMap.get(peerId),
      ...{
        id: peerId
      }
    })

    renderPeerList(state.peerList)
    console.log('Peer joined the room', peerId)
  })

  room.on('peer left', (peerId) => {
    // remove from peer list
    state.peerList = state.peerList
      .filter(id => id !== peerId)

    // remove record from peer map
    state.peerMap.delete(peerId)

    renderPeerList(state.peerList)
    console.log('Peer left...', peerId)
  })

  room.on('subscribed', (roomId) => {
    console.log('Now connected:', roomId)
  })

  room.on('message', (message) => {
    let data = new TextDecoder('utf-8').decode(message.data)
    let payload = JSON.parse(data)

    // handle chat message
    if (payload.type === 'chat') {
      state.messageThread = [
        ...state.messageThread,
        {
          id: message.from,
          content: payload.message
        }
      ]

      renderMessageThread(state.messageThread)
    }

    // handle handle nick change
    if (payload.type === 'nickchange') {
      state.peerMap.set(message.from, {
        id: message.from,
        nick: payload.nick
      })

      renderPeerList(state.peerList)
      console.log(state.peerList)
    }
  })

  // Post Message
  postMessageEvents
    .pipe(
      map(event => q('#input')),
      map(input => input.value),
      filter(msg => msg)
    )
    .subscribe((message) => {
      console.log('postMessage', message)

      // broadcast message
      broadcastChatMessage(room, {
        message: message
      })

      // clear and focus input
      let input = q('#input')
      input.value = ''
      input.focus()
    })

  // Nick Change
  fromEvent(q('#nick'), 'change')
    .pipe(
      map(event => event.target),
      map(target => target.value)
    )
    .subscribe((nick) => {
      console.log('nickChange', nick)

      // set nick
      state.profile = {
        ...state.profile,
        ...{
          nick: nick
        }
      }

      // broadcast nick change
      broadcastNickChange(room, nick)
    })
})
