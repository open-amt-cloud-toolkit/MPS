# Management Presence Server

[![Known Vulnerabilities](https://snyk.io/test/github/open-amt-cloud-toolkit/mps/badge.svg?targetFile=package.json)](https://snyk.io/test/github/open-amt-cloud-toolkit/mps?targetFile=package.json) ![Node.js CI](https://github.com/open-amt-cloud-toolkit/mps/workflows/Node.js%20CI/badge.svg)

> Disclaimer: Production viable releases are tagged and listed under 'Releases'.  All other check-ins should be considered 'in-development' and should not be used in production

The Management Presence Server (MPS) enables remote edge management of Intel vPro® Platforms featuring Intel® AMT.  MPS uses an Intel vPro® feature, Client Initiated Remote Access (CIRA), to maintain a persistent connection with managed devices. As a cloud-agnostic microservice, MPS provides out-of-band manageability features, such as power control or keyboard, video, and mouse (KVM) control.

**For detailed documentation** about Getting Started with MPS or other features of the Open AMT Cloud Toolkit, see the [docs](https://open-amt-cloud-toolkit.github.io/docs).

## Prerequisites

To succesfully deploy MPS, the following software must be installed on your development system:

- [Node.js* LTS 12.x.x or newer](https://nodejs.org/en/)
- [git](https://git-scm.com/downloads)


## Deploy the Management Presence Server (MPS) Microservice

To deploy the MPS on a local development system: 

1. Clone the MPS repository on your development system.
    ```
    git clone https://github.com/open-amt-cloud-toolkit/mps.git && cd mps
    ```

2. Modify the mps/.mpsrc file’s allowlist and common name settings. Save and close the file.
    ```
    “use_allowlist” : false
    …
    “common_name” : “the development system’s IP address”
    ```


3. Navigate to mps/webui/src and modify the app.config.js file. Replace rpsServerIP and serverIP with your development system’s IP address. Save and close the file.
    ```
    const rpsServerIP = process.env.REACT_APP_RPS_SERVER ? process.env.REACT_APP_RPS_SERVER : '192.168.0.8'; 
    const serverIP = process.env.REACT_APP_MPS_SERVER ? process.env.REACT_APP_MPS_SERVER : '192.168.0.8';
    ```

4. Run 'npm install' from the working mps directory.
    ```
    npm install
    ```

5. Run 'npm run dev' start command. The npm run dev start command may take 2-3 minutes to install.
    ```
    npm run dev
    ```

6. The MPS listens on port 4433. Successful installation produces the command line message:
    
    ```
    Intel(R) AMT server running on [development-system-ip]:4433
    MPS: Microservice running on https://[development-system-ip]:3000.
    ```
    
For detailed documentation about MPS, see the [docs](https://open-amt-cloud-toolkit.github.io/docs)


## License Note

If you are distributing the FortAwesome Icons, please provide attribution to the source per the [CC-by 4.0](https://creativecommons.org/licenses/by/4.0/deed.ast) license obligations. 


