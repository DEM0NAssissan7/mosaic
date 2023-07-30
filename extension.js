/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */
const extension = imports.misc.extensionUtils.getCurrentExtension();

const windowing = extension.imports.windowing;
const tiling = extension.imports.tiling;

let wm_eventids = [];
let display_eventids = [];
let maximized_windows = [];

let workspace_manager = global.workspace_manager;

function tile_window_workspace(meta_window) {
    tiling.tile_workspace_windows(meta_window.get_workspace(), meta_window);
}

class Extension {
    constructor() {
    }

    tile_all_workspaces() {
        let n_workspaces = workspace_manager.get_n_workspaces();
        for(let i = 0; i < n_workspaces; i++) {
            let workspace = workspace_manager.get_workspace_by_index(i);
            // Recurse all monitors
            let n_monitors = global.display.get_n_monitors();
            for(let j = 0; j < n_monitors; j++)
                tiling.tile_workspace_windows(workspace, false, j);
        }
    }

    sort_window_workspace(_, window) {
        setTimeout(() => {
            tile_window_workspace(window);
        }, 100);
    }

    sort_window_workspace_wm(_, win) {
        tile_window_workspace(win.meta_window);
    }

    enable() {
        console.log("Starting Mosaic layout manager.");
        
        let size_changed = false;
        let event_timeout;
        wm_eventids.push(global.window_manager.connect(
            'size-changed', // When size is changed
            (_, win) => {
                // Deal with maximizing to a new workspace and vice versa
                let window = win.meta_window;
                let id = window.get_id();
                let workspace = window.get_workspace();
                size_changed = true;
                
                if(window.maximized_horizontally === true && window.maximized_vertically === true && windowing.get_all_workspace_windows().length !== 1) {
                    // If maximized (and not alone), move to new workspace and activate it if it is on the active workspace
                    let new_workspace = windowing.win_to_new_workspace(window, workspace.index() === window.get_workspace().index());
                    /* We mark the window as activated by using its id to index an array
                        We put the value as the active workspace index so that if the workspace anatomy
                        of the current workspace changes, it does not move the maximized window to an unrelated
                        window.
                    */
                    maximized_windows[id] = new_workspace.index(); // Mark window as maximized
                    tiling.tile_workspace_windows(workspace, false, window.get_monitor()); // Sort the workspace where the window came from
                    size_changed = false;
                    return;
                } else if(
                (window.maximized_horizontally === false ||
                window.maximized_vertically === false) && // If window is not maximized
                maximized_windows[id] === workspace.index() &&
                windowing.get_all_workspace_windows().length === 1// If the workspace anatomy has not changed
                ) {
                    maximized_windows[id] = false;
                    windowing.move_back_window(window); // Move the window back to its workspace
                    tile_window_workspace(window);
                }
                if(size_changed) {
                    clearTimeout(event_timeout);
                    event_timeout = setTimeout(() => {
                        tiling.tile_workspace_windows(workspace, window);
                    }, 1000);
                    size_changed = false;
                }
        }));

        display_eventids.push(global.display.connect('window-created', this.sort_window_workspace));
        wm_eventids.push(global.window_manager.connect('destroy', this.sort_window_workspace_wm));

        // Sort all workspaces at startup
        this.tile_all_workspaces();
    }

    disable() {
        // Disconnect all events
        for(let eventid of wm_eventids)
            global.window_manager.disconnect(eventid);
        for(let eventid of display_eventids)
            global.display.disconnect(eventid);
    }
}

function init() {
    return new Extension();
}