import * as net from 'net'
import { common } from '../../utils/constants'
import { IMpsProxy } from './ImpsProxy'
import { APFProtocol } from "../../models/Mps"
import { getDistributedKV } from "../../utils/IDistributedKV"
import { MPSMicroservice } from '../../mpsMicroservice'
import { logger as log } from "../../utils/logger";

const MPS_MESSAGE_HEADER_LENGTH = 85;
const MPS_DISCONNECT_MESSAGE_HEADER_LENGTH = 77;
const MPS_SERVER_MSG_CHANNELID_INDEX = 77;
const MPS_SERVER_MSG_DATALENGTH_INDEX = 81;
const MPS_SERVER_MSG_UUID_START_INDEX = 5;
const MPS_SERVER_MSG_UUID_LENGTH = 72;
const MPS_SERVER_MSG_TYPE_INDEX = 4;
const MPS_SERVER_MSG_TYPE_DATA_START = 81;
const MPS_PROXY_MSG_DATA_INDEX = 85;
const MPS_DEVICE_DISCONNECT_LENGTH = 77;
const MPS_STATE_CHANGE_MSG_LENGTH = 81;

export class MpsProxy implements IMpsProxy {
  static proxies: any = {}
  socket: any
  first: any
  clientCert: any
  accumulator: any
  activetunnels: any
  boundPorts: []
  host: any
  nextchannelid: any
  channels: {}
  nextsourceport: any
  nodeid: any
  static sockets: any = {}
  static guidSockets: any = {}
  mpsService: MPSMicroservice
  ciraChannel: any
  readyState: any
  constructor(guid, mpsService: MPSMicroservice, socket) {
    this.mpsService = mpsService;
    this.socket = socket;
    //this.tag = { first: true, clientCert: null, accumulator: "", activetunnels: 0, boundPorts: [], host: null, nextchannelid: 4, channels: {}, nextsourceport: 0 };
    this.first = true;
    this.clientCert = null;
    this.accumulator = "";
    this.activetunnels = 0;
    this.boundPorts = [];
    this.host = guid;
    this.nextchannelid = 4;
    this.channels = {};
    this.nextsourceport = 0
    this.ciraChannel = null;
    this.readyState = "";
  }

  destroy() {
    // Send CHANNEL_OPEN msg to webProxy.
    this.socket.write(
      Buffer.from( // message header length
        common.IntToStr(MPS_DISCONNECT_MESSAGE_HEADER_LENGTH) +
        // Channel Open
        String.fromCharCode(APFProtocol.DISCONNECT) +
        // UUID
        common.rstr2hex(this.host), 'binary')

    );
  }

  static processCommand = (socket) => {

    let len = socket.tag.accumulator.length;
    let data = socket.tag.accumulator;
    // Nothing to process
    if (len < 4) {
      return 0;
    }

    let thisMsgLength = common.ReadInt(data, 0);
    log.silly(`Length of this message ${thisMsgLength} from server ${socket.tag.ip}`)

    // if we have not received the complete message in this packet, accumulate
    if (thisMsgLength > data.length) {
      log.silly(`length of message to process is less than or equal to the required message length, add to acc`)
      return 0;
    }
    // process the message further
    else {
      // Received Message format as below:
      // ResponseType - data, channelOpen, ChannelClose, deviceDisconnect, 
      // UUID
      // ChannelID
      // data
      let msgType = data.charCodeAt(MPS_SERVER_MSG_TYPE_INDEX);
      log.silly(`MpsProxy received message type: ${msgType}`);

      // UUID
      let uuidHex = '';
      // read hex data from message
      for (let index = MPS_SERVER_MSG_UUID_START_INDEX;
        index <= MPS_SERVER_MSG_UUID_START_INDEX + MPS_SERVER_MSG_UUID_LENGTH;
        ++index) {
        uuidHex += data[index];
      }
      let uuid = common.hex2rstr(uuidHex);
      log.silly(`MpsProxy received uuid: ${uuid}`);

      if (APFProtocol.CHANNEL_OPEN === msgType) {
        log.silly(`Channel opened msg received for ${uuid}`);

        // get channelId
        let mpsproxyChannelid = common.ReadInt(data, MPS_SERVER_MSG_CHANNELID_INDEX);
        log.silly(`MpsProxy received Channelid: ${mpsproxyChannelid}`);
        // find the corresponding MpsProxy object
        let mpsproxyObject = MpsProxy.proxies[uuid];
        if ('undefined' !== typeof mpsproxyObject) {
          if (mpsproxyObject.channels[mpsproxyChannelid].onStateChange)
            mpsproxyObject.channels[mpsproxyChannelid].onStateChange(mpsproxyObject.socket, 2)
          else
            log.silly(`this.channels[$(mpsproxyChannelid}].onStateChange undefined`)
        }
        else {
          log.debug(`received message for ${uuid} do not have MpsProxy Object`);
        }
        return MPS_STATE_CHANGE_MSG_LENGTH;
      }
      else if (APFProtocol.CHANNEL_CLOSE === msgType) {
        log.silly(`Channel Closed msg received for ${uuid}`);
        // get channelId
        let mpsproxyChannelid = common.ReadInt(data, MPS_SERVER_MSG_CHANNELID_INDEX);
        log.silly(`MpsProxy received Channelid: ${mpsproxyChannelid}`);

        // find the corresponding MpsProxy object
        let mpsproxyObject = MpsProxy.proxies[uuid];
        if ('undefined' !== typeof mpsproxyObject) {
          if ('undefined' === typeof mpsproxyObject.channels[mpsproxyChannelid]) {
            log.silly(`channel ${mpsproxyChannelid} do not exists`)
          }
          else {
            if (mpsproxyObject.channels[mpsproxyChannelid].onStateChange)
              mpsproxyObject.channels[mpsproxyChannelid].onStateChange(mpsproxyObject.socket, 0);
            delete mpsproxyObject.channels[mpsproxyChannelid];
          }
        }
        else {
          log.debug(`received message for ${uuid} do not have MpsProxy Object`);
        }
        return MPS_STATE_CHANGE_MSG_LENGTH;
      }
      else if (APFProtocol.CHANNEL_DATA === msgType) {
        log.silly(`data received for ${uuid}`);
        // get channelId
        let mpsproxyChannelid = common.ReadInt(data, MPS_SERVER_MSG_CHANNELID_INDEX);
        log.silly(`MpsProxy received Channelid: ${mpsproxyChannelid}`);

        // get data length
        let dataLength = common.ReadInt(data, MPS_SERVER_MSG_DATALENGTH_INDEX);
        log.silly(`MpsProxy received application data of length: ${dataLength}`);

        // find the corresponding MpsProxy object
        let mpsproxyObject = MpsProxy.proxies[uuid];
        if ('undefined' !== typeof mpsproxyObject) {
          if ('undefined' === typeof mpsproxyObject.channels[mpsproxyChannelid]) {
            log.debug(`channel ${mpsproxyChannelid} do not exists`)
          }
          else {
            if (mpsproxyObject.channels[mpsproxyChannelid].onData) {
              // get data
              let msgData = '';
              // read hex data from message
              for (let index = MPS_PROXY_MSG_DATA_INDEX;
                index < MPS_PROXY_MSG_DATA_INDEX + dataLength;
                index++) {
                msgData += data[index];
              }
              // write data
              mpsproxyObject.channels[mpsproxyChannelid].onData(mpsproxyObject.socket, msgData)
            }
          }
        }
        else {
          log.debug(`received message for ${uuid} do not have MpsProxy Object`);
        }
        return MPS_MESSAGE_HEADER_LENGTH + dataLength;
      }
      else if (APFProtocol.DISCONNECT === msgType) {
        log.silly(`Device ${uuid} Closed`);

        // find the corresponding MpsProxy object
        let mpsproxyObject = MpsProxy.proxies[uuid];
        if ('undefined' !== typeof mpsproxyObject) {
          if (mpsproxyObject.mpsService.CIRADisconnected)
            mpsproxyObject.mpsService.CIRADisconnected(uuid);
        }
        else {
          log.debug(`received message for ${uuid} do not have MpsProxy Object`);
        }
        return MPS_DEVICE_DISCONNECT_LENGTH;
      }
      else {
        log.error(`MpsProxy: Unknown response type received`);
      }
    }
  }

  static onData(data, mpsServerSocket) {
    log.silly(`received packet of length: ${data.length}`);
    mpsServerSocket.tag.accumulator += data;

    try {
      // Parse all of the APF data we can
      let l = 0;
      do {
        l = this.processCommand(mpsServerSocket);
        if (l > 0) { mpsServerSocket.tag.accumulator = mpsServerSocket.tag.accumulator.substring(l); }
      } while (l > 0);
      if (l < 0) { mpsServerSocket.end() }
    } catch (e) {
      log.error(`MpsProxy:onData: ${e}`)
    }
  }

  SetupCiraChannel(targetport, uuid): any {
    log.silly(`call to SetupCiraChannel targetport:${targetport}, uuid:${uuid}`)
    let currChannel = this.nextchannelid;
    let ciraChannel = {
      targetport: targetport,
      channelid: this.nextchannelid++,
      socket: this.socket,
      state: 1,
      sendcredits: 0,
      amtpendingcredits: 0,
      amtCiraWindow: 0,
      ciraWindow: 32768,
      write: (data) => {
        log.silly(`write data on socket ${data}`)
        try {
          this.socket.write(// message header length      
            Buffer.from(
              common.IntToStr(MPS_MESSAGE_HEADER_LENGTH + data.length) +
              // Channel Open
              String.fromCharCode(APFProtocol.CHANNEL_DATA) +
              // UUID
              common.rstr2hex(ciraChannel.nodeId) +
              //  target port
              common.IntToStr(ciraChannel.channelid) +

              common.IntToStr(data.length) +

              data, 'binary')
          )
        } catch (error) {
          log.error(`SetupCiraChannel write exception: ${error}`);
        }
      },
      sendBuffer: undefined,
      amtchannelid: undefined,
      close: () => {
        log.silly(`channel close for ${ciraChannel.nodeId}`)
        this.WriteCloseChannel(ciraChannel)
      },
      closing: undefined,
      onStateChange: undefined,
      onData: undefined,
      nodeId: uuid
    };

    // Send CHANNEL_OPEN msg to webProxy.
    this.WriteSetupChannel(ciraChannel, targetport);

    if (typeof this.channels === 'undefined') {
      log.silly('SetupCiraChannel: this.channels is undefined')
    }
    this.channels[currChannel] = ciraChannel;
    return this.channels[currChannel];
  }

  WriteSetupChannel(ciraChannel, targetport) {
    try {
      this.socket.write(
        Buffer.from(
          // message header length
          common.IntToStr(MPS_MESSAGE_HEADER_LENGTH) +
          // Channel Open
          String.fromCharCode(APFProtocol.CHANNEL_OPEN) +
          // UUID
          common.rstr2hex(ciraChannel.nodeId) +
          //  target port
          common.IntToStr(ciraChannel.channelid) +
          //  Channelid
          common.IntToStr(targetport), 'binary')
      )
    } catch (error) {
      log.error(`WriteSetupChannel exception: ${error}`);
    }
  }

  WriteCloseChannel(ciraChannel) {
    try {
      this.socket.write(
        Buffer.from(
          // message header length
          common.IntToStr(MPS_MESSAGE_HEADER_LENGTH) +
          // Channel Open
          String.fromCharCode(APFProtocol.CHANNEL_CLOSE) +
          // UUID
          common.rstr2hex(ciraChannel.nodeId) +
          //  target port
          common.IntToStr(ciraChannel.channelid), 'binary')
      )
    } catch (error) {
      log.error(`WriteCloseChannel exception`);
    }
  }

  static async getSocketForGuid(hostGuid: string, mpsservice: MPSMicroservice) {

    // get MPS server IP
    let mpsServerIP: string = await getDistributedKV(mpsservice).lookup(hostGuid)
    log.silly(`MPS Server IP fetched from distrubuted KV: ${mpsServerIP}`);

    // Global is a list of Global static variables
    if (typeof MpsProxy.sockets[mpsServerIP] === 'undefined') {
      log.silly(`Create socket for ${mpsServerIP}`);
      let mpsServerSocket: any = new net.Socket();
      mpsServerSocket.setEncoding('binary');
      // connect on the device

      mpsServerSocket.connect(mpsservice.config.web_proxy_port, mpsServerIP, function () {
        // add accumulator
        mpsServerSocket.tag = {};
        mpsServerSocket.tag.accumulator = '';
        mpsServerSocket.tag.ip = mpsServerIP;
        log.silly(`Connected to mpsServer on socket for device ${hostGuid} at IP ${mpsServerIP}`)
      })

      mpsServerSocket.on('error', (err) => {
        log.error(`mps proxy error: ${err}`)
      })

      mpsServerSocket.on('close', () => {
        log.silly(`MPS Server Socket closed. Clean up MPS Proxy state.`)
        if (!mpsServerSocket.destroyed) {
          mpsServerSocket.destroy();
          log.silly(`MPS Server Socket destroyed.`);
        }
        delete MpsProxy.sockets[mpsServerIP]
      })
      mpsServerSocket.on('timeout', () => {
        log.silly(`MPS Server Socket closed. Clean up MPS Proxy state.`)
        if (!mpsServerSocket.destroyed) {
          mpsServerSocket.destroy();
          log.silly(`MPS Server Socket destroyed.`);
        }
        delete MpsProxy.sockets[mpsServerIP]
      })
      mpsServerSocket.setKeepAlive(true, 5000);
      mpsServerSocket.on("data", (data) => MpsProxy.onData(data, mpsServerSocket))
      MpsProxy.sockets[mpsServerIP] = mpsServerSocket
    }
    else {
      log.silly(`Socket already exists for ${mpsServerIP}, need to use the same`);
      // Global is a list of Global static variables
      if (typeof MpsProxy.guidSockets[hostGuid] === 'undefined') {
        log.silly(`map ${hostGuid} with socket on ${mpsServerIP}`);
        MpsProxy.guidSockets[hostGuid] = MpsProxy.sockets[mpsServerIP]
      }
      else {
        log.silly(`need to re-map ${hostGuid} with socket on ${mpsServerIP} if destroy`);
        if (MpsProxy.guidSockets[hostGuid].destroyed) { // Prev reference I had was destroyed. get the new one.
          log.silly(`need to re-map ${hostGuid} with socket on ${mpsServerIP}`);
          MpsProxy.guidSockets[hostGuid] = MpsProxy.sockets[mpsServerIP] // get the latest
        }
      }

      return MpsProxy.guidSockets[hostGuid]
    }
  }

  static async get(mpsService: MPSMicroservice, guid: string) {
    // get socket; talk to webProxy
    let socket = await MpsProxy.getSocketForGuid(guid, mpsService);

    if (typeof MpsProxy.proxies[guid] === 'undefined' || MpsProxy.proxies[guid].socket?.destroyed) {
      log.silly(`Create new MpsProxy object for ${guid}`)
      MpsProxy.proxies[guid] = new MpsProxy(guid, mpsService, socket);
      MpsProxy.proxies[guid].readyState = 'open';
    }

    return MpsProxy.proxies[guid]
  }
}
