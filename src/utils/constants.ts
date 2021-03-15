/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
**********************************************************************/

export const common = require('./common.js')
// WS-MAN libraries
export const amtPort = 16992

export const default_networking_adaptor = `eth0`;

export const UUIDRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

// HTTP error codes
export const httpErrorTable = {
  200: 'OK',
  400: 'Incorrect URI or Bad Request',
  401: 'Authentication Error',
  404: {
    device: 'Device not found/connected. Please connect again using CIRA.',
    method: 'Request does not contain method',
    noMethod: 'Requested method does not exists',
    payload: 'Request does not contain payload',
    guid: 'GUID does not exist in the payload',
    action: 'Power action type does not exist',
    invalidGuid: 'GUID empty/invalid'
  },
  408: 'Timeout Error',
  500: 'Internal Server Error',
  601: 'WSMAN Parsing Error',
  602: 'Unable to parse HTTP response header',
  603: 'Unexpected HTTP enum response',
  604: 'Unexpected HTTP pull response'
}

// Power Actions supported as per Distributed Management Task Force standard.
// ValueMap={2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}
// Values={Power On, Sleep - Light, Sleep - Deep, Power Cycle (Off Soft), Power Off - Hard, Hibernate, Power Off - Soft, Power Cycle (Off Hard), Master Bus Reset, Diagnostic Interrupt (NMI), Power Off - Soft Graceful, Power Off - Hard Graceful, Master Bus Reset Graceful, Power Cycle (Off - Soft Graceful), Power Cycle (Off - Hard Graceful)}
export const DMTFPowerStates = [2, 5, 8, 10, 4, 7, 12, 14, 100, 101, 104, 200, 201, 202, 203, 300, 301, 400, 401]

export const UserConsentOptions = {
  none: 0,
  kvm: 1,
  all: 0xFFFFFFFF
}

export const AMTFeaturesConst = {
  AMT_REDIR_SERVICE: 'AMT_RedirectionService',
  AMT_REDIR_LISTENER: 'ListenerEnabled',
  AMT_REDIR_STATE: 'EnabledState',
  AMT_KVM_REDIR: 'CIM_KVMRedirectionSAP',
  AMT_KVM_ENABLED_STATE: 'EnabledState',
  AMT_KVM_REQUESTED_STATE: 'RequestedState',
  AMT_OPTIN_SERVICE: 'IPS_OptInService',
  AMT_USER_CONSENT: 'OptInRequired'
}
