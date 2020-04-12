declare module 'serverless-webpack' {
  import serverless from 'serverless';

  const lib: {
    serverless: serverless;
    webpack: {
      isLocal: boolean;
    };
    entries: {
      [name: string]: string | string[];
    };
    options: { [name: string]: string };
  };
}
