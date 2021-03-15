/**
* @fileoverview Script Compiler / Decompiler / Runner
* @author Ylian Saint-Hilaire
* @copyright Intel Corporation 2018
* @license Apache-2.0
* @version v0.1.0e
*/

import * as fs from 'fs'
import { logger as log } from './logger'
import { certificatesType, mpsConfigType, webConfigType, certAndKeyType } from '../models/Config'
import { CertificateOperations } from './certoperations.js'
import path from 'path'

const certoperation = CertificateOperations()

export class certificates {
  static generateCertificates (config, certpath): certificatesType {
    let mpsCertAndKey: certAndKeyType
    let rootCertificate, rootPrivateKey
    let rootCertAndKey: certAndKeyType
    let mpsCertificate, mpsPrivateKey
    const rootCertPath = path.join(certpath, '/root-cert-public.crt')
    const rootCertPrivateKeyPath = path.join(certpath, '/root-cert-private.key')
    const mpsserverCertPath = path.join(certpath, '/mpsserver-cert-public.crt')
    const mpsserverCertPrivateKeyPath = path.join(certpath, '/mpsserver-cert-private.key')
    if (fs.existsSync(rootCertPath) && fs.existsSync(rootCertPrivateKeyPath)) {
      // load certificate
      rootCertificate = fs.readFileSync(rootCertPath, 'utf8')
      rootPrivateKey = fs.readFileSync(rootCertPrivateKeyPath, 'utf8')
      rootCertAndKey = { cert: certoperation.pki.certificateFromPem(rootCertificate), key: certoperation.pki.privateKeyFromPem(rootPrivateKey) }
    } else {
      log.info('Generating Root certificate...')
      rootCertAndKey = certoperation.GenerateRootCertificate(true, 'MPSRoot', null, null, true)
      rootCertificate = certoperation.pki.certificateToPem(rootCertAndKey.cert)
      rootPrivateKey = certoperation.pki.privateKeyToPem(rootCertAndKey.key)
      fs.writeFileSync(rootCertPath, rootCertificate)
      fs.writeFileSync(rootCertPrivateKeyPath, rootPrivateKey)
    }

    if (fs.existsSync(mpsserverCertPath) && fs.existsSync(mpsserverCertPrivateKeyPath)) {
      // Keep the console certificate we have
      mpsCertificate = fs.readFileSync(mpsserverCertPath, 'utf8')
      mpsPrivateKey = fs.readFileSync(mpsserverCertPrivateKeyPath, 'utf8')
      mpsCertAndKey = { cert: certoperation.pki.certificateFromPem(mpsCertificate), key: certoperation.pki.privateKeyFromPem(mpsPrivateKey) }
    } else {
      log.info('Generating Intel AMT MPS certificate...')
      mpsCertAndKey = certoperation.IssueWebServerCertificate(rootCertAndKey, false, config.common_name, config.country, config.organization, null, false)
      mpsCertificate = certoperation.pki.certificateToPem(mpsCertAndKey.cert)
      mpsPrivateKey = certoperation.pki.privateKeyToPem(mpsCertAndKey.key)
      fs.writeFileSync(mpsserverCertPath, mpsCertificate)
      fs.writeFileSync(mpsserverCertPrivateKeyPath, mpsPrivateKey)
    }

    // Set MPS TLS Configuration
    const mpsConfig: mpsConfigType = { cert: mpsCertificate, key: mpsPrivateKey, minVersion: 'TLSv1', requestCert: true, rejectUnauthorized: false }

    // Set WebServer TLS Configuration
    // certificates.web.root.key = rootPrivateKey;
    const webConfig: webConfigType = { ca: rootCertificate, cert: mpsCertificate, key: mpsPrivateKey }

    const certificates: certificatesType = { mps_tls_config: mpsConfig, web_tls_config: webConfig }

    return certificates// return mps and web certificates
  }
}
