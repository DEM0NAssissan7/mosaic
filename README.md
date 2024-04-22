# Window Mosaic mode
Next-generation window management

# Disclaimer
This extension is still very early software and is NOT ready for production use. It is still under active development.
It will be made known when the extension will be ready for the first alpha release. As of right now, it is not
recommended to be used in production, especially given the fast-changing nature of the codebase (as of right now).

# Project Goals
- Make the user do as little window management as possible
- Increase productivity factor
- Tile the windows in the most efficient way possible
- Automatically manage workspaces
- More powerful tiling features for GNOME (like corner tiling)

# Installation instructions
To install to your user extensions folder, do the following:
1. Download the source code by any means (and decompress archive if necessary)
2. Open a terminal in the directory of the project
3. Run `./install.sh` to install the extension
4. Log out and log back in
5. Enable the extension using either an extension manager or by running `gnome-extensions enable window-mosaic-mode@heikkiket`

# Implemented features:
- Mosaic tiling
- New workspace on maximize
- Automatic workspace creation
- Dynamic window reording

# Needs work:
- Tiling algorithm
- Event listeners

# Missing features:
- Corner tiling
- Automatic snap-tiling
- Overflow windows docked away

# Needs review:
- Event listeners
- APIs
