declare module 'serverless-webpack' {
  export const lib: {
    serverless: {
      serverlessDirPath: string;
      version: string;
      config: {
        servicePath: string;
      };
    };
    webpack: {
      isLocal: boolean;
    };
    entries: {
      [name: string]: string | string[];
    };
    options: { [name: string]: string | boolean | number };
  };
}
