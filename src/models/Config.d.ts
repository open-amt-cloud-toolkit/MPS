/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
* Description: config type definitions
**********************************************************************/

export type configType = {
    use_allowlist: boolean,
    common_name: string,
    port: number,
    username: string,
    pass: string,
    use_global_mps_credentials: boolean,
    country: string,
    company: string,
    listen_any: boolean,
    https: boolean,
    tls_offload: boolean,
    web_port : number,
    generate_certificates: boolean,
    alias_port?: number,
    debug?: boolean,
    logger_off: boolean,
    secrets_path?: string,
    data_path?: string,
    cert_path: string,
    cert_format: string,
    use_vault?: boolean,
    vault_address?: string,
    vault_token?: string,
    debug_level: number,
    web_admin_user: string,
    web_admin_password: string,
    mps_tls_config: any,
    web_tls_config: any,
    session_encryption_key: string,
    mpsxapikey: string,
    tls_cert?: string,
    tls_cert_key?: string,
    tls_cert_ca?: string,
    web_tls_cert?: string,
    web_tls_cert_key?: string,
    web_tls_cert_ca?: string,
    auth_enabled?: boolean,
    cors_origin:string,
    cors_headers:string,
    cors_methods:string
}

export type certificatesType = {
    mps_tls_config: mpsConfigType,
    web_tls_config: webConfigType
}

export type mpsConfigType = {
   cert: any,
   key: any,
   minVersion: any,
   secureOptions?: any,
   requestCert: boolean,
   rejectUnauthorized: boolean
}

export type webConfigType = {
    ca: any,
    cert: any,
    key: any,
    secureOptions?: any,
}

export type certAndKeyType = {
    cert: any,
    key: any
};

export type directConfigType = {
    ca: any,
    cert: any,
    key: any,
    ciphers: string,
    secureOptions?: any,
    rejectUnauthorized: boolean
}

export type apiResponseType ={
    statuscode: number,
    payload: any
}
