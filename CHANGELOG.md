<a name="v1.1.0"></a>
## v1.1.0

### Build
- **deps:** update jest to 26.6.0
- **deps-dev:** bump eslint from 7.17.0 to 7.19.0
- **deps-dev:** bump ts-node from 8.10.2 to 9.1.1
- **deps-dev:** bump [@types](https://github.com/types)/node-forge from 0.8.7 to 0.9.7
- **deps-dev:** bump [@typescript](https://github.com/typescript)-eslint/parser from 4.12.0 to 4.14.2
- **deps-dev:** bump [@types](https://github.com/types)/node from 14.14.20 to 14.14.22
- **deps-dev:** bump [@typescript](https://github.com/typescript)-eslint/eslint-plugin
- **deps-dev:** bump ts-jest from 26.4.4 to 26.5.0
- **deps-dev:** bump eslint-config-standard-with-typescript

### Ci
- add latest tag to docker image
- add dependabot config
- add types for conventional commits
- add docker ci
- update docker build
- Update docker-image.yml
- remove snyk from github actions
- **docs:** remove automation

### Docs
- changelog
- add status badges
- add release disclaimer
- remove from mps and move to docs repo

### Feat
- **cors:** Add support for CORS

### Fix
- cors support for cookies
- upgrade node-vault from 0.9.20 to 0.9.21
- upgrade ws from 7.3.1 to 7.4.0
- **cors:** added support to multiple origins
- **api:** changed response for logout api
- **cors:** allow setting of cors regardless of authmode

### Refactor
- default allowlist to false in config
- remove webui pieces
- migrate from internal
- **docker:** migrate docker scripts to open-amt-cloud-toolkit
- **eslint:** add linting to code
- **webui:** move webui to sample-web-ui repo


<a name="v1.0.0"></a>
## v1.0.0 - 2020-11-20
### Build
- add condition for master to publish docs
- optimize dockerfile

### Ci
- license and copyright added
- add build automation w/ github actions
- build automation for documentation

### Docs
- format vault document
- update docker to reflect vault in dev mode
- remove prev/next guidance
- fix broken link in localization.md
- fix broken link
- link fix

### Fix
- **docker:** build time taking too long

### Refactor
- **docker:** remove build pre-build step
- **docker:** optimize dockerfile



