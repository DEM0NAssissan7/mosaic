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
const drawing = extension.imports.drawing;
const reordering = extension.imports.reordering;

let wm_eventids = [];
let display_eventids = [];
let workspace_man_eventids = [];
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

let size_changed = false;
let event_timeout;
let expanded_window_timeout;

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
                tiling.tile_workspace_windows(workspace, false, j, true);
        }
    }

    created_handler(_, window) {
        let clock = function() {
            if(window.get_monitor() !== null && window.title) {
                if(window.maximized_horizontally && window.maximized_vertically)
                    windowing.move_oversized_window(window);
                else
                    tile_window_workspace(window);
            } else
                setTimeout(clock, 100);
        }
        clock();
    }

    destroyed_handler(_, win) {
        let window = win.meta_window;
        let workspace = window.get_workspace();
        let previous_workspace = workspace.get_neighbor(-3);
        let monitor = window.get_monitor();

        tiling.tile_workspace_windows(windowing.get_workspace(), 
            global.display.get_focus_window(),
            null,
            true);

        if(previous_workspace === 1 || previous_workspace.index() === workspace.index() || !previous_workspace) {
            previous_workspace = workspace.get_neighbor(-4); // The new workspace will be the one on the right instead.
            // Recheck to see if it is still a problematic workspace
            if( previous_workspace === 1 ||
                previous_workspace.index() === workspace.index() ||
                previous_workspace.index() === global.workspace_manager.get_n_workspaces() - 1)
                return;
        }
        
        if( windowing.get_monitor_workspace_windows(workspace, monitor).length === 0 &&
            workspace.index() !== workspace_manager.get_n_workspaces() - 1)
        {
            previous_workspace.activate(windowing.get_timestamp());
            tiling.tile_workspace_windows(previous_workspace, false, monitor);
            return;
        }
    }
    
    switch_workspace_handler(_, win) {
        tile_window_workspace(win.meta_window); // Tile when switching to a workspace. Helps to create a more cohesive experience.
    }

    size_change_handler(_, win, mode) {
        let window = win.meta_window;
        if(windowing.is_related(window)) {
            let id = window.get_id();
            let workspace = window.get_workspace();
            let monitor = window.get_monitor();

            if(mode === 2 || mode === 0) { // If the window was maximized
                if(window.maximized_horizontally === true && window.maximized_vertically === true && windowing.get_all_workspace_windows(monitor).length > 1) {
                    clearTimeout(expanded_window_timeout);
                    expanded_window_timeout = setTimeout(() => {
                        // If maximized (and not alone), move to new workspace and activate it if it is on the active workspace
                        let new_workspace = windowing.move_oversized_window(window);
                        /* We mark the window as activated by using its id to index an array
                            We put the value as the active workspace index so that if the workspace anatomy
                            of the current workspace changes, it does not move the maximized window to an unrelated
                            window.
                        */
                        if(new_workspace) {
                            maximized_windows[id] = {
                                workspace: new_workspace.index(),
                                monitor: monitor
                            }; // Mark window as maximized
                            tiling.tile_workspace_windows(workspace, false, monitor, false); // Sort the workspace where the window came from
                        }
                    }, 30);
                }
            } else if(mode === 3 || mode === 1) { // If the window was unmaximized
                if( (window.maximized_horizontally === false ||
                    window.maximized_vertically === false) && // If window is not maximized
                    maximized_windows[id] &&
                    windowing.get_all_workspace_windows(monitor).length === 1// If the workspace anatomy has not changed
                ) {
                    if( maximized_windows[id].workspace === workspace.index() &&
                        maximized_windows[id].monitor === monitor
                    ) {
                        maximized_windows[id] = false;
                        windowing.move_back_window(window); // Move the window back to its workspace
                        tile_window_workspace(window);
                    }
                }
            }
        }
    }

    size_changed_handler(_, win) {
        let window = win.meta_window;
        if(!size_changed && windowing.is_related(window)) {
            // Live resizing
            size_changed = true;
            tiling.tile_workspace_windows(window.get_workspace(), window, null, true);
            size_changed = false;
        }
    }

    grab_op_begin_handler(_, meta_window, grabpo) {
        reordering.start_drag(meta_window);
        // tile_window_workspace(window);
    }
    grab_op_end_handler(_, window, grabpo) {
        if(windowing.is_related(window)) {
            if( (grabpo === 1 || grabpo === 1025) && // When a window has moved
                !(window.maximized_horizontally === true && window.maximized_vertically === true))
            {
                reordering.stop_drag(window);
                tiling.tile_workspace_windows(window.get_workspace(), window, null, true);
            }
            if(grabpo === 25601) // When released from resizing
                tile_window_workspace(window);
        }
    }

    workspace_created_handler(_, index) {
        // tiling.append_workspace(index);
    }

    enable() {
        console.log("[MOSAIC]: Starting Mosaic layout manager.");
        
        wm_eventids.push(global.window_manager.connect('size-change', this.size_change_handler));
        wm_eventids.push(global.window_manager.connect('size-changed', this.size_changed_handler));
        display_eventids.push(global.display.connect('window-created', this.created_handler));
        wm_eventids.push(global.window_manager.connect('destroy', this.destroyed_handler));
        display_eventids.push(global.display.connect("grab-op-begin", this.grab_op_begin_handler));
        display_eventids.push(global.display.connect("grab-op-end", this.grab_op_end_handler));
        // workspace_man_eventids.push(global.workspace_manager.connect('workspace-added', this.workspace_created_handler));
        // wm_eventids.push(global.window_manager.connect('switch-workspace', this.switch_workspace_handler));

        // Sort all workspaces at startup
        setTimeout(this.tile_all_workspaces, 300);
    }

    disable() {
        console.log("[MOSAIC]: Disabling Mosaic layout manager.");
        // Disconnect all events
        for(let eventid of wm_eventids)
            global.window_manager.disconnect(eventid);
        for(let eventid of display_eventids)
            global.display.disconnect(eventid);
        for(let eventid of workspace_man_eventids)
            global.workspace_manager.disconnect(eventid);
        drawing.clear_actors();
    }
}

function init() {
    return new Extension();
}