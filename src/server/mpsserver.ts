/*********************************************************************
* Copyright (c) Intel Corporation 2018-2019
* SPDX-License-Identifier: Apache-2.0
**********************************************************************/

/* Construct a Intel AMT MPS server object
    Note:
        Functionality has been modified for standalone operation only (Meshcentral services will not work with this code)
    Parameters:
        parent (mpsMicroservice): parent service invoking this module (provides eventing and wiring services)
        db: database for credential and allowlisting
        config: settings pertaining to the behaviour of this service
        certificates: certificates to use for TLS server creation
*/

/**
* @description Intel AMT MPS server object
* @author Ylian Saint-Hilaire
* @version v0.2.0c
*/

import * as net from 'net'
import * as tls from 'tls'

import { configType, certificatesType } from '../models/Config'
import { APFProtocol, APFChannelOpenFailureReasonCode } from '../models/Mps'
import { logger as log } from '../utils/logger'
import { MPSMicroservice } from '../mpsMicroservice'
import { IDbProvider } from '../models/IDbProvider'

const common = require('../utils/common.js')
// 90 seconds max idle time, higher than the typical KEEP-ALIVE period of 60 seconds
const MAX_IDLE = 90000
const MPS_PROXY_MSG_HEADER_LENGTH = 85
const MPS_PROXY_MSG_TYPE_INDEX = 4
const MPS_PROXY_MSG_UUID_START_INDEX = 5
const MPS_PROXY_MSG_UUID_LENGTH = 72
const MPS_PROXY_MSG_CHANNELID_INDEX = 77
const MPS_PROXY_MSG_TARGET_PORT_INDEX = 81
const MPS_PROXY_MSG_DATA_LENGTH_INDEX = 81
const MPS_PROXY_MSG_DATA_INDEX = 85
const MPS_STATE_CHANGE_MSG_LENGTH = 81
const MPS_DATA_MSG_HEADER_LENGTH = 85
const MPS_DEVICE_DISCONNECT_LENGTH = 77

export class mpsServer {

  db: IDbProvider;
  mpsService: MPSMicroservice;
  config: configType;
  certs: certificatesType;
  ciraConnections = {};
  server: any;
  webProxy: any
  onCiraDisconnect: any
  onCiraChannelClose: any
  allSockets: any
  constructor(mpsService: MPSMicroservice) {
    this.mpsService = mpsService
    this.db = mpsService.db
    this.config = mpsService.config
    this.certs = mpsService.certs
    this.allSockets = {}

    if (this.config.tls_offload) {
      // Creates a new TCP server
      this.server = net.createServer((socket) => {
        this.onConnection(socket)
      })
    } else {
      // Creates a TLS server for secure connection
      this.server = tls.createServer(this.certs.mps_tls_config, (socket) => {
        this.onConnection(socket)
      });
    }

    //hook up cira disconnect event handler
    this.onCiraDisconnect = (nodeid) => { // On AMT Device Disconnection
      log.silly(`onCiraDisconnect for nodeid=${nodeid}`)
      try {
        if (this.ciraConnections[nodeid] != null) {
          delete this.ciraConnections[nodeid]
        }
      }
      catch (e) { log.error(`onCiraDisconnect: ${e}`) }

      Object.keys(this.allSockets).map((key) => {
        let socket = this.allSockets[key] // todo: check if socket is open


        try {
          // Write connection state back to the web proxy using helper methods
          this.Write(
            socket,
            common.IntToStr(MPS_DEVICE_DISCONNECT_LENGTH) +
            String.fromCharCode(APFProtocol.DISCONNECT) +
            common.rstr2hex(nodeid)
          );
          log.silly(`${socket.remoteAddress}:${socket.remotePort}: device disconnected for ${nodeid}`)
        } catch (e) {
          log.error(`write connection state back to web proxy error: ${e}`);
        }
        try {
          log.silly(`${socket.remoteAddress}:${socket.remotePort}: onCiraDisconnect:delete amtMpsproxyChannelMapping and mpsproxyAmtChannelMapping`)
          // delete mapping for the uuid
          if (socket.tag.amtMpsproxyChannelMapping[nodeid] != null) {
            delete socket.tag.amtMpsproxyChannelMapping[nodeid]
          }
          if (socket.tag.mpsproxyAmtChannelMapping[nodeid] != null) {
            delete socket.tag.mpsproxyAmtChannelMapping[nodeid]
          }
          log.silly(`${socket.remoteAddress}:${socket.remotePort}: onCiraDisconnect:deleted amtMpsproxyChannelMapping and mpsproxyAmtChannelMapping`)
        }
        catch (e) {
          log.error(`${socket.remoteAddress}:${socket.remotePort}: onCiraDisconnect: exception caught while deleting amtMpsproxyChannelMapping`)
        }
        log.silly(`${socket.remoteAddress}:${socket.remotePort}: onCiraDisconnect for nodeid=${nodeid}`)

      })
    }

    if (this.config.startup_mode == 'mps') {
      //Creates a new TCP server
      this.webProxy = net.createServer((socket: any) => {
        socket.tag = {}
        socket.tag.ipaddr = socket //ip address
        socket.tag.mpsproxyAmtChannelMapping = {}
        socket.tag.amtMpsproxyChannelMapping = {}
        socket.tag.index = this.allSockets.length // for each socket, store its index in the array with the socket itself for easy retrieval
        this.allSockets[`${socket.remoteAddress}:${socket.remotePort}`] = socket
        log.silly(`${socket.remoteAddress}:${socket.remotePort}: webProxy createServer`)
        this.onWebConnection(socket)
      });

    }
    else {
      this.onCiraDisconnect = (nodeid) => {
        if (this.ciraConnections[nodeid]) {
          delete this.ciraConnections[nodeid];
        }

        if (this.mpsService.CIRADisconnected != null) {
          this.mpsService.CIRADisconnected(nodeid)
        }
      }
    }
    if (this.config.startup_mode == 'mps') {
      // Listening for web server 
      this.webProxy.listen(this.config.web_proxy_port, () => {
        log.info(`Listening for Proxy Connections on ${this.config.common_name}:${this.config.web_proxy_port}.`);
      });

      this.webProxy.on('error', (err) => {
        log.error(`ERROR: Proxy server port ${this.config.port} is not available.`);
        if (err) log.error(err);
        // if (this.config.exactports) {
        //     process.exit();
        // }
      })
    }

    // Listening for device connections
    this.server.listen(this.config.port, () => {
      const mpsaliasport = (typeof this.config.alias_port === 'undefined') ? `${this.config.port}` : `${this.config.port} alias port ${this.config.alias_port}`
      log.info(`Intel(R) AMT MPS Microservice running on ${this.config.common_name}:${mpsaliasport}.`)
    });

    this.server.on('error', (err) => {
      log.error(`ERROR: Intel(R) AMT server port ${this.config.port} is not available.`)
      if (err) log.error(err)
      // if (this.config.exactports) {
      //     process.exit();
      // }
    })
  }
  onWebConnection = (socket): void => {
    // Web Server and Mps Server agrees on a protocol to send the traffic back and forth
    // First. WebServer would setup a CIRA Channel.
    // For CIRA Channel, get the GUID from Web Server
    // For CIRA Channel setup, the webserver would get back a Channel ID for that GUID
    // Second, 
    // it starts sending data
    // total message length

    // [90, ] - Command (90 - Channel_Open, 94 - data)
    // [  Channel_open (90) , GUID, channelid (on mpsproxy), targetport  ] - 
    //                          Here you all SetupCiraChannel
    // [  Data (94)  ,  GUID, channelid (on mpsproxy), data_length, data ] - 
    //                       Here you will lookup the channelid on MPSServer side for this guid and 
    //                       send data on that channel


    // RESPONSE:
    // [ channel_close (97), 16 bytes of GUID (socket.tag.nodeid), channelid ]

    socket.setEncoding('binary');

    // used for logging
    let socketIPPort = socket.remoteAddress + ':' + socket.remotePort

    socket.addListener("data", (data) => {

      try {
        let totalmsgLength = data.length;
        log.silly(`data from webProxy(${socketIPPort}): length =${data.length}`)

        // go over all the received messages
        for (let dataIndex = 0; dataIndex < totalmsgLength;) {

          // get length of the message
          let thisMsgLength = common.ReadInt(data, dataIndex)
          log.silly(`Length of this message ${thisMsgLength}`)

          // Channel Open or Channel data or Channel close
          let requestType = data.charCodeAt(dataIndex + MPS_PROXY_MSG_TYPE_INDEX)
          log.silly(`requestType from webProxy(${socketIPPort})= ${requestType}`)
          if ((requestType !== APFProtocol.CHANNEL_OPEN) &&
            (requestType !== APFProtocol.CHANNEL_DATA) &&
            (requestType !== APFProtocol.CHANNEL_CLOSE) &&
            (requestType !== APFProtocol.DISCONNECT)) {
            log.debug(`requestType from webProxy (${socketIPPort}) not Channel Open/data/close`)
            return
          }

          // UUID
          let uuidHex = '';
          // read hex data from message
          for (let index = dataIndex + MPS_PROXY_MSG_UUID_START_INDEX;
            index <= dataIndex + MPS_PROXY_MSG_UUID_START_INDEX + MPS_PROXY_MSG_UUID_LENGTH;
            index++) {
            uuidHex += data[index]
          }
          log.silly(`(${socketIPPort}): received uuid in hex: ${uuidHex}`)
          let uuid = common.hex2rstr(uuidHex)
          log.silly(`(${socketIPPort}): received uuid= ${uuid}`)

          // validate and check if socket is open on device
          let ciraconn;
          if (typeof this.ciraConnections !== 'undefined') {
            if ((typeof this.ciraConnections[uuid]) === 'undefined') {
              log.error(`(${socketIPPort}): ciraConnections is undefined for ${uuid}`);
              return;
            }
            else {
              log.silly(`(${socketIPPort}): get CIRA socket connection object the for device`)
              ciraconn = this.ciraConnections[uuid]
            }
          }
          else {
            log.error(`(${socketIPPort}): ciraConnections object is undefined`)
            return
          }
          // todo - communicate back to mpsProxy if error
          if (APFProtocol.DISCONNECT === requestType) {
            ciraconn?.destroy()
            this.onCiraDisconnect(uuid)
          }
          // Channel Open request
          else if (APFProtocol.CHANNEL_OPEN === requestType) {
            log.silly(`(${socketIPPort}): received CHANNEL_OPEN request from mpsProxy`)

            // webProxy sent Channelid
            // read back the Int
            let mpsproxyChannelid
            mpsproxyChannelid = common.ReadInt(data, dataIndex + MPS_PROXY_MSG_CHANNELID_INDEX);
            log.silly(`(${socketIPPort}): received channel id= ${mpsproxyChannelid}`)

            // check if mpsProxy sent channel id already in map
            if (typeof socket.tag.mpsproxyAmtChannelMapping[uuid] === 'undefined') {
              log.silly(`(${socketIPPort}): mpsproxyAmtChannelMapping for ${uuid} is undefined`)
              socket.tag.mpsproxyAmtChannelMapping[uuid] = {}
            }
            else {
              if (typeof socket.tag.mpsproxyAmtChannelMapping[uuid][mpsproxyChannelid] !== 'undefined') {
                log.silly(`(${socketIPPort}): Proxy sent channel id exists in map`)
                return;
              }
            }

            // target port
            // read back the Int
            let targetPort = common.ReadInt(data, dataIndex + MPS_PROXY_MSG_TARGET_PORT_INDEX)
            log.silly(`(${socketIPPort}): received target port= ${targetPort}`)

            // call SetupCiraChannel
            let cirachannel: any = this.SetupCiraChannel(ciraconn, targetPort)

            cirachannel.onData = (ciraconn, data) => {
              log.silly(`(${socketIPPort}): send back data for ${uuid} to webServer length ${data.length}`)
              this.Write(socket,
                common.IntToStr(MPS_DATA_MSG_HEADER_LENGTH + data.length) +
                String.fromCharCode(APFProtocol.CHANNEL_DATA) +  // msg Type
                common.rstr2hex(uuid) +                      // uuid 
                common.IntToStr(mpsproxyChannelid) +         // channel id on mpsproxy
                common.IntToStr(data.length) +               // data length
                data                                         // data
              )
            }

            cirachannel.onStateChange = (channel, state) => {
              log.debug(`(${socketIPPort}): send back state value(${state}) to webServer ${uuid}`)
              if (0 === state) {
                log.silly(`(${socketIPPort}): state:${state} uuid:${uuid}`)
                // delete channel mapping
                delete socket.tag.amtMpsproxyChannelMapping[uuid][cirachannel.channelid]
                delete socket.tag.mpsproxyAmtChannelMapping[uuid][mpsproxyChannelid]

                // send back to webServer
                this.Write(socket,
                  common.IntToStr(MPS_STATE_CHANGE_MSG_LENGTH) +
                  String.fromCharCode(APFProtocol.CHANNEL_CLOSE) + // msg Type
                  common.rstr2hex(uuid) +                      // uuid 
                  common.IntToStr(mpsproxyChannelid)           // channel id on mpsproxy
                )
              }
              else if (2 === state) {
                log.silly(`(${socketIPPort}): state:${state} uuid:${uuid}`)

                // send back to webServer
                this.Write(socket,
                  common.IntToStr(MPS_STATE_CHANGE_MSG_LENGTH) +
                  String.fromCharCode(APFProtocol.CHANNEL_OPEN) + // msg Type
                  common.rstr2hex(uuid) +                      // uuid 
                  common.IntToStr(mpsproxyChannelid)           // channel id on mpsproxy
                )
              }
            }

            if (typeof cirachannel === 'undefined') {
              log.debug(`(${socketIPPort}): received object as undefined from SetupCiraChannel`)
              return
            }

            log.silly(`(${socketIPPort}): update mpsproxyMpsMapping`)
            log.silly(`(${socketIPPort}): cirachannel.channelid: ${cirachannel.channelid}`)

            // mapping for mpsproxyChannelid to amtchannelid
            socket.tag.mpsproxyAmtChannelMapping[uuid][mpsproxyChannelid] = cirachannel; // Store the whole channel here
            //}
            log.silly(`(${socketIPPort}): mpsproxyAmtChannelMapping[${uuid}][${mpsproxyChannelid}]= ${socket.tag.mpsproxyAmtChannelMapping[uuid][mpsproxyChannelid]}`)

            // mapping for amtchannelid to mpsproxyChannelid
            if (typeof socket.tag.amtMpsproxyChannelMapping[uuid] === 'undefined') {
              log.silly(`(${socketIPPort}): amtMpsproxyChannelMapping for ${uuid} is undefined`);
              socket.tag.amtMpsproxyChannelMapping[uuid] = {}
            }
            socket.tag.amtMpsproxyChannelMapping[uuid][cirachannel.channelid] = mpsproxyChannelid
            log.silly(`(${socketIPPort}): amtMpsproxyChannelMapping[${uuid}][${cirachannel.channelid}]= ${socket.tag.amtMpsproxyChannelMapping[uuid][cirachannel.channelid]}`)
          }
          // data on channel
          else if (APFProtocol.CHANNEL_DATA === requestType) {

            log.silly(`(${socketIPPort}): received CHANNEL_DATA request from mpsProxy`)

            // webProxy sent Channelid
            // read back the Int
            let mpsproxyChannelid;
            mpsproxyChannelid = common.ReadInt(data, dataIndex + MPS_PROXY_MSG_CHANNELID_INDEX);
            log.silly(`(${socketIPPort}): received channel id= ${mpsproxyChannelid}`)

            if (typeof socket.tag.mpsproxyAmtChannelMapping[uuid] === 'undefined') {
              log.debug(`(${socketIPPort}): mpsproxyAmtChannelMapping for ${uuid} is undefined`);
              return;
            }
            else if (typeof socket.tag.mpsproxyAmtChannelMapping[uuid][mpsproxyChannelid] === 'undefined') {
              log.debug(`(${socketIPPort}): mpsproxyAmtChannelMapping for ${uuid} on mpsProxy channel ${mpsproxyChannelid} is undefined`)
              return
            }

            // message length
            // read back the Int
            let msgLength = common.ReadInt(data, dataIndex + MPS_PROXY_MSG_DATA_LENGTH_INDEX)
            log.silly(`(${socketIPPort}): message length: ${msgLength}`)

            // validate Message length
            if ((dataIndex + MPS_PROXY_MSG_HEADER_LENGTH + msgLength) > data.length) {
              log.debug(`(${socketIPPort}): received msg length of ${data.length} not matching payload length`)
              return
            }

            // get the channel first
            let cirachannel = socket.tag.mpsproxyAmtChannelMapping[uuid][mpsproxyChannelid]

            // get data
            let msgData = ''
            // read hex data from message
            for (let index = dataIndex + MPS_PROXY_MSG_DATA_INDEX;
              index < dataIndex + MPS_PROXY_MSG_DATA_INDEX + msgLength;
              index++) {
              msgData += data[index]
            }
            // write on the device socket
            if (cirachannel != null) {
              log.silly(`(${socketIPPort}): write data on device, data: ${msgData}`)
              cirachannel.write(msgData)
            }
            else {
              log.debug(`(${socketIPPort}): ciraChannel not defined`)
            }
          }
          else if (APFProtocol.CHANNEL_CLOSE === requestType) {
            log.silly(`(${socketIPPort}): received CHANNEL_CLOSE request from mpsProxy`)

            // webProxy sent Channelid
            // read back the Int
            let mpsproxyChannelid
            mpsproxyChannelid = common.ReadInt(data, dataIndex + MPS_PROXY_MSG_CHANNELID_INDEX)
            log.silly(`(${socketIPPort}): received channel id= ${mpsproxyChannelid}`)

            if (typeof socket.tag.mpsproxyAmtChannelMapping[uuid] === 'undefined') {
              log.debug(`(${socketIPPort}): mpsproxyAmtChannelMapping for ${uuid} is undefined`)
              return;
            }
            else if (typeof socket.tag.mpsproxyAmtChannelMapping[uuid][mpsproxyChannelid] === 'undefined') {
              log.debug(`(${socketIPPort}): mpsproxyAmtChannelMapping for ${uuid} on mpsProxy channel ${mpsproxyChannelid} is undefined`);
              return;
            }

            let cirachannel = socket.tag.mpsproxyAmtChannelMapping[uuid][mpsproxyChannelid] // Store the whole channel here

            if (cirachannel != null) {
              log.silly(`(${socketIPPort}): send channel close to device`)
              cirachannel.close()
            }
            else {
              log.silly(`(${socketIPPort}): ciraChannel not defined`)
            }
          }
          dataIndex += thisMsgLength
        }
        log.silly(`(${socketIPPort}): done processing of the message received on webProxy`)
      }
      catch (e) {
        log.error(`(${socketIPPort}):Error in socket on data: webServer: ${e}`)
      }

    });

    // webServer connection closed
    socket.addListener('close', () => {
      log.debug(`(${socketIPPort}): webServer connection closed`)
      try {
        // delete all the entries from webMpsChannelMapping/webproxyMpsMapping
        socket.tag.mpsproxyAmtChannelMapping = null
        socket.tag.amtMpsproxyChannelMapping = null
        socket.tag.channelSocketMapping = null
        delete this.allSockets[`${socketIPPort}`]
      } catch (e) {
        log.error(`(${socketIPPort}): Error from webserver socket close: ${e}`)
      }
    })

    socket.addListener('error', () => {
      log.error('onWebConnection error');
    });
  }

  onConnection = (socket): void => {
    if (this.config.tls_offload) {
      socket.tag = { first: true, clientCert: null, accumulator: '', activetunnels: 0, boundPorts: [], socket: socket, host: null, nextchannelid: 4, channels: {}, nextsourceport: 0 }
    } else {
      socket.tag = { first: true, clientCert: socket.getPeerCertificate(true), accumulator: '', activetunnels: 0, boundPorts: [], socket: socket, host: null, nextchannelid: 4, channels: {}, nextsourceport: 0 }
    }
    socket.setEncoding('binary');
    this.debug(1, `MPS:New CIRA connection`)

      // Setup the CIRA keep alive timer
      socket.setTimeout(MAX_IDLE)
      socket.on('timeout', () => {
        this.debug(1, 'MPS:CIRA timeout, disconnecting.')
        try {
          socket.end()
          if (this.ciraConnections[socket.tag.nodeid]) {
          this.onCiraDisconnect(socket.tag.nodeid);
          this.debug(1, "MPS: call CIRADisconnected");
            if (typeof this.mpsService.CIRADisconnected === 'function') {
              this.mpsService.CIRADisconnected(socket.tag.nodeid)
            }
          else {
            this.debug(1, "MPS: No definition for CIRADisconnected");
          }
        }
        } catch (e) {
          log.error(`Error from socket timeout: ${e}`)
        }
      	this.debug(1, "MPS:CIRA timeout, disconnected.");
      })

      socket.addListener('data', (data) => {
        // TODO: mpsdebug should be added to the config file
        // if (this.config.mpsdebug) {
        //     let buf = Buffer.from(data, "binary");
        //     console.log('MPS <-- (' + buf.length + '):' + buf.toString('hex'));
        // } // Print out received bytes

        socket.tag.accumulator += data

        // Detect if this is an HTTPS request, if it is, return a simple answer and disconnect. This is useful for debugging access to the MPS port.
        if (socket.tag.first == true) {
          if (socket.tag.accumulator.length < 3) return
          // if (!socket.tag.clientCert.subject) { console.log("MPS Connection, no client cert: " + socket.remoteAddress); socket.write('HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nMeshCentral2 MPS server.\r\nNo client certificate given.'); socket.end(); return; }
          if (socket.tag.accumulator.substring(0, 3) == 'GET') {
            log.debug('MPS Connection, HTTP GET detected: ' + socket.remoteAddress)
            socket.write('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>Intel Management Presence Server (MPS).<br />Intel&reg; AMT computers must connect here using CIRA.</body></html>')
            socket.end()
            return
          }
          socket.tag.first = false

          // Setup this node with certificate authentication
          if (socket.tag.clientCert && socket.tag.clientCert.subject && socket.tag.clientCert.subject.O) {
            // This is a node where the organization is indicated within the CIRA certificate
            this.db.IsOrgApproved(socket.tag.clientCert.subject.O, (allowed) => {
              if (allowed) {
                this.debug(1, 'CIRA connection for organization: ' + socket.tag.clientCert.subject.O)
                socket.tag.certauth = true
              } else {
                this.debug(1, 'CIRA connection for unknown node with incorrect organization: ' + socket.tag.clientCert.subject.O)
                socket.end()
              //return TODO: is missing?
              }
            })
          } else {
            // This node connected without certificate authentication, use password auth
            this.debug(1, 'Intel AMT CIRA trying to connect without certificate authentication')
          }
        }

      try {
        // Parse all of the APF data we can
        let l = 0
        do {
          l = this.processCommand(socket)
          if (l > 0) { socket.tag.accumulator = socket.tag.accumulator.substring(l) }
        } while (l > 0)
        if (l < 0) { socket.end() }
      } catch (e) {
        log.error(e)
      }
    })

      socket.addListener('close', () => {
        this.debug(1, 'MPS:CIRA connection closed')
        try {
          if (this.ciraConnections[socket.tag.nodeid]) {
            delete this.ciraConnections[socket.tag.nodeid]
            if (typeof this.mpsService.CIRADisconnected === 'function') {
              this.mpsService.CIRADisconnected(socket.tag.nodeid)
            }
          }
        } catch (e) {
          log.error(`Error from socket close: ${e}`)
        }
      })

    socket.addListener('error', () => {
      log.debug(`MPS Error ${socket.tag.nodeid}: ${socket.remoteAddress}`)
    })
  }

    // Process one APF command
    processCommand = (socket) => {
      const cmd = socket.tag.accumulator.charCodeAt(0)
      const len = socket.tag.accumulator.length
      const data = socket.tag.accumulator
      if (len == 0) { return 0 }

    switch (cmd) {
      case APFProtocol.KEEPALIVE_REQUEST: {
        if (len < 5) {
          return 0
        }
        log.debug(`MPS: KEEPALIVE_REQUEST: ${socket.tag.nodeid}`);
        this.SendKeepAliveReply(socket, common.ReadInt(data, 1))
        return 5
      }
      case APFProtocol.KEEPALIVE_REPLY: {
        if (len < 5) return 0
        this.debug(3, 'MPS:KEEPALIVE_REPLY')
        return 5
      }
      case APFProtocol.PROTOCOLVERSION: {
        if (len < 93) return 0
        socket.tag.MajorVersion = common.ReadInt(data, 1)
        socket.tag.MinorVersion = common.ReadInt(data, 5)
        socket.tag.SystemId = this.guidToStr(common.rstr2hex(data.substring(13, 29))).toLowerCase()
        this.debug(3, 'MPS:PROTOCOLVERSION', socket.tag.MajorVersion, socket.tag.MinorVersion, socket.tag.SystemId)
        // Check if the device is allowlisted to connect. Only checked when 'use_allowlist' is set to true in config.json.
        if (this.config.use_allowlist) {
          this.db.IsGUIDApproved(socket.tag.SystemId, (allowed) => {
            socket.tag.nodeid = socket.tag.SystemId
            if (allowed) {
              if (socket.tag.certauth) {
                this.ciraConnections[socket.tag.SystemId] = socket
                this.mpsService.CIRAConnected(socket.tag.nodeid)
              }
            } else {
              try {
                this.debug(1, 'MPS:GUID ' + socket.tag.SystemId + ' is not allowed to connect.')
                socket.end()
              } catch (e) { }
            }
          })
        } else {
          socket.tag.nodeid = socket.tag.SystemId
          if (socket.tag.certauth) {
            this.ciraConnections[socket.tag.SystemId] = socket
            this.mpsService.CIRAConnected(socket.tag.nodeid)
          }
        }
        log.debug(`device uuid: ${socket.tag.SystemId}`)
        return 93
      }
      case APFProtocol.USERAUTH_REQUEST: {
        if (len < 13) return 0
        const usernameLen = common.ReadInt(data, 1)
        const username = data.substring(5, 5 + usernameLen)
        var serviceNameLen = common.ReadInt(data, 5 + usernameLen)
        var serviceName = data.substring(9 + usernameLen, 9 + usernameLen + serviceNameLen)
        const methodNameLen = common.ReadInt(data, 9 + usernameLen + serviceNameLen)
        const methodName = data.substring(13 + usernameLen + serviceNameLen, 13 + usernameLen + serviceNameLen + methodNameLen)
        let passwordLen = 0; let password = null
        if (methodName == 'password') {
          passwordLen = common.ReadInt(data, 14 + usernameLen + serviceNameLen + methodNameLen)
          password = data.substring(18 + usernameLen + serviceNameLen + methodNameLen, 18 + usernameLen + serviceNameLen + methodNameLen + passwordLen)
        }
        this.debug(3, 'MPS:USERAUTH_REQUEST usernameLen ' + usernameLen + ' serviceNameLen ' + serviceNameLen + ' methodNameLen ' + methodNameLen)
        this.debug(3, 'MPS:USERAUTH_REQUEST user=' + username + ', service=' + serviceName + ', method=' + methodName + ', password=' + password)
        // Authenticate device connection using username and password
        this.db.CIRAAuth(socket.tag.SystemId, username, password, (allowed) => {
          if (allowed) {
            this.debug(1, 'MPS:CIRA Authentication successful for ', username)
            this.ciraConnections[socket.tag.SystemId] = socket
            this.mpsService.CIRAConnected(socket.tag.SystemId) // Notify that a connection is successful to console
            this.SendUserAuthSuccess(socket) // Notify the auth success on the CIRA connection
          } else {
            log.warn(`MPS: CIRA Authentication failed for: ${username} `);
            this.SendUserAuthFail(socket); return -1
          }
        })
        return 18 + usernameLen + serviceNameLen + methodNameLen + passwordLen
      }
      case APFProtocol.SERVICE_REQUEST: {
        if (len < 5) return 0
        var serviceNameLen = common.ReadInt(data, 1)
        if (len < 5 + serviceNameLen) return 0
        var serviceName = data.substring(5, 5 + serviceNameLen)
        this.debug(3, 'MPS:SERVICE_REQUEST', serviceName)
        if (serviceName == 'pfwd@amt.intel.com') { this.SendServiceAccept(socket, 'pfwd@amt.intel.com') }
        if (serviceName == 'auth@amt.intel.com') { this.SendServiceAccept(socket, 'auth@amt.intel.com') }
        return 5 + serviceNameLen
      }
      case APFProtocol.GLOBAL_REQUEST: {
        if (len < 14) return 0
        const requestLen = common.ReadInt(data, 1)
        if (len < 14 + requestLen) return 0
        const request = data.substring(5, 5 + requestLen)
        const wantResponse = data.charCodeAt(5 + requestLen)

        if (request == 'tcpip-forward') {
          var addrLen = common.ReadInt(data, 6 + requestLen)
          if (len < 14 + requestLen + addrLen) return 0
          var addr = data.substring(10 + requestLen, 10 + requestLen + addrLen)
          var port = common.ReadInt(data, 10 + requestLen + addrLen)
          if (addr == '') addr = undefined
          log.debug(`MPS: GLOBAL_REQUEST ${socket.tag.nodeid} ${request} ${addr}: ${port} `)
          //this.debug(2, 'MPS:GLOBAL_REQUEST', request, addr + ':' + port)
          this.ChangeHostname(socket, addr)
          if (socket.tag.boundPorts.indexOf(port) == -1) { socket.tag.boundPorts.push(port) }
          this.SendTcpForwardSuccessReply(socket, port)
          return 14 + requestLen + addrLen
        }

        if (request == 'cancel-tcpip-forward') {
          var addrLen = common.ReadInt(data, 6 + requestLen)
          if (len < 14 + requestLen + addrLen) return 0
          var addr = data.substring(10 + requestLen, 10 + requestLen + addrLen)
          var port = common.ReadInt(data, 10 + requestLen + addrLen)
          //this.debug(2, 'MPS:GLOBAL_REQUEST', request, addr + ':' + port)
          log.debug(`MPS: GLOBAL_REQUEST ${socket.tag.nodeid} ${request} ${addr}: ${port} `)
          const portindex = socket.tag.boundPorts.indexOf(port)
          if (portindex >= 0) { socket.tag.boundPorts.splice(portindex, 1) }
          this.SendTcpForwardCancelReply(socket)
          return 14 + requestLen + addrLen
        }

        if (request == 'udp-send-to@amt.intel.com') {
          var addrLen = common.ReadInt(data, 6 + requestLen)
          if (len < 26 + requestLen + addrLen) return 0
          var addr = data.substring(10 + requestLen, 10 + requestLen + addrLen)
          var port = common.ReadInt(data, 10 + requestLen + addrLen)
          const oaddrLen = common.ReadInt(data, 14 + requestLen + addrLen)
          if (len < 26 + requestLen + addrLen + oaddrLen) return 0
          const oaddr = data.substring(18 + requestLen, 18 + requestLen + addrLen)
          const oport = common.ReadInt(data, 18 + requestLen + addrLen + oaddrLen)
          const datalen = common.ReadInt(data, 22 + requestLen + addrLen + oaddrLen)
          if (len < 26 + requestLen + addrLen + oaddrLen + datalen) return 0
          //this.debug(2, 'MPS:GLOBAL_REQUEST', request, addr + ':' + port, oaddr + ':' + oport, datalen)
          log.debug(`MPS: GLOBAL_REQUEST ${socket.tag.nodeid} ${request} ${addr}: ${port} ${oaddr}: ${oport} ${datalen} `)
          // TODO
          return 26 + requestLen + addrLen + oaddrLen + datalen
        }

          return 6 + requestLen
        }
        case APFProtocol.CHANNEL_OPEN: {
          if (len < 33) return 0
          const ChannelTypeLength = common.ReadInt(data, 1)
          if (len < (33 + ChannelTypeLength)) return 0

          // Decode channel identifiers and window size
          const ChannelType = data.substring(5, 5 + ChannelTypeLength)
          var SenderChannel = common.ReadInt(data, 5 + ChannelTypeLength)
          var WindowSize = common.ReadInt(data, 9 + ChannelTypeLength)

          // Decode the target
          const TargetLen = common.ReadInt(data, 17 + ChannelTypeLength)
          if (len < (33 + ChannelTypeLength + TargetLen)) return 0
          const Target = data.substring(21 + ChannelTypeLength, 21 + ChannelTypeLength + TargetLen)
          const TargetPort = common.ReadInt(data, 21 + ChannelTypeLength + TargetLen)

          // Decode the source
          const SourceLen = common.ReadInt(data, 25 + ChannelTypeLength + TargetLen)
          if (len < (33 + ChannelTypeLength + TargetLen + SourceLen)) return 0
          const Source = data.substring(29 + ChannelTypeLength + TargetLen, 29 + ChannelTypeLength + TargetLen + SourceLen)
          const SourcePort = common.ReadInt(data, 29 + ChannelTypeLength + TargetLen + SourceLen)

          this.debug(3, 'MPS:CHANNEL_OPEN', ChannelType, SenderChannel, WindowSize, Target + ':' + TargetPort, Source + ':' + SourcePort)

          // Check if we understand this channel type
          // if (ChannelType.toLowerCase() == "direct-tcpip")
          {
            // We don't understand this channel type, send an error back
            this.SendChannelOpenFailure(socket, SenderChannel, APFChannelOpenFailureReasonCode.UnknownChannelType)
            return 33 + ChannelTypeLength + TargetLen + SourceLen
          }

          /*
                // This is a correct connection. Lets get it setup
                var MeshAmtEventEndpoint = { ServerChannel: GetNextBindId(), AmtChannel: SenderChannel, MaxWindowSize: 2048, CurrentWindowSize:2048, SendWindow: WindowSize, InfoHeader: "Target: " + Target + ":" + TargetPort + ", Source: " + Source + ":" + SourcePort};
                // TODO: Connect this socket for a WSMAN event
                SendChannelOpenConfirmation(socket, SenderChannel, MeshAmtEventEndpoint.ServerChannel, MeshAmtEventEndpoint.MaxWindowSize);
                */

          return 33 + ChannelTypeLength + TargetLen + SourceLen
        }
        case APFProtocol.CHANNEL_OPEN_CONFIRMATION: {
          if (len < 17) return 0
          var RecipientChannel = common.ReadInt(data, 1)
          var SenderChannel = common.ReadInt(data, 5)
          var WindowSize = common.ReadInt(data, 9)
          socket.tag.activetunnels++
          var cirachannel = socket.tag.channels[RecipientChannel]
          if (cirachannel == undefined) { /* console.log("MPS Error in CHANNEL_OPEN_CONFIRMATION: Unable to find channelid " + RecipientChannel); */ return 17 }
          cirachannel.amtchannelid = SenderChannel
          cirachannel.sendcredits = cirachannel.amtCiraWindow = WindowSize
          this.debug(3, 'MPS:CHANNEL_OPEN_CONFIRMATION', RecipientChannel, SenderChannel, WindowSize)
          if (cirachannel.closing == 1) {
            // Close this channel
            this.SendChannelClose(cirachannel.socket, cirachannel.amtchannelid)
          } else {
            cirachannel.state = 2
            // Send any pending data
            if (cirachannel.sendBuffer != undefined) {
              if (cirachannel.sendBuffer.length <= cirachannel.sendcredits) {
                // Send the entire pending buffer
                this.SendChannelData(cirachannel.socket, cirachannel.amtchannelid, cirachannel.sendBuffer)
                cirachannel.sendcredits -= cirachannel.sendBuffer.length
                delete cirachannel.sendBuffer
                if (cirachannel.onSendOk) { cirachannel.onSendOk(cirachannel) }
              } else {
                // Send a part of the pending buffer
                this.SendChannelData(cirachannel.socket, cirachannel.amtchannelid, cirachannel.sendBuffer.substring(0, cirachannel.sendcredits))
                cirachannel.sendBuffer = cirachannel.sendBuffer.substring(cirachannel.sendcredits)
                cirachannel.sendcredits = 0
              }
            }
            // Indicate the channel is open
            if (cirachannel.onStateChange) { cirachannel.onStateChange(cirachannel, cirachannel.state) }
          }
          return 17
        }
        case APFProtocol.CHANNEL_OPEN_FAILURE: {
          if (len < 17) return 0
          var RecipientChannel = common.ReadInt(data, 1)
          var ReasonCode = common.ReadInt(data, 5)
          this.debug(3, 'MPS:CHANNEL_OPEN_FAILURE', RecipientChannel, ReasonCode)
          var cirachannel = socket.tag.channels[RecipientChannel]
          if (cirachannel == undefined) { log.debug('MPS Error in CHANNEL_OPEN_FAILURE: Unable to find channelid ' + RecipientChannel); return 17 }
          if (cirachannel.state > 0) {
            cirachannel.state = 0
            if (cirachannel.onStateChange) { cirachannel.onStateChange(cirachannel, cirachannel.state) }
            delete socket.tag.channels[RecipientChannel]
          }
          return 17
        }
        case APFProtocol.CHANNEL_CLOSE: {
          if (len < 5) return 0
          var RecipientChannel = common.ReadInt(data, 1)
          this.debug(3, 'MPS:CHANNEL_CLOSE', RecipientChannel)
          var cirachannel = socket.tag.channels[RecipientChannel]
          if (cirachannel == undefined) { log.debug('MPS Error in CHANNEL_CLOSE: Unable to find channelid ' + RecipientChannel); return 5 }
          this.SendChannelClose(cirachannel.socket, cirachannel.amtchannelid)
          socket.tag.activetunnels--
          if (cirachannel.state > 0) {
            cirachannel.state = 0
            if (cirachannel.onStateChange) { cirachannel.onStateChange(cirachannel, cirachannel.state) }
            delete socket.tag.channels[RecipientChannel]
          }
          return 5
        }
        case APFProtocol.CHANNEL_WINDOW_ADJUST: {
          if (len < 9) return 0
          var RecipientChannel = common.ReadInt(data, 1)
          const ByteToAdd = common.ReadInt(data, 5)
          var cirachannel = socket.tag.channels[RecipientChannel]
          if (cirachannel == undefined) { log.debug('MPS Error in CHANNEL_WINDOW_ADJUST: Unable to find channelid ' + RecipientChannel); return 9 }
          cirachannel.sendcredits += ByteToAdd
          this.debug(3, 'MPS:CHANNEL_WINDOW_ADJUST', RecipientChannel, ByteToAdd, cirachannel.sendcredits)
          if (cirachannel.state == 2 && cirachannel.sendBuffer != undefined) {
            // Compute how much data we can send
            if (cirachannel.sendBuffer.length <= cirachannel.sendcredits) {
              // Send the entire pending buffer
              this.SendChannelData(cirachannel.socket, cirachannel.amtchannelid, cirachannel.sendBuffer)
              cirachannel.sendcredits -= cirachannel.sendBuffer.length
              delete cirachannel.sendBuffer
              if (cirachannel.onSendOk) { cirachannel.onSendOk(cirachannel) }
            } else {
              // Send a part of the pending buffer
              this.SendChannelData(cirachannel.socket, cirachannel.amtchannelid, cirachannel.sendBuffer.substring(0, cirachannel.sendcredits))
              cirachannel.sendBuffer = cirachannel.sendBuffer.substring(cirachannel.sendcredits)
              cirachannel.sendcredits = 0
            }
          }
          return 9
        }
        case APFProtocol.CHANNEL_DATA: {
          if (len < 9) return 0
          var RecipientChannel = common.ReadInt(data, 1)
          const LengthOfData = common.ReadInt(data, 5)
          if (len < (9 + LengthOfData)) return 0
          this.debug(4, 'MPS:CHANNEL_DATA', RecipientChannel, LengthOfData)
          var cirachannel = socket.tag.channels[RecipientChannel]
          if (cirachannel == undefined) { log.debug('MPS Error in CHANNEL_DATA: Unable to find channelid ' + RecipientChannel); return 9 + LengthOfData }
          cirachannel.amtpendingcredits += LengthOfData
          if (cirachannel.onData) cirachannel.onData(cirachannel, data.substring(9, 9 + LengthOfData))
          if (cirachannel.amtpendingcredits > (cirachannel.ciraWindow / 2)) {
            this.SendChannelWindowAdjust(cirachannel.socket, cirachannel.amtchannelid, cirachannel.amtpendingcredits) // Adjust the buffer window
            cirachannel.amtpendingcredits = 0
          }
          return 9 + LengthOfData
        }
        case APFProtocol.DISCONNECT: {
        if (len < 7) return 0;
        var ReasonCode = common.ReadInt(data, 1);
        log.debug('MPS:DISCONNECT', ReasonCode);
        this.onCiraDisconnect(socket.tag.nodeid);
        if (this.mpsService.CIRADisconnected != null) {
          this.mpsService.CIRADisconnected(socket.tag.nodeid);
        }
        return 7;
      }
        default: {
          this.debug(1, 'MPS:Unknown CIRA command: ' + cmd)
          return -1
        }
      }
    }

    // Disconnect CIRA tunnel
    close (socket) {
      try { socket.end() } catch (e) { }
      try { delete this.ciraConnections[socket.tag.nodeid] } catch (e) { }
      if (this.mpsService) { this.mpsService.CIRADisconnected(socket.tag.nodeid) }
    }

    SendServiceAccept (socket, service) {
      this.Write(
        socket,
        String.fromCharCode(APFProtocol.SERVICE_ACCEPT) +
            common.IntToStr(service.length) +
            service
      )
    }

    SendTcpForwardSuccessReply (socket, port) {
      this.Write(
        socket,
        String.fromCharCode(APFProtocol.REQUEST_SUCCESS) + common.IntToStr(port)
      )
    }

    SendTcpForwardCancelReply (socket) {
      this.Write(socket, String.fromCharCode(APFProtocol.REQUEST_SUCCESS))
    }

    SendKeepAliveRequest (socket, cookie) {
      this.Write(
        socket,
        String.fromCharCode(APFProtocol.KEEPALIVE_REQUEST) +
            common.IntToStr(cookie)
      )
    }

    SendKeepAliveReply (socket, cookie) {
      this.Write(
        socket,
        String.fromCharCode(APFProtocol.KEEPALIVE_REPLY) + common.IntToStr(cookie)
      )
    }

    SendChannelOpenFailure (socket, senderChannel, reasonCode) {
      this.Write(
        socket,
        String.fromCharCode(APFProtocol.CHANNEL_OPEN_FAILURE) +
            common.IntToStr(senderChannel) +
            common.IntToStr(reasonCode) +
            common.IntToStr(0) +
            common.IntToStr(0)
      )
    }

    SendChannelOpenConfirmation (socket, recipientChannelId, senderChannelId, initialWindowSize) {
      this.Write(
        socket,
        String.fromCharCode(APFProtocol.CHANNEL_OPEN_CONFIRMATION) +
            common.IntToStr(recipientChannelId) +
            common.IntToStr(senderChannelId) +
            common.IntToStr(initialWindowSize) +
            common.IntToStr(-1)
      )
    }

    SendChannelOpen (socket, direct, channelid, windowsize, target, targetport, source, sourceport) {
      const connectionType = direct == true ? 'direct-tcpip' : 'forwarded-tcpip'
      // TODO: Reports of target being undefined that causes target.length to fail. This is a hack.
      if (target == null || target == undefined) target = ''
      this.Write(
        socket,
        String.fromCharCode(APFProtocol.CHANNEL_OPEN) +
            common.IntToStr(connectionType.length) +
            connectionType +
            common.IntToStr(channelid) +
            common.IntToStr(windowsize) +
            common.IntToStr(-1) +
            common.IntToStr(target.length) +
            target +
            common.IntToStr(targetport) +
            common.IntToStr(source.length) +
            source +
            common.IntToStr(sourceport)
      )
    }

    SendChannelClose (socket, channelid) {
      this.debug(2, 'MPS:SendChannelClose', channelid)
      this.Write(
        socket,
        String.fromCharCode(APFProtocol.CHANNEL_CLOSE) +
            common.IntToStr(channelid)
      )
    }

    SendChannelData (socket, channelid, data) {
      this.Write(
        socket,
        String.fromCharCode(APFProtocol.CHANNEL_DATA) +
            common.IntToStr(channelid) +
            common.IntToStr(data.length) +
            data
      )
    }

    SendChannelWindowAdjust (socket, channelid, bytestoadd) {
      this.debug(3, 'MPS:SendChannelWindowAdjust', channelid, bytestoadd)
      this.Write(
        socket,
        String.fromCharCode(APFProtocol.CHANNEL_WINDOW_ADJUST) +
            common.IntToStr(channelid) +
            common.IntToStr(bytestoadd)
      )
    }

    SendDisconnect (socket, reasonCode) {
      this.Write(
        socket,
        String.fromCharCode(APFProtocol.DISCONNECT) +
            common.IntToStr(reasonCode) +
            common.ShortToStr(0)
      )
    }

    SendUserAuthFail (socket) {
      this.Write(
        socket,
        String.fromCharCode(APFProtocol.USERAUTH_FAILURE) +
            common.IntToStr(8) +
            'password' +
            common.ShortToStr(0)
      )
    }

    SendUserAuthSuccess (socket) {
      this.Write(socket, String.fromCharCode(APFProtocol.USERAUTH_SUCCESS))
    }

    Write (socket, data) {
      // TODO: Add mpsdebug to config file.
      // if (this.config.mpsdebug) {
      //   // Print out sent bytes
      //   var buf = Buffer.from(data, "binary");
      //   console.log("MPS --> (" + buf.length + "):" + buf.toString("hex"));
      //   socket.write(buf);
      // } else {
      socket.write(Buffer.from(data, 'binary'))
      // }
    }

    SetupCommunication = (host, port) => {
      const ciraconn = this.ciraConnections[host]
      const socket = this.SetupCiraChannel(ciraconn, port)
      return socket
    }

    // Setup CIRA Channel
    SetupCiraChannel (socket, targetport) {
      const sourceport = (socket.tag.nextsourceport++ % 30000) + 1024
      const cirachannel = {
        targetport: targetport,
        channelid: socket.tag.nextchannelid++,
        socket: socket,
        state: 1,
        sendcredits: 0,
        amtpendingcredits: 0,
        amtCiraWindow: 0,
        ciraWindow: 32768,
        write: undefined,
        sendBuffer: undefined,
        amtchannelid: undefined,
        close: undefined,
        closing: undefined,
        onStateChange: undefined,
        sendchannelclose: undefined
      }
      this.SendChannelOpen(
        socket,
        false,
        cirachannel.channelid,
        cirachannel.ciraWindow,
        socket.tag.host,
        targetport,
        '1.2.3.4',
        sourceport
      )

      // This function writes data to this CIRA channel
      cirachannel.write = (data) => {
        if (cirachannel.state == 0) return false
        if (cirachannel.state == 1 || cirachannel.sendcredits == 0 || cirachannel.sendBuffer != undefined) {
          if (cirachannel.sendBuffer == undefined) {
            cirachannel.sendBuffer = data
          } else {
            cirachannel.sendBuffer += data
          }
          return true
        }
        // Compute how much data we can send
        if (data.length <= cirachannel.sendcredits) {
          // Send the entire message
          this.SendChannelData(cirachannel.socket, cirachannel.amtchannelid, data)
          cirachannel.sendcredits -= data.length
          return true
        }
        // Send a part of the message
        cirachannel.sendBuffer = data.substring(cirachannel.sendcredits)
        this.SendChannelData(
          cirachannel.socket,
          cirachannel.amtchannelid,
          data.substring(0, cirachannel.sendcredits)
        )
        cirachannel.sendcredits = 0
        return false
      }

      // This function closes this CIRA channel
      cirachannel.close = () => {
        if (cirachannel.state == 0 || cirachannel.closing == 1) return
        if (cirachannel.state == 1) {
          cirachannel.closing = 1
          cirachannel.state = 0
          if (cirachannel.onStateChange) {
            cirachannel.onStateChange(cirachannel, cirachannel.state)
          }
          return
        }
        cirachannel.state = 0
        cirachannel.closing = 1
        this.SendChannelClose(cirachannel.socket, cirachannel.amtchannelid)
        if (cirachannel.onStateChange) {
          cirachannel.onStateChange(cirachannel, cirachannel.state)
        }
      }

    cirachannel.sendchannelclose = (): void => {
      log.silly(`sendchannelclose called`)
      this.SendChannelClose(cirachannel.socket, cirachannel.amtchannelid)
    }

      socket.tag.channels[cirachannel.channelid] = cirachannel
      return cirachannel
    }

    ChangeHostname (socket, host) {
      let computerEntry = {
        name: undefined,
        host: undefined,
        amtuser: undefined
      }
      if (socket.tag.host === host) return // Nothing to change
      this.debug(3, 'Change hostname to ', host)
      socket.tag.host = host
      if (this.mpsService.mpsComputerList[socket.tag.nodeid]) {
        computerEntry = this.mpsService.mpsComputerList[socket.tag.nodeid]
        computerEntry.name = host
        computerEntry.host = socket.tag.nodeid
        this.mpsService.mpsComputerList[socket.tag.nodeid] = computerEntry
      } else {
        computerEntry = {
          name: host,
          host: socket.tag.nodeid,
          amtuser: 'admin'
        }

        this.mpsService.mpsComputerList[socket.tag.nodeid] = computerEntry
      }
    }

    guidToStr (g) {
      return (
        g.substring(6, 8) +
            g.substring(4, 6) +
            g.substring(2, 4) +
            g.substring(0, 2) +
            '-' +
            g.substring(10, 12) +
            g.substring(8, 10) +
            '-' +
            g.substring(14, 16) +
            g.substring(12, 14) +
            '-' +
            g.substring(16, 20) +
            '-' +
            g.substring(20)
      )
    }

    // Debug
    debug (lvl: number, ...argArray: string[]) {
      if (lvl > this.mpsService.debugLevel) return
      if (argArray.length == 1) { log.debug(argArray[0]) } else if (argArray.length == 2) { log.debug(`${argArray[0]} ${argArray[1]}`) } else if (argArray.length == 3) { log.debug(`${argArray[0]} ${argArray[1]} ${argArray[2]}`) } else if (argArray.length == 4) { log.debug(`${argArray[0]} ${argArray[1]} ${argArray[2]} ${argArray[3]}`) } else if (argArray.length == 5) { log.debug(`${argArray[0]} ${argArray[1]} ${argArray[2]} ${argArray[3]} ${argArray[4]}`) } else if (argArray.length == 6) { log.debug(`${argArray[0]} ${argArray[1]} ${argArray[2]} ${argArray[3]} ${argArray[4]} ${argArray[5]}`) }
    }
}