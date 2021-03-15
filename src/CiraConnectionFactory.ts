import { MPSMicroservice } from "./mpsMicroservice";
export class CiraConnectionFactory {
  factoryFn: (guid: any) => any
  constructor(factoryFn: (guid: any) => any ) {
    this.factoryFn = factoryFn
  }
  getConnection(uuid) {
    return this.factoryFn(uuid)
  }
}
