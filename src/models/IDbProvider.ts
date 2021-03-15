import { Credentials } from './models'

/*********************************************************************
* Copyright (c) Intel Corporation 2020
* SPDX-License-Identifier: Apache-2.0
**********************************************************************/
export interface IDbProvider {
  CIRAAuth: (guid: string, username: string, password: string, cb: any) => any
  getAmtPassword: (uuid: string) => any
  IsGUIDApproved: (guid: string, cb: any) => any
  IsOrgApproved: (org: string, cb: any) => any
  getAllAmtCredentials: () => Credentials | Promise<Credentials>
}
