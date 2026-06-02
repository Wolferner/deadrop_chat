# deadrop_chat — P2P Encrypted Terminal Chat

**Date:** 2026-06-02
**Status:** Approved

## Overview

A terminal REPL application for P2P encrypted chat. Every running instance is simultaneously a chat client and a DHT node — no central server required. Inspired by Signal's privacy model and IRC's interface.

## Goals

- End-to-end encrypted messages (server cannot read content)
- Metadata protection: DHT stores `hash(pseudonym)` not real names
- Anyone can run a headless bootstrap node
- Both DM (1:1) and rooms (group pub/sub)
- Single binary: `deadrop` (REPL) or `deadrop --headless` (node only)

## Non-Goals (v1)

- Tor integration (planned as future layer C)
- Admin API for headless nodes (planned separately)
- Message history sync across devices
- Mobile or web client

## Architecture

### Single Program, Two Modes

```
deadrop              # REPL client + DHT node
deadrop --headless   # DHT node only (no UI, logs to stdout)
```

Every instance participates in the DHT and helps route peer discovery. Headless nodes serve as stable bootstrap points, managed via pm2 or systemd on remote servers.

### Network Flow

```
Node starts
  → load/generate identity from ~/.deadrop/identity.json
  → connect to bootstrap peers (hardcoded + ~/.deadrop/config.json overrides)
  → join DHT, announce hash(pseudonym) → peerId

DM:
  user types "hello"
  → find hash(target-pseudonym) in DHT → get multiaddr
  → open direct Noise-encrypted stream
  → send signed, encrypted packet
  → recipient verifies Ed25519 signature → display

Room:
  user types "hello"
  → GossipSub publishes to topic hash(room-name)
  → libp2p mesh delivers to all subscribed peers
  → each peer verifies signature → display
```

### No Central Message Relay

Bootstrap/DHT nodes only participate in peer discovery routing. Message packets travel directly between peers via libp2p streams. A headless node never receives or forwards message payloads.

## Identity

Stored in `~/.deadrop/identity.json`, created on first run:

```typescript
{
  pseudonym: string,      // user-chosen nickname
  privateKey: Uint8Array, // Ed25519, never leaves device
  publicKey: Uint8Array,  // Ed25519, shared with peers
  peerId: string          // libp2p PeerId derived from publicKey
}
```

## Cryptography

| Layer           | Algorithm                   | Purpose                                                                                    |
| --------------- | --------------------------- | ------------------------------------------------------------------------------------------ |
| Transport       | Noise Protocol (via libp2p) | Encrypt all peer connections                                                               |
| Message signing | Ed25519 (`@noble/ed25519`)  | Verify sender identity (authenticity, not confidentiality — Noise handles confidentiality) |
| DHT keys        | SHA-256 hash of pseudonym   | Hide real names from DHT                                                                   |
| Room topics     | SHA-256 hash of room name   | Hide room names from DHT                                                                   |

## Message Packet Format

```typescript
{
  type: "dm" | "room",
  topic: string,         // hash(pseudonym) or hash(room-name)
  payload: Uint8Array,   // encrypted text
  signature: Uint8Array, // Ed25519 signature of payload
  senderKey: Uint8Array, // sender's Ed25519 public key
  timestamp: number
}
```

Validation via Zod at the network boundary (infrastructure layer).

## REPL Interface

Built on Node.js `readline` + `chalk` (no external UI framework).

### Startup Banner

```
deadrop v0.1.0
Identity: wolf [a3f9b2...]
Network: connecting... connected (12 peers)

Type /help for commands
>
```

### Commands

```
/join <room>          join or create a room
/leave                leave current room
/rooms                list joined rooms
/msg <pseudonym>      open DM with a peer
/who                  list members in current room
/peers                show connected peer count
/connect <multiaddr>  connect to a peer directly
/help                 show commands
/quit                 exit
```

### Chat Mode

After `/join` or `/msg`, free text is sent directly:

```
[#general] > hello everyone
[#general] wolf: hello everyone
[#general] alice: hey, new here?
```

### Chalk Color Scheme

- System messages: grey
- Peer nicknames: deterministic color from hash(pseudonym)
- Errors: red
- Incoming DMs: highlighted (bold or yellow)
- Timestamps: dim grey

## Project Structure

Follows existing DDD layout in the repo:

```
src/
  domain/
    entities/
      identity.ts
      message.ts
      room.ts
    value-objects/
      pseudonym.ts        # validation + SHA-256 hashing
      peer-address.ts     # multiaddr wrapper
  application/
    use-cases/
      send-message.ts
      join-room.ts
      find-peer.ts
    repositories/
      identity-repository.ts
      peer-repository.ts
  infrastructure/
    libp2p/
      node.ts             # create and configure libp2p node
      pubsub.ts           # GossipSub for rooms
      dht.ts              # peer discovery
    storage/
      file-identity-repository.ts   # ~/.deadrop/identity.json
      file-peer-repository.ts       # ~/.deadrop/peers.json
    repl/
      cli.ts              # readline REPL + chalk rendering
      commands.ts         # command parsing and dispatch
  index.ts                # entrypoint: REPL or --headless
```

## Dependencies

### Add

```
@libp2p/libp2p       P2P networking core
@libp2p/kad-dht      DHT for peer discovery
@libp2p/gossipsub    pub/sub for rooms
@libp2p/noise        Noise Protocol transport encryption
@libp2p/tcp          TCP transport
@libp2p/bootstrap    initial bootstrap peer connection
@noble/ed25519       Ed25519 message signing
chalk                terminal colors
multiformats         multiaddr/CID utilities (libp2p ecosystem)
```

### Remove

```
fastify              not needed — this is a P2P CLI, not an HTTP server
```

### Keep

```
zod                  validate incoming network packets at boundary
tsx, typescript, vitest, eslint, prettier, husky
```

## Bootstrap Peers and Peer Discovery

### How nodes find each other

**First run — bootstrap:**
Several stable node addresses are hardcoded in the source (like Bitcoin seed nodes). A new client connects to one of them to enter the network. These addresses can be overridden via `~/.deadrop/config.json`.

**After connecting — Kademlia DHT:**
libp2p runs the Kademlia protocol. Each node stores a partial routing table — it knows the addresses of peers "nearest" to it in the DHT keyspace. When looking up a peer, requests hop across nodes until the target is found. No single node knows everyone; knowledge is distributed.

**Subsequent runs:**
After the first connection the node saves known peers to `~/.deadrop/peers.json`. On next startup it connects to those directly, skipping bootstrap.

```
First run:
  app → bootstrap node → DHT → learns N peers → saves to peers.json

Next run:
  app → peers.json → DHT → refreshes peer list
```

**Who can be a bootstrap node?**
Anyone running `deadrop --headless` on a server with a static IP. Their multiaddr can be added to the default hardcoded list (via PR) or configured locally in `~/.deadrop/config.json`.

## Offline Message Handling

If a peer is offline when a DM is sent, the message is not silently dropped:

1. Delivery attempt fails → message displayed as `[undelivered]` in the terminal
2. Message saved locally to `~/.deadrop/outbox.json`, encrypted with sender's own key
3. User manually retries via `/retry` command or by resending the message
4. On successful delivery, message removed from outbox

No automatic retry on peer reconnect — the user decides when to resend.

Room messages are not stored in the outbox: if a peer misses a room message while offline, it is gone (no history sync in v1).

New command added to REPL:

```
/outbox       show list of undelivered messages
/retry <id>   resend a specific undelivered message
```

## Future Work

- **Level C anonymity**: Tor transport via `@libp2p/tor` (drop-in transport layer)
- **Headless admin**: local HTTP API + `deadrop admin` CLI commands
- **Message history**: optional local encrypted storage
