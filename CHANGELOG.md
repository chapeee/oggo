# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive dark mode UI with orange accents.
- SSH remote server management and testing.
- Integrated WebSocket terminal using `xterm.js`.
- Command intelligence via `tldr` npm package.
- Tom and Jerry connecting animation.
- Arrow key navigation for terminal suggestions.
- Support for encrypted SSH keys and passwords using AES.

### Changed
- Refactored `commandIntelService` to utilize official `tldr` cache and fuzzy search via `fuse.js`.
- Terminal suggestions box matches new design language.
- Replaced manual markdown parsing with direct API usage for command examples.

### Fixed
- Tab completion now successfully outputs suggestion and prevents immediate execution.
- Fixed ArrowDown skipping rows in the terminal suggestion box.
- Ensured terminal connection animation completes reliably.
- Fixed layout inconsistency across the main dashboard.
