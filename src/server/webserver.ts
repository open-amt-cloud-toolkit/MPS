/*********************************************************************
* Copyright (c) Intel Corporation 2018-2019
* SPDX-License-Identifier: Apache-2.0
**********************************************************************/

/**
* @description Intel AMT Web server object
* @author Ylian Saint-Hilaire
* @version v0.2.0c
*/

import * as net from 'net'
import * as tls from 'tls'
import * as path from 'path'
import express from 'express'
import * as https from 'https'
import * as http from 'http'
import * as parser from 'body-parser'

import session from 'express-session'

import { configType, certificatesType } from '../models/Config'
import { amtRoutes } from '../routes/amtRoutes'
import { adminRoutes } from '../routes/adminRoutes'
import { ErrorResponse } from '../utils/amtHelper'
import { logger as log } from '../utils/logger'
import { constants, UUIDRegex } from '../utils/constants'
import { mpsMicroservice } from '../mpsMicroservice'
import { IDbProvider } from '../models/IDbProvider'

const interceptor = require('../utils/interceptor.js')
const WebSocket = require('ws')
const URL = require('url').URL

export class webServer {
  db: IDbProvider
  app: any
  users: any = {}
  server = null
  notificationwss = null
  relaywss = null
  mpsService: mpsMicroservice
  config: configType
  certs: certificatesType
  sessionParser: any

  constructor (mpsService: mpsMicroservice) {
    try {
      this.mpsService = mpsService
      this.db = this.mpsService.db
      this.config = this.mpsService.config
      this.certs = this.mpsService.certs
      this.app = express()
      this.notificationwss = new WebSocket.Server({ noServer: true })
      this.relaywss = new WebSocket.Server({ noServer: true })
      const amt = new amtRoutes(this.mpsService)
      const admin = new adminRoutes(this.mpsService)

      // Create Server
      const appConfig = this.config
      if (this.config.https) {
        this.server = https.createServer(this.certs.web_tls_config, this.app)
      } else {
        this.server = http.createServer(this.app)
      }

      this.app.use((req, res, next) => {
        // Clickjacking defence
        res.setHeader('X-Frame-Options', 'SAMEORIGIN')
        const allowedOrigins: string[]= this.config.cors_origin.split(',').map((domain) => {
          return domain.trim()
        })
          res.header('Access-Control-Allow-Credentials', 'true')
          if (allowedOrigins.includes(req.headers.origin)) {
            res.setHeader('Access-Control-Allow-Origin', req.headers.origin)
          }else{
            res.setHeader('Access-Control-Allow-Origin', "*")
          }
          if (this.config.cors_headers != null && this.config.cors_headers !== '') {
            res.setHeader('Access-Control-Allow-Headers', this.config.cors_headers)
          }else{
            res.setHeader('Access-Control-Allow-Headers', "*")
          }
          if (req.method === 'OPTIONS') {
            if (this.config.cors_methods != null && this.config.cors_methods !== '') {
              res.setHeader('Access-Control-Allow-Methods', this.config.cors_methods)
            } else {
              res.setHeader('Access-Control-Allow-Methods', '*')
            }
            return res.status(200).end()
          }
          next()
      })

      // Session Configuration
      const sess: any = {
        // Strongly recommended to change this key for Production thru ENV variable MPS_SESSION_ENCRYPTION_KEY

        secret: this.config.session_encryption_key || '<YourStrongRandomizedKey123!>',
        resave: true,
        saveUninitialized: true,
        cookie: { secure: false } // by default false. use true for prod like below.
      }
      if (this.config.auth_enabled) {
        sess.cookie.secure = true
        sess.cookie.sameSite = 'none'
      }

      // express-session config for production
      if (this.app.get('env') === 'production') {
        this.app.set('trust proxy', 1) // trust first proxy
        sess.cookie.secure = true // serve secure cookies
        sess.cookie.maxAge = 24 * 60 * 60 * 1000 // limiting cookie age to a day.
      }
      // Initialize session
      this.sessionParser = session(sess)
      this.app.use(this.sessionParser)

      // Indicates to ExpressJS that the public folder should be used to serve static files.
      this.app.use(parser.urlencoded({ extended: true }))
      // Handles the Bad JSON exceptions
      this.app.use(parser.json(), (err, req, res, next) => {
        if (err instanceof SyntaxError) {
          return res.status(400).send(ErrorResponse(400))
        }
        next()
      })

      this.app.post('/authorize', function (request, response) {
        const username = request.body.username
        const password = request.body.password
        if (username && password) {
          // todo: implement a more advanced authentication system and RBAC
          if (username === appConfig.web_admin_user && password === appConfig.web_admin_password) {
            request.session.loggedin = true
            request.session.username = username
            response.status(200).send()
          } else {
            response.status(403).send('Incorrect Username and/or Password!')
          }
          response.end()
        } else {
          response.send('Please enter Username and Password!')
          response.end()
        }
      })
      this.app.get('/logout', function (request, response) {
        if (request.session) {
          request.session.destroy()
        }
        response.status(200).end()
      })

      // Console connects to this websocket for a persistent connection
      this.notificationwss.on('connection', async (ws, req) => {
        this.users[ws] = ws
        // log.debug("New control websocket.");
        ws.on('message', msg => {
          log.debug(`Incoming control message from browser: ${msg}`)
        })

        ws.on('close', req => {
          // log.debug("Closing control websocket.");
          delete this.users[ws]
        })
      })

      // Relay websocket. KVM & SOL use this websocket.
      this.relaywss.on('connection', async (ws, req) => {
        try {
          const base = `${this.config.https ? 'https' : 'http'}://${this.config.common_name}:${this.config.web_port}/`
          const req_query_url = new URL(req.url, base)
          req.query = {
            host: req_query_url.searchParams.get('host'),
            port: req_query_url.searchParams.get('port'),
            p: req_query_url.searchParams.get('p'),
            tls: req_query_url.searchParams.get('tls'),
            tls1only: req_query_url.searchParams.get('tls1only')
          }
          ws._socket.pause()
          // console.log('Socket paused', ws._socket);

          // When data is received from the web socket, forward the data into the associated TCP connection.
          // If the TCP connection is pending, buffer up the data until it connects.
          ws.on('message', msg => {
            // Convert a buffer into a string, "msg = msg.toString('ascii');" does not work
            // var msg2 = "";
            // for (var i = 0; i < msg.length; i++) { msg2 += String.fromCharCode(msg[i]); }
            // msg = msg2;
            msg = msg.toString('binary')

            if (ws.interceptor) {
              msg = ws.interceptor.processBrowserData(msg)
            } // Run data thru interceptor
            ws.forwardclient.write(msg) // Forward data to the associated TCP connection.
          })

          // If the web socket is closed, close the associated TCP connection.
          ws.on('close', () => {
            log.debug(
              `Closing web socket connection to  ${req.query.host}: ${req.query.port}.`
            )
            if (ws.forwardclient) {
              if (ws.forwardclient.close) {
                ws.forwardclient.close()
              }
              try {
                if (ws.forwardclient.destroy) { ws.forwardclient.destroy() }
              } catch (e) {
                log.error(`Exception while destroying AMT CIRA channel: ${e}`)
              }
            }
          })

          // We got a new web socket connection, initiate a TCP connection to the target Intel AMT host/port.
          log.debug(
            `Opening web socket connection to ${req.query.host}: ${req.query.port}.`
          )

          // Fetch Intel AMT credentials & Setup interceptor
          const credentials = await this.db.getAmtPassword(req.query.host)
          // obj.debug("Credential for " + req.query.host + " is " + JSON.stringify(credentials));

          if (credentials != null) {
            log.debug('Creating credential')
            if (req.query.p == 1) {
              ws.interceptor = interceptor.CreateHttpInterceptor({
                host: req.query.host,
                port: req.query.port,
                user: credentials[0],
                pass: credentials[1]
              })
            } else if (req.query.p == 2) {
              ws.interceptor = interceptor.CreateRedirInterceptor({
                user: credentials[0],
                pass: credentials[1]
              })
            }
          }

          if (req.query.tls == 0) {
            // If this is TCP (without TLS) set a normal TCP socket
            // check if this is MPS connection
            const uuid = req.query.host
            if (uuid && this.mpsService.mpsserver.ciraConnections[uuid]) {
              const ciraconn = this.mpsService.mpsserver.ciraConnections[uuid]
              ws.forwardclient = this.mpsService.mpsserver.SetupCiraChannel(
                ciraconn,
                req.query.port
              )

              ws.forwardclient.xtls = 0
              ws.forwardclient.onData = (ciraconn, data) => {
                // Run data thru interceptor
                if (ws.interceptor) {
                  data = ws.interceptor.processAmtData(data)
                }
                try {
                  ws.send(data)
                } catch (e) {
                  log.error(`Exception while forwarding data to client: ${e}`)
                }
              }

              ws.forwardclient.onStateChange = (ciraconn, state) => {
                // console.log('Relay CIRA state change:'+state);
                if (state == 0) {
                  try {
                    // console.log("Closing websocket.");
                    ws.close()
                  } catch (e) {
                    log.error(`Exception while closing client websocket connection: ${e}`)
                  }
                }
              }
              ws._socket.resume()
            } else {
              ws.forwardclient = new net.Socket()
              ws.forwardclient.setEncoding('binary')
              ws.forwardclient.forwardwsocket = ws
            }
          } else {
            // If TLS is going to be used, setup a TLS socket
            log.info('TLS Enabled!')
            const tlsoptions = {
              secureProtocol:
                req.query.tls1only == 1 ? 'TLSv1_method' : 'SSLv23_method',
              ciphers: 'RSA+AES:!aNULL:!MD5:!DSS',
              secureOptions:
                constants.SSL_OP_NO_SSLv2 |
                constants.SSL_OP_NO_SSLv3 |
                constants.SSL_OP_NO_COMPRESSION |
                constants.SSL_OP_CIPHER_SERVER_PREFERENCE,
              rejectUnauthorized: false
            }
            ws.forwardclient = tls.connect(
              req.query.port,
              req.query.host,
              tlsoptions,
              () => {
                // The TLS connection method is the same as TCP, but located a bit differently.
                log.debug(`TLS connected to ${req.query.host}: ${req.query.port}.`)
                ws._socket.resume()
              }
            )
            ws.forwardclient.setEncoding('binary')
            ws.forwardclient.forwardwsocket = ws
          }

          // Add handlers to socket.
          if (ws.forwardclient instanceof net.Socket) {
            // When we receive data on the TCP connection, forward it back into the web socket connection.
            ws.forwardclient.on('data', data => {
              if (ws.interceptor) {
                data = ws.interceptor.processAmtData(data)
              } // Run data thru interceptor
              try {
                ws.send(data)
              } catch (e) {
                log.error(`Exception while forwarding data to client: ${e}`)
              }
            })

            // If the TCP connection closes, disconnect the associated web socket.
            ws.forwardclient.on('close', () => {
              log.debug(
                `TCP disconnected from ${req.query.host} : ${req.query.port}.`
              )
              try {
                ws.close()
              } catch (e) { }
            })

            // If the TCP connection causes an error, disconnect the associated web socket.
            ws.forwardclient.on('error', err => {
              log.debug(
                `TCP disconnected with error from ${req.query.host}:${
                req.query.port
                }:${err.code},${req.url}`
              )
              try {
                ws.close()
              } catch (e) { }
            })
          }

          if (req.query.tls == 0) {
            if (!this.mpsService.mpsComputerList[req.query.host]) {
              // A TCP connection to Intel AMT just connected, send any pending data and start forwarding.
              ws.forwardclient.connect(req.query.port, req.query.host, () => {
                log.debug(`TCP connected to ${req.query.host}:${req.query.port}.`)
                ws._socket.resume()
              })
            }
          }
        } catch (err) {
          log.error('Exception Caught: ', err)
        }
      })

      // Validates GUID format
      this.app.use((req, res, next) => {
        const method = req.body.method
        const payload = req.body.payload || {}
        if (method) {
          if (payload && payload.guid !== undefined) {
            if (!UUIDRegex.test(payload.guid)) {
              return res.status(404).send(ErrorResponse(404, null, 'invalidGuid'))
            }
          }
          next()
        } else {
          return res.status(404).send(ErrorResponse(404, null, 'method'))
        }
      })

      // Routes
      this.app.use('/amt', this.isAuthenticated, amt.router)
      this.app.use('/admin', this.isAuthenticated, admin.router)

      // Handle upgrade on websocket
      this.server.on('upgrade', (request, socket, head) => {
        this.sessionParser(request, {}, () => {
          if (!this.config.auth_enabled || (request.session && request.session.loggedin === true)) { // Validate if the user session is active and valid. TODO: Add user validation if needed
            this.handleUpgrade(request, socket, head)
          }
          // else if (request.headers['X-MPS-API-Key'] && //Validate REST API key
          //   request.headers['X-MPS-API-Key'] === this.config.mpsxapikey) {
          //   this.handleUpgrade(request, socket, head)
          // }
          else { // Auth failed
            log.error('WebSocket authentication failed. Closing connection...')
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
            socket.destroy()
          }
        })
      })

      // Validate port number
      let port = 3000
      if (this.config.web_port != null) {
        port = this.config.web_port
      }
      if (isNaN(port) || port == null || typeof port !== 'number' || port < 0 || port > 65536) {
        port = 3000
      }

      // Start the ExpressJS web server
      if (this.config.https) {
        if (this.config.listen_any && this.config.listen_any) {
          this.server.listen(port, () => {
            log.info(
              `MPS Microservice running on https://${
              this.config.common_name
              }:${port}.`
            )
          })
        } else {
          // Only accept request from local host
          this.server.listen(port, '127.0.0.1', () => {
            log.info(`MPS Microservice running on https://127.0.0.1:${port}.`)
          })
        }
      } else {
        if (this.config.listen_any && this.config.listen_any) {
          this.server.listen(port, () => {
            log.info(
              `MPS Microservice running on http://${
              this.config.common_name
              }:${port}.`
            )
          })
        } else {
          this.server.listen(port, '127.0.0.1', () => {
            log.info(`MPS Microservice running on http://127.0.0.1:${port}.`)
          })
        }
      }
    } catch (error) {
      log.error(`Exception in webserver: ${error}`)
    }
  }

  // Authentication for REST API and Web User login
  isAuthenticated = (req, res, next) => {
    if (!this.config.auth_enabled || req.session.loggedin) {
      return next()
    }

    if (req.header('User-Agent').startsWith('Mozilla')) {
      // all browser calls that are not authenticated
      if (
        // This is to handle REST API calls from browser.
        req.method == 'POST' && (req.originalUrl.indexOf('/amt') >= 0 || req.originalUrl.indexOf('/admin') >= 0)
      ) {
        res.status(401).end('Authentication failed or Login Expired. Please try logging in again.')
        return
      }
      res.redirect('/')
      return
    }

    // other api calls
    if (req.header('X-MPS-API-Key') !== this.config.mpsxapikey) {
      res.status(401).end('API key authentication failed. Please try again.')
    } else { return next() }
  }

  // Handle Upgrade - WebSocket
  handleUpgrade (request, socket, head) {
    const base = `${this.config.https ? 'https' : 'http'}://${this.config.common_name}:${this.config.web_port}/`
    const pathname = (new URL(request.url, base)).pathname
    if (pathname === '/notifications/control.ashx') {
      this.notificationwss.handleUpgrade(request, socket, head, (ws) => {
        this.notificationwss.emit('connection', ws, request)
      })
    } else if (pathname === '/relay/webrelay.ashx') {
      this.relaywss.handleUpgrade(request, socket, head, (ws) => {
        this.relaywss.emit('connection', ws, request)
      })
    } else { // Invalid endpoint
      log.info('Route does not exist. Closing connection...')
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
    }
  }

  // Notify clients connected through browser web socket
  notifyUsers (msg) {
    for (const i in this.users) {
      try {
        this.users[i].send(JSON.stringify(msg))
      } catch (error) {
        log.error(error)
      }
    }
  }
}
