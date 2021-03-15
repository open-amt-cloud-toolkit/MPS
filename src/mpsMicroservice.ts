/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
**********************************************************************/

import { configType, certificatesType } from './models/Config'
import { webServer } from './server/webserver'
import { mpsServer } from './server/mpsserver'
import { logger as log } from './utils/logger'
import { IDbProvider } from './models/IDbProvider'
import { getDistributedKV } from './utils/IDistributedKV'
import { MpsProxy } from './server/proxies/MpsProxy';
import { CiraConnectionFactory } from './CiraConnectionFactory';
import { CiraChannelFactory } from './CiraChannelFactory';
import session from 'express-session';

export class MPSMicroservice {
  mpsserver : any;
  webserver : any;
  config: configType;
  certs: certificatesType;
  debugLevel: number = 1;
  mpsComputerList = {};
  db: IDbProvider;
  CiraConnectionFactory: CiraConnectionFactory
  CiraChannelFactory: CiraChannelFactory
  sess: any

  constructor (config: configType, db: IDbProvider, certs: certificatesType) {
    try {
      this.config = config
      this.debugLevel = config.debug_level
      this.db = db
      this.certs = certs
    } catch (e) {
      log.error(`Exception in MPS Microservice: ${e}`)
    }
  }

  start() {
    if (this.config.startup_mode === 'standalone') {
      //Session Configuration
      this.sess = {
        // Strongly recommended to change this key for Production thru ENV variable MPS_SESSION_ENCRYPTION_KEY
        secret: this.config.session_encryption_key || '<YourStrongRandomizedKey123!>',
        name: 'SessionSupport',
        resave: true,
        saveUninitialized: true,
        cookie: { secure: false } // by default false. use true for prod like below.
      }
      this.webserver = new webServer(this)
      this.mpsserver = new mpsServer(this)
      this.CiraConnectionFactory = new CiraConnectionFactory(async (hostGuid) => await this.mpsserver.ciraConnections[hostGuid])
      this.CiraChannelFactory = new CiraChannelFactory((socket, port) => this.mpsserver.SetupCiraChannel(socket, port))
    }
    else if (this.config.startup_mode === 'web') { // Running in distributed mode
      if (this.config.redis_enable) {
        log.silly('Redis enabled')
      // Session handling with Redis - in scale mode
      const redis = require('redis')
      const redisClient = redis.createClient({ port: this.config.redis_port, host: this.config.redis_host, password: this.config.redis_password }) // "redis" container
      const redisStore = require('connect-redis')(session)
      log.silly('connect to Redis')
      redisClient.on('error', (err) => {
        console.log('Redis error: ', err)
      });

      //Session Configuration
      this.sess = {
        // Strongly recommended to change this key for Production thru ENV variable MPS_SESSION_ENCRYPTION_KEY
        secret: this.config.session_encryption_key || '<YourStrongRandomizedKey123!>',
        name: 'SessionSupport',
        resave: true,
        saveUninitialized: true,
        cookie: { secure: false }, // by default false. use true for prod like below.
        store: new redisStore({ host: this.config.redis_host, port: this.config.redis_port, client: redisClient, ttl: 86400 })
      };
      }
      else {
        log.silly('Redis disabled')
        //Session Configuration
        this.sess = {
          // Strongly recommended to change this key for Production thru ENV variable MPS_SESSION_ENCRYPTION_KEY
          secret: this.config.session_encryption_key || '<YourStrongRandomizedKey123!>',
          name: 'SessionSupport',
          resave: true,
          saveUninitialized: true,
          cookie: { secure: false }, // by default false. use true for prod like below.              
        };
      }

      this.webserver = new webServer(this)
      getDistributedKV(this).addEventWatch()
      this.CiraConnectionFactory = new CiraConnectionFactory(async (hostGuid) => {
        let socket = await MpsProxy.getSocketForGuid(hostGuid, this).then(ok => {
          log.debug(`retreived socket for guid: ${hostGuid}, result: ${JSON.stringify(ok, null, 4)}`)
        })
          .catch(err => {
            log.error(`failed to retreive socket for guid: ${hostGuid}, result: ${err}`)
          })
        let mpsProxy = await MpsProxy.get(this, hostGuid)
        mpsProxy.nodeid = hostGuid
        return mpsProxy
      })
      this.CiraChannelFactory = new CiraChannelFactory((mpsProxy, port) => mpsProxy.SetupCiraChannel(port, mpsProxy.nodeid)) // here socket passed would be Mps Proxy
    }
    else if (this.config.startup_mode === 'mps') { // Running in distributed mode
      this.mpsserver = new mpsServer(this) // MPS only takes in connections from web or devices. so no need to have a connection or channel factory
    }
    else {
      log.error("Unknown startup mode. Exiting.")
      process.exit(1)
    }
  }

  CIRAConnected (guid: string): void {
    log.info(`CIRA connection established for ${guid}`)

    if ('mps' === this.config.startup_mode) {
      // update DistributedKV with key as device UUID
      // and value as Server IP.f
      getDistributedKV(this).updateKV(guid).then((v) => log.debug(v)).catch((reason) => log.error(reason))
    }

    if (this.webserver) {
      this.webserver.notifyUsers({ host: guid, event: 'node_connection', status: 'connected' })
    }
  }

  CIRADisconnected (guid: string): void {
    log.info(`Main:CIRA connection closed for ${guid}`)

    if ('mps' === this.config.startup_mode) {
      // delete the KV pair in DistributedKV
      getDistributedKV(this).deleteKV(guid).then((v) => log.debug(v)).catch((reason) => log.error(reason))
    }
    else if ('web' === this.config.startup_mode) {
      if (MpsProxy.guidSockets[guid]) {
        log.silly('Cleaning up MpsProxy.guidSockets entry.')
        delete MpsProxy.guidSockets[guid]
      }
    }

    if (guid && this.mpsComputerList[guid]) {
      log.silly(`delete mpsComputerList[${guid}]`)
      delete this.mpsComputerList[guid]
      if (this.webserver) {
        this.webserver.notifyUsers({
          host: guid,
          event: 'node_connection',
          status: 'disconnected'
        })
      }
    }
  }
}
