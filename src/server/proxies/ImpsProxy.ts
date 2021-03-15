
import { MpsProxy } from "./MpsProxy"
import { MPSMicroservice } from "../../mpsMicroservice"

export interface IMpsProxy {
    SetupCiraChannel(targetport, uuid);
}