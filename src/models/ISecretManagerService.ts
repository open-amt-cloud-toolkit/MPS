/*********************************************************************
 * Copyright (c) Intel Corporation 2019
 * SPDX-License-Identifier: Apache-2.0
 * Description: stores amt profiles
 * Author: Ramu Bachala
 **********************************************************************/

export interface ISecretManagerService {
  getSecretFromKey: (path: string, key: string) => Promise<string>
  readJsonFromKey: (path: string, key: string) => Promise<string>
  getSecretAtPath: (path: string) => Promise<any>
  writeSecretWithKey: (path: string, key: string, keyvalue: any) => Promise<void>
  listSecretsAtPath: (path: string) => Promise<any>
}
