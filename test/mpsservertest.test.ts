/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
**********************************************************************/

import * as tls from 'tls'
import * as net from 'net'
import * as fs from 'fs'
import * as https from 'https'
import * as forge from 'node-forge'
import { certificates } from '../src/utils/certificates'
import { certificatesType, configType } from '../src/models/Config'
import * as path from 'path'
import { Database } from '../src/utils/db'
import { MPSMicroservice } from '../src/mpsMicroservice'
import { MPSServer } from '../src/server/mpsserver'
import { join } from 'path'

// Parsing configuration
const config: configType = {
  use_allowlist: false,
  common_name: 'localhost',
  port: 4433,
  username: 'standalone',
  pass: 'G@ppm0ym',
  use_global_mps_credentials: true,
  country: 'US',
  company: 'NoCorp',
  debug: true,
  listen_any: true,
  https: true,
  tls_offload: false,
  web_port: 3000,
  generate_certificates: true,
  debug_level: 5,
  logger_off: false,
  cert_format: 'file',
  cert_path: join(__dirname, 'private'),
  data_path: join(__dirname, 'private', 'data.json'),
  web_admin_user: 'standalone',
  web_admin_password: 'G@ppm0ym',
  session_encryption_key: 'key',
  mpsxapikey: 'testkey',
  connection_string: '',
  cors_origin:'*',
  cors_headers:'*',
  cors_methods:'*',
  mps_tls_config: {
    key: '../private/mpsserver-cert-private.key',
    cert: '../private/mpsserver-cert-public.crt',
    requestCert: true,
    rejectUnauthorized: false,
    minVersion: 'TLSv1',
    ciphers: null,
    secureOptions: ['SSL_OP_NO_SSLv2', 'SSL_OP_NO_SSLv3']
  },
  web_tls_config: {
    key: '../private/mpsserver-cert-private.key',
    cert: '../private/mpsserver-cert-public.crt',
    ca: ['../private/root-cert-public.crt'],
    secureOptions: ['SSL_OP_NO_SSLv2', 'SSL_OP_NO_SSLv3', 'SSL_OP_NO_COMPRESSION', 'SSL_OP_CIPHER_SERVER_PREFERENCE', 'SSL_OP_NO_TLSv1', 'SSL_OP_NO_TLSv11']
  }
}

const pki = forge.pki
let certs : certificatesType
const certPath = config.cert_path
let db: Database
let mpsService: MPSMicroservice
let mps: MPSServer

describe('MPS Server', function () {
  let server
  beforeAll(async function () {
    jest.setTimeout(60000)
    try {
      if (!fs.existsSync(certPath)) { fs.mkdirSync(certPath, { recursive: true }) }
    } catch (e) {
      console.log(`Failed to create Cert path ${certPath}. Create if it doesn't exist`)
    }
    certs = await certificates.generateCertificates(config, certPath)
    db = new Database(config)
    mpsService = new MPSMicroservice(config, db, certs)
    mps = new MPSServer(mpsService)

    // DB initialization
    server = mps
  })

  it('Accept TLS connection test', function (done) {
    const tlsOptions = { rejectUnauthorized: false, secureProtocol: 'TLSv1_1_method' }
    try {
      var socket = tls.connect(config.port, 'localhost', tlsOptions, function () {
        socket.end()
        done()
      })
    } catch (e) {
      done(e)
    }
  })

  it('Reject Non-TLS connection test', function (done) {
    const socket = new net.Socket()
    let terminated = false
    socket.on('end', function () {
      // check if it was previously terminated
      if (terminated) {
        done(new Error('Terminated not by TLS server'))
      } else {
        done()
      }
    })

    socket.on('data', function (data) {
      console.log(data)
    })

    socket.connect(config.port, function () {
      socket.write('1234567890\n')
      setTimeout(function () {
        terminated = true
        socket.end()
      }, 2000)
    })
  })

  it('Server Fingerprint Test', function (done) {
    const tlsOptions = { rejectUnauthorized: false, secureProtocol: 'TLSv1_1_method' }
    var socket = tls.connect(config.port, 'localhost', tlsOptions, function () {
      const fingerprint = socket.getPeerCertificate().fingerprint.toLowerCase().replace(/\:/gi, '')
      socket.end()

      // Generate Thumbprint of the certificate
      const md = forge.md.sha1.create()
      md.update(forge.asn1.toDer(forge.pki.certificateToAsn1(pki.certificateFromPem(mps.certs.mps_tls_config.cert))).getBytes())
      const serverFingerprint = md.digest().toHex()
      if (serverFingerprint == fingerprint) {
        done()
      } else {
        done(new Error('Certificate fingerprint mismatch'))
      }
    })
  })

  it('Get MPS details on HTTPS GET', function (done) {
    const get_options = {
      hostname: 'localhost',
      port: config.port,
      path: '/',
      method: 'GET',
      ca: certs.mps_tls_config.cert.ca,
      strictSSL: false,
      rejectUnauthorized: false
    }
    // console.log(get_options);
    https.get(get_options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        if (res.statusCode == 200) {
          done()
        } else {
          console.log('Status code and message from mps server', res.statusCode, res.statusMessage)
          done(new Error('Invalid status response'))
        }
      })
    }).on('error', (err) => {
      done(err)
    })
  })

  it('Validate UserAuth for a valid MPS connection request', function (done) {
    jest.setTimeout(60000)
    const obj : any = {}
    const args = {
      host: config.common_name,
      port: config.port,
      clientName: 'hostname-prefix',
      uuid: '12345678-9abc-def1-2345-123456789000', // GUID template, last few chars of the string will be replaced
      username: config.username, // mps username
      password: config.pass, // mps password
      keepalive: 10000, // interval for keepalive ping
      debug: false,
      testciraState: 'USERAUTH_SUCCESS' // USERAUTH_SERVICE_ACCEPT, PFWD_SERVICE_ACCEPT, GLOBAL_REQUEST_SUCCESS, USERAUTH_SUCCESS, USERAUTH_FAILURE, PROTOCOL_VERSION_SENT, KEEPALIVE_REPLY
    }

    obj.ciraclient = require('./helper/ciraclient.js').CreateCiraClient(obj, args)
    obj.ciraclient.connect(function () {
      obj.ciraclient.disconnect()
      done()
    })
  })

  it('Validate APF USERAUTH_SERVICE_ACCEPT Message', function (done) {
    jest.setTimeout(60000)
    const obj : any = {}
    const args = {
      host: config.common_name,
      port: config.port,
      clientName: 'hostname-prefix',
      uuid: '12345678-9abc-def1-2345-123456789000', // GUID template, last few chars of the string will be replaced
      username: config.username, // mps username
      password: config.pass, // mps password
      keepalive: 10000, // interval for keepalive ping
      debug: false,
      testciraState: 'USERAUTH_SERVICE_ACCEPT' // USERAUTH_SERVICE_ACCEPT, PFWD_SERVICE_ACCEPT, GLOBAL_REQUEST_SUCCESS, USERAUTH_SUCCESS, USERAUTH_FAILURE, PROTOCOL_VERSION_SENT, KEEPALIVE_REPLY
    }

    obj.ciraclient = require('./helper/ciraclient.js').CreateCiraClient(obj, args)
    obj.ciraclient.connect(function () {
      obj.ciraclient.disconnect()
      done()
    })
  })

  it('Validate APF PFWD_SERVICE_ACCEPT Message', function (done) {
    jest.setTimeout(60000)
    const obj:any = {}
    const args = {
      host: config.common_name,
      port: config.port,
      clientName: 'hostname-prefix',
      uuid: '12345678-9abc-def1-2345-123456789000', // GUID template, last few chars of the string will be replaced
      username: config.username, // mps username
      password: config.pass, // mps password
      keepalive: 10000, // interval for keepalive ping
      debug: false,
      testciraState: 'PFWD_SERVICE_ACCEPT' // USERAUTH_SERVICE_ACCEPT, PFWD_SERVICE_ACCEPT, GLOBAL_REQUEST_SUCCESS, USERAUTH_SUCCESS, USERAUTH_FAILURE, PROTOCOL_VERSION_SENT, KEEPALIVE_REPLY
    }

    obj.ciraclient = require('./helper/ciraclient.js').CreateCiraClient(obj, args)
    obj.ciraclient.connect(function () {
      obj.ciraclient.disconnect()
      done()
    })
  })

  it('Validate APF GLOBAL_REQUEST_SUCCESS Message', function (done) {
    jest.setTimeout(60000)
    const obj:any = {}
    const args = {
      host: config.common_name,
      port: config.port,
      clientName: 'hostname-prefix',
      uuid: '12345678-9abc-def1-2345-123456789000', // GUID template, last few chars of the string will be replaced
      username: config.username, // mps username
      password: config.pass, // mps password
      keepalive: 10000, // interval for keepalive ping
      debug: false,
      testciraState: 'GLOBAL_REQUEST_SUCCESS' // USERAUTH_SERVICE_ACCEPT, PFWD_SERVICE_ACCEPT, GLOBAL_REQUEST_SUCCESS, USERAUTH_SUCCESS, USERAUTH_FAILURE, PROTOCOL_VERSION_SENT, KEEPALIVE_REPLY
    }

    obj.ciraclient = require('./helper/ciraclient.js').CreateCiraClient(obj, args)
    obj.ciraclient.connect(function () {
      obj.ciraclient.disconnect()
      done()
    })
  })

  it('Validate APF PROTOCOL_VERSION_SENT Message', function (done) {
    jest.setTimeout(60000)
    const obj:any = {}
    const args = {
      host: config.common_name,
      port: config.port,
      clientName: 'hostname-prefix',
      uuid: '12345678-9abc-def1-2345-123456789000', // GUID template, last few chars of the string will be replaced
      username: config.username, // mps username
      password: config.pass, // mps password
      keepalive: 10000, // interval for keepalive ping
      debug: false,
      testciraState: 'PROTOCOL_VERSION_SENT' // USERAUTH_SERVICE_ACCEPT, PFWD_SERVICE_ACCEPT, GLOBAL_REQUEST_SUCCESS, USERAUTH_SUCCESS, USERAUTH_FAILURE, PROTOCOL_VERSION_SENT, KEEPALIVE_REPLY
    }

    obj.ciraclient = require('./helper/ciraclient.js').CreateCiraClient(obj, args)
    obj.ciraclient.connect(function () {
      obj.ciraclient.disconnect()
      done()
    })
  })

  it('Validate APF KEEPALIVE_REPLY Message', function (done) {
    jest.setTimeout(15000)
    const obj:any = {}
    const args = {
      host: config.common_name,
      port: config.port,
      clientName: 'hostname-prefix',
      uuid: '12345678-9abc-def1-2345-123456789000', // GUID template, last few chars of the string will be replaced
      username: config.username, // mps username
      password: config.pass, // mps password
      keepalive: 10000, // interval for keepalive ping
      debug: false,
      testciraState: 'KEEPALIVE_REPLY' // USERAUTH_SERVICE_ACCEPT, PFWD_SERVICE_ACCEPT, GLOBAL_REQUEST_SUCCESS, USERAUTH_SUCCESS, USERAUTH_FAILURE, PROTOCOL_VERSION_SENT, KEEPALIVE_REPLY
    }

    obj.ciraclient = require('./helper/ciraclient.js').CreateCiraClient(obj, args)
    obj.ciraclient.connect(function () {
      obj.ciraclient.disconnect()
      done()
    })
  })

  it('Validate APF USERAUTH_FAILURE Message (using wrong password)', function (done) {
    jest.setTimeout(60000)
    const obj:any = {}
    const args = {
      host: config.common_name,
      port: config.port,
      clientName: 'hostname-prefix',
      uuid: '12345678-9abc-def1-2345-123456789000', // GUID template, last few chars of the string will be replaced
      username: config.username, // mps username
      password: 'pasdbenaksd', // Invalid mps password
      keepalive: 10000, // interval for keepalive ping
      debug: false,
      testciraState: 'USERAUTH_FAILURE' // USERAUTH_SERVICE_ACCEPT, PFWD_SERVICE_ACCEPT, GLOBAL_REQUEST_SUCCESS, USERAUTH_SUCCESS, USERAUTH_FAILURE, PROTOCOL_VERSION_SENT, KEEPALIVE_REPLY
    }

    obj.ciraclient = require('./helper/ciraclient.js').CreateCiraClient(obj, args)
    obj.ciraclient.connect(function () {
      obj.ciraclient.disconnect()
      done()
    })
  })

  afterAll(function () {
    console.log('closing server')
    mps.server.close()
  })
})
