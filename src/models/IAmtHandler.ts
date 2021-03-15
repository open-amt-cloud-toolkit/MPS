/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
* Description: Interface for AMT handle registry
**********************************************************************/

export interface IAmtHandler {
  name: string
  AmtAction: (request: Request, response: Response) => any
}
