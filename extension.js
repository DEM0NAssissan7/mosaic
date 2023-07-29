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
const Workspace = imports.ui.workspace.Workspace;

const windowing = extension.imports.windowing;

let eventids = [];
let maximized_windows = [];

let workspace_manager = global.workspace_manager;
class Extension {
    constructor() {
    }

    sort_all_workspaces() {
        let n_workspaces = workspace_manager.get_n_workspaces();
        for(let i = 0; i < n_workspaces; i++) {
            let workspace = workspace_manager.get_workspace_by_index(i);
            windowing.sort_workspace_windows(workspace, true);
        }
    }

    sort_window_workspace(_, window) {
        setTimeout(() => {
            windowing.sort_workspace_windows(window.get_workspace());
        }, 100);
    }

    sort_window_workspace_wm(_, win) {
        windowing.sort_workspace_windows(win.meta_window.get_workspace());
    }

    enable() {
        console.log("Starting Mosaic layout manager.");
        
        let enabled = false; // This prevents recursion
        eventids.push(global.window_manager.connect(
            'size-changed', // When size is changed
            (_, win) => {
            if(!enabled) {
                enabled = true;
                let window = win.meta_window;
                let id = window.get_id();
                let workspace = workspace_manager.get_active_workspace();
                
                if(window.maximized_horizontally === true && window.maximized_vertically === true && windowing.get_all_workspace_windows().length !== 1) {
                    // If maximized (and not alone), move to new workspace and activate it
                    let new_workspace = windowing.win_to_new_workspace(window);
                    /* We mark the window as activated by using its id to index an array
                        We put the value as the active workspace index so that if the workspace anatomy
                        of the current workspace changes, it does not move the maximized window to an unrelated
                        window.
                    */
                    maximized_windows[id] = new_workspace.index(); // Mark window as maximized
                    windowing.sort_workspace_windows(workspace); // Sort the workspace where the came from
                    new_workspace.activate(0);
                    enabled = false;
                    return;
                } else if(
                (window.maximized_horizontally === false ||
                window.maximized_vertically === false) && // If window is not maximized
                maximized_windows[id] === workspace.index() // If the workspace anatomy has not changed
                ) {
                    maximized_windows[id] = false;
                    windowing.move_back_window(window); // Move the window back to its workspace
                }
                windowing.sort_workspace_windows(workspace_manager.get_active_workspace()); // Sort active workspace
                enabled = false;
            }
        }));

        eventids.push(global.display.connect('window-created', this.sort_window_workspace));
        eventids.push(global.window_manager.connect('destroy', this.sort_window_workspace_wm));

        // Sort all workspaces at startup
        this.sort_all_workspaces();
    }

    disable() {
        for(let eventid of eventids) {
            // Disconnect all events
        }
    }
}

function init() {
    return new Extension();
}