/*********************************************************************
 * Copyright (c) Intel Corporation 2020
 * SPDX-License-Identifier: Apache-2.0
 * Author: Madhavi Losetty
 **********************************************************************/
import * as fs from 'fs'
import * as path from 'path'

import { certificatesType, configType } from '../src/models/Config'
import { Database } from '../src/utils/db'
import { MPSMicroservice } from '../src/mpsMicroservice'
import { MPSServer } from '../src/server/mpsserver'
import { certificates } from '../src/utils/certificates'
import { SetAMTFeaturesHandler } from '../src/controllers/AMT/SetAMTFeaturesHandler'
import { MPSValidationError } from '../src/utils/MPSValidationError'
import { join } from 'path'

//  Parsing configuration
const config: configType = {
  use_allowlist: true,
  common_name: 'localhost',
  port: 4433,
  username: 'standalone',
  pass: 'P@ssw0rd',
  use_global_mps_credentials: true,
  country: 'US',
  company: 'NoCorp',
  debug: true,
  listen_any: true,
  https: true,
  tls_offload: false,
  web_port: 3000,
  generate_certificates: true,
  debug_level: 2,
  logger_off: false,
  data_path: join(__dirname, 'private', 'data.json'),
  cert_format: 'file',
  cert_path: join(__dirname, 'private'),
  session_encryption_key: 'TestKey',
  web_admin_user: 'standalone',
  web_admin_password: 'G@ppm0ym',
  mpsxapikey: 'testapikey',
  cors_origin:'*',
  cors_headers:'*',
  cors_methods:'*',
  connection_string: '',
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

let certs : certificatesType
const certPath = path.join(__dirname, 'private')
const dbPath = path.join(__dirname, 'private')
let db: Database
let mpsService: MPSMicroservice
let mps: MPSServer
let amtFeatures: SetAMTFeaturesHandler

describe('AMTFeaturesHandler', function () {
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

    amtFeatures = new SetAMTFeaturesHandler(mpsService)
  })

  test('No flags to set AMT features in payload should fail', () => {
    let mpsValidationError = null
    const payload = {
      guid: '4bac9510-04a6-4321-bae2-d45ddf07b684'
    }
    try {
      amtFeatures.validatePayload(payload)
    } catch (error) {
      mpsValidationError = error
    }
    expect(mpsValidationError).toBeInstanceOf(MPSValidationError)
    expect(mpsValidationError.message).toEqual(`Device : ${payload.guid} to set AMT features,at least on flag is mandatory.\n userConsent:"kvm/all/none" \n enableRedir: true/false \n enableSOL: true/false \n enableIDER: true/false \n enableKVM: true/false`)
  })

  test('userConsent with numeric value should fail', () => {
    let mpsValidationError = null
    const payload = {
      guid: '4bac9510-04a6-4321-bae2-d45ddf07b684',
      userConsent: 1
    }
    try {
      amtFeatures.validatePayload(payload)
    } catch (error) {
      mpsValidationError = error
    }
    expect(mpsValidationError).toBeInstanceOf(MPSValidationError)
    expect(mpsValidationError.message).toEqual(`Device : ${payload.guid} User Consent should be \"kvm/all/none\"`)
  })

  test('userConsent with invalid string value should fail', () => {
    let mpsValidationError = null
    const payload = {
      guid: '4bac9510-04a6-4321-bae2-d45ddf07b684',
      userConsent: 'sol'
    }
    try {
      amtFeatures.validatePayload(payload)
    } catch (error) {
      mpsValidationError = error
    }
    expect(mpsValidationError).toBeInstanceOf(MPSValidationError)
    expect(mpsValidationError.message).toEqual(`Device : ${payload.guid} User Consent should be \"kvm/all/none\"`)
  })

  test('enableSOL with numeric value should fail', () => {
    let mpsValidationError = null
    const payload = {
      guid: '4bac9510-04a6-4321-bae2-d45ddf07b684',
      userConsent: 'KVM',
      enableSOL: 1
    }
    try {
      amtFeatures.validatePayload(payload)
    } catch (error) {
      mpsValidationError = error
    }
    expect(mpsValidationError).toBeInstanceOf(MPSValidationError)
    expect(mpsValidationError.message).toEqual(`Device : ${payload.guid} enableSOL should be boolean`)
  })

  test('enableSOL with string value should fail', () => {
    let mpsValidationError = null
    const payload = {
      guid: '4bac9510-04a6-4321-bae2-d45ddf07b684',
      userConsent: 'KVM',
      enableSOL: 'test'
    }
    try {
      amtFeatures.validatePayload(payload)
    } catch (error) {
      mpsValidationError = error
    }
    expect(mpsValidationError).toBeInstanceOf(MPSValidationError)
    expect(mpsValidationError.message).toEqual(`Device : ${payload.guid} enableSOL should be boolean`)
  })

  test('enableIDER with numeric value should fail', () => {
    let mpsValidationError = null
    const payload = {
      guid: '4bac9510-04a6-4321-bae2-d45ddf07b684',
      userConsent: 'NONE',
      enableSOL: true,
      enableIDER: 1
    }
    try {
      amtFeatures.validatePayload(payload)
    } catch (error) {
      mpsValidationError = error
    }
    expect(mpsValidationError).toBeInstanceOf(MPSValidationError)
    expect(mpsValidationError.message).toEqual(`Device : ${payload.guid} enableIDER should be boolean`)
  })

  test('enableIDER with string value should fail', () => {
    let mpsValidationError = null
    const payload = {
      guid: '4bac9510-04a6-4321-bae2-d45ddf07b684',
      userConsent: 'ALL',
      enableSOL: true,
      enableIDER: 'test'
    }
    try {
      amtFeatures.validatePayload(payload)
    } catch (error) {
      mpsValidationError = error
    }
    expect(mpsValidationError).toBeInstanceOf(MPSValidationError)
    expect(mpsValidationError.message).toEqual(`Device : ${payload.guid} enableIDER should be boolean`)
  })

  test('enableIDER with numeric value should fail', () => {
    let mpsValidationError = null
    const payload = {
      guid: '4bac9510-04a6-4321-bae2-d45ddf07b684',
      userConsent: 'NONE',
      enableSOL: true,
      enableIDER: false,
      enableKVM: 1
    }
    try {
      amtFeatures.validatePayload(payload)
    } catch (error) {
      mpsValidationError = error
    }
    expect(mpsValidationError).toBeInstanceOf(MPSValidationError)
    expect(mpsValidationError.message).toEqual(`Device : ${payload.guid} enableKVM should be boolean`)
  })

  test('enableKVM with string value should fail', () => {
    let mpsValidationError = null
    const payload = {
      guid: '4bac9510-04a6-4321-bae2-d45ddf07b684',
      userConsent: 'ALL',
      enableSOL: true,
      enableIDER: true,
      enableKVM: 'test'
    }
    try {
      amtFeatures.validatePayload(payload)
    } catch (error) {
      mpsValidationError = error
    }
    expect(mpsValidationError).toBeInstanceOf(MPSValidationError)
    expect(mpsValidationError.message).toEqual(`Device : ${payload.guid} enableKVM should be boolean`)
  })

  test('userConsent with value as kvm and redir, SOL, KVM, IDER with booleans should pass', () => {
    let mpsValidationError = null
    const payload = {
      guid: '4bac9510-04a6-4321-bae2-d45ddf07b684',
      userConsent: 'kvm',
      enableSOL: true,
      enableIDER: true,
      enableKVM: true
    }
    try {
      amtFeatures.validatePayload(payload)
    } catch (error) {
      mpsValidationError = error
    }
    expect(mpsValidationError).toEqual(null)
  })

  afterAll(() => {
    console.log('closing server')
    mps.server.close()
  })
})
