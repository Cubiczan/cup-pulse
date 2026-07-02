const PearRuntime = require('pear-runtime')
const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const goodbye = require('graceful-goodbye')
const FramedStream = require('framed-stream')
const path = require('bare-path')

const seed = require('./seed.json')

const pipe = new FramedStream(Bare.IPC)

const updaterConfig = {
  dir: Bare.argv[2],
  app: Bare.argv[3],
  updates: Bare.argv[4] !== 'false',
  version: Bare.argv[5],
  upgrade: Bare.argv[6],
  name: Bare.argv[7]
}

const ROOM_TOPIC = Buffer.alloc(32).fill('cup-pulse-pear-room-v1')

const store = new Corestore(path.join(updaterConfig.dir, 'pear-runtime/corestore'))
const appStore = new Corestore(path.join(updaterConfig.dir, 'cup-pulse', 'corestore'))
const swarm = new Hyperswarm()
const pear = new PearRuntime({ ...updaterConfig, swarm, store })

let cupCore = null
let latestState = null
let cupReady = null

pear.updater.on('error', console.error)

function replicate(connection) {
  store.replicate(connection)
  appStore.replicate(connection)
}

if (updaterConfig.updates !== false) {
  swarm.on('connection', replicate)
  swarm.join(pear.updater.drive.core.discoveryKey, { client: true, server: false })
}

function send(message) {
  pipe.write(JSON.stringify(message))
}

function clone(data) {
  return JSON.parse(JSON.stringify(data))
}

function peerCount() {
  return swarm.connections ? swarm.connections.size : 0
}

function broadcastPeers() {
  send({ type: 'peers', count: peerCount() })
}

async function readLatestState() {
  if (!cupCore || cupCore.length === 0) return clone(seed)
  const block = await cupCore.get(cupCore.length - 1)
  return JSON.parse(block.toString())
}

async function writeState(data) {
  latestState = data
  await cupCore.append(Buffer.from(JSON.stringify(data)))
}

async function onCoreAppend() {
  const state = await readLatestState()
  latestState = state
  send({ type: 'state', data: state })
}

async function initCupCore() {
  if (cupReady) return cupReady

  cupReady = (async () => {
    cupCore = appStore.get({ name: 'cup-pulse-state' })
    await cupCore.ready()
    await swarm.join(ROOM_TOPIC, { server: true, client: true })
    cupCore.on('append', onCoreAppend)
    latestState = await readLatestState()
    broadcastPeers()
  })()

  return cupReady
}

console.log('Cup Pulse worker storage:', pear.storage)

pear.updater.on('updating', () => pipe.write('updating'))
pear.updater.on('updated', () => pipe.write('updated'))

goodbye(async () => {
  if (cupCore) cupCore.removeListener('append', onCoreAppend)
  await swarm.destroy()
  await pear.close()
  await appStore.close()
  await store.close()
})

pipe.on('data', async (data) => {
  const raw = data.toString()

  if (raw === 'pear:applyUpdate') {
    await pear.updater.applyUpdate()
    pipe.write('pear:updateApplied')
    return
  }

  let message
  try {
    message = JSON.parse(raw)
  } catch {
    console.log('worker ipc:', raw)
    return
  }

  try {
    await initCupCore()

    if (message.type === 'getState') {
      send({ type: 'state', data: latestState })
      return
    }

    if (message.type === 'setState') {
      await writeState(message.data)
      send({ type: 'state', data: latestState })
      return
    }

    if (message.type === 'addPrediction') {
      const state = clone(latestState)
      state.opportunities.push(message.prediction)
      await writeState(state)
      send({ type: 'state', data: latestState })
    }
  } catch (err) {
    console.error('Cup sync error:', err)
    send({ type: 'error', message: err.message })
  }
})

swarm.on('connection', () => broadcastPeers())

initCupCore()
  .then(() => send({ type: 'ready' }))
  .catch((err) => {
    console.error('Cup sync init failed:', err)
    send({ type: 'error', message: err.message })
  })
