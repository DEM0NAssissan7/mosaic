const extension = imports.misc.extensionUtils.getCurrentExtension();
const tiling = extension.imports.tiling;

function get_timestamp() {
    return global.get_current_time();
}

function get_primary_monitor() {
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

function get_all_workspace_windows(monitor, allow_unrelated) {
    return get_monitor_workspace_windows(get_workspace(), monitor, allow_unrelated);
}

function move_window(window, ignore_top_bar, x, y, w, h) {
    window.move_resize_frame(ignore_top_bar, x, y, w, h);
}

function get_monitor_workspace_windows(workspace, monitor, allow_unrelated) {
    let _windows = [];
    let windows = workspace.list_windows();
    for(let window of windows)
        if(window.get_monitor() === monitor && (is_related(window) || allow_unrelated))
            _windows.push(window);
    return _windows;
}


function move_over_window(window, switch_to_new, _monitor) {
    let previous_workspace = window.get_workspace();

    let workspace = global.workspace_manager.append_new_workspace(false, get_timestamp());

    window.change_workspace(workspace); // Move window to new workspace
    global.workspace_manager.reorder_workspace(workspace, previous_workspace.index() + 1);

    if(window.maximized_horizontally && window.maximized_vertically) { // Adjust the window positioning if it is maximized\
        let monitor = window.get_monitor();
        if(_monitor !== null && _monitor !== false)
            monitor = _monitor;
        if(monitor === null) return;

        let offset = global.display.get_monitor_geometry(monitor).height - workspace.get_work_area_for_monitor(monitor).height; // Get top bar offset (if applicable)
        let frame = window.get_frame_rect();
        move_window(window, false, 0, offset, frame.width, frame.height - offset); // Move window to display properly
    }

    if(switch_to_new)
        workspace.activate(get_timestamp()); // Switch to new workspace if specified

    tiling.tile_workspace_windows(workspace, window, null, true); // Tile new workspace for window

    return workspace;
}

function move_back_window(window) {
    let workspace = window.get_workspace();
    let previous_workspace = workspace.get_neighbor(-3);
    if(!previous_workspace) {
        console.error("There is no workspace to the left.");
        return;
    }
    if(!tiling.window_fits(window, previous_workspace)) // Make sure there is space for the window in the previous workspace
        return workspace;
    window.change_workspace(previous_workspace); // Move window to previous workspace
    previous_workspace.activate(get_timestamp()); // Switch to it
    return previous_workspace;
}

function move_oversized_window(window) {
    let primary_monitor = get_primary_monitor()
    let monitor = window.get_monitor();
    let workspace = window.get_workspace();
    let switch_to_new = workspace.active;
    if(monitor === primary_monitor) // If the window is on the primary monitor
        return move_over_window(window, switch_to_new);

    // let n_monitors = global.display.get_n_monitors();
    // for(let i = 0; i < n_monitors; i++) {
    //     if(tiling.window_fits(window, workspace, i)) {
    //         window.move_to_monitor(i); // Move to monitor if there is space
    //         return workspace;
    //     }
    // }
    return move_over_window(window, switch_to_new, primary_monitor); // Move window to primary monitor if it can't fit in any other monitor.
}

function is_primary(window) {
    if(window.get_monitor() === get_primary_monitor())
        return true;
    return false;
}

function is_excluded(meta_window) {
    if( meta_window.is_hidden() ||
        meta_window.is_attached_dialog() ||
        meta_window.window_type !== 0 ||
        meta_window.is_on_all_workspaces()
    )
        return true;
    return false;
}

function is_related(meta_window) {
    if( !meta_window.is_hidden() &&
        !meta_window.is_attached_dialog() &&
        meta_window.window_type === 0
    ) return true;
    return false;
}