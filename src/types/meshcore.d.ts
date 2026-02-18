declare module "@liamcottle/meshcore.js" {
  export interface MeshcoreContact {
    publicKey: Uint8Array;
    type: number;
    flags: number;
    outPathLen: number;
    advName: string;
    lastAdvert: number;
    advLat: number;
    advLon: number;
    lastMod: number;
  }

  export interface MeshcoreDeviceInfo {
    firmwareVer: number;
    firmware_build_date: string;
    manufacturerModel: string;
  }

  export interface MeshcoreSelfInfo {
    name: string;
    type: number;
    txPower: number;
    maxTxPower: number;
    publicKey: Uint8Array;
    advLat: number;
    advLon: number;
    radioFreq: number;
    radioBw: number;
    radioSf: number;
    radioCr: number;
  }

  export interface MeshcoreBatteryVoltage {
    batteryMilliVolts: number;
  }

  export class WebBleConnection {
    constructor();
    static open(): Promise<WebBleConnection>;
    bleDevice?: { name?: string };
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    close(): Promise<void>;
    on<T = unknown>(event: number | string, callback: (data: T) => void): void;
    off<T = unknown>(event: number | string, callback: (data: T) => void): void;
    deviceQuery(query: number): Promise<unknown>;
    getContacts(): Promise<MeshcoreContact[]>;
    getSelfInfo(): Promise<MeshcoreSelfInfo>;
    getBatteryVoltage(): Promise<MeshcoreBatteryVoltage>;
    sendAdvert(type: number): Promise<void>;
    setAdvertLatLong(lat: number, lon: number): Promise<void>;
    sendToRadioFrame(frame: Uint8Array): Promise<void>;
    sign(data: Uint8Array): Promise<Uint8Array | ArrayBuffer | number[]>;
  }

  export const Constants: {
    ResponseCodes: {
      Contact: number;
      DeviceInfo: number;
      SelfInfo: number;
      BatteryVoltage: number;
      [key: string]: number;
    };
    PushCodes: {
      Advert: number;
      NewAdvert: number;
      LogRxData: number;
      [key: string]: number;
    };
    SelfAdvertTypes: {
      Flood: number;
      ZeroHop: number;
      [key: string]: number;
    };
    SupportedCompanionProtocolVersion: number;
    [key: string]: unknown;
  };
}
