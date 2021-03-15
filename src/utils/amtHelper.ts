/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
**********************************************************************/

import { httpErrorTable } from './constants'

export const ErrorResponse = (status: number, errDesc?: string, error?: string): any => {
  let response
  if (error) {
    const errorMessage = httpErrorTable[status]
    response = { status: status, error: errorMessage[error] }
  } else {
    response = { status: status, error: httpErrorTable[status] }
  }
  if (errDesc) {
    response.errorDescription = errDesc
  }
  return response
}
