const extension = imports.misc.extensionUtils.getCurrentExtension();
const enums = extension.imports.enums;
const windowing = extension.imports.windowing;

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

function sort_algorithm(windows) {

}

function Level(work_area) {
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
    this.windows = [];
    this.work_area = work_area;
}

Level.prototype.draw_horizontal = function(meta_windows, y) {
    let x = this.x;
    for(let window of this.windows) {
        window.draw(meta_windows, x, y);
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
    if(!vertical) { // If the mode is going to be horizontal
        let window_widths = 0;
        windows.map(w => window_widths += w.width + enums.window_spacing)
        window_widths -= enums.window_spacing;

        let n_levels = Math.round(window_widths / work_area.width) + 1;
        let avg_level_width = window_widths / n_levels;
        let level = levels[0];
        let level_index = 0;
        
        for(let window of windows) { // Add windows to levels
            if(level.width > avg_level_width) { // Create a new level
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
        overflow: (total_width > work_area.width || total_height > work_area.height),
        vertical: vertical,
        levels: levels
    }
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

function draw_tile(tile_info, meta_windows) {
    let levels = tile_info.levels;
    let _x = tile_info.x;
    let _y = tile_info.y;
    if(!tile_info.vertical) { // Horizontal tiling
        let y = _y;
        for(let level of levels) {
            level.draw_horizontal(meta_windows, y);
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

function tile_workspace_windows(workspace, reference_meta_window, monitor, keep_oversized_windows) {
    let working_info = get_working_info(workspace, reference_meta_window, monitor);
    if(!working_info) return;
    let meta_windows = working_info.meta_windows;
    let windows = working_info.windows;
    let work_area = working_info.work_area;

    let tile_info = tile(windows, work_area);
    if(tile_info.overflow && !keep_oversized_windows && reference_meta_window) { // Overflow clause
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
    draw_tile(tile_info, meta_windows);
}

function test_window_fit(window, workspace, monitor) {
    let working_info = get_working_info(workspace, window, monitor);
    if(!working_info) return false;
    let windows = working_info.windows;
    windows.push(new window_descriptor(window, windows.length));

    return !(get_tiled_window(windows, working_info.work_area).overflow);
}