/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
* Description: Interface for admin handle registry
**********************************************************************/

export interface IAdminHandler {
  name: string
  adminAction: (request: Request, response: Response) => any
}
