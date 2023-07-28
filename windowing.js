const extension = imports.misc.extensionUtils.getCurrentExtension();

const enums = extension.imports.enums;

function get_all_windows() {
    return global.display.list_all_windows();
}

function get_all_workspace_windows() {
    return global.workspace_manager.get_active_workspace().list_windows();
}

function move_window(window, ignore_top_bar, x, y, w, h) {
    window.move_resize_frame(ignore_top_bar, x, y, w, h);
}

function configure_window(window) {
    
}

function win_to_new_workspace(window) {
    let workspace = global.workspace_manager.append_new_workspace(false, 0); // Create new workspace
    let active_workspace_index = global.workspace_manager.get_active_workspace_index();
    global.workspace_manager.reorder_workspace(workspace, active_workspace_index + 1) // Move the new workspace to the right of the current workspace
    window.change_workspace(workspace); // Move window to new workspace
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
    previous_workspace.activate(0); // Switch to it
    global.workspace_manager.remove_workspace(workspace, 0); // Clean old workspace
    return previous_workspace;
}

function sort_workspace_windows(workspace, move_maximized_windows) {
    let windows = workspace.list_windows();
    let work_area = workspace.get_work_area_for_monitor(0);
    sort_windows(windows, work_area, move_maximized_windows);
}


function sort_windows(windows, work_area, move_maximized_windows) {
    /* Window sorting algorithm
        The goal of this algorithm is to make the windows
        organize themselves as squarely possible. This makes
        it look pretty while also presenting as many windows as possible.
    */
    if(windows.length === 0)
        return;
    let space = {
        x: 0,
        y: 0,
        width: 0,
        height: 0
    };
    // Sort windows by smallest to biggest
    let sorted_windows = [];
    for(let i = 0; i < windows.length; i++) {
        let frame = windows[i].get_frame_rect();
        sorted_windows.push({
            index: i,
            frame: {
                x: frame.x,
                y: frame.y,
                width: frame.width,
                height: frame.height,
                area: frame.width * frame.height
            }
        })
    }
    // sorted_windows = sorted_windows.sort((a, b) => b.frame.width - a.frame.width);

    let levels = [];
    let width = 0;
    let height = 0;
    let windows_buffer = [];

    for(let i = 0; i < sorted_windows.length; i++) {
        let index = sorted_windows[i].index;
        let window = windows[index];
        if((window.maximized_horizontally === true && window.maximized_vertically === true) && get_all_workspace_windows().length !== 1) {
            if(move_maximized_windows) // If we are wanting to deal with maximized windows, move them to a new workspace.
                win_to_new_workspace(window);
            continue; // Skip windows that are maximized otherwise. They will be dealt with by the size-changed listener.
        }

        let frame = window.get_frame_rect();
        if(frame.width + width > work_area.width) { // If the window being added will exceed bounds
            space.height += height + enums.window_spacing;
            space.width += width;
            levels.push({ // Add a new level
                width: width,
                height: height,
                windows: windows_buffer
            });
            height = 0;
            width = 0;
            windows_buffer = [];
        }
        width += frame.width + enums.window_spacing;
        height = Math.max(height, frame.height);
        windows_buffer.push({
            index: index,
            children: [],
            frame: {
                x: frame.x,
                y: frame.y,
                width: frame.width,
                height: frame.height
            }
        });
    }
    space.height += height;
    space.width += width;
    levels.push({
        width: width,
        height: height,
        windows: windows_buffer
    });
    height = 0;
    width = 0;
    windows_buffer = [];

    /* Run a loop to compact windows as much as possible
        Do not stop loop until the anatomy stops changing, or
        until the tiling runs out of room on the screen.
        In that case, we send the unfittable windows to a new workspace.
        This is not the current behaviour, however. This is awaiting further
        design.
        */
    let anatomy_changed = true;
    while(anatomy_changed) {
        anatomy_changed = false; // Constantly run the program until the anatomy doesn't change
        // Check available vertical space in other levels
        for(let i = 0; i < levels.length; i++) {
            let level = levels[i];
            for(let j = 0; j < level.windows.length; j++) {
                let frame = level.windows[j].frame;
                (function() {
                    for(let k = 0; k < levels.length; k++) {
                        let _level = levels[k];
                        // if(k === i) continue;
                        for(let _window of _level.windows) {
                            if(_window.index === level.windows[j].index) continue;
                            let _frame = _window.frame;
                            // See if the window will fit in the open space under the window
                            let height = _frame.height + enums.window_spacing;
                            for(let child of _window.children) // Account children heights
                                height += child.frame.height + enums.window_spacing;
                            if(frame.width <= _frame.width && frame.height + height <= _level.height) { // See if the window has space
                                anatomy_changed = true;
                                _window.children.push(level.windows[j]);
                                level.width -= frame.width; // Subtract window from width
                                level.windows.splice(j, 1);
                                if(level.height === frame.height) { // Fix height if changed
                                    space.height -= level.height;
                                    level.height = 0;
                                    for(let window of level.windows)
                                        level.height = Math.max(level.height, window.frame.height);
                                    space.height += level.height;
                                }
                                j--;
                                return;
                            }
                        }
                    }
                })()
                if(level.windows.length === 0) {
                    space.height -= level.height;
                    levels.splice(i, 1);
                    i--;
                    break;
                }
            }
        }
        // Check avaiable horizontal space in any levels
        for(let i = 0; i < levels.length; i++) {
            let level = levels[i];
            for(let j = 0; j < level.windows.length; j++) {
                let window = level.windows[j];
                let frame = window.frame;
                for(let k = 0; k < levels.length; k++) {
                    if(k >= i) break;
                    let _level = levels[k];
                    if(_level.width + frame.width <= work_area.width) {// If the window can fit
                        anatomy_changed = true;
                        _level.width += frame.width;
                        _level.windows.push(window);
                        // Clear window from old level
                        level.width -= frame.width;
                        level.windows.splice(j, 1);
                        j--;
                        break;
                    }
                }
                if(level.windows.length === 0) {
                    space.height -= level.height;
                    levels.splice(i, 1);
                    i--;
                    break;
                }
            }
        }
    }
    let center = {
        x: work_area.width / 2 + work_area.x,
        y: work_area.height / 2 + work_area.y
    }
    let y = (work_area.height - space.height) / 2 + work_area.y;
    let height_sums = 0;
    for(let level of levels) {
        let level_center = height_sums + level.height / 2;
        let x = (work_area.width - level.width) / 2 + work_area.x;

        let max_offset = 0;
        for(let window of level.windows) {
            let frame = window.frame;
            let offset = 0;
            // Get total level area height
            let height = frame.height;
            for(let child of window.children)
                height += child.frame.height;
            // Align windows towards the middle (in their level)
            let window_middle = y + height / 2
            if(frame.height !== level.height) {
                offset = center.y - window_middle;
                // Check to make sure window does not cross level boundaries
                if(offset + height > level.height) {
                    offset -= height - frame.height;
                }
                if(offset < 0) {
                    offset = 0;
                }
            }
            move_window(windows[window.index], false, x, y + offset, frame.width, frame.height);
            let _y = y + frame.height + enums.window_spacing;
            for(let child of window.children) {
                let _frame = child.frame;
                move_window(windows[child.index], false, x, _y + offset, _frame.width, _frame.height);
                _y += _frame.height + enums.window_spacing;
            }
            x += frame.width + enums.window_spacing;
        }
        y += level.height + max_offset + enums.window_spacing;
        height_sums += level.height + enums.window_spacing;
    }
}