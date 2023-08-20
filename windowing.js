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

function get_monitor_workspace_windows(workspace, monitor, allow_unrelated) {
    let _windows = [];
    let windows = workspace.list_windows();
    for(let window of windows)
        if(window.get_monitor() === monitor && (is_related(window) || allow_unrelated))
            _windows.push(window);
    return _windows;
}

function get_index(window) {
    let id = window.get_id();
    let meta_windows = windowing.get_monitor_workspace_windows(window.get_workspace(), window.get_monitor());
    for(let i = 0; i < meta_windows.length; i++)
        if(meta_windows[i].id === id)
            return i;
    return null;
}

function move_back_window(window) {
    let workspace = window.get_workspace();
    let active = workspace.active;
    let previous_workspace = workspace.get_neighbor(-3);
    if(!previous_workspace) {
        console.error("There is no workspace to the left.");
        return;
    }
    if(!tiling.window_fits(window, previous_workspace)) // Make sure there is space for the window in the previous workspace
        return workspace;
    window.change_workspace(previous_workspace); // Move window to previous workspace
    if(active)
        previous_workspace.activate(get_timestamp()); // Switch to it
    return previous_workspace;
}

function move_oversized_window(window){
    let previous_workspace = window.get_workspace();
    let focus = previous_workspace.active;
    let new_workspace = global.workspace_manager.append_new_workspace(focus, get_timestamp());
    let monitor = window.get_monitor();

    window.change_workspace(new_workspace);
    global.workspace_manager.reorder_workspace(new_workspace, previous_workspace.index() + 1);

    if(window.maximized_horizontally && window.maximized_vertically) { // Adjust the window positioning if it is maximized
        let offset = global.display.get_monitor_geometry(monitor).height - workspace.get_work_area_for_monitor(monitor).height; // Get top bar offset (if applicable)
        let frame = window.get_frame_rect();
        window.move_resize_frame(false, 0, offset, frame.width, frame.height - offset); // Move window to display properly
    }
    
    setTimeout(() => {
        tiling.tile_workspace_windows(new_workspace, window, null, true); // Tile new workspace for window
        if(focus)
            window.focus(get_timestamp());
    }, 50);

    return new_workspace;
}

function is_primary(window) {
    if(window.get_monitor() === get_primary_monitor())
        return true;
    return false;
}

function is_excluded(meta_window) {
    if( !is_related(meta_window) ||
        meta_window.is_hidden()
    )
        return true;
    return false;
}

function is_related(meta_window) {
    if( !meta_window.is_attached_dialog() &&
        meta_window.window_type === 0 &&
        !meta_window.is_on_all_workspaces()
    ) return true;
    return false;
}