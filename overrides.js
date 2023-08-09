function create_override(workspace, victim_descriptor, replacement_descriptor) {
    if(!workspace.overrides)
        workspace.overrides = [];
    workspace.overrides[victim_descriptor.index] = replacement_descriptor;
    workspace.overrides[replacement_descriptor.index] = victim_descriptor;
}

function get_override(workspace, descriptor) {
    if(!workspace.overrides)
        return descriptor;
    else {
        let replacement = workspace.overrides[descriptor.index];
        if(replacement)
            return replacement; 
    }
    return descriptor;
}