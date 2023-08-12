const extension = imports.misc.extensionUtils.getCurrentExtension();
const enums = extension.imports.enums;
const windowing = extension.imports.windowing;
const reordering = extension.imports.reordering;
const drawing = extension.imports.drawing;

var masks = [];
var working_windows = [];
var tmp_swap = [];

class window_descriptor{
    constructor(meta_window, index) {
        let frame = meta_window.get_frame_rect();

        this.index = index;
        this.x = frame.x;
        this.y = frame.y;
        this.width = frame.width;
        this.height = frame.height;
        this.id = meta_window.get_id();
    }
    draw(meta_windows, x, y) {
        windowing.move_window(meta_windows[this.index],
                            false,
                            x,
                            y,
                            this.width,
                            this.height);
    }
}

function create_descriptor(meta_window, monitor, index) {
    if( windowing.is_excluded(meta_window) ||
        meta_window.get_monitor() !== monitor ||
        (meta_window.maximized_horizontally && meta_window.maximized_horizontally))
        return false;
    return new window_descriptor(meta_window, index);
}

function windows_to_descriptors(meta_windows, monitor) {
    let descriptors = [];
    for(let i = 0; i < meta_windows.length; i++) {
        let descriptor = create_descriptor(meta_windows[i], monitor, i);
        if(descriptor)
            descriptors.push(descriptor);
    }
    return descriptors;
}

function Level(work_area) {
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
    this.windows = [];
    this.work_area = work_area;
}

Level.prototype.draw_horizontal = function(meta_windows, work_area, y) {
    let x = this.x;
    for(let window of this.windows) {
        let center_offset = (work_area.height / 2 + work_area.y) - (y + window.height / 2);
        let y_offset = 0;
        if(center_offset > 0)
            y_offset = Math.min(center_offset, this.height - window.height);

        window.draw(meta_windows, x, y + y_offset);
        x += window.width + enums.window_spacing;
    }
}

function tile(windows, work_area) {
    let vertical = false;
    {
        let width = 0;
        let height = 0;
        for(let window of windows) {
            width = Math.max(window.width, width);
            height = Math.max(window.height, height);
        }
        // if(width < height)
        //     vertical = true;
    }
    let levels = [new Level(work_area)];
    let total_width = 0;
    let total_height = 0;
    let x, y;

    let overflow = false;

    if(!vertical) { // If the mode is going to be horizontal
        let window_widths = 0;
        windows.map(w => window_widths += w.width + enums.window_spacing)
        window_widths -= enums.window_spacing;

        let n_levels = Math.round(window_widths / work_area.width) + 1;
        let avg_level_width = window_widths / n_levels;
        let level = levels[0];
        let level_index = 0;
        
        for(let window of windows) { // Add windows to levels
            if(level.width + enums.window_spacing + window.width > work_area.width) { // Create a new level
                total_width = Math.max(level.width, total_width);
                total_height += level.height + enums.window_spacing;
                level.x = (work_area.width - level.width) / 2 + work_area.x;
                levels.push(new Level(work_area));
                level_index++;
                level = levels[level_index];
            }
            if( Math.max(window.height, level.height) + total_height > work_area.height || 
                window.width + level.width > work_area.width){
                overflow = true;
                continue;
            }
            level.windows.push(window);
            if(level.width !== 0)
                level.width += enums.window_spacing;
            level.width += window.width;
            level.height = Math.max(window.height, level.height);
        }
        total_width = Math.max(level.width, total_width);
        total_height += level.height;
        level.x = (work_area.width - level.width) / 2 + work_area.x;

        y = (work_area.height - total_height) / 2 + work_area.y;
    } else {
        let window_heights = 0;
        windows.map(w => window_heights += w.height + enums.window_spacing)
        window_heights -= enums.window_spacing;

        let n_levels = Math.floor(window_heights / work_area.height) + 1;
        let avg_level_height = window_heights / n_levels;
        let level = levels[0];
        let level_index = 0;
        
        for(let window of windows) { // Add windows to levels
            if(level.width > avg_level_height) { // Create a new level
                total_width = Math.max(level.width, total_width);
                total_height += level.height + enums.window_spacing;
                level.x = (work_area.width - level.width) / 2 + work_area.x;
                levels.push(new Level(work_area));
                level_index++;
                level = levels[level_index];
            }
            level.windows.push(window);
            if(level.width !== 0)
                level.width += enums.window_spacing;
            level.width += window.width;
            level.height = Math.max(window.height, level.height);
        }
        total_width = Math.max(level.width, total_width);
        total_height += level.height;
        level.x = (work_area.width - level.width) / 2 + work_area.x;

        y = (work_area.height - total_height) / 2 + work_area.y;
    }
    return {
        x: x,
        y: y,
        overflow: overflow,
        vertical: vertical,
        levels: levels
    }
}

function swap_elements (array, index1, index2) {
    if(!array[index1] || !array[index2])
        return; // Prevent making swaps for elements that do not exist
    let tmp = array[index1];
    array[index1] = array[index2];
    array[index2] = tmp;
}

function set_tmp_swap(id1, id2) {
    let index1 = null
    let index2 = null;

    for(let i = 0; i < working_windows.length; i++) {
        let window = working_windows[i];
        if(window.id === id1 && index1 === null)
            index1 = i;
        if(window.id === id2 && index2 === null)
            index2 = i;
    }
    if(index1 !== null && index2 !== null) {
        if( index1 === index2 ||
            (tmp_swap[0] === index2 && tmp_swap[1] === index1))
            return;
        tmp_swap = [index1, index2];
    } else
        console.error("Could not find both indexes for windows");
}

function clear_tmp_swap() {
    tmp_swap = [];
}

function apply_tmp_swap(workspace) {
    if(!workspace.swaps)
        workspace.swaps = [];
    if(tmp_swap.length !== 0)
        workspace.swaps.push(tmp_swap);
}

function apply_swaps(workspace, array) {
    if(workspace.swaps)
        for(let swap of workspace.swaps)
            swap_elements(array, swap[0], swap[1]);
}

function apply_tmp(array) {
    if(tmp_swap.length !== 0)
        swap_elements(array, tmp_swap[0], tmp_swap[1]);
}

function get_working_info(workspace, window, monitor) {
    if(!workspace) // Failsafe for undefined workspace
        return false;

    let current_monitor = null;
    if(window)
        current_monitor = window.get_monitor();
    else
        current_monitor = monitor;
    if(current_monitor === null || current_monitor === false)
        return false;

    let meta_windows = windowing.get_monitor_workspace_windows(workspace, current_monitor);

    // Put needed window info into an enum so it can be transferred between arrays
    let _windows = windows_to_descriptors(meta_windows, current_monitor, workspace);
    // Apply window layout swaps
    apply_swaps(workspace, _windows);
    working_windows = [];
    _windows.map(window => working_windows.push(window)); // Set working windows before tmp application
    apply_tmp(_windows);
    // Apply masks
    let windows = [];
    for(let window of _windows)
        windows.push(get_mask(window));

    let work_area = workspace.get_work_area_for_monitor(current_monitor); // Get working area for current space
    if(!work_area) return false;

    return {
        monitor: current_monitor,
        meta_windows: meta_windows,
        windows: windows,
        work_area: work_area
    }
}

function draw_tile(tile_info, work_area, meta_windows) {
    let levels = tile_info.levels;
    let _x = tile_info.x;
    let _y = tile_info.y;
    if(!tile_info.vertical) { // Horizontal tiling
        let y = _y;
        for(let level of levels) {
            level.draw_horizontal(meta_windows, work_area, y);
            y += level.height + enums.window_spacing;
        }
    } else { // Vertical
        let x = _x;
        for(let level of levels) {
            level.draw_vertical(meta_windows, x);
            x += level.width + enums.window_spacing;
        }
    }
}

class Mask{
    constructor(window) {
        this.x = window.x;
        this.y = window.y;
        this.width = window.width;
        this.height = window.height;
    }
    draw(_, x, y) {
        drawing.remove_boxes();
        drawing.rect(x, y, this.width, this.height);
    }
}

function create_mask(meta_window) {
    masks[meta_window.get_id()] = true;
}

function destroy_masks() {
    drawing.remove_boxes();
    masks = [];
}

function get_mask(window) {
    if(masks[window.id])
        return new Mask(window);
    return window;
}

function tile_workspace_windows(workspace, reference_meta_window, _monitor, keep_oversized_windows) {
    let working_info = get_working_info(workspace, reference_meta_window, _monitor);
    if(!working_info) return;
    let meta_windows = working_info.meta_windows;
    let windows = working_info.windows;
    let work_area = working_info.work_area;
    let monitor = working_info.monitor;

    let tile_info = tile(windows, work_area);
    let overflow = tile_info.overflow;
    for(let window of windowing.get_monitor_workspace_windows(workspace, monitor))
        if(window.maximized_horizontally && window.maximized_vertically)
            overflow = true;

    if(overflow && !keep_oversized_windows && reference_meta_window) { // Overflow clause
        let id = reference_meta_window.get_id();
        let _windows = windows;
        for(let i = 0; i < _windows.length; i++) {
            if(meta_windows[_windows[i].index].get_id() === id) {
                _windows.splice(i, 1);
                break;
            }
        }
        windowing.move_oversized_window(reference_meta_window);
        tile_info = tile(_windows, work_area);
    }
    draw_tile(tile_info, work_area, meta_windows);
    return overflow;
}

function window_fits(window, workspace, monitor) {
    let working_info = get_working_info(workspace, window, monitor);
    if(!working_info) return false;
    if(workspace.index() === window.get_workspace().index()) return true;

    let windows = working_info.windows;
    windows.push(new window_descriptor(window, windows.length));

    for(let window of working_info.meta_windows)
        if(window.maximized_horizontally && window.maximized_vertically)
            return false;

    return !(tile(windows, working_info.work_area).overflow);
}