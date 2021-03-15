/*********************************************************************
 * Copyright (c) Intel Corporation 2020
 * SPDX-License-Identifier: Apache-2.0
 * Description: To get and set AMT Features
 * Author: Madhavi Losetty
 **********************************************************************/

import { MPSValidationError } from './MPSValidationError'
import { AMTFeaturesConst, UserConsentOptions } from './constants'

export class AMTFeatures {
  static async getAMTFeatures (amtstack: any, payload: any): Promise<any> {
    return await new Promise((resolve, reject) => {
      amtstack.BatchEnum('', ['*IPS_OptInService', '*AMT_RedirectionService', '*CIM_KVMRedirectionSAP'], (stack, name, wsmanResponse, status) => {
        if (status !== 200) {
          reject(new MPSValidationError(`Failed AMT features BatchEnum Exec for guid : ${payload.guid}.`))
        } else {
          resolve(wsmanResponse)
        }
      })
    })
  }

  static async setAMTFeatures (amtstack: any, payload: any): Promise<void> {
    const wsmanResponse = await AMTFeatures.getAMTFeatures(amtstack, payload)
    const amtRedirResponse = wsmanResponse[AMTFeaturesConst.AMT_REDIR_SERVICE].response
    const kvmRedirResponse = wsmanResponse[AMTFeaturesConst.AMT_KVM_REDIR].response
    let isRedirectionChanged = false

    if (wsmanResponse[AMTFeaturesConst.AMT_REDIR_SERVICE] && wsmanResponse[AMTFeaturesConst.AMT_KVM_REDIR]) {
      let redir, sol, ider, kvm

      redir = (amtRedirResponse[AMTFeaturesConst.AMT_REDIR_LISTENER] === true)
      sol = ((amtRedirResponse[AMTFeaturesConst.AMT_REDIR_STATE] & 2) !== 0)
      ider = ((amtRedirResponse[AMTFeaturesConst.AMT_REDIR_STATE] & 1) !== 0)

      if (payload.enableSOL !== undefined && payload.enableSOL !== sol) {
        sol = payload.enableSOL
        isRedirectionChanged = true
      }
      if (payload.enableIDER !== undefined && payload.enableIDER !== ider) {
        ider = payload.enableIDER
        isRedirectionChanged = true
      }
      if ((sol || ider) && !redir) {
        isRedirectionChanged = true
      }

      kvm = ((kvmRedirResponse[AMTFeaturesConst.AMT_KVM_ENABLED_STATE] === 6 && kvmRedirResponse[AMTFeaturesConst.AMT_KVM_REQUESTED_STATE] === 2) ||
                kvmRedirResponse[AMTFeaturesConst.AMT_KVM_ENABLED_STATE] === 2 || kvmRedirResponse[AMTFeaturesConst.AMT_KVM_ENABLED_STATE] === 6)
      if (payload.enableKVM !== undefined && payload.enableKVM !== kvm) {
        kvm = payload.enableKVM
        isRedirectionChanged = true
      }
      if (isRedirectionChanged && (sol || ider || kvm)) {
        redir = true
      } else if (isRedirectionChanged && !sol && !ider && !kvm) {
        redir = false
      }
      if (isRedirectionChanged) {
        amtRedirResponse[AMTFeaturesConst.AMT_REDIR_STATE] = 32768 + ((ider ? 1 : 0) + (sol ? 2 : 0))
        amtRedirResponse[AMTFeaturesConst.AMT_REDIR_LISTENER] = redir
        await AMTFeatures.setRedirectionService(amtstack, amtRedirResponse, kvm, payload)
      }
    }

    if (wsmanResponse[AMTFeaturesConst.AMT_OPTIN_SERVICE]) {
      const optServiceRes = wsmanResponse[AMTFeaturesConst.AMT_OPTIN_SERVICE].response
      if (payload.userConsent) {
        const key = payload.userConsent.toLowerCase()
        const OptInRequiredValue = UserConsentOptions[key]
        if (optServiceRes[AMTFeaturesConst.AMT_USER_CONSENT] !== OptInRequiredValue) {
          optServiceRes[AMTFeaturesConst.AMT_USER_CONSENT] = OptInRequiredValue
          await AMTFeatures.setUserConsent(amtstack, optServiceRes, payload)
        }
      }
    }
  }

  static async setRedirectionService (amtstack: any, amtRedirResponse: any, kvm: any, payload: any): Promise<boolean> {
    return await new Promise((resolve, reject) => {
      amtstack.AMT_RedirectionService_RequestStateChange(amtRedirResponse.EnabledState, (stack, name, response, status) => {
        if (status !== 200) {
          reject(new MPSValidationError(`Failed Redir Request State Change for guid : ${payload.guid}.`, status))
        } else {
          amtstack.CIM_KVMRedirectionSAP_RequestStateChange(kvm ? 2 : 3, 0, (stack, name, response, status) => {
            if (status !== 200) {
              reject(new MPSValidationError(`Failed to update KVM Redirection Service for guid : ${payload.guid}.`, status))
            }
            amtstack.Put(AMTFeaturesConst.AMT_REDIR_SERVICE, amtRedirResponse, (stack, name, kvmRedirResponse, status) => {
              if (status !== 200) {
                reject(new MPSValidationError(`Failed AMT RedirectionService update for guid : ${payload.guid}.`, status))
              }
              resolve(true)
            })
          })
        }
      })
    })
  }

  static async setUserConsent (amtstack: any, optServiceRes: any, payload: any): Promise<boolean> {
    return await new Promise((resolve, reject) => {
      amtstack.Put(AMTFeaturesConst.AMT_OPTIN_SERVICE, optServiceRes, (stack, name, response, status) => {
        if (status !== 200) {
          reject(new MPSValidationError(`Failed to get OptInService guid : ${payload.guid}.`, status))
        }
        resolve(true)
      }, 0, 1)
    })
  }
}
