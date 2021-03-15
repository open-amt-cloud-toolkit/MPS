/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
* Author: Vinay G
**********************************************************************/

import { Consul } from "./consul"
import { configType } from "../models/Config";
import { MPSMicroservice } from "../mpsMicroservice";

export interface IDistributedKV {
    // Method to fetch the value from the key passed as arg
    lookup: (uuid: string) => Promise<string>;
    updateKV: (uuid: string) => Promise<any>;
    deleteKV: (uuid: string) => Promise<any>;
    addEventWatch()
}

// Factory method to create Distributed Key/Value pair class object
export function getDistributedKV(mpsservice: MPSMicroservice): IDistributedKV {
    // Create object for HashiCorp Consul
    if (mpsservice.config.distributed_kv_name === 'HashiCorpConsul') {
        return Consul.createObject(mpsservice);
    }
    else {
        throw ("Unknown distributed KV store name.")
    }
}


