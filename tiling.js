const extension = imports.misc.extensionUtils.getCurrentExtension();
const enums = extension.imports.enums;
const windowing = extension.imports.windowing;

var total_width = 0;
var total_height = 0;
var max_width = 0;
var max_height = 0;

var added_windows = [];

class window_descriptor{
    constructor(meta_window, index) {
        let frame = meta_window.get_frame_rect();

        this.index = index;
        this.x = 0;
        this.y = 0;
        this.width = frame.width;
        this.height = frame.height;
        this.maximized_horizontally = meta_window.maximized_horizontally;
        this.maximized_vertically = meta_window.maximized_vertically;
        this.child_far_y_limit;
        this.right_child = false;
        this.under_child = false;
    }
    check_fit_right(window) {
        let child_x = this.x + this.width + enums.window_spacing;
        if(check_collision(child_x, this.y, window.width, window.height))
            return false;
        // if(window.height > this.height)
        //     return false;
        if(child_x + window.width > max_width)
            return false;
        return true;
    }
    check_fit_under(window) {
        let child_y = this.y + this.height + enums.window_spacing;
        if(check_collision(this.x, child_y, window.width, window.height))
            return false;
        // if(window.width > this.width)
        //     return false;
        let child_far_y = child_y + window.height;
        if(child_y + window.height > max_height)
            return false;
        // if(child_far_y > this.child_far_y_limit)
        //     return false;
        return true;
    }
    check_possible_fit(window) {
        if(!this.check_fit_right(window) && !this.check_fit_under(window))
            return false;
        return true;
    }
    get_area_right(window) {
        let new_width = Math.max(this.x + this.width + enums.window_spacing + window.width, total_width);
        return new_width - total_width; // Make the windows as close to the display ratio as possible. Looks nice :)
    }
    get_area_under(window) {
        let new_height = Math.max(this.y + this.height + enums.window_spacing + window.height, total_height);
        return new_height - total_height;
    }
    draw_window(meta_windows, x_offset, y_offset) {
        windowing.move_window(meta_windows[this.index],
                            false,
                            this.x + x_offset,
                            this.y + y_offset,
                            this.width,
                            this.height);
        if(this.right_child)
            this.right_child.draw_window(meta_windows, x_offset, y_offset);
        if(this.under_child)
            this.under_child.draw_window(meta_windows, x_offset, y_offset);
    }
    add_right_child(window) {
        total_width = Math.max(this.x + this.width + enums.window_spacing + window.width, total_width);
        window.x = this.x + this.width + enums.window_spacing;
        window.y = this.y;
        this.right_child = window;
    }
    add_under_child(window) {
        total_height = Math.max(this.y + this.height + enums.window_spacing + window.height, total_height);
        window.x = this.x;
        window.y = this.y + this.height + enums.window_spacing;
        this.under_child = window;
    }
    get_optimal_handler(child_window) {
        let handler = null;
        let area = Infinity;

        if(child_window.index === this.index) {
            return {
                area: area,
                handler: handler
            };
        }

        let optimal;
        // Check the right space
        if(!this.right_child) {
            if(this.check_fit_right(child_window)) {
                area = this.get_area_right(child_window);
                handler = window => this.add_right_child(window);
            }
        } else
            optimal = this.right_child.get_optimal_handler(child_window); // Get right space optimal if there is already a right child

        // Check under space
        if(!this.under_child) { // If there is space under
            if(this.check_fit_under(child_window)) {
                let area_under = this.get_area_under(child_window);
                if(area_under < area || handler === null) { // If the area under is less than the area on the right
                    area = area_under;
                    handler = window => this.add_under_child(window);
                }
            }
        } else { // If there is a child
            let _optimal = this.under_child.get_optimal_handler(child_window); // Get the under optimal
            // Compare it to right space optimal
            if(_optimal) {
                if(!optimal)
                    optimal = _optimal;
                else if(_optimal.area < optimal.area)
                    optimal = _optimal;
            }
        }

        // Check to see if the best optimal is better than the best local area calculation
        if(optimal) {
            if(optimal.area < area) {
                area = optimal.area;
                handler = optimal.handler;
            }
        }

        return {
            area: area,
            handler: handler
        };
    }
}

function check_collision(x, y, width, height) {
    for(let window of added_windows) {
        if(window.x < x + width &&
            window.x + window.width > x &&
            window.y < y + height &&
            window.y + window.height > y
        )
            return true;
    }
    return false;
}

function advanced_sort(_windows) {
    let output_windows = [];
    let windows = _windows;
    let vertical = true;
    while(windows.length > 0) {
        let window;
        let index;
        let max = 0;
        if(vertical) {
            // Get tallest unused window
            for(let i = 0; i < windows.length; i++) {
                let _window = windows[i];
                if(_window.height > max || !max) {
                    max = _window.height;
                    index = i;
                    window = _window;
                }
            }
            vertical = false;
        } else {
            // Get longest unused window
            for(let i = 0; i < windows.length; i++) {
                let _window = windows[i];
                if(_window.width > max || !max) {
                    max = _window.width;
                    index = i;
                    window = _window;
                }
            }
            vertical = true;
        }
        output_windows.push(window);
        windows.splice(index, 1);
    }
    return output_windows;
}

// let sort_algorithm = advanced_sort;
// let sort_algorithm = windows => windows.sort((a, b) => b.width * b.height - a.width * a.height);
// let sort_algorithm = windows => windows.sort((a, b) => b.height - a.height);
let sort_algorithm = windows => windows;
// let sort_algorithm = advanced_sort;

function windows_to_descriptors(meta_windows, monitor) {
    let descriptors = [];
    for(let i = 0; i < meta_windows.length; i++) {
        let meta_window = meta_windows[i];
        // Exclusion clause: windows we do not want to tile
        if( meta_window.is_hidden() ||
            meta_window.is_attached_dialog() ||
            meta_window.window_type !== 0 ||
            meta_window.get_monitor() !== monitor
            )
            continue;
        descriptors.push(new window_descriptor(meta_window, i));
    }
    return descriptors;
}

function get_tiled_window(_windows, work_area) {
    let retval = {
        window: null,
        overflow: false
    }
    if(_windows.length === 0)
        return retval;

    let windows = sort_algorithm(_windows); // Sort through windows
    let root_window = windows[0];
    retval.window = root_window;
    
    added_windows = [root_window];
    max_width = work_area.width;
    max_height = work_area.height;
    total_width = root_window.width;
    total_height = root_window.height;
    for(let i = 1; i < windows.length; i++) {
        let window = windows[i];
        let optimal = root_window.get_optimal_handler(window);
        if(optimal.area === Infinity) {
            retval.overflow = true;
            continue;
        }
        if(optimal.handler) {
            optimal.handler(window);
        added_windows.push(window);
        }
    }
    return retval;
}

function get_working_info(workspace, window, monitor) {
    if(!workspace) // Failsafe for undefined workspace
        return false;
    let meta_windows = workspace.list_windows();
    if(meta_windows.length === 0)
        return false;

    let current_monitor = null;
    if(window)
        current_monitor = window.get_monitor();
    else
        current_monitor = monitor;

    // Put needed window info into an enum so it can be transferred between arrays
    let windows = windows_to_descriptors(meta_windows, current_monitor);
    if(windows.length === 0) return false;
    let work_area = workspace.get_work_area_for_monitor(current_monitor); // Get working area for current space

    return {
        monitor: current_monitor,
        meta_windows: meta_windows,
        windows: windows,
        work_area: work_area
    }
}

function tile_workspace_windows(workspace, reference_meta_window, monitor, keep_oversized_windows) {
    let working_info = get_working_info(workspace, reference_meta_window, monitor);
    if(!working_info) return;
    let meta_windows = working_info.meta_windows;
    let windows = working_info.windows;
    let work_area = working_info.work_area;

    let tiled_window = get_tiled_window(windows, work_area);
    if(tiled_window.overflow && !keep_oversized_windows && reference_meta_window) {
        // If the window cannot fit, get rid of the new window and redo the tile
        let id = reference_meta_window.get_id();
        let _windows = windows;
        for(let i = 0; i < _windows.length; i++) {
            if(meta_windows[_windows[i].index].get_id() === id) {
                _windows.splice(i, 1);
                break;
            }
        }
        windowing.move_oversized_window(reference_meta_window);
        tiled_window = get_tiled_window(_windows, work_area);
    }
    let x = (max_width - total_width) / 2 + work_area.x; // Get where the window should be placed
    let y = (max_height - total_height) / 2 + work_area.y;
    tiled_window.window.draw_window(meta_windows, x, y); // Draw windows
}

function test_window_fit(window, workspace, monitor) {
    let working_info = get_working_info(workspace, window, monitor);
    if(!working_info) return;
    let windows = working_info.windows;
    let work_area = working_info.work_area;
    windows.push(new window_descriptor(window, windows.length));

    return !(get_tiled_window(windows, work_area).overflow);
}