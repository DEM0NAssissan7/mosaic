# Mosaic
Next-generation window management

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
5. Enable the extension using either an extension manager or by running `gnome-extensions enable mosaic@mawitime`

# Implemented features:
- 

# Missing features:
- Corner tiling
- Auto-tiling

# Needs work:
- Window tiling algorithm (major)

# Needs review:
- Event listeners
- Window tiling algorithm
- APIs
- Meta Timestamps

# Known bugs:
- Infinite workspace recursion in certain conditions

# Notes:
- There is something wrong with Tilegroup.get_optimal()