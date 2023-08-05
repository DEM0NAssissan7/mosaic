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

function win_to_new_workspace(window, switch_to_new) {
    if(!window) return;
    let window_workspace = window.get_workspace();
    if(!window_workspace) return;
    let adjacent_workspace = window_workspace.get_neighbor(-4); // Get workspace to the right
    let workspace;
    let monitor = window.get_monitor();
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
    let offset = global.display.get_monitor_geometry(monitor).height - workspace.get_work_area_for_monitor(monitor).height; // Get top bar offset (if applicable)
    let frame = window.get_frame_rect();
    move_window(window, false, 0, offset, frame.width, frame.height - offset);
    if(switch_to_new) workspace.activate(get_timestamp());
    return workspace; // Return new workspace
}

function move_back_window(window) {
    let workspace = window.get_workspace();
    let previous_workspace = workspace.get_neighbor(-3);
    if(!previous_workspace) {
        console.error("There is no workspace to the left.");
        return;
    }
    window.change_workspace(previous_workspace); // Move window to previous workspace
    previous_workspace.activate(get_timestamp()); // Switch to it
    return previous_workspace;
}