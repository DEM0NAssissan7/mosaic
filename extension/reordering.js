import * as tiling from './tiling.js';
import * as windowing from './windowing.js';

var drag_start = false;
var drag_timeout;

export function cursor_distance(cursor, frame) {
    let x = cursor.x - (frame.x + frame.width / 2);
    let y = cursor.y - (frame.y + frame.height / 2);
    return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
}

export function drag(meta_window, child_frame, id, windows) {
    let workspace = meta_window.get_workspace();
    let monitor = meta_window.get_monitor();

    let _cursor = global.get_pointer();
    let cursor = {
        x: _cursor[0],
        y: _cursor[1]
    }

    let minimum_distance = Infinity;
    let target_id = null;
    for(let window of windows) {
        let distance = cursor_distance(cursor, window);
        if(distance < minimum_distance)
        {
            minimum_distance = distance;
            target_id = window.id;
        }
    }

    // Check intersection with original window position
    if(target_id === id || target_id === null)
        tiling.clear_tmp_swap();
    else
        tiling.set_tmp_swap(id, target_id);

    if(tiling.tile_workspace_windows(workspace, null, monitor)) {
        tiling.clear_tmp_swap();
        tiling.tile_workspace_windows(workspace, null, monitor)
    }

    if(drag_start)
        drag_timeout = setTimeout(() => { drag(meta_window, child_frame, id, windows); }, 50);
}

export function start_drag(meta_window) {
    let workspace = meta_window.get_workspace()
    let monitor = meta_window.get_monitor();
    let meta_windows = windowing.get_monitor_workspace_windows(workspace, monitor);
    tiling.apply_swaps(workspace, meta_windows);
    let descriptors = tiling.windows_to_descriptors(meta_windows, monitor);

    tiling.create_mask(meta_window);
    tiling.clear_tmp_swap();

    drag_start = true;
    drag(meta_window, meta_window.get_frame_rect(), meta_window.get_id(), JSON.parse(JSON.stringify(descriptors)));
}

export function stop_drag(meta_window, skip_apply) {
    let workspace = meta_window.get_workspace();
    drag_start = false;
    clearTimeout(drag_timeout);
 
    tiling.destroy_masks();
    if(!skip_apply)
        tiling.apply_tmp_swap(workspace);
    tiling.clear_tmp_swap();
    tiling.tile_workspace_windows(workspace, null, meta_window.get_monitor());
}