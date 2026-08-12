# Change Log

All changes to the MageForge extension will be documented here.
If you have questions, feature requests or problems with this extention, please create an [issue on GitHub](https://github.com/OpenForgeProject/mageforge-vscode/issues).

## [0.7.0](https://github.com/OpenForgeProject/mageforge-vscode/compare/v0.6.1...v0.7.0) (2026-08-12)


### Features

* add shell-quote dependency and improve command line argument handling ([a418eae](https://github.com/OpenForgeProject/mageforge-vscode/commit/a418eae578c392f657e411b7b553f50c03bf0fd7))
* implement integration tests for multiple OS and enhance test coverage ([e5f8f0e](https://github.com/OpenForgeProject/mageforge-vscode/commit/e5f8f0e7427af47030a02bd5311622a55b7c479a))
* implement URL validation for external links in webview messages ([a1a896d](https://github.com/OpenForgeProject/mageforge-vscode/commit/a1a896d48cd1578d10f122ea824fd9cca2aa6d49))
* limit displayed releases to 10 and add button for full changelog ([b0dc5a9](https://github.com/OpenForgeProject/mageforge-vscode/commit/b0dc5a9799672099d8f4424ae898db3e0e91f7e2))
* **tests:** add unit and integration tests for MageForge extension ([c67ae5d](https://github.com/OpenForgeProject/mageforge-vscode/commit/c67ae5dc5950337b50dd92b8ed042c88afe29ccd))
* **tests:** add unit and integration tests for MageForge extension ([7de6d9b](https://github.com/OpenForgeProject/mageforge-vscode/commit/7de6d9b939626bdcf8d5aadb1edaaccb00929ef2))


### Bug Fixes

* improve changelog update notification ([53b44d8](https://github.com/OpenForgeProject/mageforge-vscode/commit/53b44d8ddde580d0dff1dc8505f5f5729f1008fa))
* prevent update notification from reappearing on every activation ([5c4fd71](https://github.com/OpenForgeProject/mageforge-vscode/commit/5c4fd7175eb25f83301b7303f1eba6ab8ab36aee))


### Code Refactoring

* unify URL generation in tests using makeTestUrl function ([45a1340](https://github.com/OpenForgeProject/mageforge-vscode/commit/45a13402389b5bd30cdb34c198cbc967850d5d35))

## [0.6.1](https://github.com/OpenForgeProject/mageforge-vscode/compare/v0.6.0...v0.6.1) (2026-08-11)


### Bug Fixes

* format import statements and improve message formatting in activate function ([a7b6c61](https://github.com/OpenForgeProject/mageforge-vscode/commit/a7b6c616d5ebdaecd68ca1bf6f6d5ece5dbc27f6))

## [0.6.0](https://github.com/OpenForgeProject/mageforge-vscode/compare/v0.5.0...v0.6.0) (2026-08-11)


### Features

* add timeout handling for version checks in WelcomeViewProvider ([32c49ba](https://github.com/OpenForgeProject/mageforge-vscode/commit/32c49bafa3ed98d388361154d6732d3c2530c023))


### Bug Fixes

* MageForge version badge and update Button on VS Code Focus change ([30cb97f](https://github.com/OpenForgeProject/mageforge-vscode/commit/30cb97f47503378c6adc88f9f8a9048b180a96a3))


### Maintenance

* remove vsc-extension-quickstart.md file ([7cd4c1a](https://github.com/OpenForgeProject/mageforge-vscode/commit/7cd4c1a22e2343c77f42ec1b9ab2146a8c715597))

## [0.5.0](https://github.com/OpenForgeProject/mageforge-vscode/compare/v0.4.0...v0.5.0) (2026-08-11)


### Features

* add dependabot configuration for npm and GitHub Actions updates ([6f38f3a](https://github.com/OpenForgeProject/mageforge-vscode/commit/6f38f3ad94f92ffc42a9d433860bfba685f08308))
* add security policy documentation for MageForge ([954c1af](https://github.com/OpenForgeProject/mageforge-vscode/commit/954c1afa6c7c3d9350a5bf7204147283fddf18df))


### Bug Fixes

* escaping HTML attribute sanitization ([eb670ee](https://github.com/OpenForgeProject/mageforge-vscode/commit/eb670ee6cdcc967d877ce51dc5d82791d3894f69))
* improve formatting of release heading in changelog ([3f20fe7](https://github.com/OpenForgeProject/mageforge-vscode/commit/3f20fe7033560109dc6fef07678d1398e353169a))


### Documentation

* add Security Policy ([aa16cb7](https://github.com/OpenForgeProject/mageforge-vscode/commit/aa16cb7a8d3ac6ff1e393eccd27ee8de71c9afc6))

## [0.4.0](https://github.com/OpenForgeProject/mageforge-vscode/compare/v0.3.0...v0.4.0) (2026-08-10)


### Features

* add version check and update notification in welcome view ([59a296c](https://github.com/OpenForgeProject/mageforge-vscode/commit/59a296c38312911777cb6628a2e133749cc44da8))


### Bug Fixes

* enhance changelog styling ([ce0a940](https://github.com/OpenForgeProject/mageforge-vscode/commit/ce0a9402f71bdd68bf35f88384a20b0eb5131e24))
* enhance welcome view styling with accent glow ([2cc12c9](https://github.com/OpenForgeProject/mageforge-vscode/commit/2cc12c90aadddefc91c317206a030644fe891c07))
* update README to include CI, Release, Version, and License badges ([46c1c9a](https://github.com/OpenForgeProject/mageforge-vscode/commit/46c1c9a73dd641d27d35aa796638d6ce218fb1b4))

## [0.3.0](https://github.com/OpenForgeProject/mageforge-vscode/compare/v0.2.0...v0.3.0) (2026-08-10)


### Features

* add changelog viewer and update notification for extension updates ([b4d5aa7](https://github.com/OpenForgeProject/mageforge-vscode/commit/b4d5aa7d396072411d2af19cecff858800ac46ab))
* add feature request issue template for user suggestions ([1b60d4c](https://github.com/OpenForgeProject/mageforge-vscode/commit/1b60d4cf7ed9a4d55fe5a1ca665fa9f879a79c0a))
* add template override command and context menu ([1910681](https://github.com/OpenForgeProject/mageforge-vscode/commit/19106819011f89dfca0d0dbfb553dc581fb309de))
* enhance CI workflow with formatting check and diff display on failure ([be94155](https://github.com/OpenForgeProject/mageforge-vscode/commit/be94155ffcaf805262b3be99f4c8e527505c38f7))
* enhance welcome view with version info and quick action updates ([0f75c2b](https://github.com/OpenForgeProject/mageforge-vscode/commit/0f75c2b8d2c0b92fda50b8bf6436e55581cb8eca))
* update configuration settings for enhanced environment detection ([95f3da3](https://github.com/OpenForgeProject/mageforge-vscode/commit/95f3da324c7201f487d41bb08baafed0ccb4eb61))


### Bug Fixes

* remove unreleased section from CHANGELOG ([e4fcf92](https://github.com/OpenForgeProject/mageforge-vscode/commit/e4fcf920a17155fc497f7e77efc8df474335af0a))
* reuse existing terminal for running MageForge CLI commands ([aabdcac](https://github.com/OpenForgeProject/mageforge-vscode/commit/aabdcaca9b6ff48cb1d58b1c3d067d5322f86aeb))
* update issue links and add changelog link in welcome view ([1c07087](https://github.com/OpenForgeProject/mageforge-vscode/commit/1c070873206e277e52b92f91de78fa3959fc9b9d))


### Documentation

* update README with detailed features and configuration settings ([267c485](https://github.com/OpenForgeProject/mageforge-vscode/commit/267c485ee92b0fd20ed85cd739bd7f09bfbfcdd0))


### Maintenance

* update esbuild to version 0.28.2 and add mocha override ([4e053fe](https://github.com/OpenForgeProject/mageforge-vscode/commit/4e053fe3cfc33b1b30af776842aa8170b905f452))

## [0.2.0](https://github.com/OpenForgeProject/mageforge-vscode/compare/v0.1.0...v0.2.0) (2026-08-10)


### Features

* add logo asset and update package metadata ([07cf543](https://github.com/OpenForgeProject/mageforge-vscode/commit/07cf543543d194610196e3a8aacf8b05c8bcd0cf))
* add welcome view with quick actions and resources links ([17f45ba](https://github.com/OpenForgeProject/mageforge-vscode/commit/17f45ba6bca27a596dde529ec6fa33203af6a30d))
* enhance release workflow and update package metadata ([f86d364](https://github.com/OpenForgeProject/mageforge-vscode/commit/f86d36401044eb5fd9077231d190e379a1c09ce9))
* implement MageForge CLI commands and theme management features ([0e8ca20](https://github.com/OpenForgeProject/mageforge-vscode/commit/0e8ca20812255f9d8180646b97b2c579e9cd59e8))


### Bug Fixes

* update vscode test tooling for macOS CI ([c10f92f](https://github.com/OpenForgeProject/mageforge-vscode/commit/c10f92fa1131ab8101b3487208b6a9e521e38f9b))


### Maintenance

* add pre-commit hook with lint-staged ([631cf33](https://github.com/OpenForgeProject/mageforge-vscode/commit/631cf331ed41cf45097fec833c2ce63c4ebb1578))
* update Node.js version requirements and enhance README with development setup instructions ([a2b5102](https://github.com/OpenForgeProject/mageforge-vscode/commit/a2b5102c7901265dbc4e69cd6d222a7c5dbe3a24))

## [0.1.0] - 2026-08-10

- Initial release
