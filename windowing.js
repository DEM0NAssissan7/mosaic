const extension = imports.misc.extensionUtils.getCurrentExtension();
const tiling = extension.imports.tiling;

function get_timestamp() {
    return global.get_current_time();
}

function get_primary_display() {
    return global.display.get_primary_monitor();
}

function get_workspace() {
    return global.workspace_manager.get_active_workspace();
}

function get_all_windows() {
    return global.display.list_all_windows();
}

function get_focused_window() {
    let windows = get_all_windows();
    for(let window of windows) {
        if(window.has_focus())
            return window;
    }
}

function get_all_workspace_windows(monitor) {
    return get_monitor_workspace_windows(get_workspace(), monitor);
}

function move_window(window, ignore_top_bar, x, y, w, h) {
    window.move_resize_frame(ignore_top_bar, x, y, w, h);
}

function get_monitor_workspace_windows(workspace, monitor) {
    let _windows = [];
    let windows = workspace.list_windows();
    for(let window of windows)
        if(window.get_monitor() === monitor)
            _windows.push(window);
    return _windows;
}

function win_to_new_workspace(window, switch_to_new, _monitor) {
    if(!window) return;
    let window_workspace = window.get_workspace();
    if(!window_workspace) return;
    if(!is_primary(window)) return window_workspace; // If the window is not on the primary workspace, do not move it at all.
    let adjacent_workspace = window_workspace.get_neighbor(-4); // Get workspace to the right
    let workspace;
    let monitor = window.get_monitor();
    if(_monitor >= 0 && _monitor !== null)
        monitor = _monitor;
    // This is to prevent an infinite workspace creation bug
    if(!adjacent_workspace) {
        console.warn("Could not get right neighbor for workspace " + window_workspace.index());
        workspace = global.workspace_manager.append_new_workspace(false, 0);
    } else if(get_monitor_workspace_windows(adjacent_workspace, monitor).length > 0)
        workspace = global.workspace_manager.append_new_workspace(false, 0);
    else
        workspace = adjacent_workspace;
    
    global.workspace_manager.reorder_workspace(workspace, window_workspace.index() + 1) // Move the new workspace to the right of the current workspace
    window.change_workspace(workspace); // Move window to new workspace
    window.move_to_monitor(monitor); // Move to proper monitor
    let offset = global.display.get_monitor_geometry(monitor).height - workspace.get_work_area_for_monitor(monitor).height; // Get top bar offset (if applicable)
    let frame = window.get_frame_rect();
    move_window(window, false, 0, offset, frame.width, frame.height - offset); // Move window to display properly
    tiling.tile_workspace_windows(workspace, window, false, true); // Tile new workspace for window
    tiling.tile_workspace_windows(window_workspace, false, monitor, false); // Tile the workspace where the window came from
    if(switch_to_new)
        workspace.activate(get_timestamp()); // Switch to new workspace if specified
    return workspace; // Return new workspace
}

function move_back_window(window) {
    let workspace = window.get_workspace();
    let previous_workspace = workspace.get_neighbor(-3);
    if(!previous_workspace) {
        console.error("There is no workspace to the left.");
        return;
    }
    if(!tiling.test_window_fit(window, previous_workspace, window.get_monitor())) // Make sure there is space for the window in the previous workspace
        return workspace;
    window.change_workspace(previous_workspace); // Move window to previous workspace
    previous_workspace.activate(get_timestamp()); // Switch to it
    return previous_workspace;
}

function move_oversized_window(window) {
    let primary_monitor = global.display.get_primary_monitor()
    let monitor = window.get_monitor();
    let workspace = window.get_workspace();
    let switch_to_new = workspace.index() === get_workspace().index();
    if(monitor === primary_monitor) { // If the window is on the primary monitor
        return win_to_new_workspace(window, switch_to_new);
    }
    let n_monitors = global.display.get_n_monitors();
    for(let i = 0; i < n_monitors; i++) {
        if(tiling.test_window_fit(window, workspace, i)) {
            window.move_to_monitor(i); // Move to monitor if there is space
            return workspace;
        }
    }
    return win_to_new_workspace(window, switch_to_new, primary_monitor); // Move window to primary monitor if it can't fit in any other monitor.
}