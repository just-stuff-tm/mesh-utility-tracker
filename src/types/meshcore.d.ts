declare module "@liamcottle/meshcore.js" {
  export class WebBleConnection {
    constructor();
    static open(): Promise<WebBleConnection>;
    bleDevice?: { name?: string };
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    on(event: number | string, callback: (data: any) => void): void;
    off(event: number | string, callback: (data: any) => void): void;
    deviceQuery(query: number): Promise<any>;
    // Add other methods as needed
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
    [key: string]: any;
  };

  // Add other exports as needed
}
