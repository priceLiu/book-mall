declare module "ali-oss" {
  export interface PutObjectResult {
    url?: string;
    name?: string;
    res?: unknown;
  }

  export interface PutObjectOptions {
    headers?: Record<string, string>;
    ACL?: string;
  }

  export interface OSSOptions {
    accessKeyId: string;
    accessKeySecret: string;
    region: string;
    bucket: string;
    endpoint?: string;
    authorizationV4?: boolean;
    secure?: boolean;
    internal?: boolean;
    cname?: boolean;
  }

  export default class OSS {
    constructor(options: OSSOptions);
    put(
      name: string,
      file: Buffer,
      options?: PutObjectOptions,
    ): Promise<PutObjectResult>;
    delete(name: string): Promise<unknown>;
  }
}
