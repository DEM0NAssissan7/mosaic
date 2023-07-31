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
    if(!meta_window) return;
    let workspace = meta_window.get_workspace();
    if(!workspace) return;
    tiling.tile_workspace_windows(workspace, 
                                  meta_window, 
                                  null, 
                                  false);
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
                tiling.tile_workspace_windows(workspace, false, j, false);
        }
    }

    created_handler(_, window) {
        setTimeout(() => {
            tile_window_workspace(window);
        }, 100);
    }

    destroyed_handler(_, win) {
        let window = win.meta_window;
        let workspace = window.get_workspace();
        if(!workspace) return;
        if( workspace.list_windows().length === 0 &&
            workspace.index() !== workspace_manager.get_n_workspaces() - 1
            )
        {
            let previous_workspace = workspace.get_neighbor(-3);
            if(previous_workspace === 1 ||
                !previous_workspace ||
                previous_workspace.index() === workspace.index()
            )
                return;
            previous_workspace.activate(windowing.get_timestamp());
            tiling.tile_workspace_windows(previous_workspace, false, window.get_monitor());
            return;
        }
        tile_window_workspace(window);
    }
    
    switch_workspace_handler(_, win) {
        tile_window_workspace(win.meta_window); // Tile when switching to a workspace. Helps to create a more cohesive experience.
    }

    enable() {
        console.log("Starting Mosaic layout manager.");
        
        let size_changed = false;
        let event_timeout;
        wm_eventids.push(global.window_manager.connect(
            'size-changed', // When size is changed
            (_, win) => {
                if(!size_changed) {
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
                        tiling.tile_workspace_windows(workspace, false, window.get_monitor(), false); // Sort the workspace where the window came from
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
                        tiling.tile_workspace_windows(window.get_workspace(), window, null, true);
                        clearTimeout(event_timeout);
                        event_timeout = setTimeout(() => {
                            tile_window_workspace(window); // Fully sort workspace after a time
                        }, 1000);
                        size_changed = false;
                    }
                }
        }));

        display_eventids.push(global.display.connect('window-created', this.created_handler));
        wm_eventids.push(global.window_manager.connect('destroy', this.destroyed_handler));
        wm_eventids.push(global.window_manager.connect('switch-workspace', this.switch_workspace_handler));

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