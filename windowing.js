const extension = imports.misc.extensionUtils.getCurrentExtension();
const enums = extension.imports.enums;

/* Wingroup class
    Every window has a wingroup.
    Windows in a wingroup can only travel horizontally, and every window has a child wingroup.
    The algorithm will run through them all recursively to determine the best place for a window.
*/
class Wingroup {
    constructor(x, y, max_width, max_height) {
        this.window = [];
        this.x = x;
        this.y = y;
        this.width = 0;
        this.height = 0;
        this.max_width = max_width;
        this.max_height = max_height;
    }
    get_optimal(window) {
        let new_width = this.width + enums.window_spacing + window.width;
        let minimum_area = Math.max(this.height, window.height) * new_width;
        if(new_width > this.max_width) // If the window will exceed wingroup bounds, force it to go to a subgroup
            minimum_area = Infinity;
        let target_window = null;
        for(let _window of this.windows) {
            let area = _window.subgroup.get_optimal(window).area;
            if(area && area < minimum_area) {
                minimum_area = area;
                target_window = _window;
            }
        }
        return {
            area: minimum_area,
            window: target_window
        }
    }
    add_window(window) {
        let optimal = this.get_optimal(window);
        if(optimal.area === Infinity) {
            // If window cannot fit at all
            return;
        }
        if(optimal.window === null) {
            // Add window to the side
            window.subgroup = new Wingroup(this.width + this.x, this.y + window.height, window.width, this.max_height - window.height);
            this.windows.push(window);
            this.width += window.width;
            this.height = Math.max(this.height, window.height);
            return;
        }
        optimal.window.subgroup.add_window(window);
    }
    draw_windows(meta_windows) {
        let x = (this.max_width - this.width) / 2 + this.x;
        let y = (this.max_height - this.height) / 2 + this.y;
        for(let window of this.windows) {
            move_window(meta_windows[window.index], false, x, y, window.width, window.height); // Draw initial window
            window.subgroup.draw_windows();
            x += window.width + enums.window_spacing;
        }
    }
}

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

function win_to_new_workspace(window, switch_to_new) {
    let workspace = global.workspace_manager.append_new_workspace(false, 0); // Create new workspace
    let active_workspace_index = global.workspace_manager.get_active_workspace_index();
    global.workspace_manager.reorder_workspace(workspace, active_workspace_index + 1) // Move the new workspace to the right of the current workspace
    if(switch_to_new) workspace.activate(0);
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

function window_descriptor(window, index) {
    let frame = window.get_frame_rect();

    this.index = index;
    this.children = [];
    this.x = frame.x;
    this.y = frame.y;
    this.width = frame.width;
    this.height = frame.height;
    this.total_height = frame.height;
    this.total_width = frame.width;
    this.maximized_horizontally = window.maximized_horizontally;
    this.maximized_vertically = window.maximized_vertically;
    this.vertical_children = true;
}

window_descriptor.prototype.check_available_space = function(space, window) {
    if(this.vertical_children) {
        // Children should be placed under window

        if(window.width > this.width) // Check window can properly fit under
            return false;
        let new_height = this.total_height + enums.window_spacing + window.height;
        return Math.max(new_height, space.height) * space.width; // Return the new space area
    } else {
        // Children should be placed to the right of the window
    }
}

function sort_workspace_windows(workspace, move_maximized_windows) {
    let meta_windows = workspace.list_windows();

    // Put needed window info into an enum so it can be transferred between arrays
    let window_descriptors = [];
    for(let i = 0; i < meta_windows.length; i++) {
        let window = meta_windows[i];
        // Check if the window is maximized, and move it over if it is
        if((window.maximized_horizontally === true && window.maximized_vertically === true) && get_all_workspace_windows().length !== 1) {
            if(move_maximized_windows) // If we are wanting to deal with maximized windows, move them to a new workspace.
                win_to_new_workspace(window, false);
            continue; // Skip windows that are maximized otherwise. They will be dealt with by the size-changed listener.
        }
        window_descriptors.push(new window_descriptor(window, i));
    }
    // Advanced sorter
    let windows = [];
    const advanced_sorter = false;
    if(advanced_sorter) {
        let vertical = false;
        while(window_descriptors.length > 0) {
            let window;
            let index;
            if(vertical) {
                // Get tallest unused window
                let max = 0;
                for(let i = 0; i < window_descriptors.length; i++) {
                    let _window = window_descriptors[i];
                    if(_window.height > max) {
                        max = _window.height;
                        index = i;
                        window = _window;
                    }
                }
                vertical = false;
            } else {
                // Get longest unused window
                let max = 0;
                for(let i = 0; i < window_descriptors.length; i++) {
                    let _window = window_descriptors[i];
                    if(_window.width > max) {
                        max = _window.width;
                        index = i;
                        window = _window;
                    }
                }
                vertical = true;
            }
            windows.push(window);
            window_descriptors.splice(index, 1);
        }
    } else {
        windows = window_descriptors.sort((a, b) => b.width - a.width);
    }

    let n_displays = global.display.get_n_monitors(); // Sort on all monitors
    for(let i = 0; i < n_displays; i++) {
        let work_area = workspace.get_work_area_for_monitor(i);
        // Check for snap tiled windows and adjust work area accordingly
        for(let i = 0; i < windows.length; i++) {
            let window = windows[i];
            if(window.maximized_horizontally === false && window.maximized_vertically === true && windows.length !== 1) {
                let spaced_width = window.width + enums.window_spacing;
                if(window.x + window.width === work_area.width)
                    work_area.width -= spaced_width;
                if(window.x === work_area.x) {
                    work_area.x += spaced_width;
                    work_area.width -= spaced_width;
                }
                windows.splice(i, 1);
                i--;
            }
        }
        let window_vectors = z_sort(windows, work_area); // Sort windows
        draw_window_vectors(meta_windows, window_vectors, work_area); // Draw windows on screen
    }
}

function z_sort(windows, work_area) {
    if(windows.length === 0)
        return;
    let space = {
        width: 0,
        height: 0
    };

    let horizontal_windows = [];
    // Now, sort the windows
    for(let window of windows) {
        let parent_index = null;
        let new_width = space.width + enums.window_spacing + window.width;
        let minimum_area
        if(new_width <= work_area.width) // If the window will fit when placed horizontally
            minimum_area = (space.width + enums.window_spacing + window.width) * Math.max(window.height, space.height); // Set minimum area is the area if the window is placed horizontally
        else // If not, default to putting it as a child
            minimum_area = Infinity;
        for(let i = 0; i < horizontal_windows.length; i++) {
            let available = horizontal_windows[i].check_available_space(space, window);
            if(available && available < minimum_area) {// If the new area is smaller than what has been currently measured
                minimum_area = available
                parent_index = i;
            }
        }
        if(parent_index === null){
            if(space.width + enums.window_spacing + window.width > work_area.width) { // If the window cannot fit, send it to a new workspace and switch
                continue; // Undefined behavior (for now)
            }
            horizontal_windows.push(window);
            space.width += window.width + enums.window_spacing;
            space.height = Math.max(space.height, window.height);
        } else if(parent_index >= 0) {
            let parent = horizontal_windows[parent_index];
            parent.children.push(window);
            parent.total_height += window.height + enums.window_spacing;
            space.height = Math.max(space.height, parent.total_height);
        }
    }

    // TODO: Add multi-pass sorting code to get optimal shape for windows
    return {
        windows: horizontal_windows,
        space: space
    }; // Return the set of rectangle vectors and their children
}

function draw_window_vectors(meta_windows, window_vectors, work_area) {
    if(!window_vectors)
        return;
    // Draw the windows on-screen
    let windows = window_vectors.windows;
    let space = window_vectors.space;

    let x = (work_area.width - space.width) / 2 + work_area.x;
    let y = (work_area.height - space.height) / 2 + work_area.y;
    for(let window of windows) {
        move_window(meta_windows[window.index], false, x, y, window.width, window.height);
        let _y = y + window.height + enums.window_spacing;
        for(let child of window.children) {
            move_window(meta_windows[child.index], false, x, _y, child.width, child.height);
            _y += child.height + enums.window_spacing;
        }
        x += window.width + enums.window_spacing;
    }
}